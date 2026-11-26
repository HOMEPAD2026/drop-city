// lib/_spark.mjs — a coin's last 24 hours for the home page's main-coin card (2026-11-26, the owner: "다 진행").
// Dexscreener gives the coin's busiest pair and its 5 m / 1 h / 6 h / 24 h change; GeckoTerminal gives that pair's 24
// hourly closes. When the closes can't be read, the line is built from the four changes (five real points, never made up).
// Kept 5 minutes a coin in the warm function.
const MS = 5 * 60e3;
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

/// the four changes → five points, oldest first: price 24 h, 6 h, 1 h and 5 min ago, then now
export function fromChanges(p, ch) {
  if (!(p > 0) || !ch) return null;
  const at = (pct) => (pct == null || pct <= -100 ? null : p / (1 + pct / 100));
  const pts = [at(ch.h24), at(ch.h6), at(ch.h1), at(ch.m5), p];
  return pts.every((x) => x > 0) ? pts : null;
}
/// GeckoTerminal's ohlcv_list ([ts, o, h, l, c, v], newest first) → closes oldest first
export function closesOf(list) {
  const rows = (Array.isArray(list) ? list : []).filter((r) => Array.isArray(r) && num(r[0]) && num(r[4]) > 0).sort((a, b) => a[0] - b[0]);
  return rows.length >= 6 ? rows.map((r) => Number(r[4])) : null;
}
/// Dexscreener's pairs for a token → the busiest pair that has it as its base
export function bestPair(r, mint) {
  const ps = (Array.isArray(r) ? r : (r && r.pairs) || []).filter((p) => p && p.baseToken && p.baseToken.address === mint);
  ps.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
  return ps[0] || null;
}

export function makeSpark({ fetch: f = fetch } = {}) {
  const memo = new Map();
  const getJ = (u) => f(u, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  async function read(mint) {
    const p = bestPair(await getJ(`https://api.dexscreener.com/tokens/v1/solana/${mint}`), mint);
    if (!p) return { mint, ok: false };
    const pc = p.priceChange || {}, ch = { m5: num(pc.m5), h1: num(pc.h1), h6: num(pc.h6), h24: num(pc.h24) }, price = num(p.priceUsd);
    let pts = null, src = "changes";
    const g = await getJ(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${p.pairAddress}/ohlcv/hour?aggregate=1&limit=24&currency=usd`);
    const cl = closesOf(g && g.data && g.data.attributes && g.data.attributes.ohlcv_list);
    if (cl) { pts = cl; if (price > 0) pts[pts.length - 1] = price; src = "hourly"; }
    else pts = fromChanges(price, ch);
    return { mint, ok: true, price, ch, pts, src, vol24: num(p.volume && p.volume.h24), pair: p.pairAddress, dex: p.dexId || "" };
  }
  return {
    async view(mint) {
      const hit = memo.get(mint);
      if (hit && Date.now() - hit.at < MS) return hit.v;
      const v = await read(mint).catch(() => ({ mint, ok: false }));
      memo.set(mint, { at: Date.now(), v }); if (memo.size > 200) memo.clear();
      return v;
    },
  };
}
