// tools/phone-audit.mjs — the phone walk before a deploy (round L, after K2 shipped an invisible window over the page):
// opens each page on a 390×844 touch screen and fails on
//   · anything fixed that covers most of the screen while no window is open (a hidden overlay that still catches taps)
//   · the page wider than the screen
//   · the toast drawn under an open window
//   · a tap at the screen's middle landing on something that isn't the page's own content
// Usage: node tools/phone-audit.mjs [base URL, default http://localhost:8791]   (PW = folder with node_modules/playwright)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pw = (() => { for (const p of [process.env.PW, process.cwd(), "/opt/node_modules", "/usr/lib/node_modules"]) { try { return require(require.resolve("playwright", { paths: [p].filter(Boolean) })); } catch {} } return require("playwright"); })();
const BASE = process.argv[2] || "http://localhost:8791";
const PAGES = ["/", "/#explore", "/#cards", "/#lp", "/#ranks", "/#launch", "/#fees", "/#wallets", "/#check", "/#about"];
let bad = 0; const fail = (m) => { bad++; console.log("FAIL", m); };
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("dc.lang", "ko"); localStorage.setItem("dc.introSeen", "1"); } catch {} });
for (const path of PAGES) {
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const W = innerWidth, H = innerHeight, out = { cover: [], wide: 0, mid: "" };
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el); if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") continue;
      const b = el.getBoundingClientRect(); if (b.width * b.height < W * H * 0.5) continue;
      if (el.matches(".intro, .zi, #intro, .ptr, canvas, .bg, .hero-bg, .coast, [aria-hidden=true]")) continue;
      out.cover.push((el.id ? "#" + el.id : "") + "." + String(el.className).split(" ")[0] + " op " + cs.opacity);
    }
    out.wide = document.documentElement.scrollWidth - W;
    const m = document.elementFromPoint(W / 2, H / 2); out.mid = m ? (m.closest(".cmodal, .wmodal, .sheet, .sl-wrap, .srch-o, .cd-zoom, .cd-rev, .cd-mint") ? "window" : "page") : "nothing";
    return out;
  });
  if (r.cover.length) fail(`${path}: something fixed covers the screen with no window open: ${r.cover.join(", ")}`);
  if (r.wide > 1) fail(`${path}: the page is ${r.wide}px wider than the screen`);
  if (r.mid !== "page") fail(`${path}: a tap in the middle lands on "${r.mid}"`);
  // open a coin's window: the toast must be above it
  if (path === "/") {
    await p.evaluate(() => { const b = document.querySelector(".hc, .cc"); if (b) b.click(); }); await p.waitForTimeout(700);
    const z = await p.evaluate(() => { const t = document.getElementById("toast"), m = document.getElementById("cmodal"); if (!t || !m || m.hidden) return null; return [Number(getComputedStyle(t).zIndex) || 0, Number(getComputedStyle(m).zIndex) || 0]; });
    if (!z) fail("/: the coin window didn't open"); else if (z[0] <= z[1]) fail(`/: the toast (z ${z[0]}) is under the coin window (z ${z[1]})`);
    await p.goBack(); await p.waitForTimeout(500);
    const still = await p.evaluate(() => !document.getElementById("cmodal").hidden); if (still) fail("/: Back didn't close the coin window");
  }
  await p.close(); console.log("ok", path);
}
await browser.close();
console.log(bad ? `phone-audit: ${bad} problem(s)` : "phone-audit: all clear"); process.exit(bad ? 1 : 0);
