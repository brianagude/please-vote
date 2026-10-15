// Nightly data job. Run locally with `npm run data` (reads .env.local),
// or a single step with `npm run data -- congress`.
// Each step is independent: if one source is down, the others still update
// and the failed one keeps yesterday's file.
import { congress } from "./congress.ts";
import { legislature } from "./legislature.ts";
import { log } from "./lib.ts";

const STATES = ["ga"];
const STEPS: Record<string, (code: string) => Promise<void>> = { congress, legislature };

const only = process.argv.slice(2);
let failed = 0;
for (const code of STATES) {
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
