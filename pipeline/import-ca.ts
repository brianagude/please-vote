// Turn California's Certified List of Candidates into the site's race files.
//
//   python3 scripts/ca-certification.py data/states/ca/sources/cert-list-candidates.pdf   (PDF -> certification.json)
//   node --env-file-if-exists=.env.local pipeline/import-ca.ts
//
// Writes data/states/ca/races.json (statewide offices, U.S. House)
// and data/states/ca/legislature-races.json (State Senate and Assembly).
//
// California's primary sends the top two to November whatever their party, so most races
// have exactly two candidates. The list marks statewide and legislature incumbents with *,
// but not U.S. House members (the districts were redrawn for 2026, and some members run in a
// new district number), so those come from Congress's own records. Candidate details added
// by hand later (bio, career, links, photo) are kept when this runs again.
// Each candidate's ballot designation (the job title printed under their name) is shown as "On the ballot as".
// Board of Equalization races and judges are left out for now (see docs/ROADMAP.md).
import fs from "node:fs";
import path from "node:path";
import { getJSON, readJSON, stateDir, writeJSON } from "./lib.ts";

const sd = stateDir("ca");
const cert = readJSON(path.join(sd, "sources/certification.json"));
const source = {
  label: `California Secretary of State, Certified List of Candidates (${cert.dated})`,
  url: "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026",
};

const STATEWIDE: Record<string, string> = {
  Governor: "governor",
  "Lieutenant Governor": "ltgov",
  "Secretary of State": "sos",
  Controller: "controller",
  Treasurer: "treasurer",
  "Attorney General": "ag",
  "Insurance Commissioner": "ins",
  "Superintendent of Public Instruction": "schools",
};
const PARTY: Record<string, string> = {
  Democratic: "Democrat",
  Republican: "Republican",
  "No Party Preference": "No party preference",
  "Non-Partisan": "Nonpartisan",
};
const party = (p: string) => PARTY[p] ?? p;
/** The job title printed under their name on the ballot, as a sourced fact. */
const ballotAs = (p: any) => (p.designation && p.designation !== "No Ballot Designation" ? { ballotAs: { text: p.designation, source } } : {});

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ") // nicknames: "Donald P. (Don) Wagner"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const norm = (s: string) => slug(s).replace(/-/g, "");
const lastOf = (n: string) => n.replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/i, "").trim().split(/\s+/).pop()!;
const firstOf = (n: string) => n.trim().split(/\s+/)[0];

// Keep anything added by hand to a candidate (bio, links, photo...).
const oldRaces = fs.existsSync(path.join(sd, "races.json")) ? readJSON(path.join(sd, "races.json")) : { statewide: {}, house: {} };
const oldById = new Map<string, any>([...Object.values<any>(oldRaces.statewide), ...Object.values<any>(oldRaces.house)].flatMap((r) => r.candidates.map((c: any) => [c.id, c])));

// California's current members of Congress, matched by name (not district: the numbers changed).
const congress = await getJSON<any[]>("https://unitedstates.github.io/congress-legislators/legislators-current.json");
const reps = congress.filter((p) => p.terms.at(-1).type === "rep" && p.terms.at(-1).state === "CA");
/** The current member this candidate is, by FEC ID first, then by first and last name. */
const repFor = (name: string, fecId?: string) => {
  const byFec = fecId && reps.find((r) => r.id.fec?.includes(fecId));
  if (byFec) return byFec;
  const first = norm(firstOf(name));
  return reps.find(
    (r) =>
      norm(r.name.last).endsWith(norm(lastOf(name))) && // "Diaz Barragán" ends with "Barragan"
      [r.name.first, r.name.middle, r.name.nickname].filter(Boolean).some((f: string) => norm(f).startsWith(first) || first.startsWith(norm(f))),
  );
};

// FEC candidate IDs for 2026 U.S. House candidates, so campaign money fills in.
const fecKey = process.env.DATA_GOV_API_KEY;
async function fecIds(district: string): Promise<{ id: string; name: string }[]> {
  if (!fecKey) return [];
  const u = new URL("https://api.open.fec.gov/v1/candidates/");
  u.search = new URLSearchParams({ api_key: fecKey, state: "CA", district: district.padStart(2, "0"), office: "H", election_year: "2026", per_page: "100" }).toString();
  await new Promise((r) => setTimeout(r, 1100)); // about 60 requests a minute
  return ((await getJSON(u)).results ?? []).map((r: any) => ({ id: r.candidate_id, name: r.name }));
}

const roster = fs.existsSync(path.join(sd, "legislature.json")) ? readJSON(path.join(sd, "legislature.json")) : { upper: {}, lower: {} };
const legislators = [...Object.values<any>(roster.upper ?? {}), ...Object.values<any>(roster.lower ?? {})];

const legislatorFor = (name: string) => legislators.find((x) => x.openstates && norm(lastOf(x.name)) === norm(lastOf(name)) && norm(firstOf(x.name)) === norm(firstOf(name)));

const statewide: Record<string, any> = {};
const house: Record<string, any> = {};
const legislature: any = { source, upper: {}, lower: {} };

for (const r of cert.races) {
  if (STATEWIDE[r.office]) {
    statewide[STATEWIDE[r.office]] = {
      candidates: r.candidates.map((p: any) => {
        const id = slug(p.name);
        const old = oldById.get(id) ?? {};
        const { incumbent: _, ids: oldIds, ...kept } = old; // incumbent always from the list, never kept from last time
        // A sitting state legislator running statewide: link their Open States record, for state bills and votes.
        const leg = legislatorFor(p.name);
        const { openstates: __, ...restIds } = oldIds ?? {};
        const ids = { ...restIds, ...(leg ? { openstates: leg.openstates } : {}) };
        return {
          ...kept,
          id,
          name: p.name,
          party: party(p.party),
          ...(p.incumbent ? { incumbent: true } : {}),
          ...ballotAs(p),
          links: old.links ?? {},
          ...(Object.keys(ids).length ? { ids } : {}),
        };
      }),
    };
  } else if (r.office === "United States Representative") {
    const fec = await fecIds(r.district);
    house[r.district] = {
      candidates: r.candidates.map((p: any) => {
        const id = slug(p.name);
        // Incumbent status and the member link are worked out fresh each time, never kept from last time.
        const { incumbent: _, ...old } = oldById.get(id) ?? {};
        const { bioguide: __, openstates: ___, ...oldIds } = old.ids ?? {};
        // FEC names are "LAST, FIRST"; a two-part last name ends with ours.
        const f = fec.filter((x) => norm(x.name.split(",")[0]).endsWith(norm(lastOf(p.name))));
        const rep = repFor(p.name, f.length === 1 ? f[0].id : undefined);
        // A sitting state legislator running for Congress: link their Open States record, for state bills.
        // (Not for a member of Congress: Rep. Robert Garcia and Assemblymember Robert Garcia are two people.)
        const leg = !rep && legislatorFor(p.name);
        const ids = {
          ...oldIds,
          ...(leg ? { openstates: leg.openstates } : {}),
          ...(rep ? { bioguide: rep.id.bioguide } : {}),
          ...(f.length === 1 ? { fec: f[0].id } : rep?.id.fec ? { fec: rep.id.fec.at(-1) } : {}),
        };
        let bio = old.bio;
        if (!bio && rep) {
          const terms = rep.terms.filter((t: any) => t.type === "rep");
          let i = terms.length - 1;
          const year = (d: string) => Number(d.slice(0, 4));
          while (i > 0 && year(terms[i - 1].end) >= year(terms[i].start)) i--;
          const now = String(terms.at(-1).district);
          const moved = now !== r.district ? ` Represents District ${now} now; the district lines changed for 2026.` : "";
          bio = { text: `U.S. representative since ${terms[i].start.slice(0, 4)}.${moved}`, source: { label: "Congress.gov member profile", url: `https://bioguide.congress.gov/search/bio/${rep.id.bioguide}` } };
        }
        return {
          ...old,
          id,
          name: p.name,
          party: party(p.party),
          ...(rep ? { incumbent: true } : {}),
          ...ballotAs(p),
          ...(bio ? { bio } : {}),
          links: { ...(rep?.terms.at(-1).url ? { official: rep.terms.at(-1).url } : {}), ...(old.links ?? {}) },
          ...(Object.keys(ids).length ? { ids } : {}),
        };
      }),
    };
  } else if (r.office === "State Senate" || r.office === "State Assembly Member") {
    const ch = r.office === "State Senate" ? "upper" : "lower";
    legislature[ch][r.district] = r.candidates.map((p: any) => ({ name: p.name, party: party(p.party), ...(p.incumbent ? { incumbent: true } : {}), ...ballotAs(p) }));
  }
}

const n = (o: object) => Object.fromEntries(Object.entries(o).sort((a, b) => Number(a[0]) - Number(b[0])));
writeJSON(path.join(sd, "races.json"), { statewide, house: n(house) });
writeJSON(path.join(sd, "legislature-races.json"), { source, upper: n(legislature.upper), lower: n(legislature.lower) });

const houseList = Object.values<any>(house).flatMap((r) => r.candidates);
console.log(`Statewide: ${Object.keys(statewide).join(", ")}. U.S. House: ${Object.keys(house).length} districts, ${houseList.filter((c) => c.incumbent).length} current members running.`);
console.log(`State Senate: ${Object.keys(legislature.upper).length}. Assembly: ${Object.keys(legislature.lower).length}.`);
console.log(`FEC IDs found for ${houseList.filter((c) => c.ids?.fec).length} of ${houseList.length} congressional candidates.`);
for (const c of houseList) if (!c.ids?.fec) console.log(`  no FEC match: ${c.name} (${c.party})`);
const running = new Set(houseList.filter((c) => c.ids?.bioguide).map((c) => c.ids.bioguide));
const notRunning = reps.filter((r) => !running.has(r.id.bioguide));
if (notRunning.length) console.log(`Current members not on the November ballot for the House: ${notRunning.map((r) => `${r.name.official_full} (${r.terms.at(-1).district})`).join(", ")}`);
if (!legislators.length) console.log("No legislature roster yet: state legislators running for Congress aren't linked. Run the legislature step, then this again.");
