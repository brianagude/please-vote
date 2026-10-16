// Instagram posts about the site itself, styled like it. Nonpartisan, like the site:
// no candidates, parties, or picks. Anyone can share these.
//
//   npm run build && npx astro preview --port 4329    (in another terminal: the how-to slides use real screenshots)
//   node scripts/make-promo.mjs added ny     -> exports/promo/added-ny-story.png and -feed.png ("Just added: New York")
//   node scripts/make-promo.mjs howto ga     -> exports/promo/howto-ga-1..6.png (feed carousel) and howto-ga-post.png (one image)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [kind = "howto", code = "ga"] = process.argv.slice(2);
const SITE = "vote.brianagude.com";
const PREVIEW = "http://localhost:4329";
const cfg = JSON.parse(fs.readFileSync(`data/states/${code}/state.json`, "utf8"));
const guide = code === "ga" ? "/" : `/${code}/`;
const urlText = SITE + (code === "ga" ? "" : guide.replace(/\/$/, ""));
const OUT = "exports/promo";
fs.mkdirSync(OUT, { recursive: true });

const SIZES = { story: { w: 1080, h: 1920, top: 250, bottom: 250, people: 250 }, feed: { w: 1080, h: 1350, top: 140, bottom: 150, people: 160 } };
const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// This state's crowd (some signs show the state's name).
// Embedded as data, since the page is rendered from a string and can't load local files.
const strip = (which) => `data:image/svg+xml;base64,${fs.readFileSync(`public/people/${code}/${which}-0.svg`).toString("base64")}`;

const page = (S, inner, { justify = "center" } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${S.w}px;height:${S.h}px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;position:relative;overflow:hidden}
.safe{position:absolute;left:72px;right:72px;top:${S.top}px;bottom:${S.bottom}px;display:flex;flex-direction:column;justify-content:${justify};gap:28px}
.lbl{font-family:Archivo;font-stretch:115%;font-weight:500;font-size:26px;letter-spacing:.2em;text-transform:uppercase;color:rgba(43,40,36,.68)}
.kick{font-family:Archivo;font-stretch:110%;font-weight:700;font-size:34px;letter-spacing:.2em;text-transform:uppercase;color:#ad3f2c}
.disp{font-family:Archivo;font-stretch:68%;font-weight:700;text-transform:uppercase;line-height:.88}
.huge{font-size:300px}
.big{font-size:132px;line-height:.92}
.mid{font-size:92px;line-height:.95}
.body{font-size:46px;line-height:1.28;text-wrap:pretty}
.soft{color:#6d675d}
.step{font-family:"Instrument Sans";font-weight:700;color:#ad3f2c;font-size:64px;line-height:1}
.urlbox{align-self:flex-start;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:46px;letter-spacing:.06em;color:#ad3f2c;border:4px solid #ad3f2c;padding:16px 26px 12px;transform:rotate(-2deg)}
.sheet{border:4px solid #2b2824;background:#f7f4ec}
.shot{align-self:stretch}
/* Screenshots already have the site's own border, so no second frame here. */
.shot img{display:block;width:100%}
.dates{display:flex;flex-direction:column}
.dates div{display:flex;justify-content:space-between;gap:20px;padding:20px 26px;border-top:2px solid #2b2824;font-size:38px}
.dates div:first-child{border-top:0}
.dates b{font-family:Archivo;font-stretch:68%;font-weight:700;font-size:52px;text-transform:uppercase;white-space:nowrap}
.people{position:absolute;left:0;right:0;height:${S.people}px;background-repeat:repeat-x;background-size:auto ${S.people}px;opacity:.35}
.people.top{top:0;background-image:url('${strip("top")}');background-position:-180px 0}
.people.bottom{bottom:0;background-image:url('${strip("bottom")}');background-position:-520px 0}
.dots{position:absolute;bottom:${S.people + 14}px;left:0;right:0;display:flex;justify-content:center;gap:12px}
.dots i{width:14px;height:14px;border-radius:50%;border:2px solid #2b2824}.dots i.on{background:#2b2824}
</style></head><body><div class="people top"></div><div class="people bottom"></div><div class="safe">${inner}</div></body></html>`;

const browser = await chromium.launch();
async function render(S, html, file) {
  const p = await browser.newPage({ viewport: { width: S.w, height: S.h } });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(OUT, file) });
  await p.close();
  console.log(path.join(OUT, file));
}

/** A real screenshot of part of the site, as a data URL. */
async function shot(url, selector, prep) {
  const p = await browser.newPage({ viewport: { width: 760, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto(PREVIEW + url, { waitUntil: "networkidle" });
  // Freeze the background people and countdown so the shot is clean.
  await p.addStyleTag({ content: "body::before,body::after,.strip,.pbar{display:none!important}" });
  if (prep) await p.evaluate(prep);
  const buf = await p.locator(selector).first().screenshot();
  await p.close();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

if (kind === "added") {
  // "Just added: NEW / YORK". Two-word names stack.
  const words = cfg.name.toUpperCase().split(" ");
  for (const [fmt, S] of Object.entries(SIZES)) {
    const size = fmt === "story" ? (words.length > 1 ? 250 : 220) : words.length > 1 ? 210 : 190;
    const html = page(
      S,
      `<span class="kick">Just added</span>
       <h1 class="disp" style="font-size:${size}px">${words.map(esc).join("<br>")}</h1>
       <p class="body">See who's on your ballot and what they've done in office.</p>
       <span class="urlbox">${esc(urlText)}</span>`,
    );
    await render(S, html, `added-${code}-${fmt}.png`);
  }
} else if (kind === "howto") {
  const S = SIZES.feed;
  const d = cfg.dates;
  // Only dates still ahead (by the end date for ranges), and no runoff.
  const today = new Date().toISOString().slice(0, 10);
  const datesHtml = d
    .filter((x) => !/runoff/i.test(x.what) && (x.end ?? x.start) >= today)
    .map((x) => `<div><span>${esc(x.what)}</span><b>${esc(x.when)}</b></div>`)
    .join("");
  // Real pieces of the site.
  // The ballot sections, closed: what's on the ballot without showing any one candidate (neutral).
  const ballot = await shot(guide, "#ballot");
  const form = await shot(guide, ".sheet.form");
  // A record without the person's name on it: just the vote totals and topics.
  // Only the first few topics, so the box ends with its own bottom border.
  const voted = await shot("/person/lucy-mcbath/", "section[aria-labelledby=votes] .sheet", () =>
    document.querySelectorAll("details.topic").forEach((t, i) => i >= 5 && t.remove()),
  );

  const slides = [
    `<span class="lbl">${esc(cfg.name)} · Nov 3, 2026</span>
     <h1 class="disp big">Know who's on your ballot</h1>
     <p class="body">A free guide to every race on your ballot.</p>
     <span class="urlbox">${esc(urlText)}</span>`,
    `<span class="step">01</span>
     <h2 class="disp mid">Mark your calendar</h2>
     <div class="sheet dates">${datesHtml}</div>
     <p class="body soft">Polls are open ${esc(cfg.election.polls)} on Election Day.</p>`,
    `<span class="step">02</span>
     <h2 class="disp mid">Type in your address</h2>
     <div class="shot"><img src="${form}"></div>
     <p class="body">The site finds your districts and shows only the races on <i>your</i> ballot.</p>`,
    `<span class="step">03</span>
     <h2 class="disp mid">See who's running</h2>
     <div class="shot" style="width:82%"><img src="${ballot}"></div>
     <p class="body">Open a section to see what each office does, and every candidate running for it.</p>`,
    `<span class="step">04</span>
     <h2 class="disp mid">Check their record</h2>
     <div class="shot"><img src="${voted}"></div>
     <p class="body">For people already in office: bills they wrote, how they voted, and who's funding them.</p>`,
    `<h2 class="disp big">Please vote.</h2>
     <p class="body">Look up your ballot before you go.</p>
     <span class="urlbox">${esc(urlText)}</span>`,
  ];
  for (const [i, inner] of slides.entries()) {
    const dots = `<div class="dots">${slides.map((_, j) => `<i class="${i === j ? "on" : ""}"></i>`).join("")}</div>`;
    await render(S, page(S, inner).replace("</body>", `${dots}</body>`), `howto-${code}-${i + 1}.png`);
    // The same slide as a story (taller, no carousel dots: stories advance on their own).
    await render(SIZES.story, page(SIZES.story, inner), `howto-${code}-story-${i + 1}.png`);
  }
  // One single post that says it all.
  await render(
    S,
    page(
      S,
      `<span class="lbl">${esc(cfg.name)} · Nov 3, 2026</span>
       <h1 class="disp big">Who's on your ballot?</h1>
       <p class="body">Type in your address to see every race on your ballot, what each office does, and every candidate's record.</p>
       <div class="sheet dates">${datesHtml}</div>
       <span class="urlbox">${esc(urlText)}</span>`,
    ),
    `howto-${code}-post.png`,
  );
} else throw new Error('Use "added <state>" or "howto <state>"');

await browser.close();
