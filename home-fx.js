// home-fx.js — the home page's motion (2026-11-26, the owner: "다 진행"): THE GAME band comes alive (the picture drifts,
// a searchlight sweeps, the top coins float over it as signs, "N in the city now" from ?street), the coin rows drift on
// their own (paused on hover / touch), the main coin's card shines when its price moves, sections rise into view, a
// soft glow follows the pointer over cards, the hero's sky lags the scroll a little. Nothing here is needed for the page
// to work; reduced motion turns all of it off.
import { $, esc, usd, getJ, pic } from "/common.js";
import { t, tf } from "/i18n.js";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
const html = document.documentElement;

/// THE GAME band: signs for the three biggest coins + the live count of players in the streets
let hereAt = 0, here = null;
export async function paintBand(coins) {
  const band = document.querySelector("#play .cband-in"); if (!band) return;
  band.classList.add("live");
  if (!band.querySelector(".cb-lt")) band.insertAdjacentHTML("afterbegin", `<i class="cb-lt" aria-hidden="true"></i><i class="cb-lt b" aria-hidden="true"></i><div class="cb-sg" aria-hidden="true"></div>`);
  const top = coins.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 3);
  band.querySelector(".cb-sg").innerHTML = top.map((c, i) => `<span class="sg" style="--i:${i}">${pic(c)}<b>$${esc(c.symbol)}</b><small>${usd(c.mcapUsd)}</small></span>`).join("");
  if (Date.now() - hereAt > 30e3) { hereAt = Date.now(); const r = await getJ("?street=1").catch(() => null); if (r && Number.isFinite(r.here)) here = r.here; }
  let chip = band.querySelector(".cb-now"); if (!chip) { chip = document.createElement("span"); chip.className = "cb-now"; band.querySelector(".cband-t").prepend(chip); }
  chip.hidden = here == null;
  if (here != null) chip.innerHTML = `<i></i>${esc(here > 0 ? tf("cbNow", "{n} in the city now", { n: here }) : t("cbNow0", "The streets are open — be the first tonight"))}`;
}

/// the main coin's card shines once when its price changes between two reads
let lastPx = null;
export function shineMain(c) {
  const px = c && c.priceUsd; if (!px) return;
  if (lastPx != null && px !== lastPx && !RM) { const el = $("mainc"); if (el) { el.classList.remove("shine", "up", "dn"); void el.offsetWidth; el.classList.add("shine", px > lastPx ? "up" : "dn"); } }
  lastPx = px;
}

function once() {
  if (RM) return;
  // the coin rows drift sideways by themselves on wide screens, and stop while a pointer or finger is on them
  const rows = [...document.querySelectorAll(".hot-list")];
  let held = new Set(), last = performance.now(), acc = new Map();
  for (const r of rows) {
    r.addEventListener("pointerenter", () => held.add(r)); r.addEventListener("pointerleave", () => held.delete(r));
    r.addEventListener("touchstart", () => { held.add(r); clearTimeout(r._ht); }, { passive: true });
    r.addEventListener("touchend", () => { r._ht = setTimeout(() => held.delete(r), 4000); }, { passive: true });
    r.addEventListener("wheel", () => { held.add(r); clearTimeout(r._ht); r._ht = setTimeout(() => held.delete(r), 3000); }, { passive: true });
  }
  const step = (now) => {
    const dt = Math.min(64, now - last); last = now;
    if (!document.hidden && html.dataset.page === "home") for (const [i, r] of rows.entries()) {
      if (held.has(r) || r.scrollWidth <= r.clientWidth + 4) continue;
      const b = r.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) continue;
      const dir = i % 2 ? -1 : 1, a = (acc.get(r) || 0) + dir * dt * 0.018; // ~18 px a second
      const whole = Math.trunc(a); acc.set(r, a - whole);
      if (!whole) continue;
      const max = r.scrollWidth - r.clientWidth;
      if ((dir > 0 && r.scrollLeft >= max - 1) || (dir < 0 && r.scrollLeft <= 0)) { r.scrollTo({ left: dir > 0 ? 0 : max, behavior: "smooth" }); held.add(r); setTimeout(() => held.delete(r), 2500); continue; }
      r.scrollLeft += whole;
    }
    requestAnimationFrame(step);
  };
  if (innerWidth >= 700) requestAnimationFrame(step);

  // sections rise into view (the ones already on screen don't move)
  const secs = [...document.querySelectorAll("main > section.sec")];
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }, { rootMargin: "0px 0px -8% 0px" });
  for (const s of secs) { const b = s.getBoundingClientRect(); if (b.top < innerHeight) continue; s.classList.add("rise"); io.observe(s); }

  // a soft pink glow under the pointer over cards
  if (FINE) document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".hc, .cn-t, .tz, .lb-c, .ts, .cf");
    if (!c) return; const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px"); c.classList.add("glow");
  }, { passive: true });

  // the hero's sky lags the scroll a little (a transform only — nothing repaints)
  const sky = $("coast"), bg = document.querySelector(".hero-bg");
  if (sky) { let tk = false; addEventListener("scroll", () => { if (tk) return; tk = true; requestAnimationFrame(() => { tk = false; const y = Math.min(scrollY, 900) * 0.28; sky.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`; if (bg) bg.style.transform = sky.style.transform; }); }, { passive: true }); }
}

/// the headline: one gentle line-by-line rise, only right after the intro (never on a plain load — no flicker)
export function headline() {
  if (RM) return;
  const h = document.querySelector(".hero h1"); if (!h) return;
  h.classList.remove("hl-in"); void h.offsetWidth; h.classList.add("hl-in");
}

let started = false;
export function startFx() { if (started) return; started = true; try { once(); } catch {} }
