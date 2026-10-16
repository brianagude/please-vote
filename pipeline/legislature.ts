// Who holds each state legislative seat right now.
// Source: Open States' list of current legislators, one file per state
// (https://data.openstates.org/people/current/<state>.csv). It's a plain download, so it
// doesn't count against the Open States API's 250-requests-a-day limit.
import path from "node:path";
import { get, log, readJSON, stateDir, writeJSON } from "./lib.ts";
import { parseCSV } from "./votes.ts";

const PARTY: Record<string, string> = { Democratic: "D", Republican: "R", Libertarian: "L", Independent: "I" };

/** A person's page on openstates.org: their name, then their ID written in base 62. */
export function openstatesUrl(id: string, name: string) {
  const A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let n = BigInt("0x" + id.replace(/^ocd-person\//, "").replace(/-/g, ""));
  let s = "";
  while (n > 0n) {
    s = A[Number(n % 62n)] + s;
    n /= 62n;
  }
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://openstates.org/person/${slug}-${s}/`;
}

export async function openstatesPeople(code: string) {
  const res = await get(`https://data.openstates.org/people/current/${code}.csv`);
  if (!res.ok) throw new Error(`Open States people file for ${code}: HTTP ${res.status}`);
  return parseCSV(await res.text());
}

export async function legislature(code: string) {
  const config = readJSON(path.join(stateDir(code), "state.json"));
  const out: any = { asOf: new Date().toISOString().slice(0, 10), upper: {}, lower: {} };

  const people = await openstatesPeople(code);
  for (const ch of ["upper", "lower"] as const) {
    for (const p of people.filter((x) => x.current_chamber === ch)) {
      const d = p.current_district;
      if (!d) continue;
      out[ch][d] = {
        name: p.name,
        party: PARTY[p.current_party] ?? p.current_party,
        openstates: p.id,
        source: { label: "Open States", url: openstatesUrl(p.id, p.name) },
      };
    }
    out[ch] = Object.fromEntries(Object.entries(out[ch]).sort((a, b) => Number(a[0]) - Number(b[0])));
    // Seats with no current member are left out; the site then says it
    // couldn't confirm the seat, rather than guessing "vacant".
    const missing = Array.from({ length: config.districts[ch].count }, (_, i) => String(i + 1)).filter((n) => !out[ch][n]);
    if (missing.length) log("legislature", `${ch}: no current member for district ${missing.join(", ")}`);
    // Guard: a broken upstream shouldn't wipe the roster.
    if (Object.keys(out[ch]).length < config.districts[ch].count * 0.9)
      throw new Error(`${ch} roster looks incomplete (${Object.keys(out[ch]).length}); keeping yesterday's file`);
  }

  const changed = writeJSON(path.join(stateDir(code), "legislature.json"), out);
  log("legislature", `${Object.keys(out.upper).length} upper, ${Object.keys(out.lower).length} lower${changed ? " (updated)" : ""}`);
}
