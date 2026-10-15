// Federal campaign money (DECISIONS #7). Source: OpenFEC, one api.data.gov key.
// Totals cover the whole election period (6 years for Senate, 2 for House).
import path from "node:path";
import { candidates, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const day = (s?: string) => s?.slice(0, 10);

export async function fec(code: string) {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY is not set");
  const sd = stateDir(code);
  const races = readJSON(path.join(sd, "races.json"));
  const cycle = readJSON(path.join(sd, "state.json")).election.date.slice(0, 4);
  const out: Record<string, any> = {};

  for (const { c } of candidates(races)) {
    const id = c.ids?.fec;
    if (!id) continue;
    const u = new URL(`https://api.open.fec.gov/v1/candidate/${id}/totals/`);
    u.search = new URLSearchParams({ api_key: key, cycle, election_full: "true" }).toString();
    const t = (await getJSON(u)).results?.[0];
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
      from: day(t.coverage_start_date),
      through: day(t.coverage_end_date),
      source: { label: "FEC", url: `https://www.fec.gov/data/candidate/${id}/?cycle=${cycle}&election_full=true` },
    };
  }
  const changed = writeJSON(path.join(sd, "generated/money.json"), out);
  log("fec", `${Object.keys(out).length} candidates${changed ? " (updated)" : ""}`);
}
