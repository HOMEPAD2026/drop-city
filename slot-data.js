// slot-data.js — CITY SLOTS' rules (pure, shared by slot.js and its test): the day's spins and streak, the titles, the pay table
export const BASE = 10;
export const TITLES = [[14, "slotTi14", "Kingpin"], [7, "slotTi7", "Made Man"], [3, "slotTi3", "Regular"], [1, "slotTi1", "New in town"]];
const dayOf = () => new Date().toISOString().slice(0, 10);
/// today's state: a new UTC day refills the spins and moves the streak (kept if yesterday was played, else back to 1)
export function today(s = {}, d = dayOf()) {
  if (s.day === d) return s;
  const y = new Date(Date.parse(d + "T00:00:00Z") - 86400e3).toISOString().slice(0, 10);
  const streak = s.day === y ? (s.streak || 0) + 1 : 1;
  return { ...s, day: d, streak, spins: BASE + Math.min(5, streak - 1), pts: s.pts || 0, best: s.best || 0 };
}
export const titleOf = (streak) => TITLES.find(([n]) => (streak || 0) >= n) || TITLES[TITLES.length - 1];
/// the pay table on the middle line: three of a kind, two of a kind from the left, ★ wild anywhere
export function payOf(line, mainId) {
  const [a, b, c] = line, w = (x) => x === "star";
  const k3 = [a, b, c].find((x) => !w(x)) || "star";
  if ([a, b, c].every((x) => w(x) || x === k3)) return k3 === "star" ? 1000 : k3 === "seven" ? 777 : k3 === mainId ? 500 : 150;
  if (w(a) && w(b)) return 60;
  if (a === b || w(a) || w(b)) { const k = w(a) ? b : a; return k === mainId ? 40 : k === "seven" ? 30 : 15; }
  return 0;
}
/// the reels' symbol ids and how often each lands (shared by the page and the server's spins)
export const weightOf = (id, mainId) => (id === "star" ? 1 : id === "seven" ? 2 : id === mainId ? 3 : 4);
export function bagOf(ids, mainId) { return ids.flatMap((id) => Array(weightOf(id, mainId)).fill(id)); }
/// the wallet's one signature a day to play for the weekly board
export const slotMessage = (wallet, day, issued) => `GTAFUN City Slots\nWallet: ${wallet}\nDay (UTC): ${day}\nIssued: ${issued}`;
/// the UTC Monday a moment belongs to (the board's week)
export const weekOf = (t) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
