// Nightly data job. Run locally with `npm run data` (reads .env.local),
// or a single step with `npm run data -- congress`.
// Each step is independent: if one source is down, the others still update
// and the failed one keeps yesterday's file.
import { congress } from "./congress.ts";
import { legislature } from "./legislature.ts";
import { photos } from "./photos.ts";
import { fec } from "./fec.ts";
import { bills } from "./bills.ts";
import { votes } from "./votes.ts";
import { contact } from "./contact.ts";
import { nymoney } from "./nymoney.ts";
import fs from "node:fs";
import { log, stateDir } from "./lib.ts";

// Every state with a data folder.
const STATES = fs.readdirSync(stateDir("")).filter((d) => fs.existsSync(`${stateDir(d)}/state.json`));
// Order matters: photos uses congress output; bills reads the Georgia vote files that votes writes.
const STEPS: Record<string, (code: string) => Promise<void>> = { congress, legislature, photos, fec, nymoney, votes, bills, contact };

// npm run data -- [step ...] [--state ga]   (no steps = all; no --state = every state)
const args = process.argv.slice(2);
const si = args.indexOf("--state");
const onlyState = si >= 0 ? args.splice(si, 2)[1] : null;
const only = args;
let failed = 0;
for (const code of STATES.filter((c) => !onlyState || c === onlyState)) {
  for (const [name, step] of Object.entries(STEPS)) {
    if (only.length && !only.includes(name)) continue;
    try {
      await step(code);
    } catch (e) {
      failed++;
      log(name, `FAILED: ${e instanceof Error ? e.message : e}`);
    }
  }
}
if (failed) {
  log("run", `${failed} step(s) failed`);
  process.exitCode = 1;
}
