// sitemap.xml for search engines: every state guide, every person page, and /directory/.
import type { APIRoute } from "astro";
import { loadState, personPages, stateCodes, statePath } from "../lib/state";

export const GET: APIRoute = ({ site }) => {
  const url = (p: string) => new URL(p, site).href;
  const entries = [
    ...stateCodes().map((code) => ({ loc: url(statePath(code)), lastmod: loadState(code).config.asOf })),
    ...personPages().map((p) => ({ loc: url(p.path), lastmod: p.asOf })),
    { loc: url("/directory/"), lastmod: new Date().toISOString().slice(0, 10) },
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml" } });
};
