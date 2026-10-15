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
    const y = near ? near.y + (r() - 0.5) * 70 : 110 + r() * (H - 130);
    const h = 46 + r() * 34;
    if (x < 26 || x > W - 26 || y < 110 || y > H - 12) continue;
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
      bag: r() < 0.06,
      // Rally things, all nonpartisan: a VOTE sign, a check-mark sign, a sign with
      // unreadable scribbles, or just waving. Never names, parties, issues, or flags.
      sign: (() => {
        const v = r();
        return v < 0.14 ? "vote" : v < 0.22 ? "check" : v < 0.32 ? "scribble" : null;
      })(),
      wave: r() < 0.14,
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

// Hand-lettered "VOTE": each letter is a few marker strokes in a 0..1 box.
const LETTERS = {
  V: [[[0, 0], [0.5, 1], [1, 0]]],
  O: "ellipse",
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.75, 0.5]]],
};

/** A sign on a stick, held up from (hx, hy). Board is paper-colored so it covers what's behind. */
function sign(p, hx, hy, J) {
  const h = p.h;
  const bw = h * (p.sign === "vote" ? 0.5 : 0.4);
  const bh = h * 0.26;
  const top = hy - h * 0.34; // stick top = board bottom
  const cx = hx + J(1.5);
  const tilt = f(J(6));
  const out = [];
  out.push(`<path d="M${f(hx)} ${f(hy + h * 0.02)}L${f(cx + J(0.6))} ${f(top)}" stroke-width="${f(h * 0.022)}"/>`);
  const x0 = cx - bw / 2, y0 = top - bh;
  const P = (u, v, n = 0.5) => `${f(x0 + u * bw + J(n))} ${f(y0 + v * bh + J(n))}`;
  const inner = [];
  inner.push(`<path d="M${P(0, 0)}L${P(1, 0)}L${P(1, 1)}L${P(0, 1)}Z" class="board" stroke-width="${f(1 + h * 0.008)}"/>`);
  const lw = f(h * 0.02);
  if (p.sign === "vote") {
    const pad = 0.12, lwid = (1 - pad * 2) / 4.4, gap = lwid * 0.13;
    "VOTE".split("").forEach((ch, i) => {
      const u0 = pad + i * (lwid + gap), v0 = 0.26, lh = 0.5;
      const L = LETTERS[ch];
      if (L === "ellipse") inner.push(`<ellipse cx="${f(x0 + (u0 + lwid / 2) * bw + J(0.3))}" cy="${f(y0 + (v0 + lh / 2) * bh + J(0.3))}" rx="${f((lwid / 2) * bw * 0.95)}" ry="${f((lh / 2) * bh)}" stroke-width="${lw}"/>`);
      else for (const line of L) inner.push(`<path d="M${line.map(([a, b]) => P(u0 + a * lwid, v0 + b * lh, 0.3)).join("L")}" stroke-width="${lw}"/>`);
    });
  } else if (p.sign === "check") {
    inner.push(`<path d="M${P(0.32, 0.5, 0.4)}L${P(0.46, 0.72, 0.4)}L${P(0.7, 0.24, 0.4)}" stroke-width="${f(h * 0.035)}"/>`);
  } else {
    // Lettering too small to read: a couple of scribbled lines.
    for (const v of [0.35, 0.65]) {
      let d = `M${P(0.15, v, 0.3)}`;
      for (let u = 0.22; u <= 0.85; u += 0.07) d += `L${P(u, v + (Math.round(u * 100) % 2 ? -0.1 : 0.1), 0.4)}`;
      inner.push(`<path d="${d}" stroke-width="${f(h * 0.014)}"/>`);
    }
  }
  out.push(`<g transform="rotate(${tilt} ${f(cx)} ${f(top)})">${inner.join("")}</g>`);
  return out.join("");
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

  // Arms: hanging or hands in pockets; one goes up to hold a sign or wave.
  const aw = f(h * 0.035);
  const handY = p.pockets ? hipY + h * 0.02 : hipY + h * 0.1;
  const handX = p.pockets ? hip * 0.9 : sh * 1.05;
  const up = p.sign || p.wave ? p.facing : 0; // which arm is raised
  const arm = (side) => {
    if (side === up) {
      const tx = x + side * sh * 1.35;
      const ty = neckY - h * (p.sign ? 0.16 : 0.22);
      return `M${pt(x + side * sh, neckY + h * 0.05)}Q${pt(x + side * sh * 1.6, neckY - h * 0.02)} ${pt(tx, ty)}`;
    }
    return `M${pt(x + side * sh, neckY + h * 0.05)}Q${pt(x + side * sh * 1.25, (neckY + handY) / 2)} ${pt(x + side * handX, handY)}`;
  };
  out.push(`<path d="${arm(-1)}${arm(1)}" stroke-width="${aw}"/>`);
  if (p.wave) {
    // A little open hand at the top of the raised arm, with a couple of motion ticks.
    const tx = x + up * sh * 1.35, ty = neckY - h * 0.22;
    out.push(`<circle cx="${f(tx + J(0.5))}" cy="${f(ty - h * 0.02 + J(0.5))}" r="${f(h * 0.028)}" class="fill"/>`);
    out.push(`<path d="M${pt(tx + up * h * 0.07, ty - h * 0.06, 0.6)}l${f(up * h * 0.04)} ${f(-h * 0.02)}M${pt(tx + up * h * 0.075, ty + h * 0.0, 0.6)}l${f(up * h * 0.045)} 0" stroke-width="0.8"/>`);
  }
  if (p.bag) {
    const bx = x + -p.facing * sh * 1.3;
    out.push(`<path d="M${pt(bx - 4, handY + 1)}L${pt(bx + 4, handY + 1)}L${pt(bx + 5, handY + h * 0.11)}L${pt(bx - 5, handY + h * 0.11)}Z" class="fill"/>`);
  }

  // Head: a filled blob, nudged the way they're facing; sometimes hair or a hat.
  const hx = x + p.facing * h * 0.01;
  const hy = neckY - headR * 1.05;
  out.push(`<ellipse cx="${f(hx + J(0.6))}" cy="${f(hy + J(0.6))}" rx="${f(headR * (0.85 + J(0.05)))}" ry="${f(headR * (1.05 + J(0.05)))}" class="fill"/>`);
  if (p.hair) out.push(`<path d="M${pt(hx - headR, hy - headR * 0.2, 0.6)}Q${pt(hx - headR * 1.4, hy + headR * 1.6, 0.8)} ${pt(hx - headR * 0.6, hy + headR * 2.2, 0.6)}" stroke-width="${f(headR * 0.6)}"/>`);
  if (p.hat) out.push(`<path d="M${pt(hx - headR * 1.6, hy - headR * 0.55, 0.5)}L${pt(hx + headR * 1.6, hy - headR * 0.55, 0.5)}" stroke-width="${f(headR * 0.5)}"/>`);

  if (p.sign) out.push(sign(p, x + up * sh * 1.35, neckY - h * 0.16, J));
  return `<g transform="rotate(${f(p.lean + J(0.6))} ${f(x)} ${f(y)})">${out.join("")}</g>`;
}

function tile(layoutSeed, frame) {
  const people = layout(layoutSeed);
  const j = rng(layoutSeed * 31 + frame * 977 + 7);
  const body = people.map((p) => person(p, j)).join("");
  // A little turbulence roughens every edge like a felt-tip marker on paper.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><filter id="m" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="${frame + 3}"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter><style>path,ellipse{stroke:#2b2824;fill:none;stroke-linecap:round;stroke-linejoin:round}.fill{fill:#2b2824;stroke-width:.8}.board{fill:#f2eee3}</style></defs><g filter="url(#m)">${body}</g></svg>\n`;
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
