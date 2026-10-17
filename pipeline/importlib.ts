// Shared pieces for turning a state's certified candidate list into the site's race files
// (pipeline/import-ca.ts, pipeline/import-tx.ts). Each state's import reads its own list and
// handles its own quirks; matching people to Congress, the FEC, and the legislature lives here.
import fs from "node:fs";
import path from "node:path";
import { getJSON, readJSON, writeJSON } from "./lib.ts";

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ") // nicknames: "Donald P. (Don) Wagner"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const norm = (s: string) => slug(s).replace(/-/g, "");
export const lastOf = (n: string) => n.replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/i, "").trim().split(/\s+/).pop()!;
export const firstOf = (n: string) => n.trim().split(/\s+/)[0];
const byNumber = (o: object) => Object.fromEntries(Object.entries(o).sort((a, b) => Number(a[0]) - Number(b[0])));

/** Candidates from the last run, by ID, so details added by hand (bio, links, photo) are kept. */
export function previousCandidates(sd: string) {
  const f = path.join(sd, "races.json");
  const old = fs.existsSync(f) ? readJSON(f) : { statewide: {}, house: {} };
  return new Map<string, any>([...Object.values<any>(old.statewide), ...Object.values<any>(old.house)].flatMap((r) => r.candidates.map((c: any) => [c.id, c])));
}

/** A state's current members of Congress, from congress-legislators (no key). */
export async function congressMembers(state: string) {
  const all = await getJSON<any[]>("https://unitedstates.github.io/congress-legislators/legislators-current.json");
  const now = (p: any) => p.terms.at(-1);
  return {
    reps: all.filter((p) => now(p).type === "rep" && now(p).state === state),
    senators: all.filter((p) => now(p).type === "sen" && now(p).state === state),
  };
}

/** The member this candidate is: by FEC ID first, then by first and last name (never by district, which can change). */
export function memberFor(members: any[], name: string, fecId?: string) {
  const byFec = fecId && members.find((r) => r.id.fec?.includes(fecId));
  if (byFec) return byFec;
  const first = norm(firstOf(name));
  return members.find(
    (r) =>
      norm(r.name.last).endsWith(norm(lastOf(name))) && // "Diaz Barragán" ends with "Barragan"
      [r.name.first, r.name.middle, r.name.nickname].filter(Boolean).some((f: string) => norm(f).startsWith(first) || first.startsWith(norm(f))),
  );
}

/** FEC candidate IDs for a 2026 race ("H" with a district, or "S"), so campaign money fills in. */
export async function fecCandidates(state: string, office: "H" | "S", district?: string): Promise<{ id: string; name: string }[]> {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) return [];
  const u = new URL("https://api.open.fec.gov/v1/candidates/");
  u.search = new URLSearchParams({ api_key: key, state, office, election_year: "2026", per_page: "100", ...(district ? { district: district.padStart(2, "0") } : {}) }).toString();
  await new Promise((r) => setTimeout(r, 1100)); // about 60 requests a minute
  return ((await getJSON(u)).results ?? []).map((r: any) => ({ id: r.candidate_id, name: r.name }));
}

/** The one FEC ID whose last name matches ("LAST, FIRST"; a two-part last name ends with ours). */
export const fecMatch = (fec: { id: string; name: string }[], name: string) => {
  let f = fec.filter((x) => norm(x.name.split(",")[0]).endsWith(norm(lastOf(name))));
  // Two people with the same last name (Troy and Trever Nehls): the first name decides.
  if (f.length > 1) f = f.filter((x) => norm(firstOf(x.name.split(",")[1] ?? "")) === norm(firstOf(name)));
  return f.length === 1 ? f[0].id : undefined;
};

/** The state's current legislators (data/states/<code>/legislature.json), as a list. */
export function legislatorsOf(sd: string) {
  const f = path.join(sd, "legislature.json");
  const roster = fs.existsSync(f) ? readJSON(f) : { upper: {}, lower: {} };
  return {
    roster,
    list: [...Object.values<any>(roster.upper ?? {}), ...Object.values<any>(roster.lower ?? {})],
  };
}

/** A sitting state legislator with this first and last name, for linking their Open States record. */
export const legislatorFor = (list: any[], name: string) =>
  list.find((x) => x.openstates && norm(lastOf(x.name)) === norm(lastOf(name)) && norm(firstOf(x.name)) === norm(firstOf(name)));

/** A current House member's one-line background, from Congress's own records. */
export function houseBio(rep: any, district: string) {
  const terms = rep.terms.filter((t: any) => t.type === "rep");
  let i = terms.length - 1;
  const year = (d: string) => Number(d.slice(0, 4));
  while (i > 0 && year(terms[i - 1].end) >= year(terms[i].start)) i--; // back-to-back terms
  const now = String(terms.at(-1).district);
  const moved = now !== district ? ` Represents District ${now} now; the district lines changed for 2026.` : "";
  return { text: `U.S. representative since ${terms[i].start.slice(0, 4)}.${moved}`, source: { label: "Congress.gov member profile", url: `https://bioguide.congress.gov/search/bio/${rep.id.bioguide}` } };
}

/** One U.S. House candidate, with incumbent status and member links worked out fresh each run. */
export function houseCandidate(o: {
  name: string;
  party: string;
  district: string;
  old: any;
  members: any[];
  fec: { id: string; name: string }[];
  legislators: any[];
  extra?: object;
  links?: Record<string, string>;
}) {
  const { incumbent: _, ...old } = o.old ?? {};
  const { bioguide: __, openstates: ___, ...oldIds } = old.ids ?? {};
  const fecId = fecMatch(o.fec, o.name);
  const rep = memberFor(o.members, o.name, fecId);
  // A sitting state legislator running for Congress: link their Open States record, for state bills.
  // (Not for a member of Congress: Rep. Robert Garcia and Assemblymember Robert Garcia are two people.)
  const leg = !rep && legislatorFor(o.legislators, o.name);
  const ids = {
    ...oldIds,
    ...(leg ? { openstates: leg.openstates } : {}),
    ...(rep ? { bioguide: rep.id.bioguide } : {}),
    ...(fecId ? { fec: fecId } : rep?.id.fec ? { fec: rep.id.fec.at(-1) } : {}),
  };
  const bio = old.bio ?? (rep ? houseBio(rep, o.district) : undefined);
  return {
    ...old,
    id: slug(o.name),
    name: o.name,
    party: o.party,
    ...(rep ? { incumbent: true } : {}),
    ...(o.extra ?? {}),
    ...(bio ? { bio } : {}),
    links: { ...(o.links ?? {}), ...(rep?.terms.at(-1).url ? { official: rep.terms.at(-1).url } : {}), ...(old.links ?? {}) },
    ...(Object.keys(ids).length ? { ids } : {}),
  };
}

/** Write races.json and legislature-races.json, districts in number order. */
export function writeRaces(sd: string, statewide: object, house: object, legislature: { source: object; upper: object; lower: object; notes?: object }) {
  writeJSON(path.join(sd, "races.json"), { statewide, house: byNumber(house) });
  const { source, upper, lower, notes } = legislature;
  writeJSON(path.join(sd, "legislature-races.json"), { source, upper: byNumber(upper), lower: byNumber(lower), ...(notes ? { notes } : {}) });
}

/** The end-of-run summary every import prints. */
export function report(o: { statewide: object; house: Record<string, any>; legislature: { upper: object; lower: object }; reps: any[]; legislators: any[]; lowerLabel: string }) {
  const houseList = Object.values<any>(o.house).flatMap((r) => r.candidates);
  console.log(`Statewide: ${Object.keys(o.statewide).join(", ")}. U.S. House: ${Object.keys(o.house).length} districts, ${houseList.filter((c) => c.incumbent).length} current members running.`);
  console.log(`State Senate: ${Object.keys(o.legislature.upper).length}. ${o.lowerLabel}: ${Object.keys(o.legislature.lower).length}.`);
  console.log(`FEC IDs found for ${houseList.filter((c) => c.ids?.fec).length} of ${houseList.length} congressional candidates.`);
  for (const c of houseList) if (!c.ids?.fec) console.log(`  no FEC match: ${c.name} (${c.party})`);
  const running = new Set(houseList.filter((c) => c.ids?.bioguide).map((c) => c.ids.bioguide));
  const notRunning = o.reps.filter((r) => !running.has(r.id.bioguide));
  if (notRunning.length) console.log(`Current members not on the November ballot for the House: ${notRunning.map((r) => `${r.name.official_full ?? `${r.name.first} ${r.name.last}`} (${r.terms.at(-1).district})`).join(", ")}`);
  if (!o.legislators.length) console.log("No legislature roster yet: state legislators running for Congress aren't linked. Run the legislature step, then this again.");
}
