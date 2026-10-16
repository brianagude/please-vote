// Shared helpers for the nightly data job.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const UA = "PleaseVote/1.0 (nonpartisan voter guide; https://github.com/)";

export const stateDir = (code: string) => path.resolve("data/states", code);

export function readJSON<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Write pretty JSON only if it changed, so unchanged nights make no commit. */
export function writeJSON(file: string, data: unknown): boolean {
  const next = JSON.stringify(data, null, 2) + "\n";
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Local copy of downloads, for work sessions only. When the data job runs on a laptop (not in
 * GitHub's nightly run, where CI is set), plain GET requests are saved in .cache/http/ and reused
 * for 24 hours, so trying out a change doesn't ask Open States (250 requests a day) again.
 * Turn it off with PV_FRESH=1; delete .cache/ to start over. Nothing in .cache/ is uploaded.
 */
const CACHE_DIR = path.resolve(".cache/http");
const useCache = (init: RequestInit) => !process.env.CI && !process.env.PV_FRESH && (!init.method || init.method === "GET");
const cacheFile = (url: string) => path.join(CACHE_DIR, crypto.createHash("sha256").update(url).digest("hex").slice(0, 32));

export async function get(url: string | URL, init: RequestInit = {}, tries = 4): Promise<Response> {
  if (!useCache(init)) return fetchRetry(url, init, tries);
  const f = cacheFile(String(url));
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 24 * 3600e3) {
    const { status, type } = JSON.parse(fs.readFileSync(f + ".json", "utf8"));
    return new Response(fs.readFileSync(f), { status, headers: { "content-type": type } });
  }
  const res = await fetchRetry(url, init, tries);
  if (!res.ok) return res;
  const body = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(f, body);
  fs.writeFileSync(f + ".json", JSON.stringify({ status: res.status, type: res.headers.get("content-type") ?? "", url: String(url).replace(/api_key=[^&]+/, "api_key=***") }));
  return new Response(body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "" } });
}

/** fetch with a timeout and a few retries for flaky or rate-limited APIs. */
async function fetchRetry(url: string | URL, init: RequestInit = {}, tries = 4): Promise<Response> {
  // Congress.gov can take over a minute to answer.
  const timeout = String(url).includes("api.congress.gov") ? 180_000 : 60_000;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...init.headers }, signal: AbortSignal.timeout(timeout) });
      // Open States' daily limit: every retry counts against it too, so stop right away.
      if (res.status === 429 && String(url).includes("openstates.org")) throw Object.assign(new Error("HTTP 429 (Open States daily limit)"), { final: true });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      if ((e as { final?: boolean }).final) break;
      await sleep(2000 * 2 ** i);
    }
  }
  throw new Error(`${String(url).replace(/api_key=[^&]+/, "api_key=***")}: ${last}`);
}

export async function getJSON<T = any>(url: string | URL, init?: RequestInit): Promise<T> {
  const res = await get(url, init);
  if (!res.ok) throw new Error(`${String(url).replace(/api_key=[^&]+/, "api_key=***")}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const log = (step: string, msg: string) => console.log(`[${step}] ${msg}`);

/** Every candidate in a state's races.json, with where it sits. */
export function candidates(races: any): { race: string; c: any }[] {
  return [
    ...Object.entries(races.statewide).flatMap(([k, r]: [string, any]) => r.candidates.map((c: any) => ({ race: k, c }))),
    ...Object.entries(races.house).flatMap(([k, r]: [string, any]) => r.candidates.map((c: any) => ({ race: `house-${k}`, c }))),
  ];
}
