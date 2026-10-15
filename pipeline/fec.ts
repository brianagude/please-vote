// Federal campaign money (DECISIONS #7). Source: OpenFEC, one api.data.gov key.
// Totals cover the whole election period (6 years for Senate, 2 for House).
import fs from "node:fs";
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const day = (s?: string) => s?.slice(0, 10);

// OpenFEC allows about 60 requests a minute; space them out.
let last = 0;
async function fecJSON(u: URL) {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  return getJSON(u);
}

/**
 * Which PACs gave to the campaign, and which outside groups (super PACs and others) spent for or against the candidate.
 * Both cover the current two years (cycle), when money for this race is mostly raised and spent.
 *  pacs:    itemized receipts on FEC line 11C ("contributions from other political committees"), entity type PAC,
 *           added up per PAC. Leaves out conduits like ActBlue (those are individual donations passed along)
 *           and transfers from the candidate's own other committees.
 *  outside: independent expenditures (Schedule E), per group, for (S) or against (O).
 */
async function groups(id: string, cycle: string, key: string) {
  const fecUrl = (p: string, q: Record<string, string>) => {
    const u = new URL(`https://api.open.fec.gov/v1/${p}`);
    u.search = new URLSearchParams({ api_key: key, ...q }).toString();
    return u;
  };
  const committee = (await fecJSON(fecUrl(`candidate/${id}/committees/`, { cycle, designation: "P" }))).results?.[0]?.committee_id;

  const pacs = new Map<string, { name: string; id?: string; amount: number }>();
  if (committee) {
    // Keyset paging: pass back the last row's index and amount.
    let after: Record<string, string> = {};
    for (let page = 0; page < 20; page++) {
      const d = await fecJSON(fecUrl("schedules/schedule_a/", {
        committee_id: committee, two_year_transaction_period: cycle, line_number: "F3-11C", per_page: "100",
        sort: "-contribution_receipt_amount", ...after,
      }));
      for (const r of d.results ?? []) {
        if (r.entity_type !== "PAC" || r.memoed_subtotal) continue;
        const k = r.contributor_id || r.contributor_name;
        const cur = pacs.get(k) ?? { name: r.contributor_name, id: r.contributor_id ?? undefined, amount: 0 };
        cur.amount += r.contribution_receipt_amount ?? 0;
        pacs.set(k, cur);
      }
      const li = d.pagination?.last_indexes;
      if (!li || (d.results ?? []).length < 100) break;
      after = { last_index: li.last_index, last_contribution_receipt_amount: li.last_contribution_receipt_amount };
    }
  }

  const outside = new Map<string, { name: string; id?: string; for: number; against: number }>();
  const e = await fecJSON(fecUrl("schedules/schedule_e/by_candidate/", { candidate_id: id, cycle, election_full: "false", per_page: "100" }));
  for (const r of e.results ?? []) {
    const k = r.committee_id ?? "unnamed";
    const cur = outside.get(k) ?? { name: r.committee_name ?? "", id: r.committee_id ?? undefined, for: 0, against: 0 };
    if (r.support_oppose_indicator === "S") cur.for += r.total ?? 0;
    else if (r.support_oppose_indicator === "O") cur.against += r.total ?? 0;
    outside.set(k, cur);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    pacs: [...pacs.values()].filter((p) => p.amount > 0).map((p) => ({ ...p, amount: round(p.amount) })).sort((a, b) => b.amount - a.amount),
    outside: [...outside.values()]
      .filter((o) => o.for > 0 || o.against > 0)
      .map((o) => ({ ...o, for: round(o.for), against: round(o.against) }))
      .sort((a, b) => b.for + b.against - (a.for + a.against)),
    groupsSince: `${Number(cycle) - 1}-01-01`,
  };
}

export async function fec(code: string) {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY is not set");
  const sd = stateDir(code);
  const races = readJSON(path.join(sd, "races.json"));
  const cfg = readJSON(path.join(sd, "state.json"));
  const cycle = cfg.election.date.slice(0, 4);
  const file = path.join(sd, "generated/money.json");
  const old: Record<string, any> = fs.existsSync(file) ? readJSON(file) : {};
  const out: Record<string, any> = {};
  let errors = 0;

  for (const { c } of candidates(races)) {
    const id = c.ids?.fec;
    if (!id) continue;
    try {
      const u = new URL(`https://api.open.fec.gov/v1/candidate/${id}/totals/`);
      u.search = new URLSearchParams({ api_key: key, cycle, election_full: "true" }).toString();
      const t = (await fecJSON(u)).results?.[0];
      if (!t) continue; // under $5,000 raised or spent: FEC has no totals yet
      out[c.id] = {
        raised: t.receipts,
        spent: t.disbursements,
        cashOnHand: t.last_cash_on_hand_end_period,
        fromIndividuals: t.individual_contributions,
        fromPACs: t.other_political_committee_contributions,
        fromParty: t.political_party_committee_contributions,
        fromSelf: (t.candidate_contribution ?? 0) + (t.loans_made_by_candidate ?? 0),
        // Donations only (not transfers, loans, or refunds): the base for "where donations came from".
        donations: t.contributions,
        // Money moved in from the candidate's other campaign accounts. Counts as "raised" but isn't new donations.
        transfersIn: t.transfers_from_other_authorized_committee ?? 0,
        ...(await groups(id, cycle, key)),
        from: day(t.coverage_start_date),
        through: day(t.coverage_end_date),
        source: { label: "FEC", url: `https://www.fec.gov/data/candidate/${id}/?cycle=${cycle}&election_full=true` },
      };
    } catch (e) {
      // Keep yesterday's numbers for this person.
      errors++;
      if (old[c.id]) out[c.id] = old[c.id];
      log("fec", `${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  const changed = writeJSON(file, out);
  log("fec", `${Object.keys(out).length} candidates${changed ? " (updated)" : ""}`);
  if (errors) throw new Error(`${errors} candidate(s) failed`);
}
