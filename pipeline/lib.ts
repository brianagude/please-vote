// Shared helpers for the nightly data job.
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

/** fetch with a timeout and a few retries for flaky or rate-limited APIs. */
export async function get(url: string | URL, init: RequestInit = {}, tries = 4): Promise<Response> {
  // Congress.gov can take over a minute to answer.
  const timeout = String(url).includes("api.congress.gov") ? 180_000 : 60_000;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...init.headers }, signal: AbortSignal.timeout(timeout) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      last = e;
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
