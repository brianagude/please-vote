// Renders the link-preview images (1200x630) used when the site is shared in
// messages and social posts. Same look as the masthead. One per state:
//   Georgia -> public/share.png (the main address), others -> public/share-<code>.png
//
//   node scripts/make-share-image.mjs    (needs the people drawings and internet for fonts)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const states = fs.readdirSync("data/states").filter((c) => fs.existsSync(`data/states/${c}/state.json`));
const browser = await chromium.launch();
for (const code of states) {
const cfg = JSON.parse(fs.readFileSync(`data/states/${code}/state.json`, "utf8"));
// Georgia keeps its original image; other states use their own crowd (signs with the state's name).
const strip = fs.readFileSync(code === "ga" ? "public/people/top-0.svg" : `public/people/${code}/top-0.svg`, "utf8");
const stripData = `data:image/svg+xml;base64,${Buffer.from(strip).toString("base64")}`;
const out = code === "ga" ? "public/share.png" : `public/share-${code}.png`;
const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;padding:56px 64px 0;position:relative;overflow:hidden}
.lbl{font-family:Archivo;font-stretch:115%;font-weight:500;font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:rgba(43,40,36,.68)}
.disp{font-family:Archivo;font-stretch:68%;font-weight:700;text-transform:uppercase;line-height:.9}
.sheet{border:3px solid #2b2824;background:#f7f4ec;display:grid;grid-template-columns:1fr 300px}
.sheet>div{padding:22px 28px 26px;display:flex;flex-direction:column;gap:12px}
.sheet>div+div{border-left:2px solid #2b2824;justify-content:space-between}
h1{font-size:150px}
.n{font-family:Archivo;font-stretch:68%;font-weight:700;color:#ad3f2c;font-size:84px;line-height:.9}
.row{border:3px solid #2b2824;border-top:0;background:#f7f4ec;padding:18px 28px;font-size:30px}
.people{position:absolute;left:0;right:0;bottom:-6px;height:118px;background:url("${stripData}") repeat-x 0 0/auto 118px;opacity:.38}
</style></head><body>
<div class="sheet">
  <div><span class="lbl">${cfg.name} general election</span><h1 class="disp">Please Vote</h1></div>
  <div><span class="lbl">Election day</span><span class="n">NOV 3</span><span style="font-size:24px">Polls ${cfg.election.polls}</span></div>
</div>
<div class="row">When to vote, what's on your ballot, and who's running.</div>
<div class="people"></div>
</body></html>`;

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await page.close();
console.log(out, Math.round(fs.statSync(out).size / 1024) + "KB");
}
await browser.close();
