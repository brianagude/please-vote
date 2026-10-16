// Turn New York's certified candidate list into the site's race files.
//
//   python3 scripts/ny-certification.py data/states/ny/sources/<file>.pdf   (PDF -> certification.json)
//   node --env-file-if-exists=.env.local pipeline/import-ny.ts
//
// Writes data/states/ny/races.json (governor, attorney general, comptroller, U.S. House)
// and data/states/ny/legislature-races.json (State Senate and Assembly).
//
// New York lets one candidate run on several party lines ("fusion voting"), so each
// person's lines are combined: "Democrat, Working Families". Candidate details added by
// hand later (bio, career, links, photo) are kept when this runs again.
// Judicial races are left out, as in Georgia (DECISIONS #2).
import fs from "node:fs";
import path from "node:path";
import { getJSON, readJSON, stateDir, writeJSON } from "./lib.ts";

const sd = stateDir("ny");
const cert = readJSON(path.join(sd, "sources/certification.json"));
const source = { label: `New York State Board of Elections certification (${cert.dated})`, url: "https://elections.ny.gov/ballot-certifications-elections" };

// Statewide officeholders now, from the state's own sites.
const STATEWIDE_INCUMBENTS: Record<string, { last: string; source: string }> = {
  governor: { last: "Hochul", source: "https://www.governor.ny.gov/" },
  ag: { last: "James", source: "https://ag.ny.gov/" },
  comptroller: { last: "DiNapoli", source: "https://www.osc.ny.gov/" },
};

const PARTY: Record<string, string> = { Democratic: "Democrat", Republican: "Republican" };
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const norm = (s: string) => slug(s).replace(/-/g, "");
const lastOf = (n: string) => n.replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/i, "").trim().split(/\s+/).pop()!;

/** One race's party lines -> one entry per person, lines in ballot order. */
function people(lines: { party: string; name: string; lt?: string }[]) {
  const by = new Map<string, { name: string; lt?: string; parties: string[] }>();
  for (const l of lines) {
    if (!l.name) continue; // a party with no candidate in this race
    const p = by.get(l.name) ?? { name: l.name, lt: l.lt, parties: [] };
    // An independent line named after the candidate ("Karen Ortiz") reads as "Independent".
    const party = norm(l.party) === norm(l.name) ? "Independent" : PARTY[l.party] ?? l.party;
    if (!p.parties.includes(party)) p.parties.push(party);
    by.set(l.name, p);
  }
  return [...by.values()];
}

// Keep anything added by hand to a candidate (bio, links, photo...).
const oldRaces = fs.existsSync(path.join(sd, "races.json")) ? readJSON(path.join(sd, "races.json")) : { statewide: {}, house: {} };
const oldById = new Map<string, any>([...Object.values<any>(oldRaces.statewide), ...Object.values<any>(oldRaces.house)].flatMap((r) => r.candidates.map((c: any) => [c.id, c])));

// Members of Congress from New York, by district.
const congress = await getJSON<any[]>("https://unitedstates.github.io/congress-legislators/legislators-current.json");
const reps = new Map<string, any>();
for (const p of congress) {
  const t = p.terms.at(-1);
  if (t.type === "rep" && t.state === "NY") reps.set(String(t.district), p);
}

// FEC candidate IDs for 2026 U.S. House candidates, so campaign money fills in.
const fecKey = process.env.DATA_GOV_API_KEY;
async function fecIds(district: string): Promise<{ id: string; name: string }[]> {
  if (!fecKey) return [];
  const u = new URL("https://api.open.fec.gov/v1/candidates/");
  u.search = new URLSearchParams({ api_key: fecKey, state: "NY", district: district.padStart(2, "0"), office: "H", election_year: "2026", per_page: "100" }).toString();
  await new Promise((r) => setTimeout(r, 1100)); // about 60 requests a minute
  return ((await getJSON(u)).results ?? []).map((r: any) => ({ id: r.candidate_id, name: r.name }));
}

const statewide: Record<string, any> = {};
const house: Record<string, any> = {};
const legislature: any = { source, upper: {}, lower: {} };
const roster = fs.existsSync(path.join(sd, "legislature.json")) ? readJSON(path.join(sd, "legislature.json")) : { upper: {}, lower: {} };

for (const r of cert.races) {
  const list = people(r.lines);
  if (r.office.startsWith("Governor") || r.office === "Attorney General" || r.office === "Comptroller") {
    const key = r.office.startsWith("Governor") ? "governor" : r.office === "Attorney General" ? "ag" : "comptroller";
    statewide[key] = {
      candidates: list.map((p) => {
        const id = slug(p.name);
        const inc = STATEWIDE_INCUMBENTS[key].last === lastOf(p.name);
        return {
          ...(oldById.get(id) ?? {}),
          id,
          name: p.name,
          party: p.parties.join(", "),
          ...(inc ? { incumbent: true } : {}),
          ...(p.lt ? { runningMate: p.lt } : {}),
          links: oldById.get(id)?.links ?? {},
        };
      }),
    };
  } else if (r.office === "Representative in Congress") {
    const rep = reps.get(r.district);
    const fec = await fecIds(r.district);
    house[r.district] = {
      candidates: list.map((p) => {
        const id = slug(p.name);
        const old = oldById.get(id) ?? {};
        const isRep = rep && norm(rep.name.last) === norm(lastOf(p.name));
        // FEC names are "LAST, FIRST"; a two-part last name ("AVILA CHEVALIER") ends with ours.
        const f = fec.filter((x) => norm(x.name.split(",")[0]).endsWith(norm(lastOf(p.name))));
        // A sitting state legislator running for Congress: link their Open States record, for state bills.
        const leg = [...Object.values<any>(roster.upper ?? {}), ...Object.values<any>(roster.lower ?? {})].find(
          (x) => norm(lastOf(x.name)) === norm(lastOf(p.name)) && norm(x.name.split(" ")[0]) === norm(p.name.split(" ")[0]),
        );
        const ids = {
          ...(old.ids ?? {}),
          ...(leg?.openstates ? { openstates: leg.openstates } : {}),
          ...(isRep ? { bioguide: rep.id.bioguide } : {}),
          ...(f.length === 1 ? { fec: f[0].id } : isRep && rep.id.fec ? { fec: rep.id.fec.at(-1) } : {}),
        };
        // A current member's one-line background, from Congress's own records (same as Georgia's).
        let since = "";
        if (isRep) {
          const terms = rep.terms.filter((t: any) => t.type === "rep");
          let i = terms.length - 1;
          // Walk back through back-to-back terms (one ends the year the next starts).
          const year = (d: string) => Number(d.slice(0, 4));
          while (i > 0 && year(terms[i - 1].end) >= year(terms[i].start)) i--;
          since = terms[i].start.slice(0, 4);
        }
        const bio = old.bio ?? (isRep ? { text: `U.S. representative since ${since}.`, source: { label: "Congress.gov member profile", url: `https://bioguide.congress.gov/search/bio/${rep.id.bioguide}` } } : undefined);
        return {
          ...old,
          id,
          name: p.name,
          party: p.parties.join(", "),
          ...(isRep ? { incumbent: true } : {}),
          ...(bio ? { bio } : {}),
          // Current members: their official House website, from Congress's records.
          links: { ...(isRep && rep.terms.at(-1).url ? { official: rep.terms.at(-1).url } : {}), ...(old.links ?? {}) },
          ...(Object.keys(ids).length ? { ids } : {}),
        };
      }),
    };
  } else if (r.office === "State Senator" || r.office === "Member of Assembly") {
    const ch = r.office === "State Senator" ? "upper" : "lower";
    const holder = roster[ch]?.[r.district];
    legislature[ch][r.district] = list.map((p) => ({
      name: p.name,
      party: p.parties.join(", "),
      ...(holder && norm(lastOf(holder.name)) === norm(lastOf(p.name)) ? { incumbent: true } : {}),
    }));
  }
}

const n = (o: object) => Object.fromEntries(Object.entries(o).sort((a, b) => Number(a[0]) - Number(b[0])));
writeJSON(path.join(sd, "races.json"), { statewide, house: n(house) });
writeJSON(path.join(sd, "legislature-races.json"), { source, upper: n(legislature.upper), lower: n(legislature.lower) });

const all = [...Object.values<any>(statewide), ...Object.values<any>(house)].flatMap((r) => r.candidates);
console.log(`Statewide: ${Object.keys(statewide).join(", ")}. U.S. House: ${Object.keys(house).length} districts, ${all.filter((c) => c.ids?.bioguide).length} incumbents matched.`);
console.log(`State Senate: ${Object.keys(legislature.upper).length}. Assembly: ${Object.keys(legislature.lower).length}.`);
const houseList = Object.values<any>(house).flatMap((r) => r.candidates);
console.log(`FEC IDs found for ${houseList.filter((c) => c.ids?.fec).length} of ${houseList.length} congressional candidates.`);
for (const c of houseList) if (!c.ids?.fec) console.log(`  no FEC match: ${c.name} (${c.party})`);
const noRep = [...reps.keys()].filter((d) => !house[d]?.candidates.some((c: any) => c.incumbent));
if (noRep.length) console.log(`Districts where the current member isn't on the ballot: ${noRep.map((d) => `${d} (${reps.get(d).name.official_full})`).join(", ")}`);
if (!Object.keys(roster.upper ?? {}).length) console.log("No legislature roster yet: State Senate and Assembly incumbents aren't marked. Run the legislature step, then this again.");
