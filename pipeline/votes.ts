// How each officeholder voted, and how often they didn't vote (DECISIONS #4 and #7).
//
// Which votes count (DECISIONS #4): final-passage votes on bills and joint
// resolutions that passed at least one chamber, since records.since in state.json.
// That means passage, agreeing to the other chamber's changes, conference reports,
// and veto overrides. Not amendments, procedural motions, cloture, or nominations.
//
//   U.S. House and Senate: Voteview (UCLA) roll-call CSVs (no key). They republish the
//     official House Clerk and Senate records, which block automated downloads.
//   Federal bill topics and status: GovInfo BILLSTATUS XML (no key; Congress.gov "policy area")
//   Georgia General Assembly:
//     who voted how:   Open States bulk CSV per session (the votes, with Open States person IDs)
//     what each vote was: the General Assembly's own vote service (webservices.legis.ga.gov).
//     Open States labels every Georgia vote "passage", including amendment votes,
//     so we read the real caption ("PASSAGE BY SUBSTITUTE", "ADOPTION OF AMENDMENT #1") from Georgia.
//
// "Didn't vote" = not voting, excused, or absent. Attendance counts every recorded
// vote in the window, not just the ones listed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { candidates, get, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

export type Cast = "Yes" | "No" | "Present" | "Excused" | "Didn't vote";

/** A bill that someone voted on. Stored once and shared by everyone who voted on it. */
export interface BillRef {
  bill: string;
  title: string;
  url: string;
  /** Congress.gov gives one "policy area"; Georgia can give several subjects, so a bill may sit under more than one topic. */
  topics: string[];
  law?: boolean;
}
/** One vote, kept short because there are thousands: [bill key, date, chamber, what the vote was, how they voted, did it pass (1/0)]. */
export type VoteTuple = [string, string, string, string, Cast, 0 | 1];
export interface VoteRecord {
  since: string;
  /** missed counts every vote they didn't cast; excused is the part of that the chamber excused (Georgia only). */
  attendance: { missed: number; excused: number; total: number };
  votes: VoteTuple[];
  source: { label: string; url: string }[];
}
export interface VotesFile {
  bills: Record<string, BillRef>;
  people: Record<string, VoteRecord>;
}
type Row = { key: string; ref: BillRef; date: string; chamber: string; what: string; vote: Cast; passed: boolean };

/** Newest first; bill details go into the shared table. */
function pack(rows: Row[], bills: Record<string, BillRef>): VoteTuple[] {
  return rows
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      bills[r.key] = r.ref;
      return [r.key, r.date, r.chamber, r.what, r.vote, r.passed ? 1 : 0];
    });
}

// ---------- which votes count ----------

const FED_TYPES: Record<string, { slug: string; label: string; gov: string }> = {
  HR: { slug: "house-bill", label: "H.R.", gov: "hr" },
  S: { slug: "senate-bill", label: "S.", gov: "s" },
  HJRES: { slug: "house-joint-resolution", label: "H.J.Res.", gov: "hjres" },
  SJRES: { slug: "senate-joint-resolution", label: "S.J.Res.", gov: "sjres" },
};

/** "H R 3424", "S.J.Res. 7", "H.J.Res.12" → { type: "HJRES", number: "12" }; null for simple/concurrent resolutions. */
export function fedBill(s: string | undefined): { type: string; number: string } | null {
  const m = (s ?? "").toUpperCase().replace(/[.\s]/g, "").match(/^(HR|S|HJRES|SJRES)(\d+)$/);
  return m ? { type: m[1], number: m[2] } : null;
}

/** House clerk vote-question that is a final-passage-type vote. */
export function housePassage(q: string): string | null {
  const s = q.trim();
  if (/Overrid|Objections of the President/i.test(s)) return "Veto override";
  if (/Conference Report/i.test(s)) return "Final version (conference report)";
  if (/Concur/i.test(s)) return "Agree to the Senate's changes";
  if (/^On (Motion to Suspend the Rules and )?Pass/i.test(s)) return "Passage";
  return null;
}

/** Senate question + title that is a final-passage-type vote. */
export function senatePassage(q: string, title = ""): string | null {
  const s = q.trim();
  if (/Overrid/i.test(s)) return "Veto override";
  if (/Conference Report/i.test(s)) return "Final version (conference report)";
  if (/^On Passage of the Bill$|^On the Joint Resolution$|^On the Bill$/i.test(s)) return "Passage";
  if (/^On the Motion( to Concur)?$/i.test(s) && /Concur/i.test(title) && !/Cloture|Table|Waive|Point of Order/i.test(title))
    return "Agree to the House's changes";
  return null;
}

/** Georgia General Assembly caption that is a final-passage-type vote. */
export function gaPassage(caption: string): string | null {
  const c = caption.trim().toUpperCase();
  if (/AMEND(MENT)?\s*#|ADOPTION OF AMEND|LOCAL|ROLL CALL|ATTENDANCE|MOTION|RECONSIDER|TABLE|TRANSMIT|ENGROSS|PREVIOUS QUESTION/.test(c)) return null;
  if (/OVERRIDE|VETO/.test(c)) return "Veto override";
  if (/CONFERENCE/.test(c)) return "Final version (conference report)";
  if (/^AGREE/.test(c)) return "Agree to the other chamber's changes";
  if (/^PASSAGE|^ADOPT/.test(c)) return "Passage";
  return null;
}

const cast = (v: string): Cast => {
  const s = v.trim().toLowerCase();
  if (s === "yea" || s === "aye" || s === "yes") return "Yes";
  if (s === "nay" || s === "no") return "No";
  if (s === "present") return "Present";
  if (s === "excused") return "Excused";
  return "Didn't vote";
};

// ---------- small helpers ----------

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? "";
const unxml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");
const congressOf = (year: number) => Math.floor((year - 1789) / 2) + 1;

async function text(url: string, init?: RequestInit) {
  // Some government sites answer 403 when we go too fast; back off and retry.
  for (let i = 0; ; i++) {
    const res = await get(url, init);
    if (res.status !== 403 || i >= 4) return { ok: res.ok, status: res.status, body: await res.text() };
    await new Promise((r) => setTimeout(r, 15_000 * 2 ** i));
  }
}

/** Run fn over items with a few at a time. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/** Minimal RFC 4180 CSV parser (quoted fields may hold commas and newlines). */
export function parseCSV(s: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// ---------- U.S. House and Senate ----------
// The House Clerk and senate.gov block automated downloads, so we use Voteview (UCLA),
// which republishes every official roll call as CSV, with each member's bioguide ID.

type FedVote = { date: string; q: string; title: string; bill: string; result: string; ga: Record<string, string> };
type Cache = { [n: string]: FedVote };

const VV_CAST: Record<string, string> = { "1": "Yea", "2": "Yea", "3": "Yea", "4": "Nay", "5": "Nay", "6": "Nay", "7": "Present", "8": "Present", "9": "Not Voting" };

async function voteview(chamber: "House" | "Senate", congress: number, cacheDir: string, done: boolean): Promise<Cache> {
  const file = path.join(cacheDir, `${chamber.toLowerCase()}-votes-${congress}.json`);
  const cache: { complete?: boolean; votes: Cache } = fs.existsSync(file) ? readJSON(file) : { votes: {} };
  if (cache.complete) return cache.votes;
  const csv = async (kind: string) => {
    const url = `https://voteview.com/static/data/out/${kind}/${chamber[0]}${congress}_${kind}.csv`;
    const { ok, status, body } = await text(url);
    if (!ok) throw new Error(`Voteview ${chamber[0]}${congress} ${kind}: HTTP ${status}`);
    return parseCSV(body);
  };
  const ga: Record<string, string> = {};
  for (const m of await csv("members")) if (m.chamber === chamber && m.state_abbrev === "GA" && m.bioguide_id) ga[m.icpsr] = m.bioguide_id;
  const votes: Cache = {};
  const byRoll: Record<string, FedVote> = {};
  for (const r of await csv("rollcalls")) {
    // Key by year and the chamber's own roll-call number ("2025-105"); Voteview numbers across the whole Congress.
    const v = { date: r.date, q: r.vote_question, title: r.vote_desc, bill: r.bill_number, result: r.vote_result, ga: {} };
    votes[`${r.date.slice(0, 4)}-${r.clerk_rollnumber}`] = byRoll[r.rollnumber] = v;
  }
  for (const v of await csv("votes")) {
    const who = ga[v.icpsr];
    if (who && byRoll[v.rollnumber] && VV_CAST[v.cast_code]) byRoll[v.rollnumber].ga[who] = VV_CAST[v.cast_code];
  }
  writeJSON(file, { complete: done, votes });
  return votes;
}

// ---------- federal bill details (topic, title, status) ----------

type BillInfo = {
  title: string;
  topic: string;
  passedHouse: boolean;
  passedSenate: boolean;
  law: boolean;
  /** Senate record votes ("2025-105") where the Senate agreed to the House's changes. */
  senateConcur: string[];
  fetched: string;
  v?: number;
};

async function billInfo(congress: number, type: string, number: string, cache: Record<string, BillInfo>): Promise<BillInfo | null> {
  const key = `${congress}-${type}-${number}`;
  const old = cache[key];
  const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  // Laws don't change; anything else is re-checked weekly.
  if (old?.v === 2 && (old.law || old.fetched >= week)) return old;
  const t = FED_TYPES[type].gov;
  const { ok, body } = await text(`https://www.govinfo.gov/bulkdata/BILLSTATUS/${congress}/${t}/BILLSTATUS-${congress}${t}${number}.xml`);
  if (!ok) return old ?? null;
  const items = [...body.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const actions = items.map((i) => tag(i, "text"));
  const senateConcur = items
    .map((i) => ({ text: tag(i, "text"), date: tag(i, "actionDate") }))
    .filter((a) => /concur|agreed to the House amendment/i.test(a.text) && /Senate/i.test(a.text))
    .flatMap((a) => [...a.text.matchAll(/Record Vote (?:Number|No)[.:]?\s*(\d+)/gi)].map((m) => `${a.date.slice(0, 4)}-${m[1]}`));
  cache[key] = {
    // The bill's own "Display Title"; other <title>s in the file belong to related bills.
    title: unxml(body.match(/<titleType>Display Title<\/titleType>[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1] ?? tag(body, "title")).replace(/^(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.) \d+, /, ""),
    v: 2,
    topic: unxml(tag(tag(body, "policyArea"), "name")) || "Other",
    passedHouse: actions.some((a) => /Passed\/agreed to in House|passed House/i.test(a)),
    passedSenate: actions.some((a) => /Passed\/agreed to in Senate|passed Senate/i.test(a)),
    law: actions.some((a) => /Became Public Law|Became Private Law/i.test(a)),
    senateConcur: [...new Set(senateConcur)],
    fetched: new Date().toISOString().slice(0, 10),
  };
  return cache[key];
}

async function federal(code: string, since: string, people: { id: string; bioguide: string }[]) {
  const sd = stateDir(code);
  const cacheDir = path.join(sd, "generated/cache");
  const year = new Date().getFullYear();
  const start = Number(since.slice(0, 4));

  const rolls: { chamber: "House" | "Senate"; congress: number; n: string; v: FedVote; ga: Record<string, string> }[] = [];
  for (let c = congressOf(start); c <= congressOf(year); c++)
    for (const chamber of ["House", "Senate"] as const) {
      const got = await voteview(chamber, c, cacheDir, c < congressOf(year));
      for (const [n, v] of Object.entries(got)) rolls.push({ chamber, congress: c, n, v, ga: v.ga });
    }
  log("votes", `federal: ${rolls.length} roll calls since ${since}`);

  // Bill details only for passage-type votes.
  const billsFile = path.join(cacheDir, "federal-bills.json");
  const bills: Record<string, BillInfo> = fs.existsSync(billsFile) ? readJSON(billsFile) : {};
  // Voteview only says "On the Motion" for some Senate votes. The bill's history
  // says which Senate record vote agreed to the House's changes.
  const maybeConcur = (r: { chamber: string; v: FedVote }) => r.chamber === "Senate" && /^On the Motion$/i.test(r.v.q.trim());
  const candidatesForBills = rolls
    .filter((r) => r.v.date >= since)
    .map((r) => ({ ...r, what: r.chamber === "House" ? housePassage(r.v.q) : senatePassage(r.v.q, r.v.title), b: fedBill(r.v.bill) }))
    .filter((r) => r.b && (r.what || maybeConcur(r)));
  const keys = [...new Map(candidatesForBills.map((r) => [`${r.congress}-${r.b!.type}-${r.b!.number}`, r])).values()];
  await pool(keys, 6, async (r) => void (await billInfo(r.congress, r.b!.type, r.b!.number, bills)));
  writeJSON(billsFile, bills);
  const passage = candidatesForBills
    .map((r) => {
      if (r.what || !maybeConcur(r)) return r;
      const info = bills[`${r.congress}-${r.b!.type}-${r.b!.number}`];
      return info?.senateConcur.includes(r.n) ? { ...r, what: "Agree to the House's changes" } : r;
    })
    .filter((r) => r.what);

  const out: VotesFile = { bills: {}, people: {} };
  for (const p of people) {
    let total = 0, missed = 0;
    for (const r of rolls) {
      if (r.v.date < since || !(p.bioguide in r.ga)) continue;
      total++;
      if (cast(r.ga[p.bioguide]) === "Didn't vote") missed++;
    }
    if (!total) continue;
    const rows: Row[] = [];
    for (const r of passage) {
      if (!(p.bioguide in r.ga)) continue;
      const info = bills[`${r.congress}-${r.b!.type}-${r.b!.number}`];
      if (!info || !(info.passedHouse || info.passedSenate || info.law)) continue; // DECISIONS #4: passed at least one chamber
      const t = FED_TYPES[r.b!.type];
      rows.push({
        key: `us-${r.congress}-${r.b!.type}-${r.b!.number}`,
        ref: {
          bill: `${t.label} ${r.b!.number}`,
          title: info.title || r.v.title,
          url: `https://www.congress.gov/bill/${ordinal(r.congress)}-congress/${t.slug}/${r.b!.number}`,
          topics: [info.topic],
          ...(info.law ? { law: true } : {}),
        },
        date: r.v.date,
        chamber: r.chamber,
        what: r.what!,
        vote: cast(r.ga[p.bioguide]),
        passed: /Passed|Agreed|Overrid/i.test(r.v.result) && !/Not|Rejected|Failed/i.test(r.v.result),
      });
    }
    out.people[p.id] = {
      since,
      attendance: { missed, excused: 0, total },
      votes: pack(rows, out.bills),
      source: [
        { label: "Congress.gov", url: `https://www.congress.gov/member/${p.bioguide}` },
        { label: "Voteview (UCLA)", url: "https://voteview.com/" },
      ],
    };
  }
  return out;
}

// ---------- Georgia General Assembly ----------

const GA_SVC = "http://webservices.legis.ga.gov/GGAServices";
async function gaSoap(service: string, action: string, body: string) {
  const res = await get(`${GA_SVC}/${service}/Service.svc`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${action}"` },
    body: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`,
  });
  if (!res.ok) throw new Error(`legis.ga.gov ${service}: HTTP ${res.status}`);
  return res.text();
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(And|Of|The|For|To|In)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());

/** Georgia's local acts are titled "Savannah, City of; ..." or "Cobb County; ...". */
const isLocal = (title: string) => /^[^;]*(, City of|, Town of|County|Consolidated Government)[^;]*;/.test(title);

type GaVote = { chamber: string; num: string; date: string; caption: string; bill: string; billTitle: string; topics: string[]; url: string; result: string };
type GaSession = { v?: number; fetched: string; people: string[]; votes: Record<string, GaVote>; cast: Record<string, Record<string, string>> };
type GaPerson = { openstates: string; last: string; district: string; chamber: string };

const ordinalUpper = (d: string) => ordinal(Number(d)).toUpperCase();

/**
 * Open States can't always tell two members with the same last name apart
 * (David Clark and Jasmine Clark in the House are both just "CLARK").
 * Georgia's own record names them "CLARK, 100TH" and "CLARK, 108TH",
 * so for anyone Open States didn't match we read each vote from Georgia.
 */
/** How each member voted on one Georgia vote, by Georgia's own name for them ("CLARK, 108TH"). */
async function gaMembers(voteId: number) {
  const xml = await gaSoap("Votes", "http://www.legis.ga.gov/2009/01/01/services/VoteFinder/GetVote",
    `<GetVote xmlns="http://www.legis.ga.gov/2009/01/01/services/"><VoteId>${voteId}</VoteId></GetVote>`).catch(() => "");
  return [...xml.matchAll(/<a:Name>([^<]*)<\/a:Name><\/a:Member><a:MemberVoted>([^<]*)</g)].map((m) => ({ name: m[1].toUpperCase(), vote: m[2] }));
}
function gaFind(members: { name: string; vote: string }[], p: GaPerson) {
  const same = members.filter((m) => m.name === p.last || m.name.startsWith(p.last + ","));
  return same.length === 1 ? same[0] : same.find((m) => m.name === `${p.last}, ${ordinalUpper(p.district)}`);
}

async function gaFallback(missing: GaPerson[], ids: Record<string, number>, castBy: Record<string, Record<string, string>>) {
  for (const branch of ["House", "Senate"]) {
    const who = missing.filter((p) => (p.chamber === "lower" ? "House" : "Senate") === branch);
    if (!who.length) continue;
    const keys = Object.keys(ids).filter((k) => k.startsWith(branch + "#"));
    await pool(keys, 3, async (k) => {
      const members = await gaMembers(ids[k]);
      for (const p of who) {
        const hit = gaFind(members, p);
        if (hit) (castBy[p.openstates] ??= {})[k] = hit.vote;
      }
    });
  }
}

/**
 * Open States lumps "Excused" and "Not Voting" together as "other".
 * Georgia keeps them apart, so we look up just those votes.
 */
async function gaExcused(people: GaPerson[], ids: Record<string, number>, castBy: Record<string, Record<string, string>>) {
  const keys = [...new Set(people.flatMap((p) => Object.entries(castBy[p.openstates] ?? {}).filter(([, o]) => o === "other").map(([k]) => k)))];
  await pool(keys.filter((k) => ids[k]), 3, async (k) => {
    const members = await gaMembers(ids[k]);
    for (const p of people) {
      if (castBy[p.openstates]?.[k] !== "other") continue;
      const hit = gaFind(members, p);
      if (hit) castBy[p.openstates][k] = hit.vote;
    }
  });
}

/**
 * Bill subjects from Georgia's own index ("EDUCATION", "REVENUE AND TAXATION"), by bill ("HB 3").
 * Open States has them for some sessions only, so we read them from Georgia for all.
 */
async function gaSubjects(sessionId: number): Promise<Map<string, string[]>> {
  const ns = "http://www.legis.ga.gov/2009/01/01/services/";
  const act = "http://www.legis.ga.gov/2009/01/01/services/LegislationSearch/";
  const titles = await gaSoap("Legislation", act + "GetTitles", `<GetTitles xmlns="${ns}"/>`);
  const subjects = [...titles.matchAll(/<a:Subject><a:Code>[^<]*<\/a:Code><a:Id>(\d+)<\/a:Id><a:Name>([^<]*)<\/a:Name>/g)].map((m) => ({ id: m[1], name: unxml(m[2]).trim() }));
  const out = new Map<string, string[]>();
  await pool(subjects, 3, async (sub) => {
    for (let start = 0; ; start += 250) {
      const xml = await gaSoap("Legislation", act + "GetLegislationSearchResultsPaged",
        `<GetLegislationSearchResultsPaged xmlns="${ns}"><Constraints xmlns:a="http://www.legis.ga.gov/2009/01/01/data/"><a:Session><a:Id>${sessionId}</a:Id></a:Session>` +
        `<a:Subjects><b:int xmlns:b="http://schemas.microsoft.com/2003/10/Serialization/Arrays">${sub.id}</b:int></a:Subjects></Constraints>` +
        `<PageSize>250</PageSize><StartIndex>${start}</StartIndex></GetLegislationSearchResultsPaged>`);
      const rows = [...xml.matchAll(/<a:LegislationSearchResult>([\s\S]*?)<\/a:LegislationSearchResult>/g)];
      for (const [, r] of rows) {
        // The bill's own number follows its own Id ("<a:Id>63471</a:Id><a:Number>3</a:Number>").
        const num = r.match(/<a:Id>\d+<\/a:Id><a:Number>(\d+)<\/a:Number>/)?.[1];
        if (!num) continue;
        const bill = `${tag(r, "a:DocumentType")} ${num}`;
        out.set(bill, [...(out.get(bill) ?? []), sub.name]);
      }
      if (rows.length < 250) break;
    }
  });
  for (const v of out.values()) v.sort();
  return out;
}

async function gaSession(s: any, gaIds: Record<string, number>, people: GaPerson[], cacheDir: string): Promise<GaSession | null> {
  const file = path.join(cacheDir, `ga-votes-${s.identifier}.json`);
  const today = new Date().toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const old: GaSession | null = fs.existsSync(file) ? readJSON(file) : null;
  // A session that ended over 30 days ago won't change, unless we now track someone new.
  if (old && s.end_date && s.end_date < recent && people.every((p) => old.people.includes(p.openstates)) && old.v === 4) return old;

  const zipUrl = s.downloads?.find((d: any) => /csv/.test(d.url))?.url;
  const sid = gaIds[s.name];
  if (!zipUrl || !sid) {
    log("votes", `ga ${s.identifier}: no ${zipUrl ? "legis.ga.gov session" : "Open States download"}, skipped`);
    return old;
  }

  // 1. Georgia's own captions, so we know which votes were final passage.
  const caption: Record<string, { caption: string; date: string }> = {};
  const voteIds: Record<string, number> = {};
  for (const branch of ["House", "Senate"]) {
    const xml = await gaSoap("Votes", "http://www.legis.ga.gov/2009/01/01/services/VoteFinder/GetVotes",
      `<GetVotes xmlns="http://www.legis.ga.gov/2009/01/01/services/"><Branch>${branch}</Branch><SessionId>${sid}</SessionId></GetVotes>`);
    for (const m of xml.matchAll(/<a:VoteListing>([\s\S]*?)<\/a:VoteListing>/g))
    {
      const k = `${branch}#${tag(m[1], "a:Number")}`;
      caption[k] = { caption: unxml(tag(m[1], "a:Caption")), date: tag(m[1], "a:Date").slice(0, 10) };
      voteIds[k] = Number(tag(m[1], "a:VoteId"));
    }
  }

  // 2. Open States bulk CSVs: votes, who voted how, bill titles and subjects.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-os-"));
  try {
    const zip = path.join(tmp, "s.zip");
    const res = await get(zipUrl);
    if (!res.ok) throw new Error(`Open States bulk ${s.identifier}: HTTP ${res.status}`);
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const csv = (name: string) => parseCSV(execFileSync("unzip", ["-p", zip, `*_${name}.csv`], { maxBuffer: 1 << 30 }).toString("utf8"));

    const bills = new Map(csv("bills").map((b) => [b.id, b]));
    const gaSubj = await gaSubjects(sid);
    const sources = new Map<string, string>();
    for (const r of csv("bill_sources")) if (/legis\.ga\.gov\/legislation\/\d+/.test(r.url) && !sources.has(r.bill_id)) sources.set(r.bill_id, r.url);
    const votes: Record<string, GaVote> = {};
    const eventToKey: Record<string, string> = {};
    for (const v of csv("votes")) {
      const m = v.motion_text.match(/^(House|Senate) Vote #(\d+)/);
      if (!m) continue;
      const key = `${m[1]}#${m[2]}`;
      eventToKey[v.id] = key;
      if (votes[key]) continue; // one vote can cover a batch of local bills; keep the first
      const b = bills.get(v.bill_id);
      const subjects: string[] = (b && gaSubj.get(b.identifier)) || (b ? JSON.parse(b.subject.replace(/'/g, '"') || "[]") : []);
      votes[key] = {
        chamber: m[1],
        num: m[2],
        date: caption[key]?.date || v.start_date.slice(0, 10),
        caption: caption[key]?.caption ?? "",
        bill: b?.identifier ?? "",
        billTitle: b?.title ?? "",
        topics: subjects.length ? subjects.map(titleCase) : [b && isLocal(b.title) ? "Local laws (one city or county)" : "Other"],
        url: sources.get(v.bill_id) ?? "",
        result: v.result,
      };
    }
    const want = new Set(people.map((p) => p.openstates));
    const castBy: Record<string, Record<string, string>> = {};
    for (const r of csv("vote_people")) {
      if (!want.has(r.voter_id)) continue;
      const key = eventToKey[r.vote_event_id];
      if (key) (castBy[r.voter_id] ??= {})[key] = r.option;
    }
    // Anyone Open States didn't match: read Georgia's own record, for the votes Open States has.
    const missing = people.filter((p) => !castBy[p.openstates]);
    if (missing.length && Object.keys(votes).length) {
      log("votes", `ga ${s.identifier}: reading Georgia's record for ${missing.map((p) => p.last).join(", ")}`);
      await gaFallback(missing, Object.fromEntries(Object.entries(voteIds).filter(([k]) => votes[k])), castBy);
    }
    await gaExcused(people, voteIds, castBy);
    const out: GaSession = { v: 4, fetched: today, people: people.map((p) => p.openstates), votes, cast: castBy };
    writeJSON(file, out);
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function georgia(code: string, since: string, people: { id: string; openstates: string }[]) {
  const sd = stateDir(code);
  const cacheDir = path.join(sd, "generated/cache");
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error("OPENSTATES_API_KEY is not set");
  const today = new Date().toISOString().slice(0, 10);
  const juris = await getJSON(`https://v3.openstates.org/jurisdictions/${code}?include=legislative_sessions`, { headers: { "X-API-KEY": key } });
  const sessions = juris.legislative_sessions.filter((s: any) => (s.end_date || today) >= since);

  const sx = await gaSoap("Session", "GetSessions", `<GetSessions xmlns="http://www.legis.ga.gov/2009/01/01/services/"/>`);
  const gaIds: Record<string, number> = {};
  for (const m of sx.matchAll(/<a:Session>([\s\S]*?)<\/a:Session>/g)) gaIds[tag(m[1], "a:Description")] = Number(tag(m[1], "a:Id"));

  // Last name, chamber, and district, for matching in Georgia's own records.
  const u = new URL("https://v3.openstates.org/people");
  for (const p of people) u.searchParams.append("id", p.openstates);
  u.searchParams.set("per_page", "50");
  const info = new Map(((await getJSON(u, { headers: { "X-API-KEY": key } })).results ?? []).map((r: any) => [r.id, r]));
  const who: GaPerson[] = people.map((p) => {
    const r: any = info.get(p.openstates);
    return {
      openstates: p.openstates,
      last: (r?.family_name || r?.name?.split(" ").pop() || "").toUpperCase(),
      district: r?.current_role?.district ?? "",
      chamber: r?.current_role?.org_classification ?? "",
    };
  });
  const data: (GaSession & { session: string })[] = [];
  for (const s of sessions) {
    const d = await gaSession(s, gaIds, who, cacheDir);
    if (d) data.push({ ...d, session: s.identifier });
  }
  log("votes", `georgia: ${data.reduce((n, d) => n + Object.keys(d.votes).length, 0)} recorded votes in ${data.length} sessions`);

  // A bill counts if any of its passage votes passed (DECISIONS #4). Bill numbers restart each session.
  const passedBills = new Set<string>();
  data.forEach((d, i) => {
    for (const v of Object.values(d.votes)) if (gaPassage(v.caption) && v.result === "pass") passedBills.add(`${i}|${v.bill}`);
  });

  const out: VotesFile = { bills: {}, people: {} };
  for (const p of people) {
    let total = 0, missed = 0, excused = 0;
    const rows: Row[] = [];
    for (const [i, d] of data.entries()) {
      const mine = d.cast[p.openstates] ?? {};
      for (const [k, opt] of Object.entries(mine)) {
        const v = d.votes[k];
        if (!v || v.date < since) continue;
        total++;
        const c = cast(opt);
        if (c === "Didn't vote" || c === "Excused") missed++;
        if (c === "Excused") excused++;
        const what = gaPassage(v.caption);
        if (!what || !v.bill || !passedBills.has(`${i}|${v.bill}`)) continue;
        rows.push({
          key: `${code}-${d.session}-${v.bill}`,
          ref: { bill: v.bill, title: v.billTitle, url: v.url, topics: v.topics },
          date: v.date,
          chamber: v.chamber === "House" ? "Georgia House" : "Georgia Senate",
          what,
          vote: cast(opt),
          passed: v.result === "pass",
        });
      }
    }
    if (!total) continue;
    out.people[p.id] = {
      since,
      attendance: { missed, excused, total },
      votes: pack(rows, out.bills),
      source: [
        { label: "Open States", url: `https://openstates.org/person/${p.openstates.replace("ocd-person/", "")}/` },
        { label: "Georgia General Assembly", url: "https://www.legis.ga.gov/" },
      ],
    };
  }
  return out;
}

/** One line per bill and per person, so nightly changes show up as small diffs. */
function writeVotes(file: string, d: VotesFile): boolean {
  const block = (o: Record<string, unknown>) =>
    "{\n" + Object.keys(o).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(o[k])}`).join(",\n") + "\n  }";
  const next = `{\n  "bills": ${block(d.bills)},\n  "people": ${block(d.people)}\n}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === next) return false;
  fs.writeFileSync(file, next);
  return true;
}

export async function votes(code: string) {
  const sd = stateDir(code);
  const since = readJSON(path.join(sd, "state.json")).records.since;
  const races = readJSON(path.join(sd, "races.json"));
  const file = path.join(sd, "generated/votes.json");
  const old: VotesFile = fs.existsSync(file) ? readJSON(file) : { bills: {}, people: {} };
  const all = candidates(races).map(({ c }) => c);
  const fed = all.filter((c) => c.ids?.bioguide).map((c) => ({ id: c.id, bioguide: c.ids.bioguide }));
  const st = all.filter((c) => c.ids?.openstates).map((c) => ({ id: c.id, openstates: c.ids.openstates }));

  const out: VotesFile = { bills: {}, people: {} };
  let errors = 0;
  // Each source is independent: if one fails, keep yesterday's records for its people.
  for (const [name, ids, run] of [
    ["federal", fed.map((p) => p.id), () => federal(code, since, fed)],
    ["state", st.map((p) => p.id), () => (code === "ga" ? georgia(code, since, st) : Promise.resolve({ bills: {}, people: {} }))],
  ] as const) {
    try {
      const got = await run();
      Object.assign(out.people, got.people);
      Object.assign(out.bills, got.bills);
    } catch (e) {
      errors++;
      log("votes", `${name}: ${e instanceof Error ? e.message : e}`);
      for (const id of ids)
        if (old.people[id]) {
          out.people[id] = old.people[id];
          for (const [k] of old.people[id].votes) out.bills[k] = old.bills[k];
        }
    }
  }
  const changed = writeVotes(file, out);
  log("votes", `${Object.keys(out.people).length} people, ${Object.keys(out.bills).length} bills${changed ? " (updated)" : ""}`);
  if (errors) throw new Error(`${errors} source(s) failed`);
}
