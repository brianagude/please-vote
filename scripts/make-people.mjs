// Draws the background people: small, loose marker sketches of ordinary
// people standing around, scattered down the page margins. Original drawings
// made by this script; generic people only (no signs, flags, or symbols).
//
//   node scripts/make-people.mjs
//   -> public/people/left-{0,1,2}.svg, public/people/right-{0,1,2}.svg
//
// Each side has 3 "frames": the same people, redrawn with slightly different
// wobble. Swapping between them gives hand-drawn "line boil" animation.
import fs from "node:fs";

const W = 340; // tile width (fits a side margin)
const H = 3200; // tile height (repeats down the page)
const FRAMES = 3;

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const f = (n) => Math.round(n * 10) / 10;

/** Pick where people stand: loose clusters, nobody overlapping. */
function layout(seed) {
  const r = rng(seed);
  const spots = [];
  let tries = 0;
  while (spots.length < 64 && tries++ < 12000) {
    // Sometimes start a small group next to someone already placed.
    const near = spots.length && r() < 0.45 ? spots[Math.floor(r() * spots.length)] : null;
    const x = near ? near.x + (r() - 0.5) * 90 : 20 + r() * (W - 40);
    const y = near ? near.y + (r() - 0.5) * 70 : 70 + r() * (H - 90);
    const h = 46 + r() * 34;
    if (x < 18 || x > W - 18 || y < 70 || y > H - 12) continue;
    // Uneven crowding: some stretches busy, others nearly empty.
    const busy = 0.5 + 0.5 * Math.sin(y / 170 + seed) * Math.cos(x / 90 + seed * 0.3);
    if (!near && r() > 0.25 + busy * 0.75) continue;
    if (spots.some((p) => Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < Math.max(p.h, h) * 0.95)) continue;
    spots.push({
      x,
      y,
      h,
      // What kind of person: build and pose, fixed across frames.
      coat: r() < 0.3,
      skirt: r() < 0.22,
      walk: r() < 0.25,
      pockets: r() < 0.45,
      bag: r() < 0.18,
      hat: r() < 0.15,
      hair: r() < 0.3,
      light: r() < 0.3, // light shirt: outlined instead of filled
      facing: r() < 0.5 ? -1 : 1,
      wide: 0.85 + r() * 0.35,
      lean: (r() - 0.5) * 7, // degrees; nobody stands perfectly straight
    });
  }
  return spots.sort((a, b) => a.y - b.y); // people in front drawn last
}

/** One person, drawn with the jitter of a single frame. */
function person(p, j) {
  const J = (n) => (j() - 0.5) * 2 * n;
  const { x, y, h } = p;
  const sh = h * 0.13 * p.wide; // shoulder half-width
  const hip = h * 0.1 * p.wide;
  const neckY = y - h * 0.8;
  const hipY = y - h * (p.coat ? 0.36 : 0.46);
  const headR = h * 0.07;
  const out = [];
  const pt = (px, py, n = 1.2) => `${f(px + J(n))} ${f(py + J(n))}`;

  // Shadow: a quick line on the ground, always to the left like late sun.
  out.push(`<path d="M${pt(x + h * 0.05, y + 1, 0.5)}L${pt(x - h * (0.38 + j() * 0.12), y + 1 + J(1), 0.8)}" stroke-width="${f(1 + j())}"/>`);

  // Legs
  const lw = f(h * 0.045 + J(0.4));
  if (p.skirt) {
    out.push(`<path d="M${pt(x - hip, hipY)}L${pt(x - hip * 1.5, y - h * 0.2)}L${pt(x + hip * 1.5, y - h * 0.2)}L${pt(x + hip, hipY)}Z" class="fill"/>`);
    out.push(`<path d="M${pt(x - hip * 0.5, y - h * 0.2)}L${pt(x - hip * 0.55, y)}M${pt(x + hip * 0.5, y - h * 0.2)}L${pt(x + hip * 0.5, y)}" stroke-width="${f(lw * 0.6)}"/>`);
  } else {
    const spread = p.walk ? h * 0.12 : h * 0.035;
    out.push(`<path d="M${pt(x - hip * 0.55, hipY)}L${pt(x - spread, y)}M${pt(x + hip * 0.55, hipY)}L${pt(x + spread * (p.walk ? 0.6 : 1), y)}" stroke-width="${lw}"/>`);
  }

  // Body: a slightly lopsided filled shape, or an outline for a light shirt.
  const body = `M${pt(x - sh, neckY + h * 0.03)}Q${pt(x, neckY - h * 0.02)} ${pt(x + sh, neckY + h * 0.03)}L${pt(x + hip * (p.coat ? 1.25 : 1), hipY)}L${pt(x - hip * (p.coat ? 1.25 : 1), hipY)}Z`;
  out.push(p.light ? `<path d="${body}" stroke-width="${f(1.3 + j() * 0.5)}"/>` : `<path d="${body}" class="fill"/>`);
  if (p.light) out.push(`<path d="M${pt(x + J(2), neckY + h * 0.06)}L${pt(x + J(2), hipY - 2)}" stroke-width="0.9"/>`); // shirt seam

  // Arms: hanging, hands in pockets, or one carrying a bag.
  const aw = f(h * 0.035);
  const handY = p.pockets ? hipY + h * 0.02 : hipY + h * 0.1;
  const handX = p.pockets ? hip * 0.9 : sh * 1.05;
  out.push(`<path d="M${pt(x - sh, neckY + h * 0.05)}Q${pt(x - sh * 1.25, (neckY + handY) / 2)} ${pt(x - handX, handY)}M${pt(x + sh, neckY + h * 0.05)}Q${pt(x + sh * 1.25, (neckY + handY) / 2)} ${pt(x + handX, handY)}" stroke-width="${aw}"/>`);
  if (p.bag) {
    const bx = x + p.facing * sh * 1.3;
    out.push(`<path d="M${pt(bx - 4, handY + 1)}L${pt(bx + 4, handY + 1)}L${pt(bx + 5, handY + h * 0.11)}L${pt(bx - 5, handY + h * 0.11)}Z" class="fill"/>`);
  }

  // Head: a filled blob, nudged the way they're facing; sometimes hair or a hat.
  const hx = x + p.facing * h * 0.01;
  const hy = neckY - headR * 1.05;
  out.push(`<ellipse cx="${f(hx + J(0.6))}" cy="${f(hy + J(0.6))}" rx="${f(headR * (0.85 + J(0.05)))}" ry="${f(headR * (1.05 + J(0.05)))}" class="fill"/>`);
  if (p.hair) out.push(`<path d="M${pt(hx - headR, hy - headR * 0.2, 0.6)}Q${pt(hx - headR * 1.4, hy + headR * 1.6, 0.8)} ${pt(hx - headR * 0.6, hy + headR * 2.2, 0.6)}" stroke-width="${f(headR * 0.6)}"/>`);
  if (p.hat) out.push(`<path d="M${pt(hx - headR * 1.6, hy - headR * 0.55, 0.5)}L${pt(hx + headR * 1.6, hy - headR * 0.55, 0.5)}" stroke-width="${f(headR * 0.5)}"/>`);

  return `<g transform="rotate(${f(p.lean + J(0.6))} ${f(x)} ${f(y)})">${out.join("")}</g>`;
}

function tile(layoutSeed, frame) {
  const people = layout(layoutSeed);
  const j = rng(layoutSeed * 31 + frame * 977 + 7);
  const body = people.map((p) => person(p, j)).join("");
  // A little turbulence roughens every edge like a felt-tip marker on paper.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><filter id="m" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="${frame + 3}"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter><style>path,ellipse{stroke:#2b2824;fill:none;stroke-linecap:round;stroke-linejoin:round}.fill{fill:#2b2824;stroke-width:.8}</style></defs><g filter="url(#m)">${body}</g></svg>\n`;
}

fs.mkdirSync("public/people", { recursive: true });
let total = 0;
for (const [side, seed] of [["left", 1964], ["right", 2026]])
  for (let fr = 0; fr < FRAMES; fr++) {
    const file = `public/people/${side}-${fr}.svg`;
    fs.writeFileSync(file, tile(seed, fr));
    total += fs.statSync(file).size;
  }
console.log(`people: ${FRAMES * 2} files, ${Math.round(total / 1024)}KB total`);
