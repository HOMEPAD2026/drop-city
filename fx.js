// fx.js — small motion helpers for the home page (2026-11-26): the dock's sliding pill. Loaded after site.js; nothing
// here is needed for the page to work.
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
