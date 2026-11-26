// home-x.js — the home page's live parts (the owner, 2026-11-26: "다 진행"): "Right now in the city" (trades, new
// launches and cashback credits as one feed), the trust numbers (cashback paid, trades counted, the vault's buybacks
// and burns — read from ?cb=1 and ?flows=1, never made up), and a notice bar that stays closed once closed.
import { $, esc, short, usd, getJ, pic } from "/common.js";
import { t } from "/i18n.js";

const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : x >= 1 ? Math.round(x).toString() : (x || 0).toFixed(2));
const ago = (ms) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d"; };
let CB = null, FL = null, at = 0, seen = new Set(), first = true;

/// the notice bar: one message at a time, closed for good once closed (its id in dc.notice)
const NOTICE = { id: "block0-2026-12-04", key: "noticeB0", en: "From Dec 4, pump.fun charges a fee on non-dev buys in a coin's first block. Launch clean: make your first buy from your own wallet.", href: "#launch" };
export function notice() {
  let shut = ""; try { shut = localStorage.getItem("dc.notice") || ""; } catch {}
  if (shut === NOTICE.id || document.querySelector(".notice")) return;
  const el = document.createElement("div"); el.className = "notice"; el.setAttribute("role", "status");
  el.innerHTML = `<span class="nt-dot"></span><a href="${NOTICE.href}">${esc(t(NOTICE.key, NOTICE.en))}</a><button type="button" aria-label="Close">×</button>`;
  el.querySelector("button").onclick = () => { try { localStorage.setItem("dc.notice", NOTICE.id); } catch {} el.classList.add("bye"); setTimeout(() => el.remove(), 300); };
  const tk = document.querySelector(".ticker"); if (tk) tk.after(el);
}

export async function paintCity({ coins, trades, CFG, openCoin }) {
  const box = $("cityfeed"), tiles = $("citytrust"); if (!box || !tiles) return;
  if (Date.now() - at > 60e3) { at = Date.now(); [CB, FL] = await Promise.all([getJ("?cb=1").catch(() => null), getJ("?flows=1").catch(() => null)]); }
  const S = "$" + (CFG.ticker || "GTAFUN"), by = new Map(coins.map((c) => [c.mint, c]));
  // the feed: trades, launches in the last day, cashback credits — newest first
  const ev = [];
  for (const x of trades || []) ev.push({ k: x.side === "buy" ? "buy" : "sell", at: x.at, id: "t" + x.sig, c: by.get(x.mint), txt: `${x.side === "buy" ? t("evBuy", "bought") : t("evSell", "sold")} <b>${(x.sol || 0).toFixed(2)} SOL</b>`, who: x.who, big: (x.sol || 0) >= 1 });
  for (const c of coins) if (c.launchedAt && Date.now() / 1000 - c.launchedAt < 86400 && c.kind !== "partner") ev.push({ k: "new", at: c.launchedAt * 1000, id: "n" + c.mint, c, txt: t("evNew", "just launched"), who: c.creator });
  for (const x of (CB && CB.last) || []) ev.push({ k: "cb", at: x.at, id: "c" + x.sig + x.w, c: null, txt: `${t("evCb", "earned")} <b>+${fmt(x.amt)} ${esc(S)}</b> ${t("evCbOn", "cashback on")} $${esc(x.sym || "")}`, who: x.w });
  ev.sort((a, b) => b.at - a.at);
  const rows = ev.slice(0, 8);
  box.innerHTML = rows.length ? rows.map((e) => { const isNew = !first && !seen.has(e.id); return `<div class="cf k-${e.k}${isNew ? " new" : ""}${e.big ? " big" : ""}"${e.c ? ` data-m="${esc(e.c.mint)}"` : ""}><i class="cf-ic"></i>${e.c ? pic(e.c) : `<span class="cf-w">${esc(short(e.who || ""))}</span>`}<span class="cf-t">${e.c ? `<b>$${esc(e.c.symbol)}</b> ` : ""}${e.txt}</span><small>${ago(e.at)}</small></div>`; }).join("")
    : `<p class="fine">${esc(t("cfNone", "Quiet right now — the next trade shows up here."))}</p>`;
  rows.forEach((e) => seen.add(e.id)); first = false;
  box.onclick = (e) => { const r = e.target.closest("[data-m]"); if (r) openCoin(r.dataset.m); };
  // trust numbers
  const all = FL && FL.all;
  tiles.innerHTML = [
    [CB ? fmt(CB.total) : "–", `${S} ${t("tsCb", "cashback earned by traders")}`, "#lp"],
    [CB ? fmt(CB.trades) : "–", t("tsTrades", "trades counted"), "#live"],
    [all ? all.buySol.toFixed(2) + " SOL" : "–", t("tsBuy", "THE VAULT's buybacks"), "#wallets"],
    [all ? String(all.burns) : "–", t("tsBurn", "burns on chain"), "#wallets"],
  ].map(([v, l, h]) => `<a class="ts" href="${h}"><b>${esc(v)}</b><small>${esc(l)}</small></a>`).join("");
}
