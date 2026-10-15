// Members of Congress: terms, leadership roles, and committees.
// Source: github.com/unitedstates/congress-legislators (no key).
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const BASE = "https://unitedstates.github.io/congress-legislators";
const SOURCE = { label: "unitedstates/congress-legislators", url: "https://github.com/unitedstates/congress-legislators" };

export async function congress(code: string) {
  const [people, membership, committees] = await Promise.all([
    getJSON<any[]>(`${BASE}/legislators-current.json`),
    getJSON<Record<string, any[]>>(`${BASE}/committee-membership-current.json`),
    getJSON<any[]>(`${BASE}/committees-current.json`),
  ]);

  // Committee and subcommittee names by thomas_id ("SSAF", "SSAF13", ...)
  const names: Record<string, { name: string; parent?: string }> = {};
  for (const c of committees) {
    names[c.thomas_id] = { name: c.name };
    for (const s of c.subcommittees ?? []) names[c.thomas_id + s.thomas_id] = { name: s.name, parent: c.name };
  }

  const races = readJSON(path.join(stateDir(code), "races.json"));
  const wanted = new Set(candidates(races).map(({ c }) => c.ids?.bioguide).filter(Boolean));
  const out: Record<string, any> = {};

  for (const p of people) {
    const id = p.id.bioguide;
    if (!wanted.has(id)) continue;
    const roles: any[] = [];
    for (const [cid, members] of Object.entries(membership)) {
      const m = members.find((x) => x.bioguide === id);
      if (m && names[cid] && !names[cid].parent) roles.push({ committee: names[cid].name, title: m.title ?? null });
    }
    out[id] = {
      name: p.name.official_full,
      ids: { fec: p.id.fec ?? [], wikidata: p.id.wikidata, wikipedia: p.id.wikipedia },
      terms: p.terms.map((t: any) => ({ type: t.type, start: t.start, end: t.end, state: t.state, district: t.district, party: t.party })),
      leadership: (p.leadership_roles ?? []).map((r: any) => ({ title: r.title, chamber: r.chamber, start: r.start, end: r.end })),
      committees: roles,
      source: SOURCE,
    };
  }
  const missing = [...wanted].filter((id) => !out[id]);
  if (missing.length) log("congress", `not in legislators-current: ${missing.join(", ")}`);
  const changed = writeJSON(path.join(stateDir(code), "generated/congress.json"), out);
  log("congress", `${Object.keys(out).length} members${changed ? " (updated)" : ""}`);
}
