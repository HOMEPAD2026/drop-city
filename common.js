// common.js — what the website and the city share: the API, formatting, the wallet, the pump.fun kit, demo coins.
export const API = "/api/pad";
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");
export const usd = (v) => (v == null ? "–" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + v.toFixed(0));
export const hh = (ms) => new Date(ms).toISOString().slice(11, 16);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const getJ = (q) => fetch(API + q, { cache: "no-store" }).then((r) => r.json());
export const post = (b) => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }));
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const b58 = (u8) => { let n = 0n; for (const b of u8) n = n * 256n + BigInt(b); let s = ""; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of u8) { if (b) break; s = "1" + s; } return s; };
export const note = (s, ms = 3200) => { const t = $("toast"); t.textContent = s; t.hidden = false; clearTimeout(note.t); note.t = setTimeout(() => (t.hidden = true), ms); };
/// the hour's drop in words: [text, class]
export function dropState(slot, cfg) {
  if (!cfg.open && !DEMO) return ["THE CITY OPENS SOON", ""];
  if (!slot) return ["…", ""];
  if (slot.state === "dropped") return [`DROPPED${slot.drop && slot.drop.symbol ? " $" + slot.drop.symbol : ""}`, "done"];
  if (slot.state === "dropping") return ["THE AGENT IS DROPPING…", "held"];
  if (slot.state === "failed") return ["THE AGENT IS RETRYING", "held"];
  if (slot.state === "off") return ["THE AGENT IS OFFLINE", ""];
  return ["THE AGENT DROPS ANY MINUTE", "open"];
}
/// wake the agent once when this hour has no drop yet (the server makes sure it drops only once)
let poked = "";
/// (a failed try is retried too, at most every 4 minutes from one page — the server allows 3 tries an hour)
let pokedAt = 0;
export function poke(slot) {
  if (DEMO || !slot || new Date().getUTCMinutes() < 1 || new Date().getUTCMinutes() >= 55) return;
  const want = slot.state === "waiting" || (slot.state === "failed" && (slot.tries || 0) < 3);
  if (!want || (poked === slot.hour && Date.now() - pokedAt < 4 * 60e3)) return;
  poked = slot.hour; pokedAt = Date.now(); fetch(API + "?tick=1", { cache: "no-store" }).catch(() => {});
}

export const DEMO = new URLSearchParams(location.search).get("demo") === "1";
export const DEFAULT_CFG = { name: "DROP CITY", ticker: "DROP", suffix: "", split: { creator: 6000, vault: 3000, buyer: 1000 }, open: false };
export async function loadCfg() { try { return { ...DEFAULT_CFG, ...(await getJ("?cfg")) }; } catch { return { ...DEFAULT_CFG }; } }
export async function loadCoins() { if (DEMO) return demoCoins(); try { const j = await getJ("?list"); return Array.isArray(j.items) ? j.items : []; } catch { return []; } }
export async function loadSlot() { if (DEMO) return { hour: new Date().toISOString().slice(0, 13), next: Math.ceil(Date.now() / 3600e3) * 3600e3, state: "dropped", drop: { symbol: "OWL" } }; try { return await getJ("?slot"); } catch { return null; } }
export const stars = (c) => { const m = c.mcapUsd || 0, n = m >= 1e6 ? 5 : m >= 250e3 ? 4 : m >= 50e3 ? 3 : m >= 10e3 ? 2 : 1; return "★".repeat(n) + "☆".repeat(5 - n); };
export const ini = (c, cls = "ini") => `<span class="${cls}">${esc((c.symbol || "?").slice(0, 3))}</span>`;
export const pic = (c) => (c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ini>${esc((c.symbol || "?").slice(0, 3))}</span>'">` : ini(c));

// ---------------- the wallet
let solP = null;
export const sol = () => (window.arcSol ? Promise.resolve(window.arcSol) : (solP = solP || new Promise((r) => { const t = setInterval(() => { if (window.arcSol) { clearInterval(t); r(window.arcSol); } }, 100); setTimeout(() => r(null), 6000); })));
let kitP = null, connP = null;
export const kit = () => (kitP = kitP || new Promise((ok, no) => { if (window.ArcPumpKit) return ok(window.ArcPumpKit); const s = document.createElement("script"); s.src = "/vendor/pump-kit.js?v=64d3c38c42"; s.onload = () => ok(window.ArcPumpKit); s.onerror = () => no(new Error("the Solana kit didn't load")); document.head.appendChild(s); }));
export const conn = () => (connP = connP || kit().then((K) => new K.Connection(new URL(API + "?solrpc=1", location.origin).href, { commitment: "confirmed", disableRetryOnRateLimit: true })));


// ---------------- ?demo=1: made-up coins to see a full city
export function demoCoins() {
  const day = new Date().toISOString().slice(0, 10), nowH = new Date().getUTCHours();
  const names = [["Night Owl", "OWL"], ["Neon Rat", "NRAT"], ["Getaway Cat", "GCAT"], ["Pier Shark", "SHRK"], ["Dock Frog", "DFROG"], ["Cash Gull", "GULL"], ["Tow Truck", "TOW"], ["Palm Pump", "PALM"], ["Heat Wave", "HEAT"], ["Lowrider", "LOW"], ["Bail Out", "BAIL"], ["Big Score", "SCORE"]];
  return names.map(([n, s], i) => ({ mint: "Demo" + i + "x".repeat(38), name: n, symbol: s, image: "", kind: i % 3 === 2 ? "user" : "drop", hour: i % 3 === 2 ? "" : i < Math.min(nowH, 9) ? `${day}T${String(i * 2 % 24).padStart(2, "0")}` : "2026-11-10T0" + (i % 9), launchedAt: Math.floor(Date.now() / 1000) - i * 3600,
    progress: [12, 48, 77, 100, 33, 91, 5, 64, 22, 58, 86, 40][i], graduated: i === 3 || i === 10, mcapUsd: [8e3, 31e3, 54e3, 410e3, 19e3, 72e3, 4e3, 45e3, 12e3, 38e3, 1.2e6, 26e3][i], priceUsd: 0.00004, description: "A made-up coin for the demo city." }));
}
