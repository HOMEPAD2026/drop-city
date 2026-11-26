// icons.js — GTAFUN's own icon set (the owner, 2026-11-26: "아이콘도 고급을 써"): hand-drawn 24 px line icons in one SVG
// sprite (injected once), shown as ic(name) in the text's colour or tile(name, kind) — a glossy rounded tile in the Vice
// Night colours with the glyph in white. medal(n) is a metal coin with its place (gold / silver / bronze). No emoji.
const P = {
  flame: '<path d="M12 3c.6 3.1 4.6 5.1 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-2.1 1-3.4 2.1-4.3.2 1.5.9 2.4 1.9 2.7C11.1 8.4 11.5 5.6 12 3Z"/><path d="M12 14.3c1 .8 1.6 1.7 1.6 2.7a1.6 1.6 0 0 1-3.2 0c0-1 .6-1.9 1.6-2.7Z"/>',
  spark: '<path d="M11 3.5l1.7 4.9 4.9 1.7-4.9 1.7L11 16.7l-1.7-4.9-4.9-1.7 4.9-1.7Z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
  city: '<path d="M3 21h18"/><path d="M5 21V11l5-3v13"/><path d="M10 21V4.5l6 3V21"/><path d="M16 21v-8l3.5 1.6V21"/><path d="M12.5 9.5h1M12.5 12.5h1M12.5 15.5h1M7 13.5h.8M7 16.5h.8"/>',
  shield: '<path d="M12 3l7.5 3v5.6c0 4.6-3.1 8.1-7.5 9.4-4.4-1.3-7.5-4.8-7.5-9.4V6Z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.6"/>',
  trophy: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0Z"/><path d="M8 6H5.2a3 3 0 0 0 3 4.2M16 6h2.8a3 3 0 0 1-3 4.2"/><path d="M12 13.2V17M8.5 20.5h7M9.8 17h4.4"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>',
  slot: '<rect x="3.5" y="6" width="15" height="12.5" rx="2.5"/><path d="M8.5 6v12.5M13.5 6v12.5"/><path d="M18.5 10.5H21V6.5"/><circle cx="21" cy="5.5" r="1"/>',
  siren: '<path d="M7 18v-5a5 5 0 0 1 10 0v5"/><rect x="5" y="18" width="14" height="3" rx="1"/><path d="M12 2.8v2M4.6 5.6 6 7M19.4 5.6 18 7"/>',
  camera: '<path d="M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20V19H4Z"/><circle cx="12" cy="13.5" r="3.4"/>',
  rocket: '<path d="M12 3c3 2 5 5.6 5 9.6L14.6 16H9.4L7 12.6C7 8.6 9 5 12 3Z"/><circle cx="12" cy="10" r="1.7"/><path d="M10 19l2 2.2 2-2.2"/>',
  grad: '<path d="M2.5 9 12 5l9.5 4L12 13Z"/><path d="M6.5 11v4.6c1.5 1.4 3.5 2.1 5.5 2.1s4-.7 5.5-2.1V11M21.5 9v5"/>',
  cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.7"/><path d="M6.5 10v4M17.5 10v4"/>',
  crown: '<path d="M4 17h16l1.2-9-5.2 3.6L12 5l-4 6.6L2.8 8Z"/><path d="M5 20.5h14"/>',
  invite: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.3 19.5a5.7 5.7 0 0 1 11.4 0"/><path d="M18.5 8v6M15.5 11h6"/>',
  megaphone: '<path d="M4 10v4h3l8.5 4.5v-13L7 10Z"/><path d="M18.5 9.3a3.6 3.6 0 0 1 0 5.4"/><path d="M7 14l1.2 5h2.3"/>',
  drop: '<path d="M12 3.5c3.1 3.8 5.6 6.7 5.6 9.7a5.6 5.6 0 0 1-11.2 0c0-3 2.5-5.9 5.6-9.7Z"/><path d="M9.6 14a2.6 2.6 0 0 0 2.4 2.5"/>',
  cards: '<rect x="4.5" y="3.5" width="11" height="15.5" rx="2"/><path d="M8.5 21h9a2 2 0 0 0 2-2V7"/><path d="m10 8.3 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3Z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  up: '<path d="M6.5 14.5 12 9l5.5 5.5"/>',
  down: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
  bolt: '<path d="M13 2.8 5.5 13.2h5.2L10 21.2l7.5-10.4h-5.2Z"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="7.5" width="16.5" height="11.5" rx="2.5"/><circle cx="16.3" cy="13.2" r="1.2"/>',
};
const KINDS = { sun: 1, violet: 1, peach: 1, rose: 1, steel: 1 };
let done = false;
function sprite() {
  if (done || typeof document === "undefined") return; done = true;
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("aria-hidden", "true"); s.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  s.innerHTML = Object.entries(P).map(([k, d]) => `<symbol id="gi-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join("");
  (document.body || document.documentElement).prepend(s);
}
export const has = (n) => n in P;
/// a line icon in the text's colour
export function ic(n, cls = "") { sprite(); return `<svg class="gi${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><use href="#gi-${has(n) ? n : "star"}"/></svg>`; }
/// the glossy tile: sun (pink → coral → peach) · violet · peach · rose · steel
export function tile(n, kind = "sun", cls = "") { return `<span class="gt gt-${KINDS[kind] ? kind : "sun"}${cls ? " " + cls : ""}" aria-hidden="true">${ic(n)}</span>`; }
/// a metal medal with its place on it
export function medal(n) { const k = n === 1 ? "gold" : n === 2 ? "silver" : "bronze"; return `<span class="gm2 gm2-${k}" aria-label="#${n}"><b>${n}</b></span>`; }
/// fill the page's [data-ic="name"] / [data-ic="name:kind"] placeholders (tiles) and [data-gi] (plain icons)
export function fill(root = document) {
  sprite();
  root.querySelectorAll("[data-ic]").forEach((el) => { if (el.dataset.icDone) return; const [n, k] = el.dataset.ic.split(":"); el.outerHTML = tile(n, k || "sun"); });
  root.querySelectorAll("[data-gi]").forEach((el) => { if (el.dataset.icDone) return; el.innerHTML = ic(el.dataset.gi); el.dataset.icDone = "1"; });
}
if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill()); else fill(); }
