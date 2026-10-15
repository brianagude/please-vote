// Draws the background crowd: rows of hand-drawn heads and shoulders, small
// and dense at the back, larger at the front, like a rally seen from the
// stage. Generic people only: no signs, flags, or podium.
//
//   node scripts/make-crowd.mjs   -> public/crowd-back.svg, public/crowd-front.svg
//
// Seeded, so the drawing is the same every time it's regenerated.
import fs from "node:fs";

let seed = 1964;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const jit = (n) => (rand() - 0.5) * 2 * n;
const f = (n) => Math.round(n * 10) / 10;

const W = 1600;
const H = 1000;

/** A wobbly closed loop, like a quick pen circle that doesn't quite meet. */
function head(cx, cy, r) {
  const pts = [];
  const start = rand() * Math.PI * 2;
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2 * 1.04;
    const rr = r * (1 + jit(0.09)) * (i % 2 ? 1.06 : 1); // slightly taller than wide
    pts.push([cx + Math.cos(a) * rr * 0.9, cy + Math.sin(a) * rr * 1.08]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += `Q${f(x0 + (x1 - x0) * 0.5 + jit(r * 0.12))} ${f(y0 + (y1 - y0) * 0.5 + jit(r * 0.12))} ${f(x1)} ${f(y1)}`;
  }
  return d;
}

/** Shoulders: one loose arc under the head. */
function shoulders(cx, top, r) {
  const w = r * (2.4 + jit(0.35));
  const h = r * (1.6 + jit(0.3));
  return `M${f(cx - w)} ${f(top + h)}Q${f(cx - w * 0.95 + jit(r * 0.2))} ${f(top + jit(r * 0.15))} ${f(cx + jit(r * 0.2))} ${f(top + jit(r * 0.1))}Q${f(cx + w * 0.95 + jit(r * 0.2))} ${f(top + jit(r * 0.15))} ${f(cx + w)} ${f(top + h)}`;
}

function rows(fromRow, toRow, total) {
  const out = [];
  for (let row = fromRow; row < toRow; row++) {
    const t = row / (total - 1); // 0 = back, 1 = front
    const r = 3.5 + t * t * 24; // head radius grows toward the front
    const y = 30 + Math.pow(t, 1.25) * (H - 60) + jit(2);
    const gap = r * (2.5 + jit(0.15));
    const offset = (row % 2) * gap * 0.5 + jit(gap * 0.3);
    for (let x = -gap + offset; x < W + gap; x += gap * (1 + jit(0.18))) {
      if (rand() < 0.04) continue; // an empty seat now and then
      const cx = x + jit(r * 0.3);
      const cy = y + jit(r * 0.25);
      const sw = f(0.6 + t * 1.6);
      // Hair or a hat: a darker fill on some heads, like a halftone print.
      const fill = rand() < 0.35 ? "currentColor" : "none";
      const fo = fill === "none" ? "" : ` fill-opacity="${f(0.25 + rand() * 0.35)}"`;
      // Far-away heads are just small ovals; the hand-drawn wobble only shows up close.
      if (r < 7) out.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 0.9)}" ry="${f(r * 1.08)}" fill="${fill}"${fo} stroke-width="${sw}"/>`);
      else out.push(`<path d="${head(cx, cy, r)}" fill="${fill}"${fo} stroke-width="${sw}"/>`);
      if (r > 5) out.push(`<path d="${shoulders(cx, cy + r * 1.05, r)}" fill="none" stroke-width="${sw}"/>`);
    }
  }
  return out.join("");
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" color="#2b2824"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;

const TOTAL = 20;
fs.writeFileSync("public/crowd-back.svg", svg(rows(0, 13, TOTAL)));
fs.writeFileSync("public/crowd-front.svg", svg(rows(13, TOTAL, TOTAL)));
for (const n of ["back", "front"]) console.log(n, Math.round(fs.statSync(`public/crowd-${n}.svg`).size / 1024) + "KB");
