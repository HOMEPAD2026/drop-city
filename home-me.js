// home-me.js — the home page's personal bits (2026-11-26, the owner: "다 진행"): "My corner" once a wallet is connected
// (cashback, watchlist, my coins, slot spins left, my profile), the leaderboard teasers (cashback top 3, City Slots'
// week top 3) and the search (name / ticker / CA — "/" or Ctrl+K opens it).
import { $, esc, short, usd, getJ, pic } from "/common.js";
import { t, tf } from "/i18n.js";
import { watched, myBag } from "/coin-x.js";
import { today } from "/slot-data.js";
import { tile, medal } from "/icons.js";
import { plusFly } from "/moments.js";

const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : Math.round(x || 0).toString());
const lastEarned = {};
let ME = "", CB = null, cbAt = 0, SL = null, slAt = 0;

/// My corner: shown only with a wallet; every number is the server's (?cb=&w=) or this device's (watchlist, slot spins)
export async function paintCorner({ key, coins, CFG, openCoin, openSlot }) {
  if (key !== undefined) ME = key || "";
  const box = $("corner"); if (!box) return;
  document.documentElement.classList.toggle("has-w", !!ME);
  if (!ME) { box.innerHTML = ""; return; }
  if (Date.now() - cbAt > 60e3 || !CB || CB._w !== ME) { cbAt = Date.now(); CB = await getJ("?cb=1&w=" + encodeURIComponent(ME)).catch(() => null); if (CB) CB._w = ME; }
  const S = "$" + (CFG.ticker || "GTAFUN"), me = (CB && CB.me) || null;
  const grew = me && lastEarned[ME] != null && me.earned > lastEarned[ME] ? me.earned - lastEarned[ME] : 0; if (me) lastEarned[ME] = me.earned;
  const w = watched(), wl = Object.keys(w).map((m) => coins.find((c) => c.mint === m)).filter(Boolean);
  const mine = coins.filter((c) => c.creator === ME);
  const bag = await myBag(ME).catch(() => null), held = ((bag && bag.items) || []).map((h) => coins.find((c) => c.mint === h.mint)).filter(Boolean);
  let sl = {}; try { sl = today(JSON.parse(localStorage.getItem("dc.slot") || "{}") || {}); } catch {}
  const chips = (l) => l.slice(0, 4).map((c) => `<button type="button" class="cn-chip" data-m="${esc(c.mint)}">${pic(c)}<span>$${esc(c.symbol)}</span></button>`).join("");
  box.innerHTML = `<div class="cn-h"><h3>${tile("wallet", "peach")}${esc(t("cnH", "My corner"))}</h3><a href="/w/${esc(ME)}" class="cn-prof">${esc(short(ME))} · ${esc(t("cnProf", "My profile"))} ›</a></div>
    <div class="cn-g">
      <a class="cn-t" href="#lp"><small>${tile("cash", "sun", "sm")}${esc(t("cnCb", "My cashback"))}</small><b>${me ? fmt(me.earned) : "–"} <i>${esc(S)}</i></b><span>${me ? esc(me.rank ? tf("cnRank", "today +{d} · rank #{r}", { d: fmt(me.today), r: me.rank }) : tf("cnToday", "today +{d}", { d: fmt(me.today) })) : esc(t("cnCbNo", "Trade a city coin to earn 0.3% back"))}</span></a>
      <div class="cn-t"><small>${tile("wallet", "sun", "sm")}${esc(t("cnBag", "My bag"))}${bag ? ` · ${usd(bag.usd)}` : ""}</small>${held.length ? `<div class="cn-chips">${chips(held)}</div>` : `<span>${esc(bag ? t("cnBagNo", "No city coins in this wallet yet") : t("cnBagErr", "Couldn't read the wallet right now"))}</span>`}</div>
      <div class="cn-t"><small>${tile("star", "violet", "sm")}${esc(t("cnWatch", "Watching"))} · ${wl.length}</small>${wl.length ? `<div class="cn-chips">${chips(wl)}</div>` : `<span>${esc(t("cnWatchNo", "Tap ★ Watch on a coin to follow it here"))}</span>`}</div>
      <div class="cn-t"><small>${tile("rocket", "peach", "sm")}${esc(t("cnMine", "My coins"))} · ${mine.length}</small>${mine.length ? `<div class="cn-chips">${chips(mine)}</div>` : `<a class="cn-go" href="#launch">${esc(t("cnLaunch", "Launch your first coin"))} ›</a>`}</div>
      <button type="button" class="cn-t cn-slot"><small>${tile("slot", "rose", "sm")}${esc(t("cnSlot", "City Slots today"))}</small><b>${sl.spins ?? 10} <i>${esc(t("cnSpins", "spins left"))}</i></b><span>${esc(tf("cnStreak", "{n}-day streak · play ›", { n: sl.streak || 1 }))}</span></button>
    </div>`;
  if (grew > 0) requestAnimationFrame(() => plusFly(box.querySelector(".cn-t"), `+${fmt(grew)} ${S}`));
  box.onclick = (e) => { const c = e.target.closest("[data-m]"); if (c) { e.preventDefault(); openCoin(c.dataset.m); return; } if (e.target.closest(".cn-slot")) openSlot(); };
}

/// the leaderboard teasers: cashback's all-time top 3 and City Slots' week top 3 (a toy score)
export async function paintBoards({ CFG, openSlot }) {
  const box = $("lbt"); if (!box) return;
  if (Date.now() - slAt > 60e3) { slAt = Date.now(); SL = await getJ("?slots=1").catch(() => SL); }
  if (!CB || Date.now() - cbAt > 60e3) { const r = await getJ("?cb=1" + (ME ? "&w=" + encodeURIComponent(ME) : "")).catch(() => null); if (r) { CB = r; CB._w = ME; cbAt = Date.now(); } }
  const S = "$" + (CFG.ticker || "GTAFUN");
  const rows = (l, unit) => (l.length ? l.slice(0, 3).map((x, i) => `<a class="lb-r${x.w === ME ? " me" : ""}" href="/w/${esc(x.w)}">${medal(i + 1)}<code>${esc(short(x.w))}</code><b>${fmt(x.v)} <i>${esc(unit)}</i></b></a>`).join("") : `<p class="fine">${esc(t("lbNone", "No one yet — be first."))}</p>`);
  const cbTop = ((CB && CB.top) || []).map((x) => ({ w: x.w, v: x.amt })), slTop = ((SL && SL.top) || []).map((x) => ({ w: x.w, v: x.pts }));
  box.innerHTML = `<div class="lb-c"><div class="lb-h"><h3>${tile("trophy", "sun")}${esc(t("lbCb", "Cashback leaders"))}</h3><a href="#lp">${esc(t("hotAll", "See all ›"))}</a></div>${rows(cbTop, S)}</div>
    <div class="lb-c"><div class="lb-h"><h3>${tile("slot", "violet")}${esc(t("lbSlot", "City Slots · this week"))}</h3><button type="button" class="lb-play">${esc(t("lbPlay", "Play ›"))}</button></div>${rows(slTop, t("lbPts", "pts"))}<small class="lb-n">${esc(t("lbToy", "A toy score — never money or tokens."))}</small></div>`;
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

/// an invite (?ref=<wallet>) is acknowledged on arrival — a strip under the ticker — and the moment a wallet connects it's
/// offered as one free signature, instead of waiting three screens down the LP page (round K, the owner 2026-11-26)
const pendingRef = () => { try { return localStorage.getItem("dc.refDone") ? "" : localStorage.getItem("dc.ref") || ""; } catch { return ""; } };
export function initInvite({ CFG }) {
  const ref = pendingRef(); if (!ref || document.querySelector(".inv-strip")) return;
  const el = document.createElement("div"); el.className = "inv-strip"; el.setAttribute("role", "status");
  el.innerHTML = `${tile("invite", "violet", "sm")}<span>${esc(tf("invStrip", "Invited by {w} — trade city coins and 0.3% comes back to you in {s}", { w: short(ref), s: "$" + (CFG.ticker || "GTAFUN") }))}</span><a href="#lp">${esc(t("invMore", "How it works ›"))}</a>`;
  const at = document.querySelector(".notice") || document.querySelector(".ticker"); if (at) at.after(el);
}
let asked = "";
export async function inviteOnConnect(key) {
  const ref = pendingRef(); if (!key || !ref || ref === key || asked === key) return; asked = key;
  const v = await getJ("?cb=1&w=" + encodeURIComponent(key)).catch(() => null);
  if (v && v.me && v.me.ref) { try { localStorage.setItem("dc.refDone", "1"); localStorage.removeItem("dc.ref"); } catch {} const s = document.querySelector(".inv-strip"); if (s) s.remove(); return; }
  const el = document.createElement("div"); el.className = "wmodal inv-pop"; el.setAttribute("role", "dialog");
  el.innerHTML = `<div class="wm-card"><button type="button" class="wm-x" aria-label="Close">×</button>${tile("invite", "violet")}<h3>${esc(t("invPopH", "Link your inviter"))}</h3><p class="wm-sub">${esc(tf("invPopP", "{w} invited you. Link them with one free signature — nothing is sent on chain, and they earn a bonus on top of your cashback, never out of it.", { w: short(ref) }))}</p><div class="inv-a"><button type="button" class="btn ghost" data-i="later">${esc(t("invLater", "Later"))}</button><button type="button" class="btn hot" data-i="link">${esc(t("invLink", "Link with one signature"))}</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("in"));
  const close = () => { el.classList.remove("in"); setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 200); };
  el.onclick = async (e) => {
    if (e.target === el || e.target.closest(".wm-x") || e.target.closest('[data-i="later"]')) return close();
    const b = e.target.closest('[data-i="link"]'); if (!b) return;
    b.disabled = true; const [{ linkInviter }, { sol }] = await Promise.all([import("/cb-ui.js"), import("/common.js")]);
    const S = await sol(); if (S && S.key && (await linkInviter(S, ref))) { close(); const s = document.querySelector(".inv-strip"); if (s) s.remove(); } else b.disabled = false;
  };
}

/// COIN OF THE DAY: yesterday's winner up top, today's five candidates to vote on (one signed vote a wallet a day)
let COTD = null, cotdAt = 0;
export async function paintCotd({ coins, CFG, openCoin }) {
  const box = $("cotd"); if (!box) return;
  if (!COTD || Date.now() - cotdAt > 60e3) { cotdAt = Date.now(); COTD = await getJ("?cotd=1" + (ME ? "&w=" + encodeURIComponent(ME) : "")).catch(() => COTD); }
  const v = COTD, by = (m) => coins.find((c) => c.mint === m);
  const cands = ((v && v.mints) || []).map(by).filter(Boolean), win = v && v.winner && by(v.winner.mint);
  window.__dcCotd = win ? win.mint : "";
  if (!v || (cands.length < 2 && !win)) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  const total = (v.votes || []).reduce((a, b) => a + b, 0), left = Math.max(0, v.closes - Date.now()), hh = Math.floor(left / 3600e3), mm = Math.floor((left % 3600e3) / 60e3);
  const row = (c) => { const i = v.mints.indexOf(c.mint), n = (v.votes || [])[i] || 0, pct = total ? Math.round((n / total) * 100) : 0, mine = v.mine === i;
    return `<div class="ct-r${mine ? " mine" : ""}" style="--p:${pct}%"><button type="button" class="ct-c" data-m="${esc(c.mint)}">${pic(c)}<b>$${esc(c.symbol)}</b><small>${usd(c.mcapUsd)}</small></button><span class="ct-n">${n}</span><button type="button" class="btn ${mine ? "hot" : "ghost"} ct-v" data-v="${esc(c.mint)}" ${v.mine != null ? "disabled" : ""}>${esc(mine ? t("ctVoted", "Your vote") : t("ctVote", "Vote"))}</button></div>`; };
  const h = `<div class="sec-h"><h2>${tile("crown", "sun")}<span>${esc(t("ctH", "Coin of the day"))}</span></h2><small class="ct-cd">${esc(tf("ctLeft", "voting closes in {h}h {m}m (UTC midnight)", { h: hh, m: mm }))}</small></div>
    <div class="ct-g">${win ? `<button type="button" class="ct-win" data-m="${esc(win.mint)}"><span class="ct-k">${esc(t("ctWinK", "TODAY'S COIN OF THE DAY"))}</span>${pic(win)}<b>$${esc(win.symbol)}</b><small>${esc(win.name || "")} · ${usd(win.mcapUsd)}</small><em>${esc(tf("ctWinN", "{n} votes yesterday", { n: v.winner.votes }))}</em></button>` : `<div class="ct-win empty"><span class="ct-k">${esc(t("ctWinK", "TODAY'S COIN OF THE DAY"))}</span><p>${esc(t("ctWinNo", "Tomorrow's is picked by today's vote — one free signature a wallet."))}</p></div>`}
    <div class="ct-list">${cands.length >= 2 ? `<p class="ct-q">${esc(t("ctQ", "Pick tomorrow's — the busiest coins launched here today"))}</p>${cands.map(row).join("")}` : ""}<p class="fine">${esc(t("ctFine", "One vote a wallet a day, signed in your wallet — nothing is sent on chain or paid."))}</p></div></div>`;
  if (box._h !== h) { box._h = h; box.innerHTML = h; }
  box.onclick = async (e) => {
    const vb = e.target.closest("[data-v]");
    if (vb) { vb.disabled = true; try { await voteCotd(vb.dataset.v, v.day); } finally { cotdAt = 0; paintCotd({ coins, CFG, openCoin }).catch(() => {}); } return; }
    const c = e.target.closest("[data-m]"); if (c) openCoin(c.dataset.m);
  };
}
async function voteCotd(mint, day) {
  const [{ sol, post, b58, note }, { openWallet }] = await Promise.all([import("/common.js"), import("/wallet.js")]);
  let S = await sol(); if (!S || !S.key) { await openWallet(); S = await sol(); } if (!S || !S.key) return;
  try {
    const issued = new Date().toISOString(), msg = `GTAFUN coin of the day\nWallet: ${S.key}\nDay (UTC): ${day}\nCoin: ${mint}\nIssued: ${issued}`;
    const sig = await S.signMessage(new TextEncoder().encode(msg));
    const r = await post({ action: "cotd-vote", wallet: S.key, mint, day, issued, sig: b58(sig) });
    note(r.ok ? t("ctDone", "Vote counted — see you at midnight UTC.") : (r.j && r.j.error) || "Couldn't count the vote.", 3500);
  } catch (x) { note(/reject|denied|cancel/i.test(String(x && x.message)) ? t("cbCancel", "Cancelled in your wallet.") : String((x && x.message) || x).slice(0, 120), 3500); }
}
