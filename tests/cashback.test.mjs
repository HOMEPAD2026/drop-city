// Trader cashback: a transaction read as a trade, the day's caps, the tick's cursors and exclusions, and the LP payout
// owing it (no network).
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kp = () => C.b58enc(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
process.env.PAD_VAULT = kp(); process.env.PAD_BUYER = kp(); process.env.PAD_SUFFIX = "";
const REWARDS = kp(); process.env.PAD_LP_WALLET = REWARDS;
const { tradeOf, creditOf, cbCfg, makeCashback, refMessage } = await import("../lib/_cashback.mjs");
const { makeLp } = await import("../lib/_lp.mjs");
const { PAD } = await import("../pad-config.js");
const MAIN = PAD.main, WSOL = "So11111111111111111111111111111111111111112";

// ---------------- a transaction → a trade
const tb = (owner, mint, n) => ({ owner, mint, uiTokenAmount: { uiAmount: n } });
const mk = (who, { lam = [0, 0], fee = 5000, pre = [], post = [], err = null } = {}) => ({ meta: { err, fee, preBalances: [lam[0], 1], postBalances: [lam[1], 1], preTokenBalances: pre, postTokenBalances: post }, transaction: { message: { accountKeys: [who, kp()] } } });
const A = kp(), B = kp(), COIN = kp(), CREATOR = kp();
{ const buy = tradeOf(mk(A, { lam: [5e9, 4e9 - 5000], pre: [], post: [tb(A, COIN, 1000)] }), COIN);
  ok(buy && buy.side === "buy" && Math.abs(buy.sol - 1) < 1e-9 && buy.who === A, "a buy: coin in, SOL out (the network fee given back)");
  const sell = tradeOf(mk(A, { lam: [1e9, 1.5e9 - 5000], pre: [tb(A, COIN, 1000)], post: [tb(A, COIN, 0)] }), COIN);
  ok(sell && sell.side === "sell" && Math.abs(sell.sol - 0.5) < 1e-9, "a sell: coin out, SOL in");
  const wsol = tradeOf(mk(A, { lam: [1e9, 1e9 - 5000], pre: [tb(A, WSOL, 2)], post: [tb(A, WSOL, 1.2), tb(A, COIN, 50)] }), COIN);
  ok(wsol && wsol.side === "buy" && Math.abs(wsol.sol - 0.8) < 1e-9, "wrapped SOL counts as SOL");
  ok(tradeOf(mk(A, { lam: [1e9, 1e9 - 5000], pre: [tb(A, COIN, 100)], post: [tb(A, COIN, 0), tb(B, COIN, 100)] }), COIN) === null, "a plain transfer is no trade");
  ok(tradeOf(mk(A, { lam: [5e9, 4e9], pre: [], post: [tb(A, COIN, 1000)], err: { x: 1 } }), COIN) === null, "a failed transaction is no trade");
  ok(tradeOf(mk(A, { lam: [5e9, 5e9 - 5000], pre: [], post: [tb(A, COIN, 1000)] }), COIN) === null, "coin in with no SOL out (an airdrop) is no trade"); }

// ---------------- the caps
{ const L = { ...cbCfg(), bps: 30, daily: 1000, perWallet: 400, minUsd: 2 }, st = { spent: 0, per: {} };
  ok(Math.abs(creditOf(100, st, A, L, 0.001) - 300) < 1e-6, "0.3 % of a $100 trade at $0.001 a main coin = 300");
  ok(creditOf(1, st, A, L, 0.001) === 0, "a trade under minUsd earns nothing");
  st.per[A] = 300; ok(Math.abs(creditOf(100, st, A, L, 0.001) - 100) < 1e-6, "a wallet's day cap");
  st.spent = 950; ok(Math.abs(creditOf(100, st, B, L, 0.001) - 50) < 1e-6, "the day's total cap");
  ok(creditOf(100, st, B, L, 0) === 0, "no main-coin price, no credit"); }

// ---------------- the tick
const docs = new Map();
const store = { get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null), put: async (k, v, o = {}) => { if (o.create && docs.has(k)) return { conflict: true }; docs.set(k, JSON.parse(JSON.stringify(v))); return {}; } };
const items = [{ mint: MAIN, kind: "user", symbol: "GTAFUN", priceUsd: 0.001, creator: kp() }, { mint: COIN, kind: "user", symbol: "COIN", priceUsd: 0.01, creator: CREATOR }, { mint: kp(), kind: "partner", symbol: "SUP", priceUsd: 1 }];
const pad = { list: async () => ({ items }) };
let sigs = { [MAIN]: [{ signature: "S0" }], [COIN]: [{ signature: "C0" }] }, txs = {};
const rpc = async (m, p) => {
  if (m === "getSignaturesForAddress") { const all = sigs[p[0]] || [], until = p[1].until, i = until ? all.findIndex((s) => s.signature === until) : -1; return (i >= 0 ? all.slice(0, i) : all).slice(0, p[1].limit); }
  if (m === "getTransaction") return txs[p[0]] || null;
  return null;
};
let clock = Date.parse("2026-11-25T10:00:00Z");
const CB = makeCashback({ store, pad, rpc, now: () => clock, solUsd: async () => 200 });
let r = await CB.tick();
ok(r.read === 0 && docs.get("cb/state.json").cur[COIN] === "C0", "the first look only sets each coin's cursor (no back pay)");
ok(!docs.get("cb/state.json").cur[items[2].mint], "supported coins (not launched here) aren't counted");
// new trades: A buys 1 SOL of COIN, the creator sells, B buys the main coin, a platform wallet buys
sigs[COIN] = [{ signature: "C3" }, { signature: "C2" }, { signature: "C1" }, { signature: "C0" }];
sigs[MAIN] = [{ signature: "S2" }, { signature: "S1" }, { signature: "S0" }];
txs.C1 = mk(A, { lam: [5e9, 4e9 - 5000], post: [tb(A, COIN, 1000)] });
txs.C2 = mk(CREATOR, { lam: [1e9, 3e9 - 5000], pre: [tb(CREATOR, COIN, 5000)], post: [tb(CREATOR, COIN, 0)] });
txs.C3 = mk(process.env.PAD_VAULT, { lam: [9e9, 8e9 - 5000], post: [tb(process.env.PAD_VAULT, COIN, 10)] });
txs.S1 = mk(B, { lam: [5e9, 4.5e9 - 5000], post: [tb(B, MAIN, 1e6)] });
txs.S2 = { meta: null };
clock += 300e3; r = await CB.tick();
const led = docs.get("cb/ledger.json");
ok(r.read === 5 && r.credited === 2, "five transactions read, two traders credited");
ok(Math.abs(led.earned[A] - 600) < 1e-6, "1 SOL × $200 × 0.3 % ÷ $0.001 = 600 main coins");
ok(Math.abs(led.earned[B] - 300) < 1e-6, "the main coin's own trades count too");
ok(!led.earned[CREATOR] && !led.earned[process.env.PAD_VAULT], "the coin's creator and the platform's wallets earn nothing");
ok(docs.get("cb/state.json").cur[COIN] === "C3" && docs.get("cb/state.json").cur[MAIN] === "S2", "the cursors move to the newest read");
clock += 300e3; r = await CB.tick(); ok(r.read === 0 && Math.abs(docs.get("cb/ledger.json").earned[A] - 600) < 1e-6, "the same trades never count twice");
ok((await CB.tick()).busy === true, "a second tick in the same few minutes waits");
const v = await CB.view(A); ok(v.me.earned === 600 && v.bps === 30 && v.last.length === 2 && v.last[0].sym, "the view: my cashback, the rate, the latest");
// ---------------- referrals: a trader links its inviter once, signed; the inviter then earns 10 % of its cashback on top
{ const sk = ed25519.utils.randomSecretKey(), T = C.b58enc(ed25519.getPublicKey(sk)), INV = kp(), issued = new Date(clock).toISOString();
  const sign = (w, inv, at) => C.b58enc(ed25519.sign(new TextEncoder().encode(refMessage(w, inv, at)), sk));
  ok((await CB.ref({ wallet: T, ref: INV, issued, sig: C.b58enc(new Uint8Array(64)) })).status === 403, "a referral needs the trader's own signature");
  ok((await CB.ref({ wallet: T, ref: T, issued, sig: sign(T, T, issued) })).status === 400, "a wallet can't invite itself");
  ok((await CB.ref({ wallet: T, ref: INV, issued: new Date(clock - 3600e3).toISOString(), sig: sign(T, INV, new Date(clock - 3600e3).toISOString()) })).status === 400, "an old signature is refused");
  ok((await CB.ref({ wallet: T, ref: INV, issued, sig: sign(T, INV, issued) })).status === 200, "the trader links its inviter");
  ok((await CB.ref({ wallet: T, ref: kp(), issued, sig: sign(T, INV, issued) })).status >= 400, "a linked wallet can't change its inviter");
  sigs[COIN] = [{ signature: "C4" }, ...sigs[COIN]]; txs.C4 = mk(T, { lam: [5e9, 4e9 - 5000], post: [tb(T, COIN, 1000)] });
  clock += 300e3; await CB.tick();
  const l2 = docs.get("cb/ledger.json");
  ok(Math.abs(l2.earned[T] - 600) < 1e-6 && Math.abs(l2.earned[INV] - 60) < 1e-6 && Math.abs(l2.ref[INV] - 60) < 1e-6, "the inviter earns 10 % of the trader's cashback on top (60 of 600)");
  const vi = await CB.view(INV); ok(vi.me.invited === 1 && Math.abs(vi.me.refEarned - 60) < 1e-6 && vi.refBps === 1000, "the inviter's view: one invite, the bonus earned");
  const vt = await CB.view(T); ok(vt.me.ref === INV && vt.top.length >= 3 && vt.top[0].amt >= vt.top[1].amt && vt.me.rank >= 1, "the leaderboard, the trader's rank and inviter"); }
// a new day resets the caps
clock += 86400e3; await CB.tick(); ok(docs.get("cb/state.json").spent === 0, "a new UTC day starts the caps again");

// ---------------- the LP payout owes the cashback too
const lp = makeLp({ store, pad, now: () => clock, fetchImpl: async () => ({ ok: true, json: async () => ({ data: { data: [] } }) }), rpc, cashback: () => CB.earned() });
const due = await lp.due();
ok(due.some((d) => d.owner === A && Math.abs(d.pending - 600) < 1e-6) && due.some((d) => d.owner === B), "the rewards wallet's list carries the cashback");
docs.set("lp/ledger.json", { earned: { [A]: 50 }, paid: { [A]: 650 }, hours: 1, total: 50, sigs: [] });
ok(!(await lp.due()).some((d) => d.owner === A), "paid in full (LP + cashback) leaves nothing owed");
const lv = await lp.view(A); ok(lv.me.cashback === 600 && lv.me.pending === 0, "the LP view shows the cashback beside the LP rewards");
console.log(`cashback: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
