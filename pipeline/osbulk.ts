// Open States bulk CSV downloads: one zip per legislative session, no API key, and not
// counted against the API's 250-requests-a-day limit. Each zip is downloaded at most once
// per run and deleted when the run ends.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { get } from "./lib.ts";
import { parseCSV } from "./votes.ts";

const zips = new Map<string, Promise<string>>();
let dir: string | null = null;

/** Download a session's zip (once per run) and return a reader for its CSV files by name ("bills", "votes"...). */
export async function bulk(url: string) {
  if (!zips.has(url))
    zips.set(
      url,
      (async () => {
        dir ??= fs.mkdtempSync(path.join(os.tmpdir(), "pv-os-"));
        const file = path.join(dir, `${zips.size}.zip`);
        const res = await get(url);
        if (!res.ok) throw new Error(`Open States bulk ${url}: HTTP ${res.status}`);
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        return file;
      })(),
    );
  const zip = await zips.get(url)!;
  return (name: string) => parseCSV(execFileSync("unzip", ["-p", zip, `*_${name}.csv`], { maxBuffer: 1 << 30 }).toString("utf8"));
}

process.on("exit", () => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});
