// lib/_lp.mjs — LP rewards (the owner, 2026-11-24: Raydium CPMM pools pairing the city's supported coins with SOL and
// with the main coin; rewards paid in the main coin). Every hour: the pools are found through Raydium's public API, each
// pool's LP holders are read from the chain, and that hour's share of the day's reward is split across the pools by their
// liquidity (main-coin pairs weigh more) and inside a pool by LP tokens held — so it pays for liquidity that stays.
// The ledger keeps what each wallet earned and was paid. Paying is done in the page by the rewards wallet (a GM's own
// wallet signs); the server only checks the transfer on chain and marks it paid — it holds no key.
import { PAD } from "../pad-config.js";
import * as C from "./_chain.mjs";
import { cfg as padCfg } from "./_pad.mjs";

export const CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const WSOL = "So11111111111111111111111111111111111111112";
const TOKEN = "TokenkegQfeZyiNwAJbNbGQPxZPxXgL4XQjBEc7hbr";
// LP held by these never earns: the incinerator (burned LP) and Raydium's LP lock program's custody
const NEVER = new Set(["1nc1nerator11111111111111111111111111111111", "LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE"]);
const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();

/// the rewards settings: pad-config.js lp, with PAD_LP_DAILY / PAD_LP_WALLET from the environment winning
export function lpCfg() {
  const L = { daily: 1000000, boostMain: 1.5, minUsd: 10, minPoolUsd: 1000, minPay: 100, exclude: [], wallet: "", ...(PAD.lp || {}) };
  if (env("PAD_LP_DAILY") && Number(env("PAD_LP_DAILY")) >= 0) L.daily = Number(env("PAD_LP_DAILY"));
  if (C.isPubkey(env("PAD_LP_WALLET"))) L.wallet = env("PAD_LP_WALLET");
  if (!C.isPubkey(L.wallet)) L.wallet = "";
  return L;
}
const hourOf = (t) => new Date(t).toISOString().slice(0, 13);
const round6 = (x) => Math.floor(x * 1e6) / 1e6;

/// one hour's reward, split: pools by weight (liquidity × the main-coin boost), holders by LP held → { owner: amount }
export function splitHour(pools, hourReward, boostMain = 1.5) {
  const live = pools.filter((p) => p.tvl > 0 && p.eligible > 0);
  const W = live.reduce((s, p) => s + p.tvl * (p.kind === "main" ? boostMain : 1), 0), out = {};
  if (!W || !(hourReward > 0)) return { out, perPool: {} };
  const perPool = {};
  for (const p of live) {
    const r = (hourReward * p.tvl * (p.kind === "main" ? boostMain : 1)) / W; perPool[p.id] = r;
    for (const [o, a] of Object.entries(p.holders)) if (a > 0) out[o] = (out[o] || 0) + (r * a) / p.eligible;
  }
  return { out, perPool };
}

export function makeLp({ store, pad, now = () => Date.now(), fetchImpl = fetch, rpc = C.rpc, cashback = async () => ({}) }) {
  // cashback(): { wallet: main coins earned as trader cashback } (lib/_cashback.mjs) — the same payout pays both
  const mem = { pools: null };
  /// the CPMM pools of each supported coin with SOL and with the main coin (Raydium's API; kept 30 minutes)
  async function pools() {
    if (mem.pools && now() - mem.pools.at < 30 * 60e3) return mem.pools.items;
    const main = padCfg().main || PAD.main, sup = (PAD.supported || []).map((x) => x.mint).filter(C.isPubkey);
    const pairs = sup.flatMap((m) => [[m, WSOL, "sol"], ...(main && main !== m ? [[m, main, "main"]] : [])]);
    const items = [];
    for (const [a, b, kind] of pairs) {
      const u = `https://api-v3.raydium.io/pools/info/mint?mint1=${a}&mint2=${b}&poolType=standard&poolSortField=liquidity&sortType=desc&pageSize=5&page=1`;
      const j = await fetchImpl(u, { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      for (const p of (j && j.data && j.data.data) || []) {
        if (p.programId !== CPMM || !p.lpMint || !p.lpMint.address) continue;
        items.push({ id: p.id, kind, coin: a, other: b, lpMint: p.lpMint.address, lpDecimals: p.lpMint.decimals ?? 9, tvl: Number(p.tvl) || 0,
          symA: (p.mintA && p.mintA.symbol) || "", symB: (p.mintB && p.mintB.symbol) || "", mintA: p.mintA && p.mintA.address, mintB: p.mintB && p.mintB.address });
      }
    }
    mem.pools = { at: now(), items };
    return items;
  }
  /// who holds a pool's LP tokens: every token account of the LP mint (getProgramAccounts), else the 20 largest
  async function holders(lpMint) {
    const by = {};
    try {
      const r = await rpc("getProgramAccounts", [TOKEN, { encoding: "jsonParsed", filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: lpMint } }] }]);
      for (const a of r || []) { const i = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info; if (!i) continue; const n = Number(i.tokenAmount && i.tokenAmount.uiAmount) || 0; if (n > 0) by[i.owner] = (by[i.owner] || 0) + n; }
      return { by, full: true };
    } catch { /* an RPC that refuses program scans: the largest accounts only */ }
    const big = await rpc("getTokenLargestAccounts", [lpMint]);
    const accs = ((big && big.value) || []).filter((x) => Number(x.uiAmount) > 0);
    if (accs.length) {
      const info = await rpc("getMultipleAccounts", [accs.map((x) => x.address), { encoding: "jsonParsed" }]);
      ((info && info.value) || []).forEach((a, k) => { const o = a && a.data && a.data.parsed && a.data.parsed.info && a.data.parsed.info.owner; if (o) by[o] = (by[o] || 0) + Number(accs[k].uiAmount); });
    }
    return { by, full: false };
  }
  /// this hour's snapshot (once an hour, whoever calls first): holders, then the hour's reward into the ledger
  async function tick() {
    const t = now(), hour = hourOf(t), L = lpCfg(), key = `lp/snap/${hour}.json`;
    if (await store.get(key).catch(() => null)) return { hour, done: true };
    const lock = await store.put(`lp/lock/${hour}.json`, { at: t }, { create: true }).catch(() => ({ conflict: true }));
    if (lock && lock.conflict) return { hour, busy: true };
    // a pool under minPoolUsd of liquidity earns nothing (a dust pool would otherwise take the whole day)
    const ps = (await pools()).filter((p) => p.tvl >= L.minPoolUsd), ex = new Set([...(L.exclude || []), ...NEVER, ...(L.wallet ? [L.wallet] : [])]);
    const rows = [];
    for (const p of ps) {
      const h = await holders(p.lpMint).catch(() => null); if (!h) continue;
      const total = Object.values(h.by).reduce((s, x) => s + x, 0), keep = {};
      // too little to count (under minUsd of liquidity), excluded wallets and the pool's own custody earn nothing
      for (const [o, a] of Object.entries(h.by)) if (!ex.has(o) && o !== p.id && total > 0 && (a / total) * p.tvl >= L.minUsd) keep[o] = a;
      rows.push({ ...p, holders: keep, eligible: Object.values(keep).reduce((s, x) => s + x, 0), lpTotal: total, full: h.full });
    }
    const hourReward = L.daily / 24, { out, perPool } = splitHour(rows, hourReward, L.boostMain);
    const led = (await store.get("lp/ledger.json").catch(() => null)) || { earned: {}, paid: {}, hours: 0, total: 0, sigs: [] };
    for (const [o, a] of Object.entries(out)) led.earned[o] = round6((led.earned[o] || 0) + a);
    led.hours++; led.total = round6((led.total || 0) + Object.values(out).reduce((s, x) => s + x, 0)); led.at = t;
    await store.put("lp/ledger.json", led, {});
    const snap = { hour, at: t, reward: hourReward, pools: rows.map((p) => ({ id: p.id, kind: p.kind, coin: p.coin, tvl: p.tvl, holders: Object.keys(p.holders).length, reward: round6(perPool[p.id] || 0), full: p.full })), paidOut: round6(Object.values(out).reduce((s, x) => s + x, 0)) };
    await store.put(key, snap, {});
    return snap;
  }
  /// the page's view: the pools (with an APR estimate from the main coin's price), the day's reward, a wallet's account
  async function view(w = "") {
    const L = lpCfg(), [ps, led, list] = await Promise.all([pools(), store.get("lp/ledger.json").catch(() => null), pad.list().catch(() => ({ items: [] }))]);
    const main = (list.items || []).find((x) => x.mint === (list.cfg && list.cfg.main)), px = main && main.priceUsd ? main.priceUsd : null;
    const ok = (p) => p.tvl >= L.minPoolUsd, W = ps.filter(ok).reduce((s, p) => s + p.tvl * (p.kind === "main" ? L.boostMain : 1), 0);
    const rows = ps.map((p) => { const share = W && ok(p) ? (p.tvl * (p.kind === "main" ? L.boostMain : 1)) / W : 0, perDay = L.daily * share;
      return { eligible: ok(p), id: p.id, kind: p.kind, coin: p.coin, other: p.other, symA: p.symA, symB: p.symB, tvl: p.tvl, perDay: round6(perDay), apr: px && p.tvl > 0 ? (perDay * 365 * px) / p.tvl : null }; });
    const cb = await cashback().catch(() => ({}));
    const l = led || { earned: {}, paid: {} }, me = C.isPubkey(w) ? { earned: l.earned[w] || 0, cashback: cb[w] || 0, paid: l.paid[w] || 0, pending: round6(Math.max(0, (l.earned[w] || 0) + (cb[w] || 0) - (l.paid[w] || 0))) } : null;
    return { daily: L.daily, wallet: L.wallet || null, boostMain: L.boostMain, minUsd: L.minUsd, minPoolUsd: L.minPoolUsd, mainPriceUsd: px, pools: rows, hours: l.hours || 0, total: l.total || 0, paidTotal: Object.values(l.paid || {}).reduce((s, x) => s + x, 0), me, last: (l.sigs || []).slice(0, 10) };
  }
  /// what is owed (LP rewards + trader cashback − paid, pending ≥ minPay), biggest first — the rewards wallet pays from this list
  async function due() {
    const L = lpCfg(), l = (await store.get("lp/ledger.json").catch(() => null)) || { earned: {}, paid: {} }, cb = await cashback().catch(() => ({}));
    const owe = { ...l.earned }; for (const [o, a] of Object.entries(cb)) owe[o] = round6((owe[o] || 0) + a); // LP rewards + trader cashback
    return Object.entries(owe).map(([o, e]) => ({ owner: o, pending: round6(e - (l.paid[o] || 0)) })).filter((x) => x.pending >= L.minPay).sort((a, b) => b.pending - a.pending);
  }
  /// a payout the rewards wallet sent: read the transaction, credit each owner's received main coin as paid (once a tx)
  async function paid(b) {
    const sig = String((b && b.sig) || ""), L = lpCfg();
    if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig)) return { status: 400, body: { error: "not a transaction signature" } };
    if (!L.wallet) return { status: 409, body: { error: "the rewards wallet isn't set (PAD_LP_WALLET)" } };
    const main = padCfg().main || PAD.main;
    const tx = await rpc("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    if (!tx || !tx.meta || tx.meta.err) return { status: 404, body: { error: "the transaction isn't confirmed (or failed)" } };
    const signers = (tx.transaction.message.accountKeys || []).filter((k) => k.signer).map((k) => String(k.pubkey));
    if (!signers.includes(L.wallet)) return { status: 403, body: { error: "not signed by the rewards wallet" } };
    const bal = (arr) => { const m = {}; for (const x of arr || []) if (x.mint === main && x.owner) m[x.owner] = (m[x.owner] || 0) + (Number(x.uiTokenAmount && x.uiTokenAmount.uiAmount) || 0); return m; };
    const pre = bal(tx.meta.preTokenBalances), post = bal(tx.meta.postTokenBalances), got = {};
    for (const o of Object.keys(post)) { const d = post[o] - (pre[o] || 0); if (o !== L.wallet && d > 0) got[o] = round6(d); }
    if (!Object.keys(got).length) return { status: 400, body: { error: "no main-coin transfer to anyone in it" } };
    const once = await store.put(`lp/paid/${sig}.json`, { at: now(), got }, { create: true }).catch(() => ({ conflict: true }));
    if (once && once.conflict) return { status: 200, body: { ok: true, already: true } };
    const led = (await store.get("lp/ledger.json").catch(() => null)) || { earned: {}, paid: {}, hours: 0, total: 0, sigs: [] };
    for (const [o, a] of Object.entries(got)) led.paid[o] = round6((led.paid[o] || 0) + a);
    led.sigs = [{ sig, at: now(), n: Object.keys(got).length, amount: round6(Object.values(got).reduce((s, x) => s + x, 0)) }, ...(led.sigs || [])].slice(0, 50);
    await store.put("lp/ledger.json", led, {});
    return { status: 200, body: { ok: true, got } };
  }
  return { pools, holders, tick, view, due, paid };
}
