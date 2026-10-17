// Open States bulk CSV downloads: one zip per legislative session, no API key, and not
// counted against the API's 250-requests-a-day limit. Each zip is downloaded at most once
// per run and deleted when the run ends.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { get, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";
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
  const files = execFileSync("unzip", ["-Z1", zip]).toString("utf8").split("\n");
  // A session with no recorded votes (a short special session) has no vote files at all.
  return (name: string) =>
    files.some((f) => f.endsWith(`_${name}.csv`)) ? parseCSV(execFileSync("unzip", ["-p", zip, `*_${name}.csv`], { maxBuffer: 1 << 30 }).toString("utf8")) : [];
}

process.on("exit", () => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A state's legislative sessions and their bulk download links, from Open States (one API request).
 * Saved in generated/cache/os-sessions.json. The nightly run refreshes it once a night; a work
 * session on a laptop reuses it for 7 days. If the API is down or out of requests, the saved copy
 * is used instead.
 */
export async function osSessions(code: string): Promise<any[]> {
  const file = path.join(stateDir(code), "generated/cache/os-sessions.json");
  const saved: { fetched: string; sessions: any[] } | null = fs.existsSync(file) ? readJSON(file) : null;
  const age = saved ? Date.now() - Date.parse(saved.fetched) : Infinity;
  if (saved && !process.env.CI && !process.env.PV_FRESH && age < 7 * 864e5) return saved.sessions;
  try {
    const key = process.env.OPENSTATES_API_KEY;
    if (!key) throw new Error("OPENSTATES_API_KEY is not set");
    const juris = await getJSON(`https://v3.openstates.org/jurisdictions/${code}?include=legislative_sessions`, { headers: { "X-API-KEY": key } });
    const sessions = juris.legislative_sessions.map((s: any) => ({ identifier: s.identifier, name: s.name, start_date: s.start_date, end_date: s.end_date, downloads: s.downloads }));
    writeJSON(file, { fetched: new Date().toISOString(), sessions });
    return sessions;
  } catch (e) {
    if (!saved) throw e;
    log("sessions", `${code}: using the saved session list from ${saved.fetched.slice(0, 10)} (${e instanceof Error ? e.message : e})`);
    return saved.sessions;
  }
}
