// @ts-check
import { defineConfig } from "astro/config";

// Fully static: pages are rebuilt each night by the data job.
// The address lookup lives in worker/index.ts, not in Astro.
export default defineConfig({
  output: "static",
  build: { format: "directory" },
});
