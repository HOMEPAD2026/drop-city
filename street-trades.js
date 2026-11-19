// street-trades.js — the coins' trades, live in the city (on the map and on foot): every buy bursts from the top of its
// tower in green and gold with "+0.25 SOL", every sell puffs red, a big buy (≥ BIG SOL) rains money and says so.
// Read from the trades feed (GET ?trades, the same one the site's ticker uses), every few seconds while the page is open.
import { getJ } from "/common.js";
export const BIG = 1; // SOL
export function streetTrades(A, { every = 8000 } = {}) {
  const { city } = A;
  const seen = new Set(); let first = true;
  const fmt = (s) => (s >= 10 ? s.toFixed(0) : s >= 1 ? s.toFixed(1) : s.toFixed(2));
  async function poll() {
    if (document.hidden) return;
    let j = null; try { j = await getJ("?trades"); } catch { return; }
    const items = (j && j.items) || [];
    const fresh = items.filter((t) => t && t.sig && !seen.has(t.sig)); for (const t of items) if (t && t.sig) seen.add(t.sig);
    if (first) { first = false; return; } // what happened before we came in isn't news
    fresh.sort((a, b) => a.at - b.at).slice(-8).forEach((t, i) => setTimeout(() => react(t), i * 450));
    if (seen.size > 2000) { const keep = items.map((t) => t.sig); seen.clear(); keep.forEach((s) => seen.add(s)); }
  }
  function react(t) {
    const tw = city.towers.get(t.mint); if (!tw) return;
    const p = tw.group.position, top = tw.h + 4, buy = t.side === "buy", big = buy && t.sol >= BIG;
    city.burst(p.x, top, p.z, big ? 1.1 : 0.35, buy ? [[0.24, 1, 0.71], [1, 0.83, 0.42], [1, 1, 1]] : [[1, 0.3, 0.3], [0.5, 0.1, 0.12], [0.3, 0.3, 0.3]]);
    A.pop(`${buy ? "+" : "−"}${fmt(t.sol)} SOL`, { x: p.x, z: p.z }, buy ? "#3dffb5" : "#ff4d6d", top + 2);
    if (big) { for (let k = 1; k <= 3; k++) setTimeout(() => city.burst(p.x + (Math.random() - 0.5) * 10, top + 8 + k * 4, p.z + (Math.random() - 0.5) * 10, 0.6, [[1, 0.83, 0.42], [0.24, 1, 0.71]]), k * 300);
      A.toast(`💸 Big buy: ${fmt(t.sol)} SOL of $${t.symbol}`); A.sound("buy"); }
  }
  poll(); setInterval(poll, every);
  return { react, poll };
}
