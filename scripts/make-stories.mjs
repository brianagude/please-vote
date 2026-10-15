// Instagram story cards (1080x1920) or a feed carousel (1080x1350) for one
// voter's ballot, styled like the site.
// These are for the owner's personal account, not the site: they pick which
// offices to show and list Democrats first. The site itself stays neutral.
//
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>"              -> exports/stories/ (featured women)
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>" story-ballot -> exports/stories-ballot/
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>" feed        -> exports/feed-ballot/
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>" feed-women  -> exports/feed-women/
//
// Edit COPY and OFFICES below.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const COPY = {
  intro: {
    kicker: "Georgia · Nov 3, 2026",
    big: "Did you know?",
    sub: "A lot of the Democratic candidates running for office this year are Black women (((((:",
    small: "So I built a site to help me learn about who's on my ballot.",
  },
  outro: {
    kicker: "Georgia voters",
    big: "Please learn who you're voting for.",
    url: "vote.brianagude.com",
    dates: ["Early voting: now through Oct 30", "Election Day: Nov 3, 7 a.m. – 7 p.m."],
  },
};

// Which races to show, in order. "@house", "@upper", "@lower" are the voter's districts.
const OFFICES = ["@house", "governor", "sos", "ag", "agr", "ins", "labor", "schools", "@upper", "@lower"];
// Sizes per format. "safe" keeps text clear of Instagram's own buttons and labels.
const FORMATS = {
  story: { w: 1080, h: 1920, safeTop: 250, safeBottom: 250, people: 250, perSlide: 4, out: "exports/stories", outroNote: "", featured: true },
  "story-ballot": { w: 1080, h: 1920, safeTop: 250, safeBottom: 250, people: 250, perSlide: 5, out: "exports/stories-ballot", outroNote: "" },
  feed: { w: 1080, h: 1350, safeTop: 175, safeBottom: 185, people: 160, perSlide: 4, out: "exports/feed-ballot", outroNote: "Link in bio" },
  "feed-women": { w: 1080, h: 1350, safeTop: 175, safeBottom: 185, people: 160, perSlide: 3, out: "exports/feed-women", outroNote: "Link in bio", featured: true },
};
const F = FORMATS[process.argv[3] ?? "story"];
if (!F) throw new Error('Format must be "story", "story-ballot", "feed", or "feed-women"');
const PARTY_ORDER = ["D", "R", "L", "I"]; // Democrats first

// The feed carousel features these candidates (owner's list), each with her own card.
const FOOTER = "More on every candidate @ vote.brianagude.com";

const FEATURED = [
  "Lucy McBath",
  "Keisha Lance Bottoms",
  "Penny Brown Reynolds",
  "Tanya Miller",
  "Katherine E. Juhan-Arnold",
  "Keisha Sean Waites",
  "Nikki Porcher",
  "Lydia Powell",
  "Kenya Wicks",
  "Debra Bazemore",
];

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
const congress = read("generated/congress.json");
const bills = read("generated/bills.json");
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
// Split items evenly across as few slides as fit (e.g. 10 items, 4 max -> 4, 3, 3).
const split = (items, max) => {
  const count = Math.ceil(items.length / max);
  const out = [];
  for (let i = 0, start = 0; i < count; i++) {
    const size = Math.ceil((items.length - start) / (count - i));
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
};
const slides = split(blocks, F.perSlide);
// Featured people for the feed carousel, with the office each is running for.
const featured = FEATURED.map((name) => {
  for (const b of blocks) {
    const c = b.cands.find((x) => x.name === name);
    if (c) return { ...c, office: b.title, inRace: b.cands.length };
  }
  throw new Error(`${name} isn't on this ballot`);
});

const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
const people = (which, pos) => `<div class="people ${pos}" style="background-image:url('file://${path.resolve(`public/people/${which}-0.svg`)}')"></div>`;

const page = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{--s:1}
body{width:${F.w}px;height:${F.h}px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;position:relative;overflow:hidden}
.safe{position:absolute;left:60px;right:60px;top:${F.safeTop}px;bottom:${F.safeBottom}px;display:flex;flex-direction:column;justify-content:center;gap:calc(22px*var(--s))}
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
.sub{font-size:56px;line-height:1.2;font-weight:600;text-wrap:pretty}
.light{color:#6d675d;font-size:36px}
.line{font-size:calc(24px*var(--s));line-height:1.3;color:#2b2824;text-wrap:pretty}
.big{text-wrap:pretty}
.urlbox{align-self:flex-start;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:46px;letter-spacing:.06em;color:#ad3f2c;border:4px solid #ad3f2c;padding:16px 26px 12px;transform:rotate(-2deg)}
.grid{display:flex;flex-direction:column;border:4px solid #2b2824;background:#f7f4ec}
.feat{display:grid;grid-template-columns:auto minmax(0,1fr);gap:calc(28px*var(--s));padding:calc(30px*var(--s)) 30px;border-top:3px solid #2b2824;align-items:start}
.feat:first-child{border-top:0}
.feat .pin{width:calc(230px*var(--s));height:calc(230px*var(--s))}
.feat.sparse{padding-top:calc(22px*var(--s));padding-bottom:calc(22px*var(--s))}
.feat.sparse .pin{width:calc(150px*var(--s));height:calc(150px*var(--s))}
.feat .info{display:flex;flex-direction:column;align-items:flex-start;gap:calc(8px*var(--s));min-width:0}
.feat .bio{font-size:calc(30px*var(--s));line-height:1.3;font-weight:500;text-wrap:pretty}
.feat ul{list-style:none;display:flex;flex-direction:column;gap:calc(8px*var(--s));border-top:2px dashed #cfc8b8;padding-top:calc(10px*var(--s));margin-top:calc(4px*var(--s));align-self:stretch}
.feat li{font-size:calc(26px*var(--s));line-height:1.3;padding-left:22px;position:relative;text-wrap:pretty}
.feat li::before{content:"";position:absolute;left:2px;top:.55em;width:9px;height:9px;border:2px solid #a39d91;border-radius:50%}
.feat .office{border:0;font-family:Archivo;font-stretch:115%;font-weight:500;font-size:calc(20px*var(--s));letter-spacing:.16em;text-transform:uppercase;color:rgba(43,40,36,.68);line-height:1.35}
.feat .name{font-size:calc(46px*var(--s))}
.people{position:absolute;left:0;right:0;height:${F.people}px;background-repeat:repeat-x;background-size:auto ${F.people}px;opacity:.35}
.people.top{top:0;background-position:-180px 0}
.people.bottom{bottom:0;background-position:-520px 0}
</style></head><body>${people("top", "top")}${people("bottom", "bottom")}<div class="safe">${inner}</div></body></html>`;

/** A few more sourced facts: career items, then congressional roles and bills (same data as the site). */
function moreFacts(c) {
  const out = (c.career ?? []).filter((f) => f.source).map((f) => f.text);
  const m = c.ids?.bioguide && congress[c.ids.bioguide];
  if (m)
    for (const r of m.committees.filter((r) => r.title)) {
      const what = r.parent ? `the ${r.committee} subcommittee` : `the ${r.committee}`;
      out.push(/ranking/i.test(r.title) ? `Top ${PARTY[c.party]} on ${what}` : /^chair/i.test(r.title) ? `Leads ${what}` : `${r.title}, ${what}`);
    }
  const b = c.id && bills[c.id];
  if (b) out.push(`Wrote ${b.wrote} ${b.wrote === 1 ? "bill" : "bills"} since 2023; ${b.becameLaw ? `${b.becameLaw} became law` : "none became law yet"}`);
  return out.slice(0, 4);
}

/** The candidate's one-line background from the site (sourced only), or "Running unopposed". */
const lineFor = (c, othersInRace) => (othersInRace === 1 ? "Running unopposed." : c.bio?.source ? c.bio.text : "");

const candHTML = (c, n) => {
  const ph = photoOf(c);
  return `<div class="cand">
    <span class="pin">${ph ? `<img src="${ph}">` : esc(initials(c.name))}</span>
    <span class="who"><span class="name">${esc(c.name)}</span><span class="party">${esc(PARTY[c.party] ?? c.party)}</span>${c.incumbent ? `<span class="stamp">Incumbent</span>` : ""}${lineFor(c, n) ? `<span class="line">${esc(lineFor(c, n))}</span>` : ""}</span>
  </div>`;
};
const featHTML = (c) => {
  const ph = photoOf(c);
  const facts = moreFacts(c);
  // Less to say -> a smaller photo, so sparse sections can share a card.
  return `<div class="feat${facts.length ? "" : " sparse"}">
    <span class="pin">${ph ? `<img src="${ph}">` : esc(initials(c.name))}</span>
    <div class="info">
      <span class="office">${esc(c.office)}</span>
      <span class="name">${esc(c.name)}</span>
      <span class="party">${esc(PARTY[c.party] ?? c.party)}</span>
      ${c.incumbent ? `<span class="stamp">Incumbent</span>` : ""}
      ${lineFor(c, c.inRace) ? `<p class="bio">${esc(lineFor(c, c.inRace))}</p>` : ""}
      ${facts.length ? `<ul>${facts.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </div>
  </div>`;
};
const officeHTML = (b) => `<div class="office"><h2 class="disp otitle">${esc(b.title)}</h2><div class="cands">${order(b.cands).map((c) => candHTML(c, b.cands.length)).join("")}</div></div>`;

// ---- render ----
const out = F.out;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-stories-"));
const browser = await chromium.launch();
const shoot = async (html, file) => {
  const f = path.join(tmp, "card.html");
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: F.w, height: F.h } });
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
await shoot(page(`<span class="lbl">${esc(COPY.intro.kicker)}</span><h1 class="disp big" style="font-size:150px">${esc(COPY.intro.big)}</h1><p class="sub">${esc(COPY.intro.sub)}</p><p class="small light">${esc(COPY.intro.small)}</p>`), `${pad(n++)}-intro.png`);
if (F.featured) {
  // Pack by how much each person has: measure every section at full size, then fill
  // each card up to what fits (and at most perSlide), in order. Sparse ones share a card;
  // detailed ones get room.
  const frame = (inner, label) => page(`<div style="display:flex;justify-content:space-between"><span class="lbl">On my ballot</span><span class="lbl">${label}</span></div><div class="grid">${inner}</div><span class="lbl">${esc(FOOTER)}</span>`);
  const mf = path.join(tmp, "measure.html");
  fs.writeFileSync(mf, frame(featured.map(featHTML).join(""), "0 / 0"));
  const mp = await browser.newPage({ viewport: { width: F.w, height: F.h } });
  await mp.goto("file://" + mf, { waitUntil: "networkidle" });
  await mp.evaluate(() => document.fonts.ready);
  const { heights, room } = await mp.evaluate(() => {
    const safe = document.querySelector(".safe");
    const grid = document.querySelector(".grid");
    const heights = [...grid.children].map((e) => e.getBoundingClientRect().height);
    // Everything on the card except the people: the label rows, the gaps, and the grid's border.
    const gap = parseFloat(getComputedStyle(safe).rowGap) || 0;
    const others = [...safe.children].filter((e) => e !== grid).reduce((n, e) => n + e.getBoundingClientRect().height, 0);
    const border = grid.getBoundingClientRect().height - heights.reduce((a, b) => a + b, 0);
    return { heights, room: safe.clientHeight - others - gap * (safe.children.length - 1) - border };
  });
  await mp.close();
  if (process.env.DEBUG) console.error("room", Math.round(room), "heights", heights.map(Math.round).join(","));
  // Try every way to split the list (in order) into cards. Keep splits where each card
  // fits and holds at most perSlide; pick the fewest cards, then the most even ones.
  const cap = room * 0.95;
  let best = null;
  for (let mask = 0; mask < 1 << (featured.length - 1); mask++) {
    const groups = [[0]];
    for (let i = 1; i < featured.length; i++) (mask & (1 << (i - 1)) ? groups.push([i]) : groups.at(-1).push(i));
    const sums = groups.map((g) => g.reduce((n, i) => n + heights[i], 0));
    if (sums.some((x) => x > cap) || groups.some((g) => g.length > F.perSlide)) continue;
    const score = [groups.length, Math.max(...sums) - Math.min(...sums)];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { groups, score };
  }
  const groups = best.groups.map((g) => g.map((i) => featured[i]));
  for (const [i, g] of groups.entries())
    await shoot(page(`<div style="display:flex;justify-content:space-between"><span class="lbl">On my ballot</span><span class="lbl">${i + 1} / ${groups.length}</span></div><div class="grid">${g.map(featHTML).join("")}</div><span class="lbl">${esc(FOOTER)}</span>`), `${pad(n++)}-women-${i + 1}.png`);
} else for (const [i, s] of slides.entries())
  await shoot(page(`<div style="display:flex;justify-content:space-between"><span class="lbl">On my ballot</span><span class="lbl">${i + 1} / ${slides.length}</span></div><div class="sheet">${s.map(officeHTML).join("")}</div><span class="lbl">${esc(FOOTER)}</span>`), `${pad(n++)}-ballot-${i + 1}.png`);
await shoot(page(`<span class="lbl">${esc(COPY.outro.kicker)}</span><h1 class="disp big" style="font-size:136px">${esc(COPY.outro.big)}</h1><span class="urlbox">${esc(COPY.outro.url)}</span><div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">${COPY.outro.dates.map((d) => `<p class="small" style="font-size:40px">${esc(d)}</p>`).join("")}</div>${F.outroNote ? `<p class="lbl" style="margin-top:16px">${esc(F.outroNote)}</p>` : `<div style="height:220px"></div>`}`), `${pad(n++)}-go-learn.png`);

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fs.readdirSync(out).join("\n"));
