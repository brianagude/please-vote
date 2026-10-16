// Bills each candidate wrote, and which became law (DECISIONS #7).
//   Federal: Congress.gov /member/{bioguide}/sponsored-legislation
//   State:   Open States bulk CSV per session (first-listed primary sponsor only; no API calls
//            beyond the session list, so it doesn't use up the 250-a-day limit)
// Only measures that can become law count (bills and joint resolutions),
// introduced on or after records.since in state.json.
import fs from "node:fs";
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";
import { billInfo, gaPassage, gaSoap, type BillInfo } from "./votes.ts";
import { bulk } from "./osbulk.ts";

/** How far a bill got. "Lower" is the House in Congress and Georgia, the Assembly in New York. */
export type Status = string;
const statusOf = (house: boolean, senate: boolean, law: boolean, lower = "House", vetoed = false): Status =>
  law ? "Became law" : vetoed ? "Vetoed" : house && senate ? "Passed both chambers" : house ? `Passed the ${lower}` : senate ? "Passed the Senate" : "Introduced";
// Laws first, then the ones that got furthest.
const RANK = (s: Status) => (s === "Became law" ? 0 : s === "Vetoed" || s === "Passed both chambers" ? 1 : s === "Introduced" ? 3 : 2);
interface Bill {
  id: string;
  title: string;
  url: string;
  introduced?: string;
  status: Status;
}
const sortBills = (b: Bill[]) => b.sort((x, y) => RANK(x.status) - RANK(y.status) || (y.introduced ?? "").localeCompare(x.introduced ?? ""));

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
  /** Every bill they wrote, with how far it got. */
  all: Bill[];
  source: { label: string; url: string };
}

async function federal(bioguide: string, since: string, statusCache: { [k: string]: BillInfo }): Promise<Record> {
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
  // How far each bill got, from GovInfo's bill status files (no key).
  const all: Bill[] = [];
  for (const b of bills) {
    const info = await billInfo(b.congress, b.type, String(b.number), statusCache).catch(() => null);
    const law = info?.law ?? /Became Public Law/i.test(b.latestAction?.text ?? "");
    all.push({
      id: `${b.type === "HR" ? "H.R." : b.type === "S" ? "S." : b.type === "HJRES" ? "H.J.Res." : "S.J.Res."} ${b.number}`,
      title: b.title,
      url: `https://www.congress.gov/bill/${ordinal(b.congress)}-congress/${CONGRESS_TYPES[b.type]}/${b.number}`,
      introduced: b.introducedDate,
      status: statusOf(!!info?.passedHouse, !!info?.passedSenate, law),
    });
  }
  return {
    since,
    wrote: bills.length,
    becameLaw: laws.length,
    laws,
    all: sortBills(all),
    source: { label: "Congress.gov", url: `https://www.congress.gov/member/${bioguide}` },
  };
}

// --- state ---

// --- state ---

type StateBill = { id: string; title: string; url: string; introduced?: string; law: string | null; vetoed?: boolean; house: boolean; senate: boolean };
type SessionBills = { v: number; fetched: string; people: string[]; by: Record<string, StateBill[]> };

/**
 * Georgia marks every sponsor "primary"; the author is the one listed first. The bulk CSV has
 * no sponsor order, so read it from the General Assembly's own service ("Sequence" 1), by bill
 * ("SB 135" -> Georgia member ID).
 */
export async function gaAuthors(sessionName: string): Promise<Map<string, { author: string; act: string }>> {
  const ns = "http://www.legis.ga.gov/2009/01/01/services/";
  const sx = await gaSoap("Session", "GetSessions", `<GetSessions xmlns="${ns}"/>`);
  const sid = [...sx.matchAll(/<a:Session>([\s\S]*?)<\/a:Session>/g)].map((m) => m[1]).find((x) => x.includes(`<a:Description>${sessionName}</a:Description>`))?.match(/<a:Id>(\d+)/)?.[1];
  // By bill: the author's Georgia member ID, and the act number ("244" = became law; "V12" = vetoed).
  const out = new Map<string, { author: string; act: string }>();
  if (!sid) return out;
  for (let start = 0; ; start += 250) {
    const xml = await gaSoap("Legislation", ns.replace(/\/$/, "") + "/LegislationSearch/GetLegislationSearchResultsPaged",
      `<GetLegislationSearchResultsPaged xmlns="${ns}"><Constraints xmlns:a="http://www.legis.ga.gov/2009/01/01/data/"><a:Session><a:Id>${sid}</a:Id></a:Session></Constraints>` +
      `<PageSize>250</PageSize><StartIndex>${start}</StartIndex></GetLegislationSearchResultsPaged>`);
    const rows = [...xml.matchAll(/<a:LegislationSearchResult>([\s\S]*?)<\/a:LegislationSearchResult>/g)].map((m) => m[1]);
    for (const r of rows) {
      const num = r.match(/<a:Id>\d+<\/a:Id><a:Number>(\d+)<\/a:Number>/)?.[1];
      const type = r.match(/<a:DocumentType>([^<]*)/)?.[1];
      const first = r.match(/<a:MemberId>(\d+)<\/a:MemberId><a:Sequence>1<\/a:Sequence>/)?.[1];
      const act = r.match(/<a:ActVetoNumber>([^<]*)/)?.[1]?.trim() ?? "";
      if (num && type && first) out.set(`${type} ${num}`, { author: first, act });
    }
    if (rows.length < 250) break;
  }
  return out;
}

/** One session's bills by each tracked person, from the bulk CSV. */
export function sessionBills(
  read: (name: string) => Record<string, string>[],
  people: Set<string>,
  // Georgia: author by bill number, as a Georgia member ID, plus Georgia member ID -> Open States ID,
  // and which chamber passed each bill ("House|SB 28"), from Georgia's recorded passage votes.
  ga?: { authors: Map<string, { author: string; act: string }>; member: Map<string, string>; passed: Set<string> },
): Record<string, StateBill[]> {
  const bills = new Map(read("bills").map((b) => [b.id, b]));
  const orgs = new Map(read("organizations").map((o) => [o.id, o.classification]));
  // The author. Most states mark exactly one primary sponsor (New York does); Georgia uses its own sponsor order.
  const author = new Map<string, string>();
  if (ga) {
    for (const [id, b] of bills) {
      const m = ga.authors.get(b.identifier);
      const pid = m && ga.member.get(m.author);
      if (pid) author.set(id, pid);
    }
  } else for (const r of read("bill_sponsorships")) if (r.primary === "True" && !author.has(r.bill_id)) author.set(r.bill_id, r.person_id);
  const sources = new Map<string, string>();
  for (const r of read("bill_sources")) if (!sources.has(r.bill_id) && /^https?:/.test(r.url) && !/wsdl|Service\.svc/i.test(r.url)) sources.set(r.bill_id, r.url);
  // From each bill's official history: when it started, which chamber passed it, and whether it became law.
  const hist = new Map<string, { first?: string; house: boolean; senate: boolean; law: string | null; vetoed?: boolean }>();
  for (const a of read("bill_actions")) {
    if (!people.has(author.get(a.bill_id) ?? "")) continue;
    const h = hist.get(a.bill_id) ?? { house: false, senate: false, law: null };
    const date = a.date.slice(0, 10);
    if (!h.first || date < h.first) h.first = date;
    const cls = a.classification;
    if (cls.includes("passage")) {
      if (orgs.get(a.organization_id) === "lower") h.house = true;
      if (orgs.get(a.organization_id) === "upper") h.senate = true;
    }
    if ((cls.includes("became-law") || cls.includes("executive-signature")) && !h.law) h.law = date;
    if (cls.includes("executive-veto")) h.vetoed = true;
    hist.set(a.bill_id, h);
  }
  const by: Record<string, StateBill[]> = {};
  for (const [id, pid] of author) {
    if (!people.has(pid)) continue;
    const b = bills.get(id);
    if (!b || !(b.classification.includes("'bill'") || b.classification.includes("joint resolution"))) continue;
    const h = hist.get(id) ?? { house: false, senate: false, law: null };
    // Open States marks some Georgia actions as "passage" that weren't (e.g. a bill reported out of
    // committee, then recommitted), so in Georgia only a recorded passage vote counts.
    if (ga) [h.house, h.senate] = [ga.passed.has(`House|${b.identifier}`), ga.passed.has(`Senate|${b.identifier}`)];
    // Georgia records a veto as a "signature" in Open States; its own act number says which it was.
    if (ga) {
      const act = ga.authors.get(b.identifier)?.act ?? "";
      if (/^V/i.test(act)) [h.law, h.vetoed] = [null, true];
      else if (/^\d+$/.test(act)) h.law ??= h.first ?? "";
      else h.law = null;
    }
    if (h.vetoed) h.law = null;
    (by[pid] ??= []).push({ id: b.identifier, title: b.title, url: sources.get(id) ?? "", introduced: h.first, law: h.law, vetoed: !!h.vetoed, house: h.house, senate: h.senate });
  }
  return by;
}

async function stateBills(code: string, since: string, people: { id: string; openstates: string }[], lower: string): Promise<Record<string, Record>> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error("OPENSTATES_API_KEY is not set");
  const sd = stateDir(code);
  const today = new Date().toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  // One API request: the list of sessions and their bulk download links.
  const juris = await getJSON(`https://v3.openstates.org/jurisdictions/${code}?include=legislative_sessions`, { headers: { "X-API-KEY": key } });
  const sessions = juris.legislative_sessions.filter((s: any) => (s.end_date || today) >= since);
  const ids = people.map((p) => p.openstates);
  // Georgia: each tracked legislator's Georgia member ID, from the legis.ga.gov link Open States keeps (one request).
  let member: Map<string, string> | undefined;
  if (code === "ga") {
    const u = new URL("https://v3.openstates.org/people");
    for (const id of ids) u.searchParams.append("id", id);
    u.searchParams.append("include", "links");
    u.searchParams.set("per_page", "50");
    member = new Map();
    for (const p of (await getJSON(u, { headers: { "X-API-KEY": key } })).results ?? [])
      for (const l of p.links ?? []) {
        const m = l.url.match(/legis\.ga\.gov\/members\/(?:house|senate)\/(\d+)/i)?.[1];
        if (m) member.set(m, p.id);
      }
  }
  const data: SessionBills[] = [];
  for (const s of sessions) {
    const file = path.join(sd, `generated/cache/os-bills-${s.identifier}.json`);
    const old: SessionBills | null = fs.existsSync(file) ? readJSON(file) : null;
    // A session that ended over 30 days ago won't change, unless we now track someone new.
    if (old?.v === 4 && s.end_date && s.end_date < recent && ids.every((p) => old.people.includes(p))) {
      data.push(old);
      continue;
    }
    const url = s.downloads?.find((d: any) => /csv/.test(d.url))?.url;
    if (!url) {
      if (old) data.push(old);
      continue;
    }
    let ga;
    if (member) {
      const passed = new Set<string>();
      const vf = path.join(sd, `generated/cache/ga-votes-${s.identifier}.json`);
      if (fs.existsSync(vf))
        for (const v of Object.values<any>(readJSON(vf).votes)) if (v.result === "pass" && gaPassage(v.caption)) passed.add(`${v.chamber}|${v.bill}`);
      ga = { authors: await gaAuthors(s.name), member, passed };
    }
    const got: SessionBills = { v: 4, fetched: today, people: ids, by: sessionBills(await bulk(url), new Set(ids), ga) };
    writeJSON(file, got);
    data.push(got);
  }

  const out: Record<string, Record> = {};
  for (const p of people) {
    const mine = data.flatMap((d) => d.by[p.openstates] ?? []).filter((b) => !b.introduced || b.introduced >= since);
    const laws = mine.filter((b) => b.law).map((b) => ({ id: b.id, title: b.title, url: b.url, date: b.law! }));
    out[p.id] = {
      since,
      wrote: mine.length,
      becameLaw: laws.length,
      laws,
      all: sortBills(mine.map((b) => ({ id: b.id, title: b.title, url: b.url, introduced: b.introduced, status: statusOf(b.house, b.senate, !!b.law, lower, b.vetoed) }))),
      source: { label: "Open States", url: `https://openstates.org/person/${p.openstates.replace("ocd-person/", "")}/` },
    };
  }
  return out;
}

export async function bills(code: string) {
  const sd = stateDir(code);
  const since = readJSON(path.join(sd, "state.json")).records.since;
  const races = readJSON(path.join(sd, "races.json"));
  const file = path.join(sd, "generated/bills.json");
  const out: { [id: string]: Record } = fs.existsSync(file) ? readJSON(file) : {};
  // Federal bill status files, shared with the votes step.
  const statusFile = path.join(sd, "generated/cache/federal-bills.json");
  const statusCache: { [k: string]: BillInfo } = fs.existsSync(statusFile) ? readJSON(statusFile) : {};
  let errors = 0;

  const all = candidates(races).map(({ c }) => c);
  for (const c of all.filter((c) => c.ids?.bioguide)) {
    try {
      out[c.id] = await federal(c.ids.bioguide, since, statusCache);
    } catch (e) {
      // Keep yesterday's numbers for this person.
      errors++;
      log("bills", `${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // State legislators, all at once per session from the bulk download.
  const st = all.filter((c) => !c.ids?.bioguide && c.ids?.openstates).map((c) => ({ id: c.id, openstates: c.ids.openstates }));
  if (st.length) {
    try {
      const lower = readJSON(path.join(sd, "state.json")).districts.lower.label.replace(/^State /, "");
      Object.assign(out, await stateBills(code, since, st, lower));
    } catch (e) {
      errors++;
      log("bills", `state legislators: ${e instanceof Error ? e.message : e}`);
    }
  }
  writeJSON(statusFile, statusCache);
  const changed = writeJSON(file, out);
  log("bills", `${Object.keys(out).length} candidates${changed ? " (updated)" : ""}`);
  if (errors) throw new Error(`${errors} candidate(s) failed`);
}
