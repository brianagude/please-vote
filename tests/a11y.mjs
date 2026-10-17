// Accessibility audit (WCAG 2.2 AA) of the built site at desktop and phone
// widths, with every section opened. Run: npm run build && npm run test:a11y
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const server = spawn("npx", ["astro", "preview", "--port", "4329"], { stdio: "ignore" });
const url = "http://localhost:4329/";
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

let failed = 0;
const browser = await chromium.launch();
try {
  // The guide, plus person pages: a member of Congress, and a state lawmaker.
  for (const path of ["", "ny/", "ca/", "directory/", "404.html", "person/lucy-mcbath/", "person/jasmine-clark/", "person/alexandria-ocasio-cortez/", "person/scott-wiener/"])
  for (const width of [1100, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url + path, { waitUntil: "networkidle" });
    if (!path) {
      // Show a district's races too, as if the voter had entered an address.
      await page.selectOption("#sel-upper", "36");
      await page.selectOption("#sel-lower", "58");
      await page.fill("#zip", "30334");
    }
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`/${path} ${width}px: ${violations.length} problem type(s)${wide ? ", page scrolls sideways" : ""}`);
    for (const v of violations) console.log(`  ${v.id} (${v.nodes.length}): ${v.help}\n    e.g. ${v.nodes[0].target.join(" ")}`);
    failed += violations.length + (wide ? 1 : 0);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  // Killing npx doesn't stop Astro's preview server; stop it directly.
  spawn("npx", ["astro", "preview", "stop"], { stdio: "ignore" });
}
process.exit(failed ? 1 : 0);
