// Import the Secretary of State's certified candidate list (an .xlsx the owner
// downloads by hand, because sos.ga.gov blocks automated access).
//
//   node pipeline/import-sos.ts "data/states/ga/sources/<file>.xlsx"
//
// Writes data/states/ga/legislature-races.json (who's running for every State
// Senate and State House seat) and prints any statewide/U.S. differences from
// races.json so they can be fixed by hand.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readJSON, stateDir, writeJSON } from "./lib.ts";

const file = process.argv[2];
if (!file) throw new Error("Pass the path to the .xlsx file");
const code = "ga";

const unzip = (part: string) => execFileSync("unzip", ["-p", file, part], { encoding: "utf8", maxBuffer: 50e6 });
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

// A tiny .xlsx reader: shared strings + the first sheet's cells.
const shared = [...unzip("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
);
const rows = [...unzip("xl/worksheets/sheet1.xml").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
  [...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
    const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
    return (/t="s"/.test(c[1]) ? shared[Number(v)] : decode(v)).trim();
  }),
);

/** "DONZELLA JAMES" -> "Donzella James"; leaves normal names alone. */
export function tidyName(n: string) {
  return n
    .split(/(\s+|-|")/)
    .map((w) => {
      if (!/[A-Z]{2,}/.test(w) || /[a-z]/.test(w)) return w;
      const t = w.charAt(0) + w.slice(1).toLowerCase();
      return t.replace(/^Mc(\w)/, (_, c) => "Mc" + c.toUpperCase()).replace(/^O'(\w)/, (_, c) => "O'" + c.toUpperCase());
    })
    .join("");
}

const [header, ...body] = rows;
if (header.join("|") !== "Office|Name on Ballot|Incumbent?|Party") throw new Error(`Unexpected columns: ${header.join(", ")}`);

const source = { label: "Georgia Secretary of State", url: "https://sos.ga.gov/november-3-2026-general-election" };
const out: any = { source, upper: {}, lower: {} };
const other: string[][] = [];
for (const [office, name, inc, party] of body) {
  const m = office.match(/^State (Senate|House), District (\d+)$/);
  if (!m) {
    other.push([office, tidyName(name), inc, party]);
    continue;
  }
  const ch = m[1] === "Senate" ? "upper" : "lower";
  (out[ch][m[2]] ??= []).push({ name: tidyName(name), party, ...(inc === "Yes" ? { incumbent: true } : {}) });
}
for (const ch of ["upper", "lower"]) out[ch] = Object.fromEntries(Object.entries(out[ch]).sort((a, b) => Number(a[0]) - Number(b[0])));
writeJSON(path.join(stateDir(code), "legislature-races.json"), out);
console.log(`State Senate: ${Object.keys(out.upper).length} districts. State House: ${Object.keys(out.lower).length} districts.`);

// Report statewide and U.S. races that don't match races.json.
const races = readJSON(path.join(stateDir(code), "races.json"));
const all = [...Object.values<any>(races.statewide), ...Object.values<any>(races.house)].flatMap((r) => r.candidates);
const names = new Set(all.map((c) => c.name));
const onBallot = new Set(other.map((r) => r[1]));
for (const [office, name] of other) if (!names.has(name) && !office.startsWith("District Attorney")) console.log(`On ballot, not in races.json: ${office}: ${name}`);
for (const c of all) if (!onBallot.has(c.name)) console.log(`In races.json, not on ballot: ${c.name}`);
