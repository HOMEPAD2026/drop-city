// fx.js — small motion helpers for the home page (2026-11-26): the dock's sliding pill. Loaded after site.js; nothing
// here is needed for the page to work.
import { t } from "/i18n.js";
const bar = document.querySelector(".bbar");
if (bar) {
  const pill = document.createElement("i"); pill.className = "bb-pill"; pill.setAttribute("aria-hidden", "true"); bar.prepend(pill);
  document.documentElement.classList.add("fx-pill");
  const move = () => {
    const on = bar.querySelector("a.on");
    if (!on || getComputedStyle(bar).display === "none") { pill.style.opacity = "0"; return; }
    const b = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
    pill.style.width = r.width + "px"; pill.style.transform = `translateX(${r.left - b.left}px)`; pill.style.top = (r.top - b.top) + "px"; pill.style.height = r.height + "px"; pill.style.opacity = "1";
  };
  new MutationObserver(move).observe(bar, { subtree: true, attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", move, { passive: true });
  move();
}

// install as an app (2026-11-26): the button shows only when the browser offers it (Android Chrome / Samsung Internet /
// desktop Chrome / Edge); it sits in the phone menu and in the footer
let deferred = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferred = e;
  if (document.querySelector(".inst")) return;
  const label = t("instApp", "Install the app");
  for (const host of [document.getElementById("links"), document.querySelector(".sitefoot .sf-end") || document.querySelector(".sitefoot")]) {
    if (!host) continue;
    const b = document.createElement("button"); b.type = "button"; b.className = "inst" + (host.id === "links" ? " nx" : ""); b.textContent = "⤓ " + label;
    b.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; document.querySelectorAll(".inst").forEach((x) => x.remove()); };
    host.appendChild(b);
  }
});
addEventListener("appinstalled", () => document.querySelectorAll(".inst").forEach((x) => x.remove()));

// pull to refresh on a phone (2026-11-26): pulled 80 px down at the top of the page → the coins read again
{
  let y0 = null, pulled = 0; const bar = document.createElement("div"); bar.className = "ptr"; bar.innerHTML = "<i></i>"; document.body.appendChild(bar);
  addEventListener("touchstart", (e) => { y0 = scrollY <= 0 && (document.scrollingElement ? document.scrollingElement.scrollTop : 0) <= 0 && !document.documentElement.classList.contains("win-open") && !document.querySelector(".cmodal:not([hidden]), .sheet:not([hidden]), .wmodal:not([hidden]), .sl-wrap, .cd-rev, .cd-zoom, .srch-o, .navlinks.open, .cd-mint") ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
  addEventListener("touchmove", (e) => { if (y0 == null) return; pulled = Math.max(0, Math.min(120, e.touches[0].clientY - y0)); bar.style.setProperty("--p", (pulled / 80).toFixed(2)); bar.classList.toggle("on", pulled > 4); bar.classList.toggle("ready", pulled >= 80); }, { passive: true });
  addEventListener("touchend", () => { if (y0 != null && pulled >= 80) { bar.classList.add("spin"); const ev = new CustomEvent("dc:refresh", { detail: {} }); dispatchEvent(ev); const t0 = Date.now();
    // the ring spins until the refresh has really finished (at least half a second), then a check, then it fades
    Promise.race([Promise.resolve(ev.detail.p), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}).finally(() => setTimeout(() => { bar.classList.add("done"); setTimeout(() => bar.classList.remove("spin", "on", "ready", "done"), 500); }, Math.max(0, 500 - (Date.now() - t0)))); } else bar.classList.remove("on", "ready"); y0 = null; pulled = 0; }, { passive: true });
}
