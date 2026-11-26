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
  for (const host of [document.getElementById("links"), document.querySelector(".sitefoot")]) {
    if (!host) continue;
    const b = document.createElement("button"); b.type = "button"; b.className = "inst" + (host.id === "links" ? " nx" : ""); b.textContent = "⤓ " + label;
    b.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; document.querySelectorAll(".inst").forEach((x) => x.remove()); };
    host.appendChild(b);
  }
});
addEventListener("appinstalled", () => document.querySelectorAll(".inst").forEach((x) => x.remove()));
