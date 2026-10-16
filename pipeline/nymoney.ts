// Campaign money for New York's statewide candidates (governor, attorney general, comptroller).
// Source: the New York State Board of Elections' disclosure reports, published on data.ny.gov
// ("Campaign Finance Disclosure Reports Data: Beginning 1999", e9ss-239a). No key.
// The Board's own site blocks automated access; data.ny.gov has the same filings as transactions.
//
// Each candidate's committee is set by hand in races.json (ids.nysboe = the Board's filer ID).
// Totals cover filings from the 2023 election year on (after the 2022 election), added up by type:
//   donations:  monetary contributions (individuals, partnerships, corporations, LLCs, PACs, other)
//   spent:      expenditures/payments, plus "qualified expenditures" (how committees in the
//               state's public campaign finance program report spending)
//   publicFunds: matching money paid by the state's public campaign finance program
//   transfersIn: money moved in from party committees and the candidate's other campaigns
// If a report was amended, only the amended version is counted.
import path from "node:path";
import { getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const API = "https://data.ny.gov/resource/e9ss-239a.json";
const SINCE_YEAR = 2023;

const DONATION = /^Monetary Contributions Received|^LLCs\/Partnership\/Subcontractor$/;
const SPENT = /^Expenditures\/ Payments$|^Qualified Expenditures$/;

async function soql(q: string) {
  const u = new URL(API);
  u.searchParams.set("$query", q);
  return getJSON<any[]>(u);
}

export async function nymoney(code: string) {
  if (code !== "ny") return;
  const sd = stateDir(code);
  const races = readJSON(path.join(sd, "races.json"));
  const file = path.join(sd, "generated/state-money.json");
  const out: Record<string, any> = {};

  for (const race of Object.values<any>(races.statewide))
    for (const c of race.candidates) {
      const filer = c.ids?.nysboe;
      if (!filer) continue;
      const rows = await soql(
        `SELECT election_year, filing_abbrev, r_amend, filing_sched_desc, cntrbr_type_desc, sum(org_amt) AS total, min(sched_date) AS first, max(sched_date) AS last ` +
          `WHERE filer_id = "${filer}" AND election_year >= ${SINCE_YEAR} ` +
          `GROUP BY election_year, filing_abbrev, r_amend, filing_sched_desc, cntrbr_type_desc LIMIT 5000`,
      );
      // Amended reports replace the original: per filing, keep amended rows if there are any.
      const amended = new Set(rows.filter((r) => r.r_amend === "Y").map((r) => `${r.election_year}|${r.filing_abbrev}`));
      const kept = rows.filter((r) => !amended.has(`${r.election_year}|${r.filing_abbrev}`) || r.r_amend === "Y");
      const sum = (f: (r: any) => boolean) => kept.filter(f).reduce((n, r) => n + Number(r.total || 0), 0);

      const donations = sum((r) => DONATION.test(r.filing_sched_desc));
      const individuals = sum((r) => /^Monetary Contributions Received From Ind/.test(r.filing_sched_desc) && r.cntrbr_type_desc === "Individual");
      const groups = sum((r) => /From All Other/.test(r.filing_sched_desc) && /Political|Union|Association/.test(r.cntrbr_type_desc ?? ""));
      const companies = donations - individuals - groups; // corporations, LLCs, partnerships, other
      // Latest transaction date, ignoring typos dated in the future.
      const today = new Date().toISOString().slice(0, 10);
      const through = kept.reduce((m, r) => (r.last.slice(0, 10) <= today && r.last > m ? r.last : m), "").slice(0, 10);

      out[c.id] = {
        raised: Math.round(donations),
        spent: Math.round(sum((r) => SPENT.test(r.filing_sched_desc))),
        donations: Math.round(donations),
        fromIndividuals: Math.round(individuals),
        fromCompanies: Math.round(companies),
        fromPACs: Math.round(groups),
        publicFunds: Math.round(sum((r) => r.filing_sched_desc === "Public Fund Receipts")),
        transfersIn: Math.round(sum((r) => r.filing_sched_desc === "Transfers In")),
        // When this committee's money starts (a new campaign may start long after 2023).
        from: kept.reduce((m, r) => (r.first && r.first.slice(0, 10) >= `${SINCE_YEAR}-01-01` && (!m || r.first < m) ? r.first : m), "").slice(0, 10) || `${SINCE_YEAR}-01-01`,
        through,
        state: true,
        source: { label: "New York State Board of Elections", url: "https://data.ny.gov/Transparency/Campaign-Finance-Disclosure-Reports-Data-Beginning/e9ss-239a" },
      };
    }

  const changed = writeJSON(file, out);
  log("nymoney", `${Object.keys(out).length} candidates${changed ? " (updated)" : ""}`);
}
