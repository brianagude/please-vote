// Instagram story cards (1080x1920) for one voter's ballot, styled like the site.
// These are for the owner's personal account, not the site: they pick which
// offices to show and list Democrats first. The site itself stays neutral.
//
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>"
//   -> exports/stories/01-intro.png, 02-..., ...
//
// Edit COPY and OFFICES below.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const COPY = {
  intro: {
    kicker: "Georgia · Nov 3, 2026",
    big: "A lot of the Democratic candidates running for office this year are Black women (((((:",
    small: "So I built a site to help me learn about who's on my ballot.",
  },
  outro: {
    kicker: "Georgia voters",
    big: "Go learn who you're voting for.",
    url: "vote.brianagude.com",
    dates: ["Early voting: now through Oct 30", "Election Day: Nov 3, 7 a.m. – 7 p.m."],
  },
};

// Which races to show, in order. "@house", "@upper", "@lower" are the voter's districts.
const OFFICES = ["@house", "governor", "sos", "ag", "agr", "ins", "labor", "schools", "@upper", "@lower"];
const PER_SLIDE = 5;
const PARTY_ORDER = ["D", "R", "L", "I"]; // Democrats first

// Photos for candidates the site doesn't have one for (state legislators).
const EXTRA_PHOTOS = {
  "Kenya Wicks": "scripts/story-photos/kenya-wicks.jpg",
  "Debra Bazemore": "scripts/story-photos/debra-bazemore.jpg",
};

const address = process.argv[2];
if (!address) throw new Error('Pass an address: node scripts/make-stories.mjs "123 Main St, Atlanta, GA 30303"');
const SITE = "https://vote.brianagude.com";
const D = "data/states/ga";
const read = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const races = read("races.json");
const offices = read("offices.json");
const photos = read("generated/photos.json");
const running = read("legislature-races.json");
const PARTY = { D: "Democrat", R: "Republican", L: "Libertarian", I: "Independent" };

const dist = await (await fetch(`${SITE}/api/district`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })).json();
if (!dist.match || dist.state !== "GA") throw new Error("Address not found in Georgia");

const words = (n) => n.replace(/["“”][^"“”]*["“”]/g, " ").replace(/,?\s+(Jr|Sr|II|III)\.?\s*$/, "").split(/\s+/).filter(Boolean);
const last = (n) => words(n).at(-1);
const initials = (n) => { const w = words(n); return (w[0][0] + (w.length > 1 ? w.at(-1)[0] : "")).toUpperCase(); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const order = (list) => [...list].sort((a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party) || last(a.name).localeCompare(last(b.name)));
const photoOf = (c) => {
  const p = EXTRA_PHOTOS[c.name] ?? (c.photo?.src ?? (c.id && photos[c.id]?.src) ? "public" + (c.photo?.src ?? photos[c.id].src) : null);
  return p ? "file://" + path.resolve(p) : null;
};

// The races, each as { title, cands }.
const blocks = OFFICES.map((k) => {
  if (k === "@house") return { title: `U.S. House · District ${dist.house}`, cands: races.house[dist.house].candidates };
  if (k === "@upper") return { title: `State Senate · District ${dist.upper}`, cands: running.upper[dist.upper] ?? [] };
  if (k === "@lower") return { title: `State House · District ${dist.lower}`, cands: running.lower[dist.lower] ?? [] };
  return { title: offices[k].title, cands: races.statewide[k].candidates };
});
const slides = [];
for (let i = 0; i < blocks.length; i += PER_SLIDE) slides.push(blocks.slice(i, i + PER_SLIDE));

const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
const people = (which, pos) => `<div class="people ${pos}" style="background-image:url('file://${path.resolve(`public/people/${which}-0.svg`)}')"></div>`;

const page = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{--s:1}
body{width:1080px;height:1920px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;position:relative;overflow:hidden}
.safe{position:absolute;left:60px;right:60px;top:250px;bottom:250px;display:flex;flex-direction:column;justify-content:center;gap:calc(22px*var(--s))}
.lbl{font-family:Archivo;font-stretch:115%;font-weight:500;font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:rgba(43,40,36,.68)}
.disp{font-family:Archivo;font-stretch:68%;font-weight:700;text-transform:uppercase;line-height:.95}
.sheet{border:4px solid #2b2824;background:#f7f4ec}
.office{border-top:3px solid #2b2824}.office:first-child{border-top:0}
.otitle{background:#e8e2d4;padding:calc(12px*var(--s)) 24px calc(10px*var(--s));font-size:calc(44px*var(--s));border-bottom:2px solid #2b2824}
.cands{display:grid;grid-template-columns:1fr 1fr}
.cand{display:flex;align-items:center;gap:18px;padding:calc(16px*var(--s)) 24px;min-width:0}
.cand+.cand{border-left:2px dashed #cfc8b8}
.pin{flex:none;width:calc(112px*var(--s));height:calc(112px*var(--s));border-radius:50%;border:3px solid #2b2824;overflow:hidden;display:grid;place-items:center;background:#f7f4ec;font-family:Archivo;font-stretch:68%;font-weight:700;font-size:calc(42px*var(--s))}
.pin img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;filter:grayscale(1) sepia(.25) contrast(1.05)}
.who{display:flex;flex-direction:column;gap:4px;min-width:0}
.name{font-family:Archivo;font-stretch:75%;font-weight:700;font-size:calc(38px*var(--s));text-transform:uppercase;line-height:.95}
.party{font-size:calc(26px*var(--s));color:#5a554c}
.stamp{align-self:flex-start;margin-top:4px;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:calc(17px*var(--s));letter-spacing:.16em;text-transform:uppercase;color:#ad3f2c;border:2px solid #ad3f2c;padding:3px 8px 2px;transform:rotate(-2deg)}
.big{font-size:118px}
.small{font-size:42px;line-height:1.3;color:#2b2824;text-wrap:pretty}
.big{text-wrap:pretty}
.urlbox{align-self:flex-start;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:46px;letter-spacing:.06em;color:#ad3f2c;border:4px solid #ad3f2c;padding:16px 26px 12px;transform:rotate(-2deg)}
.people{position:absolute;left:0;right:0;height:250px;background-repeat:repeat-x;background-size:auto 250px;opacity:.35}
.people.top{top:0;background-position:-180px 0}
.people.bottom{bottom:0;background-position:-520px 0}
</style></head><body>${people("top", "top")}${people("bottom", "bottom")}<div class="safe">${inner}</div></body></html>`;

const candHTML = (c) => {
  const ph = photoOf(c);
  return `<div class="cand">
    <span class="pin">${ph ? `<img src="${ph}">` : esc(initials(c.name))}</span>
    <span class="who"><span class="name">${esc(c.name)}</span><span class="party">${esc(PARTY[c.party] ?? c.party)}</span>${c.incumbent ? `<span class="stamp">Incumbent</span>` : ""}</span>
  </div>`;
};
const officeHTML = (b) => `<div class="office"><h2 class="disp otitle">${esc(b.title)}</h2><div class="cands">${order(b.cands).map(candHTML).join("")}</div></div>`;

// ---- render ----
const out = "exports/stories";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-stories-"));
const browser = await chromium.launch();
const shoot = async (html, file) => {
  const f = path.join(tmp, "card.html");
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto("file://" + f, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  // Shrink a little at a time until everything fits inside Instagram's safe area.
  for (let s = 1; s > 0.6; s -= 0.04) {
    const fits = await p.evaluate((s) => {
      document.documentElement.style.setProperty("--s", String(s));
      const safe = document.querySelector(".safe");
      return safe.scrollHeight <= safe.clientHeight + 1;
    }, s);
    if (fits) break;
  }
  await p.screenshot({ path: path.join(out, file) });
  await p.close();
};

const pad = (n) => String(n).padStart(2, "0");
let n = 1;
await shoot(page(`<span class="lbl">${esc(COPY.intro.kicker)}</span><h1 class="disp big">${esc(COPY.intro.big)}</h1><p class="small">${esc(COPY.intro.small)}</p>`), `${pad(n++)}-intro.png`);
for (const [i, s] of slides.entries())
  await shoot(page(`<div style="display:flex;justify-content:space-between"><span class="lbl">On my ballot</span><span class="lbl">${i + 1} / ${slides.length}</span></div><div class="sheet">${s.map(officeHTML).join("")}</div><span class="lbl">More on every candidate: vote.brianagude.com</span>`), `${pad(n++)}-ballot-${i + 1}.png`);
await shoot(page(`<span class="lbl">${esc(COPY.outro.kicker)}</span><h1 class="disp big" style="font-size:136px">${esc(COPY.outro.big)}</h1><span class="urlbox">${esc(COPY.outro.url)}</span><div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">${COPY.outro.dates.map((d) => `<p class="small" style="font-size:40px">${esc(d)}</p>`).join("")}</div><div style="height:220px"></div>`), `${pad(n++)}-go-learn.png`);

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fs.readdirSync(out).join("\n"));
