// Renders a looping 16:9 video of the share image with the little people
// animating (the same "line boil" as the site). For portfolio use.
//
//   FFMPEG=/path/to/ffmpeg node scripts/make-portfolio-video.mjs
//   -> exports/please-vote-4k.mp4 (3840x2160) and exports/please-vote-1080p.mp4
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const FRAMES = 3; // the three drawings of each strip
const HOLD = 0.3; // seconds each drawing shows (same pace as the site)
const LOOPS = 20; // 20 x 0.9s = 18 seconds, loops seamlessly

const b64 = (file) => `data:image/svg+xml;base64,${fs.readFileSync(file).toString("base64")}`;
const noise =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .15 0 0 0 0 .12 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const html = (fr) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Sans:wght@400..700&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;background:#f2eee3 url("${noise}");color:#2b2824;font-family:"Instrument Sans",sans-serif;position:relative;overflow:hidden}
.wrap{position:absolute;left:210px;right:210px;top:120px}
.lbl{font-family:Archivo;font-stretch:115%;font-weight:500;font-size:26px;letter-spacing:.2em;text-transform:uppercase;color:rgba(43,40,36,.68)}
.disp{font-family:Archivo;font-stretch:68%;font-weight:700;text-transform:uppercase;line-height:.9}
.sheet{border:4px solid #2b2824;background:#f7f4ec;display:grid;grid-template-columns:1fr 400px}
.sheet>div{padding:30px 38px 36px;display:flex;flex-direction:column;gap:16px}
.sheet>div+div{border-left:3px solid #2b2824;justify-content:space-between}
h1{font-size:208px}
.n{font-family:Archivo;font-stretch:68%;font-weight:700;color:#ad3f2c;font-size:120px;line-height:.9}
.row{border:4px solid #2b2824;border-top:0;background:#f7f4ec;padding:24px 38px;font-size:40px}
.people{position:absolute;left:0;right:0;background-repeat:repeat-x}
.back{bottom:150px;height:150px;background-image:url("${b64(`public/people/bottom-${fr}.svg`)}");background-size:auto 150px;background-position:-300px 0;opacity:.2}
.front{bottom:-10px;height:250px;background-image:url("${b64(`public/people/top-${fr}.svg`)}");background-size:auto 250px;background-position:-620px 0;opacity:.4}
</style></head><body>
<div class="wrap">
  <div class="sheet">
    <div><span class="lbl">Georgia general election</span><h1 class="disp">Please Vote</h1></div>
    <div><span class="lbl">Election day</span><span class="n">NOV 3</span><span style="font-size:32px">Polls 7 a.m. – 7 p.m.</span></div>
  </div>
  <div class="row">When to vote, what's on your ballot, and who's running.</div>
</div>
<div class="people back"></div>
<div class="people front"></div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-video-"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
for (let fr = 0; fr < FRAMES; fr++) {
  await page.setContent(html(fr), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(tmp, `f${fr}.png`) });
}
await browser.close();

// Play the three drawings in order, over and over, each held for HOLD seconds.
const list = [];
for (let i = 0; i < LOOPS; i++) for (let fr = 0; fr < FRAMES; fr++) list.push(`file '${path.join(tmp, `f${fr}.png`)}'`, `duration ${HOLD}`);
list.push(`file '${path.join(tmp, `f${FRAMES - 1}.png`)}'`); // concat needs the last file repeated
fs.writeFileSync(path.join(tmp, "list.txt"), list.join("\n"));

fs.mkdirSync("exports", { recursive: true });
const encode = (out, scale) =>
  execFileSync(ffmpeg, [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"),
    ...(scale ? ["-vf", `scale=${scale}:flags=lanczos`] : []),
    "-t", String(LOOPS * FRAMES * HOLD), // exact length, so the loop has no hitch
    "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out,
  ]);
encode("exports/please-vote-4k.mp4");
encode("exports/please-vote-1080p.mp4", "1920:1080");
fs.copyFileSync(path.join(tmp, "f0.png"), "exports/please-vote-poster.png");
fs.rmSync(tmp, { recursive: true, force: true });
for (const f of ["please-vote-4k.mp4", "please-vote-1080p.mp4", "please-vote-poster.png"])
  console.log(`exports/${f}`, (fs.statSync(`exports/${f}`).size / 1e6).toFixed(1) + "MB");
