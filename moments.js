// moments.js — the moments worth a celebration (round L, the owner 2026-11-26): my coin graduates, my coin gets a trade,
// my cashback grows. Watched on each refresh against what this device saw last (dc.mom); the first look only learns.
import { sol, note, esc } from "/common.js";
import { t, tf } from "/i18n.js";

const KEY = "dc.mom";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || null; } catch { return null; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
export async function moments({ coins, trades, isMade }) {
  const S = await sol().catch(() => null), me = S && S.key; if (!me) return;
  const mine = coins.filter((c) => c.creator === me || (c.crew && c.crew.some((m) => m.address === me)));
  let st = load(); const first = !st || st.me !== me; if (first) st = { me, grad: [], tr: [] };
  for (const c of mine) if (isMade(c) && !st.grad.includes(c.mint)) { st.grad.push(c.mint); if (!first) celebrate(tf("momGrad", "Your {s} graduated to PumpSwap!", { s: "$" + c.symbol }), true); }
  const mm = new Set(mine.map((c) => c.mint));
  for (const x of trades || []) if (mm.has(x.mint) && x.sig && !st.tr.includes(x.sig)) { st.tr.push(x.sig); if (!first && x.side === "buy") celebrate(tf("momBuy", "Someone just bought your {s} — {v} SOL", { s: "$" + x.symbol, v: Number(x.sol).toFixed(2) }), false); }
  st.tr = st.tr.slice(-60); st.grad = st.grad.slice(-50); save(st);
}
let lastAt = 0;
function celebrate(text, big) {
  if (Date.now() - lastAt < 4000 && !big) return; lastAt = Date.now();
  note(text, big ? 6000 : 4000);
  if (navigator.vibrate) try { navigator.vibrate(big ? [20, 40, 60] : 15); } catch {}
  if (big) import("/site-x.js").then((m) => m.confetti && m.confetti()).catch(() => {});
}
/// "+N $GTAFUN" rises from an element (my cashback grew)
export function plusFly(el, text) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), f = document.createElement("span"); f.className = "plusfly"; f.textContent = text;
  f.style.left = r.left + r.width / 2 + "px"; f.style.top = r.top + 10 + "px"; document.body.appendChild(f);
  setTimeout(() => f.parentNode && f.parentNode.removeChild(f), 1500);
}
export const _esc = esc;
