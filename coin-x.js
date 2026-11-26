// coin-x.js — the coin window's extras (the owner, 2026-11-26: "응 다 진행하자"): ★ watch a coin (kept on this device),
// a move of 20 % since the last alert → a toast (and a browser notification while the tab is hidden), the price chart
// (Dexscreener's embed, loaded on a tap) and Buy here (Jupiter's plugin in a modal, the visitor's own wallet; if the
// plugin can't load, jup.ag's swap page opens with the coin already picked).
import { esc, note, usd, getJ, sol } from "/common.js";
import { t, tf } from "/i18n.js";
import { ic } from "/icons.js";

const KEY = "dc.watch", STEP = 0.2, SOL = "So11111111111111111111111111111111111111112";
export const watched = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
const save = (w) => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {} };
export const isWatched = (m) => !!watched()[m];
export function toggleWatch(c) {
  const w = watched();
  if (w[c.mint]) delete w[c.mint];
  else { w[c.mint] = { at: Date.now(), ref: c.mcapUsd || 0, sym: c.symbol }; try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch {} }
  save(w); dispatchEvent(new Event("watch:change"));
  return !!w[c.mint];
}
/// called after every refresh: a watched coin that moved STEP since its last alert speaks up once
export function checkAlerts(coins) {
  const w = watched(); let dirty = false;
  for (const c of coins) {
    const x = w[c.mint]; if (!x || !c.mcapUsd) continue;
    if (!x.ref) { x.ref = c.mcapUsd; dirty = true; continue; }
    const ch = c.mcapUsd / x.ref - 1;
    if (Math.abs(ch) < (x.step || STEP)) continue;
    const msg = `★ $${c.symbol} ${ch > 0 ? "▲" : "▼"} ${Math.abs(ch * 100).toFixed(0)}% · ${usd(c.mcapUsd)}`;
    note(msg, 5000);
    try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("GTAFUN", { body: msg, icon: "/images/icon-256.png", tag: "w-" + c.mint }); } catch {}
    x.ref = c.mcapUsd; dirty = true;
  }
  if (dirty) save(w);
}

/// the window's extra row: watch · chart · buy here
export function extrasHtml(c, CFG = {}) {
  const on = isWatched(c.mint), tg = CFG.links && CFG.links.tg, earns = c.kind !== "partner";
  return `<div class="cx-row two"><button type="button" class="cx-w${on ? " on" : ""}" data-cx="watch" aria-pressed="${on}"><span class="cx-star">${ic("star")}</span><span>${esc(on ? t("cxWatching", "Watching") : t("cxWatch", "Watch"))}</span></button>
    <button type="button" class="cx-buy" data-cx="buy">${esc(t("cxBuy", "Buy here"))}</button></div>
    <div class="cx-step"${on ? "" : " hidden"}><span>${esc(t("cxStepL", "Alert me at"))}</span>${[10, 20, 50].map((p) => `<button type="button" data-step="${p}" class="${Math.round(((watched()[c.mint] || {}).step || STEP) * 100) === p ? "on" : ""}">${p}%</button>`).join("")}</div>
    ${earns ? `<p class="cx-cb">${ic("cash")} ${esc(tf("cxCb", "0.3% of every trade of this coin comes back to you in {s}", { s: "$" + (CFG.ticker || "GTAFUN") }))}</p>` : ""}
    <p class="cx-note">${esc(t("cxWatchN", "Watching tells you when it moves 20% — while this page is open."))}${tg ? ` <a class="cx-tg" href="${esc(tg)}?start=w_${esc(c.mint)}_${Math.round(((watched()[c.mint] || {}).step || STEP) * 100)}" target="_blank" rel="noopener">${esc(t("cxTg", "Get its alerts on Telegram ›"))}</a>` : ""}</p>`;
}
/// the chart tab: Dexscreener's embed, made when the tab first opens
export function chartInto(box, c) { if (!box || box.firstChild) return; box.innerHTML = `<iframe title="Chart" loading="lazy" src="https://dexscreener.com/solana/${encodeURIComponent(c.mint)}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15"></iframe>`; }
/// the safety tab's holders: the ten biggest wallets (the curve / pool marked, the creator marked), as bars
export function holdersHtml(d, c) {
  const hs = (d && d.holders) || []; if (!hs.length) return "";
  const mx = Math.max(...hs.map((h) => h.pct || 0), 1);
  return `<div class="ch"><h5>${esc(t("chH", "Top holders"))}</h5><div class="ch-sum"><span>${esc(t("chTop", "Top 10 people"))} <b>${d.top10Pct != null ? d.top10Pct.toFixed(1) + "%" : "–"}</b></span><span>${esc(t("chDev", "Creator holds"))} <b>${d.creatorPct != null ? d.creatorPct.toFixed(2) + "%" : "–"}</b></span></div>
    ${hs.map((h, i) => { const tag = h.curve ? t("chCurve", "bonding curve") : h.owner && c && h.owner === c.creator ? t("chCreator", "creator") : ""; return `<div class="ch-r${h.curve ? " cv" : ""}${tag && !h.curve ? " dev" : ""}"><span class="n">${i + 1}</span><span class="w">${esc(h.owner ? h.owner.slice(0, 4) + "…" + h.owner.slice(-4) : "–")}${tag ? ` <em>${esc(tag)}</em>` : ""}</span><span class="bar"><i style="width:${((h.pct || 0) / mx) * 100}%"></i></span><b>${(h.pct || 0).toFixed(2)}%</b></div>`; }).join("")}</div>`;
}
export function wireExtras(el, c) {
  const row = el.querySelector(".cx-row"); if (!row) return;
  row.onclick = (e) => {
    const b = e.target.closest("[data-cx]"); if (!b) return; e.stopPropagation();
    const k = b.dataset.cx;
    if (k === "watch") { const on = toggleWatch(c); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.querySelector("span:last-child").textContent = on ? t("cxWatching", "Watching") : t("cxWatch", "Watch"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); note(on ? t("cxAdded", "Added to your watchlist.") : t("cxRemoved", "Removed from your watchlist.")); }
    if (k === "buy") buyHere(c);
    if (k === "sell") sellHere(c);
    const sp = row.parentNode && row.parentNode.querySelector(".cx-step"); if (sp && k === "watch") sp.hidden = !isWatched(c.mint);
  };
  const sp = el.querySelector(".cx-step"); if (sp) sp.onclick = (e) => { const b = e.target.closest("[data-step]"); if (!b) return; e.stopPropagation(); const w = watched(); if (!w[c.mint]) return; w[c.mint].step = Number(b.dataset.step) / 100; save(w);
    sp.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); const a = el.querySelector(".cx-tg"); if (a) a.href = a.href.replace(/_(10|20|50)$/, "_" + b.dataset.step); note(tf("cxStepSet", "You'll hear when it moves {p}%.", { p: b.dataset.step })); };
  // you hold it: how much, what it's worth, and a Sell button (the server reads the wallet: ?bag=)
  sol().then((S) => S && S.key && myBag(S.key)).then((b) => {
    const h = b && b.items.find((x) => x.mint === c.mint); if (!h || !el.isConnected) return;
    const p = document.createElement("p"); p.className = "cx-hold";
    p.innerHTML = `<span>${esc(t("cxHold", "You hold"))} <b>${esc(amtFmt(h.amt))}</b>${h.usd != null ? ` · ${usd(h.usd)}` : ""}</span><button type="button" data-cx="sell">${esc(t("cxSell", "Sell here"))}</button>`;
    row.after(p); p.onclick = (e) => { if (e.target.closest('[data-cx="sell"]')) { e.stopPropagation(); sellHere(c); } };
  }).catch(() => {});
}
const amtFmt = (x) => (x >= 1e9 ? (x / 1e9).toFixed(2) + "B" : x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : x.toFixed(x < 1 ? 4 : 2));
/// the city's coins a wallet holds (?bag=), a minute on this page
let BAGM = { k: "", at: 0, v: null };
export async function myBag(key, fresh) {
  if (!fresh && BAGM.k === key && Date.now() - BAGM.at < 60e3) return BAGM.v;
  const v = await getJ("?bag=" + encodeURIComponent(key)).catch(() => null); if (v && v.items) BAGM = { k: key, at: Date.now(), v }; return v;
}

let jupP = null;
const jup = () => (jupP = jupP || new Promise((ok, no) => {
  if (window.Jupiter) return ok(window.Jupiter);
  const s = document.createElement("script"); s.src = "https://plugin.jup.ag/plugin-v1.js"; s.async = true;
  const to = setTimeout(() => { jupP = null; no(new Error("timeout")); }, 9000);
  s.onload = () => { clearTimeout(to); window.Jupiter ? ok(window.Jupiter) : (jupP = null, no(new Error("no plugin"))); };
  s.onerror = () => { clearTimeout(to); jupP = null; no(new Error("load")); };
  document.head.appendChild(s);
}));
const jupPage = (c) => window.open(`https://jup.ag/swap/SOL-${encodeURIComponent(c.mint)}`, "_blank", "noopener");
/// the same swap, the other way: the coin in, SOL out
export async function sellHere(c) {
  note(t("cxBuyOpen", "Opening the swap…"), 2000);
  try {
    const J = await jup();
    J.init({ displayMode: "modal", formProps: { initialInputMint: c.mint, initialOutputMint: SOL, fixedMint: c.mint, swapMode: "ExactIn" }, branding: { name: "GTAFUN", logoUri: location.origin + "/images/logo-192.webp" } });
    if (typeof J.resume === "function") try { J.resume(); } catch {}
  } catch { window.open(`https://jup.ag/swap/${encodeURIComponent(c.mint)}-SOL`, "_blank", "noopener"); }
}
export async function buyHere(c) {
  note(t("cxBuyOpen", "Opening the swap…"), 2000);
  try {
    const J = await jup();
    J.init({ displayMode: "modal", formProps: { initialInputMint: SOL, initialOutputMint: c.mint, fixedMint: c.mint, fixedOutputMint: true, swapMode: "ExactIn" }, branding: { name: "GTAFUN", logoUri: location.origin + "/images/logo-192.webp" } });
    if (typeof J.resume === "function") try { J.resume(); } catch {}
  } catch { jupPage(c); }
}
