// lib/_profile.mjs — a wallet's profile (the owner, 2026-11-26: "응 다 진행하자"): the coins it launched here, its trader
// cashback (rank, invites), its LP rewards, its GTAFUN cards, and the badges those earn. Everything is read from what the
// site already records (the list, cb/ledger.json, lp/ledger.json, cards/own/<w>.json) — nothing new is stored.
import * as C from "./_chain.mjs";

/// the badges: [id, test] — the page names and draws them (site's profile.js BADGES)
export const BADGES = [
  ["launch1", (p) => p.coins.length >= 1],
  ["launch5", (p) => p.coins.length >= 5],
  ["made", (p) => p.coins.some((c) => c.graduated)],
  ["cash", (p) => p.cashback.earned > 0],
  ["top10", (p) => p.cashback.rank > 0 && p.cashback.rank <= 10],
  ["invite1", (p) => p.cashback.invited >= 1],
  ["invite5", (p) => p.cashback.invited >= 5],
  ["lp", (p) => p.lp.earned > 0],
  ["card1", (p) => p.cards.total >= 1],
  ["set", (p) => p.cards.kinds >= p.cards.of && p.cards.of > 0],
];
export const badgesOf = (p) => BADGES.filter(([, f]) => { try { return f(p); } catch { return false; } }).map(([id]) => id);

export function makeProfile({ pad, cashback, lp, cards, now = () => Date.now() }) {
  const mem = new Map();
  async function view(w) {
    if (!C.isPubkey(String(w || ""))) return { status: 400, body: { error: "bad wallet" } };
    const hit = mem.get(w); if (hit && now() - hit.at < 30e3) return { status: 200, body: hit.body };
    const [L, cb, lv, cv] = await Promise.all([pad.list().catch(() => ({ items: [] })), cashback ? cashback.view(w).catch(() => null) : null, lp ? lp.view(w).catch(() => null) : null, cards ? cards.view(w).catch(() => null) : null]);
    const items = L.items || [];
    const coins = items.filter((c) => c.creator === w && c.kind !== "partner").map((c) => ({ mint: c.mint, symbol: c.symbol, name: c.name, image: c.image, mcapUsd: c.mcapUsd || 0, graduated: !!c.graduated, progress: c.progress || 0, launchedAt: c.launchedAt || 0 }))
      .sort((a, b) => b.mcapUsd - a.mcapUsd);
    const own = Array.isArray(cv && cv.mine) ? cv.mine : [], mine = {}; for (const x of own) if (x && x.card) mine[x.card] = (mine[x.card] || 0) + 1; // cards/own/<w>.json: one row a card
    const kinds = Object.keys(mine).length, total = own.length;
    const p = {
      wallet: w,
      coins,
      mcapUsd: coins.reduce((s, c) => s + c.mcapUsd, 0),
      cashback: cb && cb.me ? { earned: cb.me.earned, today: cb.me.today, rank: cb.me.rank, of: cb.earners || 0, invited: cb.me.invited, refEarned: cb.me.refEarned, ref: cb.me.ref } : { earned: 0, today: 0, rank: 0, of: 0, invited: 0, refEarned: 0, ref: null },
      lp: lv && lv.me ? { earned: lv.me.earned, paid: lv.me.paid, pending: lv.me.pending } : { earned: 0, paid: 0, pending: 0 },
      cards: { kinds, total, of: (cv && cv.cards) || 0, mine },
      main: (L.cfg && L.cfg.ticker) || "",
    };
    p.badges = badgesOf(p);
    mem.set(w, { at: now(), body: p });
    return { status: 200, body: p };
  }
  return { view };
}
