// slot.js — CITY SLOTS, the top bar's 🎰 GAME (the owner, 2026-11-26: "응 다 진행하자"; reels promised 2026-11-20: the
// supported coins, starting with $DCTY). A toy: free spins a day, points kept on this device — never money, tokens,
// rewards or anything on chain (the same rule as the street's cash). Three reels, the middle line pays; ★ is wild.
// A daily streak (first spin of a UTC day) adds bonus spins and a title.
import { esc, note } from "/common.js";
import { t } from "/i18n.js";

import { today, titleOf, payOf, BASE } from "/slot-data.js";
const KEY = "dc.slot", ROWS = 3, CELL = 96, LEN = 30;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

export function openSlot(coins, CFG) {
  if (document.querySelector(".sl-wrap")) return;
  const main = coins.find((c) => c.mint === CFG.main), sup = coins.filter((c) => c.kind === "partner").slice(0, 6);
  const syms = [...(main ? [{ id: main.mint, img: main.image, sym: main.symbol }] : []), ...sup.map((c) => ({ id: c.mint, img: c.image, sym: c.symbol })), { id: "seven", txt: "7" }, { id: "star", txt: "★" }];
  const mainId = main ? main.mint : "";
  const weight = (s) => (s.id === "star" ? 1 : s.id === "seven" ? 2 : s.id === mainId ? 3 : 4);
  const bag = syms.flatMap((s) => Array(weight(s)).fill(s));
  const pick = () => bag[Math.floor(Math.random() * bag.length)];
  const face = (s) => `<div class="sl-c" data-id="${esc(s.id)}">${s.img ? `<img src="${esc(s.img)}" alt="" onerror="this.outerHTML='<b>${esc((s.sym || "?").slice(0, 3))}</b>'">` : `<b class="${s.id === "star" ? "st" : "sv"}">${esc(s.txt)}</b>`}</div>`;
  let S = today(load()); save(S);
  const el = document.createElement("div"); el.className = "sl-wrap"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "City Slots");
  const ti = () => titleOf(S.streak);
  el.innerHTML = `<div class="sl-card"><button type="button" class="wm-x sl-x" aria-label="Close">×</button>
    <div class="sl-top"><span class="sl-k">${esc(t("slotK", "CITY SLOTS"))}</span><b class="sl-h">${esc(t("slotHead", "Spin the city's coins"))}</b></div>
    <div class="sl-hud"><div><b data-s="pts">${(S.pts || 0).toLocaleString("en-US")}</b><small>${esc(t("slotPts", "points"))}</small></div><div><b data-s="spins">${S.spins}</b><small>${esc(t("slotSpins", "spins today"))}</small></div><div><b data-s="streak">🔥 ${S.streak}</b><small data-s="title">${esc(t(ti()[1], ti()[2]))}</small></div></div>
    <div class="sl-machine"><div class="sl-reels">${[0, 1, 2].map((i) => `<div class="sl-reel" data-r="${i}"><div class="sl-strip">${Array.from({ length: ROWS }, () => face(pick())).join("")}</div></div>`).join("")}</div><i class="sl-line" aria-hidden="true"></i></div>
    <div class="sl-msg" aria-live="polite">${esc(t("slotHint", "Match the middle line. ★ is wild."))}</div>
    <button type="button" class="btn hot big sl-go">${esc(t("slotSpin", "SPIN"))}</button>
    <details class="sl-pay"><summary>${esc(t("slotTable", "Pay table"))}</summary><ul>
      <li><span>★ ★ ★</span><b>1,000</b></li><li><span>7 7 7</span><b>777</b></li><li><span>$${esc(main ? main.symbol : "MAIN")} × 3</span><b>500</b></li><li><span>${esc(t("slotAny3", "Any supported coin × 3"))}</span><b>150</b></li><li><span>★ ★ —</span><b>60</b></li><li><span>${esc(t("slotTwo", "Two from the left"))}</span><b>15–40</b></li></ul>
      <p>${esc(t("slotFine", "A game for fun: points live on this device only — not money, tokens or rewards. 10 free spins a day, +1 for each day of your streak (up to +5)."))}</p></details></div>`;
  document.body.appendChild(el);
  const $s = (k) => el.querySelector(`[data-s="${k}"]`), go = el.querySelector(".sl-go"), msg = el.querySelector(".sl-msg");
  const close = () => { el.remove(); removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); if ((e.key === " " || e.key === "Enter") && document.activeElement === go) { e.preventDefault(); spin(); } };
  addEventListener("keydown", key);
  el.onclick = (e) => { if (e.target === el || e.target.closest(".sl-x")) close(); };
  const paintHud = () => { $s("pts").textContent = (S.pts || 0).toLocaleString("en-US"); $s("spins").textContent = S.spins; $s("streak").textContent = "🔥 " + S.streak; const x = ti(); $s("title").textContent = t(x[1], x[2]); go.disabled = S.spins <= 0 || busy; if (S.spins <= 0) go.textContent = t("slotOut", "Back tomorrow"); };
  let busy = false;
  paintHud();
  async function spin() {
    if (busy) return; S = today(S); if (S.spins <= 0) return paintHud();
    busy = true; S.spins--; save(S); paintHud(); msg.textContent = ""; el.classList.remove("win", "big");
    const out = [pick(), pick(), pick()], calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reels = [...el.querySelectorAll(".sl-reel")];
    await Promise.all(reels.map((r, i) => new Promise((done) => {
      const strip = r.querySelector(".sl-strip"), cells = Array.from({ length: LEN }, () => pick()); cells[LEN - 2] = out[i];
      strip.style.transition = "none"; strip.style.transform = "translateY(0)"; strip.innerHTML = [...Array.from({ length: ROWS }, (_, k) => strip.children[k] ? strip.children[k].outerHTML : face(pick())), ...cells.map(face)].join("");
      void strip.offsetHeight;
      const y = -(LEN + ROWS - 3) * CELL, ms = calm ? 0 : 1100 + i * 380;
      strip.style.transition = calm ? "none" : `transform ${ms}ms cubic-bezier(0.15, 0.85, 0.25, 1.04)`; strip.style.transform = `translateY(${y}px)`;
      setTimeout(() => { const keep = [...strip.children].slice(LEN, LEN + 3).map((x) => x.outerHTML).join(""); strip.style.transition = "none"; strip.innerHTML = keep; strip.style.transform = "translateY(0)"; r.classList.remove("stop"); void r.offsetWidth; r.classList.add("stop"); done(); }, ms + 20);
    })));
    const won = payOf(out.map((x) => x.id), mainId);
    if (won > 0) { S.pts = (S.pts || 0) + won; S.best = Math.max(S.best || 0, won); el.classList.add("win"); if (won >= 150) el.classList.add("big");
      msg.innerHTML = `<b>+${won.toLocaleString("en-US")}</b> ${esc(t("slotPtsWon", "points"))}`;
      if (won >= 150) import("/site-x.js").then((m) => m.confetti && m.confetti()).catch(() => {});
      import("/site-x.js").then((m) => m.tone && m.tone("win")).catch(() => {}); if (navigator.vibrate) try { navigator.vibrate(won >= 150 ? [20, 40, 60] : 15); } catch {} }
    else msg.textContent = t("slotMiss", "No match — spin again.");
    save(S); busy = false; paintHud();
  }
  go.onclick = spin;
  if (S.streak > 1 && S.seenStreak !== S.day) { note(t("slotStreak", "Streak") + ` 🔥 ${S.streak} · +${Math.min(5, S.streak - 1)} ${t("slotBonus", "bonus spins")}`, 3500); S.seenStreak = S.day; save(S); }
}
