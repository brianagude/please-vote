// Candidate photos (DECISIONS #6).
// 1. Members of Congress: official portraits from unitedstates/images (public domain).
// 2. Everyone else: the free image on their Wikipedia article, taken from
//    Wikimedia Commons, only if CC0, public domain, CC BY, or CC BY-SA.
// 3. Nobody else gets a photo; the site shows initials.
// Files are saved under public/photos/ so the site never hotlinks.
import fs from "node:fs";
import path from "node:path";
import { candidates, get, getJSON, log, readJSON, stateDir, writeJSON } from "./lib.ts";

const OK_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? [\d.]+( [a-z-]+)?)$/i;
const strip = (html = "") => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function save(url: string, file: string) {
  const res = await get(url);
  if (!res.ok) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function fromCongress(id: string, bioguide: string, dir: string) {
  const url = `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg`;
  if (!(await save(url, path.join(dir, `${id}.jpg`)))) return;
  return {
    src: `/photos/${id}.jpg`,
    license: "Public domain",
    source: { label: "unitedstates/images", url: "https://github.com/unitedstates/images" },
  };
}

async function fromCommons(id: string, title: string, stateName: string, dir: string) {
  const wp = new URL("https://en.wikipedia.org/w/api.php");
  wp.search = new URLSearchParams({ action: "query", prop: "pageprops|extracts", exintro: "1", explaintext: "1", redirects: "1", format: "json", titles: title }).toString();
  const page: any = Object.values((await getJSON(wp)).query.pages)[0];
  const file = page?.pageprops?.page_image_free;
  // Guard against a same-name person: the article must be about someone in this state.
  if (!file || !page.extract?.includes(stateName)) return;

  const c = new URL("https://commons.wikimedia.org/w/api.php");
  c.search = new URLSearchParams({ action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "225", format: "json", titles: `File:${file}` }).toString();
  const info: any = (Object.values((await getJSON(c)).query.pages)[0] as any)?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = strip(meta.LicenseShortName?.value);
  if (!OK_LICENSE.test(license)) {
    log("photos", `skip ${id}: license "${license}"`);
    return;
  }
  const ext = (info.thumburl.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  if (!(await save(info.thumburl, path.join(dir, `${id}.${ext}`)))) return;
  const artist = strip(meta.Artist?.value) || "Unknown author";
  return {
    src: `/photos/${id}.${ext}`,
    credit: artist,
    license,
    source: { label: "Wikimedia Commons", url: info.descriptionurl },
  };
}

export async function photos(code: string) {
  const sd = stateDir(code);
  const config = readJSON(path.join(sd, "state.json"));
  const races = readJSON(path.join(sd, "races.json"));
  const congress = fs.existsSync(path.join(sd, "generated/congress.json")) ? readJSON(path.join(sd, "generated/congress.json")) : {};
  const dir = path.resolve("public/photos");
  const out: Record<string, any> = {};

  for (const { c } of candidates(races)) {
    if (c.photo) continue; // set by hand in races.json
    try {
      let p = c.ids?.bioguide ? await fromCongress(c.id, c.ids.bioguide, dir) : undefined;
      const title = c.ids?.wikipedia ?? (c.ids?.bioguide && congress[c.ids.bioguide]?.ids?.wikipedia);
      if (!p && title) p = await fromCommons(c.id, title, config.name, dir);
      if (p) out[c.id] = p;
    } catch (e) {
      log("photos", `error for ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  const changed = writeJSON(path.join(sd, "generated/photos.json"), out);
  log("photos", `${Object.keys(out).length} photos${changed ? " (updated)" : ""}`);
}
