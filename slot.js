// slot.js — CITY SLOTS, the top bar's 🎰 GAME (the owner, 2026-11-26: "응 다 진행하자"; reels promised 2026-11-20: the
// supported coins, starting with $DCTY). A toy: points are a score, never money, tokens, rewards or anything on chain.
// Two ways to play: PRACTICE (spins drawn here, points on this device) and the WEEKLY BOARD (a connected wallet signs once
// a UTC day; every spin is drawn by the server — lib/_slots.mjs — so the board is fair). Three reels, the middle line
// pays; ★ is wild. A streak adds bonus spins and a title. Motion: the lever pulls, the last reel lingers on a near miss,
// coins rain on a big win.
import { esc, note, short, sol, post, getJ, b58, DEMO } from "/common.js";
import { t } from "/i18n.js";
import { today, titleOf, payOf, bagOf, slotMessage } from "/slot-data.js";

const KEY = "dc.slot", TOK = "dc.slotTok", ROWS = 3, CELL = 96, LEN = 30;
const load = (k = KEY) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
const save = (s, k = KEY) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch {} };
const day = () => new Date().toISOString().slice(0, 10);

export function openSlot(coins, CFG) {
  if (document.querySelector(".sl-wrap")) return;
  const main = coins.find((c) => c.mint === CFG.main), sup = coins.filter((c) => c.kind === "partner").slice(0, 6);
  const syms = [...(main ? [{ id: main.mint, img: main.image, sym: main.symbol }] : []), ...sup.map((c) => ({ id: c.mint, img: c.image, sym: c.symbol })), { id: "seven", txt: "7" }, { id: "star", txt: "★" }];
  const byId = new Map(syms.map((s) => [s.id, s])), mainId = main ? main.mint : "";
  const bag = bagOf(syms.map((s) => s.id), mainId).map((id) => byId.get(id));
  const pick = () => bag[Math.floor(Math.random() * bag.length)];
  const face = (s) => `<div class="sl-c" data-id="${esc(s.id)}">${s.img ? `<img src="${esc(s.img)}" alt="" onerror="this.outerHTML='<b>${esc((s.sym || "?").slice(0, 3))}</b>'">` : `<b class="${s.id === "star" ? "st" : "sv"}">${esc(s.txt)}</b>`}</div>`;
  let S = today(load()); save(S);
  let mode = "practice", B = null, wallet = null; // B: the board's state for this wallet { spins, streak, pts, week }
  const el = document.createElement("div"); el.className = "sl-wrap"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "City Slots");
  el.innerHTML = `<div class="sl-card"><button type="button" class="wm-x sl-x" aria-label="Close">×</button>
    <div class="sl-top"><span class="sl-k">${esc(t("slotK", "CITY SLOTS"))}</span><b class="sl-h">${esc(t("slotHead", "Spin the city's coins"))}</b></div>
    <div class="sl-modes" role="tablist"><button type="button" class="on" data-m="practice">${esc(t("slotPractice", "Practice"))}</button><button type="button" data-m="board">🏆 ${esc(t("slotBoardTab", "Weekly board"))}</button></div>
    <div class="sl-hud"><div><b data-s="pts">0</b><small data-s="ptsl">${esc(t("slotPts", "points"))}</small></div><div><b data-s="spins">0</b><small>${esc(t("slotSpins", "spins today"))}</small></div><div><b data-s="streak">🔥 1</b><small data-s="title"></small></div></div>
    <div class="sl-machine"><div class="sl-reels">${[0, 1, 2].map((i) => `<div class="sl-reel" data-r="${i}"><div class="sl-strip">${Array.from({ length: ROWS }, () => face(pick())).join("")}</div></div>`).join("")}</div><i class="sl-line" aria-hidden="true"></i>
      <button type="button" class="sl-lever" aria-label="Pull"><i></i><b></b></button></div>
    <div class="sl-rain" aria-hidden="true"></div>
    <div class="sl-msg" aria-live="polite">${esc(t("slotHint", "Match the middle line. ★ is wild."))}</div>
    <div class="sl-sign" hidden><p>${esc(t("slotSignP", "Play for this week's board: your wallet signs once a day (free, no transaction) and every spin is drawn by the server, so nobody can pick their reels."))}</p><button type="button" class="btn hot" data-sign>${esc(t("slotSign", "Sign in to the board"))}</button></div>
    <button type="button" class="btn hot big sl-go">${esc(t("slotSpin", "SPIN"))}</button>
    <div class="sl-board" hidden></div>
    <details class="sl-pay"><summary>${esc(t("slotTable", "Pay table"))}</summary><ul>
      <li><span>★ ★ ★</span><b>1,000</b></li><li><span>7 7 7</span><b>777</b></li><li><span>$${esc(main ? main.symbol : "MAIN")} × 3</span><b>500</b></li><li><span>${esc(t("slotAny3", "Any supported coin × 3"))}</span><b>150</b></li><li><span>★ ★ —</span><b>60</b></li><li><span>${esc(t("slotTwo", "Two from the left"))}</span><b>15–40</b></li></ul>
      <p>${esc(t("slotFine2", "A game for fun: points are a score — not money, tokens or rewards. 10 free spins a day, +1 for each day of your streak (up to +5). Practice points stay on this device; the weekly board's spins are drawn by the server."))}</p></details></div>`;
  document.body.appendChild(el);
  const $s = (k) => el.querySelector(`[data-s="${k}"]`), go = el.querySelector(".sl-go"), msg = el.querySelector(".sl-msg"), signBox = el.querySelector(".sl-sign"), boardBox = el.querySelector(".sl-board"), lever = el.querySelector(".sl-lever");
  const close = () => { el.remove(); removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); if ((e.key === " " || e.key === "Enter") && document.activeElement === go) { e.preventDefault(); spin(); } };
  addEventListener("keydown", key);
  let busy = false;
  const st = () => (mode === "board" ? B || { spins: 0, streak: 1, pts: 0, week: 0 } : S);
  const paintHud = () => {
    const s = st(), x = titleOf(s.streak);
    $s("pts").textContent = (mode === "board" ? s.week || 0 : s.pts || 0).toLocaleString("en-US"); $s("ptsl").textContent = mode === "board" ? t("slotWeekPts", "points this week") : t("slotPts", "points");
    $s("spins").textContent = s.spins; $s("streak").textContent = "🔥 " + s.streak; $s("title").textContent = t(x[1], x[2]);
    const need = mode === "board" && !B; signBox.hidden = !need; go.hidden = need; go.style.display = need ? "none" : "";
    go.disabled = s.spins <= 0 || busy; go.textContent = s.spins <= 0 ? t("slotOut", "Back tomorrow") : t("slotSpin", "SPIN");
  };
  async function paintBoard() {
    if (mode !== "board") { boardBox.hidden = true; return; }
    let v = null; try { v = await getJ("?slots=1" + (wallet ? "&w=" + wallet : "")); } catch {}
    boardBox.hidden = false;
    boardBox.innerHTML = `<h5>${esc(t("slotBoardH", "This week's top 10"))}${v ? ` <small>${esc(t("slotWeekOf", "week of"))} ${esc(v.week)} · ${v.players} ${esc(t("slotPlayers", "players"))}</small>` : ""}</h5>${v && v.top.length ? `<ol>${v.top.map((x, i) => `<li class="${x.w === wallet ? "me" : ""}"><span class="n">${i + 1}</span><span class="w">${esc(short(x.w))}</span><b>${x.pts.toLocaleString("en-US")}</b></li>`).join("")}</ol>` : `<p class="fine">${esc(t("slotBoardNone", "Nobody on the board yet this week — the first spins take it."))}</p>`}`;
  }
  async function useBoard() {
    const W = await sol().catch(() => null); wallet = W && W.key;
    if (!wallet) { B = null; paintHud(); signBox.querySelector("p").textContent = t("slotConn", "Connect your wallet to play for the weekly board."); return paintBoard(); }
    const tk = load(TOK);
    if (tk.w === wallet && tk.day === day() && tk.token) { try { const v = await getJ("?slots=1&w=" + wallet); B = v.me; } catch { B = null; } } else B = null;
    paintHud(); paintBoard();
  }
  async function signIn() {
    if (DEMO) return note("Demo — nothing is signed.");
    const W = await sol(); if (!W) return note(t("wmNone", "No Solana wallet in this browser."));
    if (!W.key) { const { openWallet } = await import("/wallet.js"); await openWallet(); if (!W.key) return; }
    const b = signBox.querySelector("[data-sign]"); b.disabled = true;
    try {
      const issued = new Date().toISOString(), sig = await W.signMessage(new TextEncoder().encode(slotMessage(W.key, day(), issued)));
      const r = await post({ action: "slot-start", wallet: W.key, issued, sig: b58(sig) });
      if (!r.ok) throw new Error((r.j && r.j.error) || "couldn't sign in");
      save({ w: W.key, day: r.j.day, token: r.j.token }, TOK); wallet = W.key; B = r.j.me; paintHud(); paintBoard();
    } catch (e) { note(/reject|denied|cancel/i.test(String(e && e.message)) ? "Cancelled in your wallet." : String((e && e.message) || e).slice(0, 120), 4000); }
    b.disabled = false;
  }
  signBox.querySelector("[data-sign]").onclick = signIn;
  el.querySelector(".sl-modes").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b || busy) return; mode = b.dataset.m; el.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === b)); el.classList.toggle("board", mode === "board"); msg.textContent = t("slotHint", "Match the middle line. ★ is wild."); if (mode === "board") useBoard(); else { boardBox.hidden = true; paintHud(); } };
  el.onclick = (e) => { if (e.target === el || e.target.closest(".sl-x")) close(); };
  paintHud();

  /// roll the reels to `out` (three symbols); the last reel lingers when the first two already match (a near miss)
  function roll(out) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches, near = out[0].id === out[1].id || out[0].id === "star" || out[1].id === "star";
    const reels = [...el.querySelectorAll(".sl-reel")];
    return Promise.all(reels.map((r, i) => new Promise((done) => {
      const strip = r.querySelector(".sl-strip"), cells = Array.from({ length: LEN }, () => pick()); cells[LEN - 2] = out[i];
      strip.style.transition = "none"; strip.style.transform = "translateY(0)"; strip.innerHTML = [...Array.from({ length: ROWS }, (_, k) => strip.children[k] ? strip.children[k].outerHTML : face(pick())), ...cells.map(face)].join("");
      void strip.offsetHeight;
      const y = -(LEN + ROWS - 3) * CELL, ms = calm ? 0 : 1100 + i * 380 + (i === 2 && near ? 900 : 0);
      if (i === 2 && near && !calm) setTimeout(() => r.classList.add("tense"), 1100 + 2 * 380 - 200);
      strip.style.transition = calm ? "none" : `transform ${ms}ms cubic-bezier(0.15, 0.85, 0.25, 1.04)`; strip.style.transform = `translateY(${y}px)`;
      setTimeout(() => { const keep = [...strip.children].slice(LEN, LEN + 3).map((x) => x.outerHTML).join(""); strip.style.transition = "none"; strip.innerHTML = keep; strip.style.transform = "translateY(0)"; r.classList.remove("stop", "tense"); void r.offsetWidth; r.classList.add("stop"); done(); }, ms + 20);
    })));
  }
  function rain(n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = el.querySelector(".sl-rain"), pics = syms.filter((s) => s.img).map((s) => s.img);
    for (let i = 0; i < n; i++) { const c = document.createElement("i"); c.style.left = Math.random() * 100 + "%"; c.style.animationDelay = Math.random() * 0.6 + "s"; c.style.animationDuration = 1.4 + Math.random() * 0.9 + "s"; if (pics.length) c.style.backgroundImage = `url("${pics[i % pics.length]}")`; box.appendChild(c); setTimeout(() => c.remove(), 2600); }
  }
  async function spin() {
    if (busy) return;
    let out;
    if (mode === "board") {
      if (!B || B.spins <= 0) return paintHud();
      const tk = load(TOK); busy = true; lever.classList.remove("pull"); void lever.offsetWidth; lever.classList.add("pull"); msg.textContent = ""; el.classList.remove("win", "big"); paintHud();
      const r = await post({ action: "slot-spin", wallet: tk.w, token: tk.token }).catch(() => null);
      if (!r || !r.ok) { busy = false; if (r && r.status === 403) { save({}, TOK); B = null; } note((r && r.j && r.j.error) || "The spin didn't go through.", 4000); return paintHud(); }
      out = r.j.line.map((id) => byId.get(id) || { id, txt: "?" }); await roll(out); B = r.j.me; done(r.j.won); paintBoard(); return;
    }
    S = today(S); if (S.spins <= 0) return paintHud();
    busy = true; S.spins--; save(S); lever.classList.remove("pull"); void lever.offsetWidth; lever.classList.add("pull"); paintHud(); msg.textContent = ""; el.classList.remove("win", "big");
    out = [pick(), pick(), pick()]; await roll(out);
    const won = payOf(out.map((x) => x.id), mainId);
    if (won > 0) { S.pts = (S.pts || 0) + won; S.best = Math.max(S.best || 0, won); }
    save(S); done(won);
  }
  function done(won) {
    if (won > 0) { el.classList.add("win"); if (won >= 150) el.classList.add("big");
      msg.innerHTML = `<b>+${won.toLocaleString("en-US")}</b> ${esc(t("slotPtsWon", "points"))}`;
      if (won >= 500) rain(26); else if (won >= 150) rain(12);
      if (won >= 150) import("/site-x.js").then((m) => m.confetti && m.confetti()).catch(() => {});
      import("/site-x.js").then((m) => m.tone && m.tone("win")).catch(() => {}); if (navigator.vibrate) try { navigator.vibrate(won >= 150 ? [20, 40, 60] : 15); } catch {} }
    else msg.textContent = t("slotMiss", "No match — spin again.");
    busy = false; paintHud();
  }
  go.onclick = spin; lever.onclick = (e) => { e.stopPropagation(); spin(); };
  if (S.streak > 1 && S.seenStreak !== S.day) { note(t("slotStreak", "Streak") + ` 🔥 ${S.streak} · +${Math.min(5, S.streak - 1)} ${t("slotBonus", "bonus spins")}`, 3500); S.seenStreak = S.day; save(S); }
}
