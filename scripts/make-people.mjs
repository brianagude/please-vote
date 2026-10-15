// Draws the background people: small, loose marker sketches of ordinary
// people standing around, scattered down the page margins. Original drawings
// made by this script; generic people only (no signs, flags, or symbols).
//
//   node scripts/make-people.mjs
//   -> public/people/left-{0,1,2}.svg, public/people/right-{0,1,2}.svg
//
// Some pairs hold a PLEASE VOTE or VOTE banner between them.
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
  const banners = [];
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
    // Now and then, two people side by side holding a banner between them.
    if (!near && r() < 0.07) {
      const d = 58 + r() * 26;
      const y2 = y + (r() - 0.5) * 8;
      const h2 = h * (0.92 + r() * 0.16);
      if (x + d > W - 26 || spots.some((p) => Math.abs(p.x - (x + d)) < 30 && Math.abs(p.y - y2) < Math.max(p.h, h2) * 0.95)) continue;
      const a = { x, y, h, ...traits(r), bannerSide: 1, sign: null, wave: false, bag: false, lean: 0 };
      const b = { x: x + d, y: y2, h: h2, ...traits(r), bannerSide: -1, sign: null, wave: false, bag: false, lean: 0 };
      spots.push(a, b);
      banners.push({ a, b, text: r() < 0.6 ? "PLEASE VOTE" : "VOTE" });
      continue;
    }
    spots.push({ x, y, h, ...traits(r) });
  }
  return { people: spots.sort((a, b) => a.y - b.y), banners }; // people in front drawn last
}

/** What kind of person: build, pose, and what they're holding. Fixed across frames. */
function traits(r) {
  const t = {
    coat: r() < 0.3,
    skirt: r() < 0.22,
    walk: r() < 0.25,
    pockets: r() < 0.45,
    bag: r() < 0.06,
    // Rally things, all nonpartisan: VOTE, PLEASE VOTE, and I VOTED signs, a check
    // mark, unreadable scribbles, or just waving. Never names, parties, issues, or flags.
    sign: (() => {
      const v = r();
      return v < 0.1 ? "vote" : v < 0.16 ? "please" : v < 0.21 ? "ivoted" : v < 0.27 ? "check" : v < 0.34 ? "scribble" : null;
    })(),
    wave: r() < 0.14,
    hat: r() < 0.15,
    hair: r() < 0.3,
    light: r() < 0.3, // light shirt: outlined instead of filled
    facing: r() < 0.5 ? -1 : 1,
    wide: 0.85 + r() * 0.35,
    lean: (r() - 0.5) * 7, // degrees; nobody stands perfectly straight
  };
  if (t.sign) t.wave = false; // one raised hand per person
  return t;
}

// Hand-lettered capitals: each letter is a few marker strokes in a 0..1 box.
const LETTERS = {
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.22, 0.62], [0.78, 0.62]]],
  D: [[[0, 0], [0, 1], [0.55, 1], [0.92, 0.78], [1, 0.5], [0.92, 0.22], [0.55, 0], [0, 0]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.75, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]]],
  L: [[[0, 0], [0, 1], [1, 1]]],
  O: "ellipse",
  P: [[[0, 1], [0, 0], [0.75, 0], [1, 0.22], [0.75, 0.48], [0, 0.48]]],
  S: [[[1, 0.12], [0.75, 0], [0.25, 0], [0, 0.2], [0.2, 0.44], [0.8, 0.56], [1, 0.8], [0.75, 1], [0.25, 1], [0, 0.88]]],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  V: [[[0, 0], [0.5, 1], [1, 0]]],
};

/** Write text in marker strokes inside a box (x0, y0, w, h). Narrow letters take less room. */
function lettering(text, x0, y0, w, h, lw, J) {
  const width = (ch) => (ch === "I" ? 0.35 : ch === " " ? 0.55 : 1);
  const total = [...text].reduce((n, ch) => n + width(ch), 0) + (text.length - 1) * 0.18;
  const lwid = w / total;
  let u = x0;
  const out = [];
  for (const ch of text) {
    const cw = lwid * width(ch);
    const L = LETTERS[ch];
    if (L === "ellipse") out.push(`<ellipse cx="${f(u + cw / 2 + J(0.3))}" cy="${f(y0 + h / 2 + J(0.3))}" rx="${f((cw / 2) * 0.95)}" ry="${f(h / 2)}" stroke-width="${lw}"/>`);
    else if (L) for (const line of L) out.push(`<path d="M${line.map(([a, b]) => `${f(u + a * cw + J(0.3))} ${f(y0 + b * h + J(0.3))}`).join("L")}" stroke-width="${lw}"/>`);
    u += cw + lwid * 0.18;
  }
  return out.join("");
}

/** A sign on a stick, held up from (hx, hy). Board is paper-colored so it covers what's behind. */
function sign(p, hx, hy, J) {
  const h = p.h;
  const bw = h * ({ vote: 0.5, please: 0.56, ivoted: 0.62 }[p.sign] ?? 0.4);
  const bh = h * (p.sign === "please" ? 0.38 : 0.26);
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
  const pad = bw * 0.12;
  if (p.sign === "vote") inner.push(lettering("VOTE", x0 + pad, y0 + bh * 0.26, bw - pad * 2, bh * 0.5, lw, J));
  else if (p.sign === "ivoted") inner.push(lettering("I VOTED", x0 + pad * 0.8, y0 + bh * 0.28, bw - pad * 1.6, bh * 0.46, f(lw * 0.9), J));
  else if (p.sign === "please") {
    inner.push(lettering("PLEASE", x0 + pad, y0 + bh * 0.14, bw - pad * 2, bh * 0.3, f(lw * 0.85), J));
    inner.push(lettering("VOTE", x0 + pad * 1.6, y0 + bh * 0.56, bw - pad * 3.2, bh * 0.3, f(lw * 0.85), J));
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

/** A cloth banner strung between two people's raised hands, sagging a little. */
function banner({ a, b, text }, j) {
  const J = (n) => (j() - 0.5) * 2 * n;
  const [ax, ay] = a.hand;
  const [bx, by] = b.hand;
  const h = (a.h + b.h) / 2;
  const poleTop = Math.min(ay, by) - h * 0.3;
  const bot = poleTop + h * 0.26;
  const sag = 2 + J(1);
  const out = [];
  // Two short poles from the hands up to the banner's top corners.
  out.push(`<path d="M${f(ax)} ${f(ay + h * 0.02)}L${f(ax + J(0.5))} ${f(poleTop)}M${f(bx)} ${f(by + h * 0.02)}L${f(bx + J(0.5))} ${f(poleTop)}" stroke-width="${f(h * 0.022)}"/>`);
  const mid = (ax + bx) / 2;
  out.push(`<path d="M${f(ax)} ${f(poleTop + J(0.5))}Q${f(mid)} ${f(poleTop + sag)} ${f(bx)} ${f(poleTop + J(0.5))}L${f(bx + J(0.5))} ${f(bot)}Q${f(mid)} ${f(bot + sag)} ${f(ax + J(0.5))} ${f(bot)}Z" class="board" stroke-width="${f(1 + h * 0.008)}"/>`);
  const pad = (bx - ax) * 0.1;
  out.push(lettering(text, ax + pad, poleTop + (bot - poleTop) * 0.28 + sag * 0.5, bx - ax - pad * 2, (bot - poleTop) * 0.46, f(h * 0.018), J));
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
  const up = p.bannerSide || (p.sign || p.wave ? p.facing : 0); // which arm is raised
  const arm = (side) => {
    if (side === up) {
      const tx = x + side * sh * 1.35;
      const ty = neckY - h * (p.sign ? 0.16 : 0.22);
      if (p.bannerSide) p.hand = [tx, ty]; // where the banner attaches
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
  const { people, banners } = layout(layoutSeed);
  const j = rng(layoutSeed * 31 + frame * 977 + 7);
  const body = people.map((p) => person(p, j)).join("") + banners.map((bn) => banner(bn, j)).join("");
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
