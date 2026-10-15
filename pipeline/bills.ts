// Bills each candidate wrote, and which became law (DECISIONS #7).
//   Federal: Congress.gov /member/{bioguide}/sponsored-legislation
//   State:   Open States v3 /bills?sponsor=... (first-listed sponsor only)
// Only measures that can become law count (bills and joint resolutions),
// introduced on or after records.since in state.json.
import fs from "node:fs";
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const CONGRESS_TYPES: Record<string, string> = {
  HR: "house-bill",
  S: "senate-bill",
  HJRES: "house-joint-resolution",
  SJRES: "senate-joint-resolution",
};
const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

interface Law {
  id: string;
  title: string;
  url: string;
  date?: string;
}
interface Record {
  since: string;
  wrote: number;
  becameLaw: number;
  laws: Law[];
  source: { label: string; url: string };
}

async function federal(bioguide: string, since: string): Promise<Record> {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY is not set");
  const items: any[] = [];
  // Newest first; stop once we're past the start date.
  for (let offset = 0; ; offset += 250) {
    const u = new URL(`https://api.congress.gov/v3/member/${bioguide}/sponsored-legislation`);
    u.search = new URLSearchParams({ api_key: key, format: "json", limit: "250", offset: String(offset) }).toString();
    const d = await getJSON(u);
    const page = d.sponsoredLegislation ?? [];
    items.push(...page);
    if (page.length < 250 || page.some((b: any) => b.introducedDate < since)) break;
  }
  const bills = items.filter((b) => b.type && CONGRESS_TYPES[b.type] && b.introducedDate >= since);
  const laws = bills
    .filter((b) => /Became Public Law/i.test(b.latestAction?.text ?? ""))
    .map((b) => ({
      id: `${b.type === "HR" ? "H.R." : b.type === "S" ? "S." : b.type} ${b.number}`,
      title: b.title,
      url: `https://www.congress.gov/bill/${ordinal(b.congress)}-congress/${CONGRESS_TYPES[b.type]}/${b.number}`,
      date: b.latestAction?.actionDate,
    }));
  return {
    since,
    wrote: bills.length,
    becameLaw: laws.length,
    laws,
    source: { label: "Congress.gov", url: `https://www.congress.gov/member/${bioguide}` },
  };
}

// --- state ---

type SessionCache = { [session: string]: { fetched: string; bills: any[] } };

async function osGet(params: Record<string, string | string[]>) {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error("OPENSTATES_API_KEY is not set");
  const u = new URL("https://v3.openstates.org/bills");
  for (const [k, v] of Object.entries(params)) for (const x of [v].flat()) u.searchParams.append(k, x);
  // The free tier is rate-limited; pace requests.
  await new Promise((r) => setTimeout(r, 6500));
  return getJSON(u, { headers: { "X-API-KEY": key } });
}

async function state(code: string, personId: string, since: string, cacheFile: string): Promise<Record> {
  const today = new Date().toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const juris = await getJSON(`https://v3.openstates.org/jurisdictions/${code}?include=legislative_sessions`, {
    headers: { "X-API-KEY": process.env.OPENSTATES_API_KEY ?? "" },
  });
  const sessions = juris.legislative_sessions.filter((s: any) => (s.end_date || today) >= since);
  const cache: SessionCache = fs.existsSync(cacheFile) ? readJSON(cacheFile) : {};

  for (const s of sessions) {
    // A session that ended more than 30 days ago won't change; reuse it.
    if (cache[s.identifier] && s.end_date && s.end_date < recent) continue;
    const bills: any[] = [];
    for (let page = 1; ; page++) {
      const d = await osGet({ jurisdiction: code, session: s.identifier, sponsor: personId, per_page: "20", page: String(page), include: ["sponsorships", "actions"] });
      for (const b of d.results) {
        // Georgia lists many "primary" sponsors; the first one listed is the author.
        const lead = b.sponsorships?.find((x: any) => x.primary) ?? b.sponsorships?.[0];
        if (lead?.person?.id !== personId) continue;
        if (!b.classification?.includes("bill") && !b.classification?.includes("joint resolution")) continue;
        const law = b.actions?.find((a: any) => a.classification?.some((c: string) => c === "became-law" || c === "executive-signature"));
        bills.push({ id: b.identifier, title: b.title, url: b.openstates_url, introduced: b.first_action_date, law: law?.date?.slice(0, 10) ?? null });
      }
      if (page >= d.pagination.max_page) break;
    }
    cache[s.identifier] = { fetched: today, bills };
  }
  writeJSON(cacheFile, cache);

  const person = (await getJSON(`https://v3.openstates.org/people?id=${encodeURIComponent(personId)}`, { headers: { "X-API-KEY": process.env.OPENSTATES_API_KEY ?? "" } })).results?.[0];
  const bills = Object.values(cache).flatMap((s) => s.bills).filter((b) => !b.introduced || b.introduced >= since);
  const laws = bills.filter((b) => b.law).map((b) => ({ id: b.id, title: b.title, url: b.url, date: b.law }));
  return {
    since,
    wrote: bills.length,
    becameLaw: laws.length,
    laws,
    source: { label: "Open States", url: person?.openstates_url ?? "https://openstates.org/ga/" },
  };
}

export async function bills(code: string) {
  const sd = stateDir(code);
  const since = readJSON(path.join(sd, "state.json")).records.since;
  const races = readJSON(path.join(sd, "races.json"));
  const file = path.join(sd, "generated/bills.json");
  const out: { [id: string]: Record } = fs.existsSync(file) ? readJSON(file) : {};
  let errors = 0;

  for (const { c } of candidates(races)) {
    try {
      if (c.ids?.bioguide) out[c.id] = await federal(c.ids.bioguide, since);
      else if (c.ids?.openstates) out[c.id] = await state(code, c.ids.openstates, since, path.join(sd, `generated/cache/openstates-bills-${c.id}.json`));
    } catch (e) {
      // Keep yesterday's numbers for this person.
      errors++;
      log("bills", `${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  const changed = writeJSON(file, out);
  log("bills", `${Object.keys(out).length} candidates${changed ? " (updated)" : ""}`);
  if (errors) throw new Error(`${errors} candidate(s) failed`);
}
