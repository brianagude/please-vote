// Cloudflare Worker: serves the static site and one endpoint,
// POST /api/district { address } -> the voter's districts.
//
// The Census Geocoder doesn't allow browser calls (no CORS headers), so the
// browser asks us and we ask Census. Addresses are never stored or logged,
// and they travel in the POST body so they don't land in URL logs.

interface Env {
  ASSETS: Fetcher;
}

const CENSUS = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

export interface DistrictResult {
  match: boolean;
  matched?: string;
  state?: string;
  house?: string;
  upper?: string;
  lower?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Pull the three districts out of a Census response. Layer names include a
 *  year or Congress number that changes, so match on the stable part. */
export function parseCensus(body: any): DistrictResult {
  const m = body?.result?.addressMatches?.[0];
  if (!m) return { match: false };
  const g: Record<string, any[]> = m.geographies ?? {};
  const pick = (re: RegExp) => {
    const layer = Object.entries(g).find(([k]) => re.test(k))?.[1]?.[0];
    const v = layer?.BASENAME ?? layer?.NAME;
    // "ZZ" / "ZZZ" means the area has no district (water, etc.)
    return v && !/^Z+$/.test(v) ? String(v).replace(/^0+/, "") : undefined;
  };
  return {
    match: true,
    matched: m.matchedAddress,
    state: g["States"]?.[0]?.STUSAB ?? m.addressComponents?.state,
    house: pick(/Congressional Districts$/),
    upper: pick(/State Legislative Districts - Upper$/),
    lower: pick(/State Legislative Districts - Lower$/),
  };
}

async function district(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  let address = "";
  try {
    address = String(((await req.json()) as any)?.address ?? "").trim();
  } catch {}
  if (address.length < 6 || address.length > 200) return json({ error: "Enter a street address" }, 400);

  const url = new URL(CENSUS);
  url.search = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return json({ error: "Lookup service error" }, 502);
    return json(parseCensus(await res.json()));
  } catch {
    return json({ error: "Lookup service unavailable" }, 504);
  }
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/district") return district(req);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
