// Who holds each state legislative seat right now.
// Source: Open States API v3 (https://docs.openstates.org/api-v3/), /people.
import path from "node:path";
import { getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const API = "https://v3.openstates.org";
const PARTY: Record<string, string> = { Democratic: "D", Republican: "R", Libertarian: "L", Independent: "I" };

export async function openstatesPeople(code: string, chamber: "upper" | "lower") {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error("OPENSTATES_API_KEY is not set");
  const people: any[] = [];
  for (let page = 1; ; page++) {
    const u = new URL(`${API}/people`);
    u.search = new URLSearchParams({ jurisdiction: code, org_classification: chamber, per_page: "50", page: String(page) }).toString();
    const d = await getJSON(u, { headers: { "X-API-KEY": key } });
    people.push(...d.results);
    if (page >= d.pagination.max_page) break;
  }
  return people;
}

export async function legislature(code: string) {
  const config = readJSON(path.join(stateDir(code), "state.json"));
  const out: any = { asOf: new Date().toISOString().slice(0, 10), upper: {}, lower: {} };

  for (const ch of ["upper", "lower"] as const) {
    for (const p of await openstatesPeople(code, ch)) {
      const d = p.current_role?.district;
      if (!d) continue;
      out[ch][d] = {
        name: p.name,
        party: PARTY[p.party] ?? p.party,
        openstates: p.id,
        source: { label: "Open States", url: p.openstates_url },
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
