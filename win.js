// win.js — every window behaves the same on a phone (round K, the owner 2026-11-26: "다 진행하자"):
// the Back button / gesture closes the window instead of leaving the page (one history entry a window; an open coin gets
// its own address /coin/<mint>, so the bar can be copied and a reload lands on it), the page behind stops scrolling while
// a window is up, and on phones the coin and wallet windows are bottom sheets you can drag down to close.
// It watches the page for the windows (no opener has to call it), so a new window only needs a line in WINS.
const html = document.documentElement;
const WINS = [
  { sel: "#cmodal", open: (el) => !el.hidden, close: (el) => clickOr(el, ".wm-x", () => (el.hidden = true)), url: (el) => (el.dataset.coin ? "/coin/" + el.dataset.coin : null) },
  { sel: "#sheet", open: (el) => !el.hidden, close: (el) => clickOr(el, '[data-f="close"]', () => (el.hidden = true)), busy: (el) => !!el.querySelector('[data-f="go"]:disabled') },
  { sel: "#wmodal", open: (el) => !el.hidden, close: (el) => clickOr(el, ".wm-x", () => (el.hidden = true)) },
  { sel: ".srch-o:not(.bye)", open: () => true, close: (el) => clickOr(el, ".srch-x", () => el.remove()) },
  { sel: ".sl-wrap", open: () => true, close: (el) => clickOr(el, ".sl-x", () => el.remove()) },
  { sel: ".ce-pop:not(.bye)", open: () => true, close: (el) => clickOr(el, ".wm-x", () => el.remove()) },
  { sel: ".inv-pop", open: () => true, close: (el) => clickOr(el, ".wm-x", () => el.remove()) },
  { sel: ".cd-zoom", open: () => true, close: (el) => el.remove() },
  { sel: ".cd-rev", open: () => true, close: (el) => el.remove() },
];
function clickOr(el, sel, fb) { const b = el.querySelector(sel); if (b) b.click(); else fb(); }
const openNow = () => { const out = []; for (const w of WINS) for (const el of document.querySelectorAll(w.sel)) if (el.isConnected && w.open(el)) out.push({ w, el }); return out; };

let stack = [], ignore = 0, base = null;
const cardOf = (el) => el.querySelector(":scope > .cm-card, :scope > .wm-card, :scope > div[role=dialog], :scope > .sl-card, :scope > .srch-in") || null;
const FOC = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
// Tab stays inside the top window
addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || !stack.length) return; const top = stack[stack.length - 1].el;
  const f = [...top.querySelectorAll(FOC)].filter((x) => x.offsetParent !== null); if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
function sync() {
  const now = openNow();
  html.classList.toggle("win-open", now.length > 0);
  // newly opened → one history entry each
  for (const o of now) if (!stack.some((s) => s.el === o.el)) {
    const url = (o.w.url && o.w.url(o.el)) || null;
    if (!stack.length) base = location.pathname + location.search + location.hash;
    try { history.pushState({ dcWin: stack.length + 1 }, "", url || location.href); } catch {}
    // keyboard: the window is a modal dialog, focus moves into it (its close button — no keyboard popping up on a phone)
    o.prev = document.activeElement; const card = cardOf(o.el);
    if (card) { if (!card.getAttribute("role")) card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); }
    requestAnimationFrame(() => { const f = (card || o.el).querySelector(".wm-x, .sheet-x, .srch-x, .sl-x, button, [href]"); if (f && !o.el.contains(document.activeElement)) try { f.focus({ preventScroll: true }); } catch {} });
    stack.push(o);
  }
  // closed by its own × / backdrop / Esc → take its entry back off the history
  const gone = stack.filter((s) => !now.some((o) => o.el === s.el));
  if (gone.length) {
    stack = stack.filter((s) => !gone.includes(s));
    const back = gone[gone.length - 1].prev; if (back && back.isConnected && back.focus) try { back.focus({ preventScroll: true }); } catch {}
    if (history.state && history.state.dcWin) { ignore += gone.length; history.go(-gone.length); }
    else if (!stack.length && base) { try { history.replaceState(null, "", base); } catch {} }
  }
}
addEventListener("popstate", (e) => {
  if (ignore > 0) { ignore--; e.stopImmediatePropagation(); return; }
  const top = stack[stack.length - 1]; if (!top) return;
  if (top.w.busy && top.w.busy(top.el)) { try { history.pushState({ dcWin: stack.length }, "", location.href); } catch {} e.stopImmediatePropagation(); return; }
  stack.pop(); e.stopImmediatePropagation(); top.w.close(top.el);
}, true);

let q = 0;
new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; sync(); }); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

// ---- phones: drag a bottom sheet down to close it
const PHONE = matchMedia("(max-width: 760px)");
let drag = null;
addEventListener("touchstart", (e) => {
  if (!PHONE.matches || e.touches.length !== 1) return;
  const card = e.target.closest && e.target.closest(".cm-card, .wm-card"); if (!card) return;
  const r = card.getBoundingClientRect(), y = e.touches[0].clientY;
  // from the top strip (the grab handle / the header), or anywhere once the card is scrolled to its top
  if (y - r.top > 72 && card.scrollTop > 0) return;
  drag = { card, y0: y, dy: 0, top: y - r.top <= 72, st: card.scrollTop };
}, { passive: true });
addEventListener("touchmove", (e) => {
  if (!drag) return; const dy = e.touches[0].clientY - drag.y0;
  if (!drag.top && (drag.card.scrollTop > 0 || dy < 0)) { drag = null; return; }
  drag.dy = Math.max(0, dy); drag.card.style.transition = "none"; drag.card.style.transform = `translateY(${drag.dy}px)`;
}, { passive: true });
addEventListener("touchend", () => {
  if (!drag) return; const { card, dy } = drag; drag = null;
  card.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)";
  if (dy > 120) { card.style.transform = "translateY(100%)"; setTimeout(() => { card.style.transform = ""; card.style.transition = ""; const host = card.parentElement; const w = WINS.find((x) => host && host.matches(x.sel)); if (w) w.close(host); }, 200); }
  else { card.style.transform = ""; setTimeout(() => (card.style.transition = ""), 240); }
}, { passive: true });

export const winOpen = () => stack.length > 0;
