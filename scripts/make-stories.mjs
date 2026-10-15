// Instagram story cards (1080x1920) for one voter's ballot, styled like the site.
//
//   node scripts/make-stories.mjs "<street address, city, GA ZIP>"
//   -> exports/stories/01-....png ...
//
// Race cards use only sourced facts from data/states/ga (the same ones the site
// shows), candidates in last-name order, party as text. Edit COPY below for the
// intro and closing cards.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const COPY = {
  intro: {
    kicker: "Georgia · Nov 3, 2026",
    big: "Did you know?",
    body: "There are a bunch of Black women on the ballot this year.",
    small: "And I'm so excited about it.",
  },
  built: {
    big: "So I built something.",
    body: "A guide to who's on my ballot, what each office does, and what the candidates have actually done.",
  },
  outro: {
    kicker: "Georgia voters",
    big: "Go learn who you're voting for.",
    url: "vote.brianagude.com",
    dates: ["Early voting: now through Oct 30", "Election Day: Nov 3, 7 a.m. – 7 p.m."],
  },
};

const address = process.argv[2];
if (!address) throw new Error('Pass an address: node scripts/make-stories.mjs "123 Main St, Atlanta, GA 30303"');
const SITE = "https://vote.brianagude.com";
const D = "data/states/ga";
const read = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const races = read("races.json");
const offices = read("offices.json");
const money = read("generated/money.json");
const bills = read("generated/bills.json");
const photos = read("generated/photos.json");
const running = read("legislature-races.json");
const PARTY = { D: "Democrat", R: "Republican", L: "Libertarian", I: "Independent" };

// Which districts this address is in, from the site's own lookup.
const dist = await (await fetch(`${SITE}/api/district`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })).json();
if (!dist.match || dist.state !== "GA") throw new Error("Address not found in Georgia");

const words = (n) => n.replace(/["“”][^"“”]*["“”]/g, " ").replace(/,?\s+(Jr|Sr|II|III)\.?\s*$/, "").split(/\s+/).filter(Boolean);
const last = (n) => words(n).at(-1);
const initials = (n) => { const w = words(n); return (w[0][0] + (w.length > 1 ? w.at(-1)[0] : "")).toUpperCase(); };
const fmtMoney = (n) => (n >= 1e6 ? `$${Math.round(n / 1e5) / 10} million` : `$${(Math.round(n / 100) * 100).toLocaleString("en-US")}`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Up to 3 short, sourced facts for a candidate. */
function facts(c) {
  const out = (c.career ?? []).filter((f) => f.source).map((f) => f.text).slice(0, 2);
  const b = bills[c.id];
  if (b) out.push(`Wrote ${b.wrote} ${b.wrote === 1 ? "bill" : "bills"} since 2023; ${b.becameLaw ? `${b.becameLaw} became law` : "none became law"}`);
  const m = money[c.id];
  if (m && out.length < 3) out.push(`Raised ${fmtMoney(m.raised)} for this race`);
  return out.slice(0, 3);
}

const photoOf = (c) => {
  const p = c.photo?.src ?? photos[c.id]?.src;
  return p ? "file://" + path.resolve("public" + p) : null;
};

// ---- the cards ----
const cards = [];
const raceCard = (group, key, title, cands, note) => {
  const o = offices[key];
  // A short first sentence is often vague on its own; add the second one with the specifics.
  const what = o.one.length < 60 ? `${o.one} ${o.why}` : o.one;
  cards.push({ kind: "race", group, title, term: o.term?.replace("-year term", " years"), what, cands: [...cands].sort((a, b) => last(a.name).localeCompare(last(b.name))), note });
};
raceCard("Federal", "senate", "U.S. Senate", races.statewide.senate.candidates);
raceCard("Federal", "house", `U.S. House · District ${dist.house}`, races.house[dist.house].candidates);
for (const k of ["governor", "ltgov", "sos", "ag", "agr", "ins", "labor", "schools", "psc3", "psc5"])
  raceCard("State", k, offices[k].title, races.statewide[k].candidates);
const leg = [
  { title: `State Senate · District ${dist.upper}`, list: running.upper[dist.upper] ?? [] },
  { title: `State House · District ${dist.lower}`, list: running.lower[dist.lower] ?? [] },
];
cards.push({ kind: "leg", leg });

const total = cards.length;
const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
const people = (which, pos) => `<div class="people ${pos}" style="background-image:url('file://${path.resolve(`public/people/${which}-0.svg`)}')"></div>`;

const page = (inner, { topPeople = "top", bottomPeople = "bottom" } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{--s:1}
body{width:1080px;height:1920px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;position:relative;overflow:hidden}
.safe{position:absolute;left:60px;right:60px;top:250px;bottom:250px;display:flex;flex-direction:column;justify-content:center;gap:calc(26px*var(--s))}
.lbl{font-family:Archivo;font-stretch:115%;font-weight:500;font-size:calc(24px*var(--s));letter-spacing:.2em;text-transform:uppercase;color:rgba(43,40,36,.68)}
.disp{font-family:Archivo;font-stretch:68%;font-weight:700;text-transform:uppercase;line-height:.92}
.sheet{border:4px solid #2b2824;background:#f7f4ec}
.row{border-top:3px solid #2b2824;display:grid}.row:first-child{border-top:0}
.cell{padding:calc(20px*var(--s)) calc(26px*var(--s));display:flex;flex-direction:column;gap:calc(10px*var(--s));min-width:0}
.cell+.cell{border-left:3px solid #2b2824}
.head{background:#e8e2d4;grid-template-columns:1fr auto}
.title{font-size:calc(88px*var(--s))}
.what{font-size:calc(34px*var(--s));line-height:1.35}
.cands{grid-template-columns:1fr 1fr}
.cand{align-items:flex-start}
.pin{width:calc(190px*var(--s));height:calc(190px*var(--s));border-radius:50%;border:3px solid #2b2824;overflow:hidden;display:grid;place-items:center;background:#f7f4ec;font-family:Archivo;font-stretch:68%;font-weight:700;font-size:calc(70px*var(--s))}
.pin img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;filter:grayscale(1) sepia(.25) contrast(1.05)}
.name{font-size:calc(56px*var(--s));font-family:Archivo;font-stretch:75%;font-weight:700;text-transform:uppercase;line-height:.95;margin-top:calc(6px*var(--s))}
.party{font-size:calc(30px*var(--s));color:#5a554c}
.stamp{align-self:flex-start;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:calc(20px*var(--s));letter-spacing:.16em;text-transform:uppercase;color:#ad3f2c;border:3px solid #ad3f2c;padding:4px 10px 3px;transform:rotate(-2deg)}
.bio{font-size:calc(30px*var(--s));line-height:1.3}
ul.facts{list-style:none;display:flex;flex-direction:column;gap:calc(10px*var(--s));border-top:2px dashed #cfc8b8;padding-top:calc(12px*var(--s))}
ul.facts li{font-size:calc(26px*var(--s));line-height:1.3;padding-left:22px;position:relative}
ul.facts li::before{content:"";position:absolute;left:2px;top:.55em;width:9px;height:9px;border:2px solid #a39d91;border-radius:50%}
.foot{display:flex;justify-content:space-between;align-items:baseline}
.big{font-size:150px}
.lede{font-size:60px;line-height:1.2;font-weight:500;text-wrap:balance}
.small{font-size:40px;color:#5a554c}
.urlbox{align-self:flex-start;font-family:Archivo;font-stretch:110%;font-weight:600;font-size:46px;letter-spacing:.06em;color:#ad3f2c;border:4px solid #ad3f2c;padding:16px 26px 12px;transform:rotate(-2deg)}
.people{position:absolute;left:0;right:0;height:250px;background-repeat:repeat-x;background-size:auto 250px;opacity:.35}
.people.top{top:0;background-position:-180px 0}
.people.bottom{bottom:0;background-position:-520px 0}
.phone{align-self:center;width:520px;border:4px solid #2b2824;border-radius:38px;overflow:hidden;background:#f2eee3;box-shadow:12px 12px 0 #2b2824}
.phone img{display:block;width:100%}
</style></head><body>${topPeople ? people(topPeople, "top") : ""}${bottomPeople ? people(bottomPeople, "bottom") : ""}<div class="safe">${inner}</div></body></html>`;

const candHTML = (c) => {
  const ph = photoOf(c);
  const bio = c.bio?.source ? c.bio.text : null;
  const fs_ = facts(c);
  return `<div class="cell cand">
    <span class="pin">${ph ? `<img src="${ph}">` : esc(initials(c.name))}</span>
    <span class="name">${esc(c.name)}</span>
    <span class="party">${esc(PARTY[c.party] ?? c.party)}</span>
    ${c.incumbent ? `<span class="stamp">Has the job now</span>` : ""}
    ${bio ? `<p class="bio">${esc(bio)}</p>` : ""}
    ${fs_.length ? `<ul class="facts">${fs_.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  </div>`;
};

const htmlFor = (card, i) => {
  if (card.kind === "race")
    return page(`
      <div class="foot"><span class="lbl">On my ballot · ${card.group}</span><span class="lbl">${i + 1} / ${total}</span></div>
      <div class="sheet">
        <div class="row head"><div class="cell"><span class="lbl">Office</span><h1 class="disp title">${esc(card.title)}</h1></div>${card.term ? `<div class="cell"><span class="lbl">Term</span><span style="font-size:calc(34px*var(--s))">${esc(card.term)}</span></div>` : ""}</div>
        <div class="row"><div class="cell"><span class="lbl">What they do</span><p class="what">${esc(card.what)}</p></div></div>
        <div class="row cands">${card.cands.map(candHTML).join("")}</div>
      </div>
      <span class="lbl">Every fact + its source: vote.brianagude.com</span>`);
  // state lawmakers: both unopposed on this ballot
  return page(`
    <div class="foot"><span class="lbl">On my ballot · State lawmakers</span><span class="lbl">${i + 1} / ${total}</span></div>
    ${card.leg.map((l) => `<div class="sheet">
      <div class="row head" style="grid-template-columns:1fr"><div class="cell"><span class="lbl">Office</span><h1 class="disp title">${esc(l.title)}</h1></div></div>
      <div class="row"><div class="cell" style="flex-direction:row;align-items:center;gap:26px">${l.list.map((c) => `<span class="pin" style="width:150px;height:150px;font-size:56px">${esc(initials(c.name))}</span><div style="display:flex;flex-direction:column;gap:8px"><span class="name">${esc(c.name)}</span><span class="party">${esc(PARTY[c.party] ?? c.party)}</span>${c.incumbent ? `<span class="stamp">Has the job now</span>` : ""}</div>`).join("")}</div></div>
      ${l.list.length === 1 ? `<div class="row"><div class="cell"><p class="what">Only one person is running for this seat.</p></div></div>` : ""}
    </div>`).join("")}
    <span class="lbl">Candidate list: Georgia Secretary of State</span>`);
};

// ---- render ----
const out = "exports/stories";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-stories-"));
const browser = await chromium.launch();

// A real phone screenshot of the site (top of the page, no address typed in).
const phoneShot = path.join(tmp, "phone.png");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 3, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: "networkidle" });
  await p.screenshot({ path: phoneShot });
  await ctx.close();
}

const shoot = async (html, file) => {
  const f = path.join(tmp, "card.html");
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto("file://" + f, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  // Shrink text a little at a time until everything fits inside Instagram's safe area.
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
await shoot(page(`<span class="lbl">${esc(COPY.intro.kicker)}</span><h1 class="disp big">${esc(COPY.intro.big)}</h1><p class="lede">${esc(COPY.intro.body)}</p><p class="small">${esc(COPY.intro.small)}</p>`), `${pad(n++)}-intro.png`);
await shoot(page(`<h1 class="disp big" style="font-size:120px">${esc(COPY.built.big)}</h1><p class="lede" style="font-size:44px">${esc(COPY.built.body)}</p><div class="phone"><img src="file://${phoneShot}"></div>`), `${pad(n++)}-built.png`);
for (const [i, card] of cards.entries()) await shoot(htmlFor(card, i), `${pad(n++)}-${(card.title ?? "state-lawmakers").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`);
await shoot(page(`<span class="lbl">${esc(COPY.outro.kicker)}</span><h1 class="disp big" style="font-size:136px">${esc(COPY.outro.big)}</h1><span class="urlbox">${esc(COPY.outro.url)}</span><div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">${COPY.outro.dates.map((d) => `<p class="small" style="color:#2b2824">${esc(d)}</p>`).join("")}</div><div style="height:220px"></div>`), `${pad(n++)}-go-learn.png`);

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fs.readdirSync(out).join("\n"));
