// home-me.js — the home page's personal bits (2026-11-26, the owner: "다 진행"): "My corner" once a wallet is connected
// (cashback, watchlist, my coins, slot spins left, my profile), the leaderboard teasers (cashback top 3, City Slots'
// week top 3) and the search (name / ticker / CA — "/" or Ctrl+K opens it).
import { $, esc, short, usd, getJ, pic } from "/common.js";
import { t, tf } from "/i18n.js";
import { watched } from "/coin-x.js";
import { today } from "/slot-data.js";

const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : Math.round(x || 0).toString());
let ME = "", CB = null, cbAt = 0, SL = null, slAt = 0;

/// My corner: shown only with a wallet; every number is the server's (?cb=&w=) or this device's (watchlist, slot spins)
export async function paintCorner({ key, coins, CFG, openCoin, openSlot }) {
  if (key !== undefined) ME = key || "";
  const box = $("corner"); if (!box) return;
  document.documentElement.classList.toggle("has-w", !!ME);
  if (!ME) { box.innerHTML = ""; return; }
  if (Date.now() - cbAt > 60e3 || !CB || CB._w !== ME) { cbAt = Date.now(); CB = await getJ("?cb=1&w=" + encodeURIComponent(ME)).catch(() => null); if (CB) CB._w = ME; }
  const S = "$" + (CFG.ticker || "GTAFUN"), me = (CB && CB.me) || null;
  const w = watched(), wl = Object.keys(w).map((m) => coins.find((c) => c.mint === m)).filter(Boolean);
  const mine = coins.filter((c) => c.creator === ME);
  let sl = {}; try { sl = today(JSON.parse(localStorage.getItem("dc.slot") || "{}") || {}); } catch {}
  const chips = (l) => l.slice(0, 4).map((c) => `<button type="button" class="cn-chip" data-m="${esc(c.mint)}">${pic(c)}<span>$${esc(c.symbol)}</span></button>`).join("");
  box.innerHTML = `<div class="cn-h"><h3>${esc(t("cnH", "My corner"))}</h3><a href="/w/${esc(ME)}" class="cn-prof">${esc(short(ME))} · ${esc(t("cnProf", "My profile"))} ›</a></div>
    <div class="cn-g">
      <a class="cn-t" href="#lp"><small>${esc(t("cnCb", "My cashback"))}</small><b>${me ? fmt(me.earned) : "–"} <i>${esc(S)}</i></b><span>${me ? esc(me.rank ? tf("cnRank", "today +{d} · rank #{r}", { d: fmt(me.today), r: me.rank }) : tf("cnToday", "today +{d}", { d: fmt(me.today) })) : esc(t("cnCbNo", "Trade a city coin to earn 0.3% back"))}</span></a>
      <div class="cn-t"><small>${esc(t("cnWatch", "Watching"))} · ${wl.length}</small>${wl.length ? `<div class="cn-chips">${chips(wl)}</div>` : `<span>${esc(t("cnWatchNo", "Tap ★ Watch on a coin to follow it here"))}</span>`}</div>
      <div class="cn-t"><small>${esc(t("cnMine", "My coins"))} · ${mine.length}</small>${mine.length ? `<div class="cn-chips">${chips(mine)}</div>` : `<a class="cn-go" href="#launch">${esc(t("cnLaunch", "Launch your first coin"))} ›</a>`}</div>
      <button type="button" class="cn-t cn-slot"><small>${esc(t("cnSlot", "City Slots today"))}</small><b>${sl.spins ?? 10} <i>${esc(t("cnSpins", "spins left"))}</i></b><span>${esc(tf("cnStreak", "{n}-day streak · play ›", { n: sl.streak || 1 }))}</span></button>
    </div>`;
  box.onclick = (e) => { const c = e.target.closest("[data-m]"); if (c) { e.preventDefault(); openCoin(c.dataset.m); return; } if (e.target.closest(".cn-slot")) openSlot(); };
}

/// the leaderboard teasers: cashback's all-time top 3 and City Slots' week top 3 (a toy score)
export async function paintBoards({ CFG, openSlot }) {
  const box = $("lbt"); if (!box) return;
  if (Date.now() - slAt > 60e3) { slAt = Date.now(); SL = await getJ("?slots=1").catch(() => SL); }
  if (!CB || Date.now() - cbAt > 60e3) { const r = await getJ("?cb=1" + (ME ? "&w=" + encodeURIComponent(ME) : "")).catch(() => null); if (r) { CB = r; CB._w = ME; cbAt = Date.now(); } }
  const S = "$" + (CFG.ticker || "GTAFUN"), medal = ["🥇", "🥈", "🥉"];
  const rows = (l, unit) => (l.length ? l.slice(0, 3).map((x, i) => `<a class="lb-r${x.w === ME ? " me" : ""}" href="/w/${esc(x.w)}"><span>${medal[i]}</span><code>${esc(short(x.w))}</code><b>${fmt(x.v)} <i>${esc(unit)}</i></b></a>`).join("") : `<p class="fine">${esc(t("lbNone", "No one yet — be first."))}</p>`);
  const cbTop = ((CB && CB.top) || []).map((x) => ({ w: x.w, v: x.amt })), slTop = ((SL && SL.top) || []).map((x) => ({ w: x.w, v: x.pts }));
  box.innerHTML = `<div class="lb-c"><div class="lb-h"><h3>${esc(t("lbCb", "Cashback leaders"))}</h3><a href="#lp">${esc(t("hotAll", "See all ›"))}</a></div>${rows(cbTop, S)}</div>
    <div class="lb-c"><div class="lb-h"><h3>${esc(t("lbSlot", "City Slots · this week"))}</h3><button type="button" class="lb-play">${esc(t("lbPlay", "Play ›"))}</button></div>${rows(slTop, t("lbPts", "pts"))}<small class="lb-n">${esc(t("lbToy", "A toy score — never money or tokens."))}</small></div>`;
  box.querySelector(".lb-play").onclick = openSlot;
}

/// search: a top-bar button opens a sheet; results by ticker / name / CA as you type; a CA that isn't listed goes to Check a CA
export function initSearch({ coins: getCoins, openCoin }) {
  const btn = $("srch"); if (!btn) return;
  let el = null;
  const close = () => { if (!el) return; const x = el; el = null; x.classList.add("bye"); setTimeout(() => x.parentNode && x.parentNode.removeChild(x), 180); };
  const open = () => {
    if (el) return;
    el = document.createElement("div"); el.className = "srch-o"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", t("srchAl", "Search coins"));
    el.innerHTML = `<div class="srch-in"><div class="srch-bar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" placeholder="${esc(t("srchPh", "Name, $TICKER or CA"))}" autocomplete="off" spellcheck="false" enterkeyhint="search"><button type="button" class="srch-x" aria-label="Close">esc</button></div><div class="srch-r" role="listbox"></div></div>`;
    document.body.appendChild(el);
    const inp = el.querySelector("input"), out = el.querySelector(".srch-r");
    let sel = 0, list = [];
    const paint = () => {
      const raw = inp.value.trim(), q = raw.replace(/^\$/, "").toLowerCase(), all = getCoins();
      list = !q ? all.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 6) : all.filter((c) => c.mint.toLowerCase() === q || (c.symbol || "").toLowerCase().startsWith(q) || (c.name || "").toLowerCase().includes(q)).sort((a, b) => ((b.symbol || "").toLowerCase() === q) - ((a.symbol || "").toLowerCase() === q) || (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 8);
      const ca = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw) && !list.length;
      sel = Math.min(sel, Math.max(0, list.length - 1));
      out.innerHTML = (q ? "" : `<small class="srch-k">${esc(t("srchTop", "Top coins"))}</small>`) + list.map((c, i) => `<button type="button" class="srch-i${i === sel ? " on" : ""}" data-m="${esc(c.mint)}">${pic(c)}<span><b>$${esc(c.symbol)}</b><small>${esc(c.name || "")}</small></span><em>${usd(c.mcapUsd)}</em></button>`).join("")
        + (ca ? `<a class="srch-ca" href="#check" data-ca="${esc(raw)}">${esc(t("srchCheck", "Not listed here — check this CA ›"))}</a>` : q && !list.length ? `<p class="fine">${esc(t("srchNone", "No coin by that name."))}</p>` : "");
    };
    inp.oninput = () => { sel = 0; paint(); };
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (list.length) { sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length; paint(); } }
      else if (e.key === "Enter") { const ca = out.querySelector(".srch-ca"); if (list[sel]) { const m = list[sel].mint; close(); openCoin(m); } else if (ca) ca.click(); }
      else if (e.key === "Escape") close();
    };
    out.onclick = (e) => {
      const b = e.target.closest("[data-m]"); if (b) { close(); openCoin(b.dataset.m); return; }
      const a = e.target.closest(".srch-ca"); if (a) { const v = a.dataset.ca; close(); setTimeout(() => { const i = $("ck-m"); if (i) { i.value = v; const g = $("ck-go"); if (g) g.click(); } }, 150); }
    };
    el.onclick = (e) => { if (e.target === el) close(); };
    el.querySelector(".srch-x").onclick = close;
    paint(); requestAnimationFrame(() => inp.focus());
  };
  btn.onclick = open;
  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); open(); }
  });
}
