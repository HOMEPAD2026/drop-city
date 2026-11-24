// LP rewards: the hour's split, the snapshot (pools from Raydium's API, holders from the chain), the ledger, payouts (no network).
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kp = () => C.b58enc(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
process.env.PAD_VAULT = kp(); process.env.PAD_BUYER = kp(); process.env.PAD_SUFFIX = "";
const REWARDS = kp(); process.env.PAD_LP_WALLET = REWARDS; process.env.PAD_LP_DAILY = "2400";
const { makeLp, splitHour, lpCfg, CPMM, WSOL } = await import("../lib/_lp.mjs");
const { PAD } = await import("../pad-config.js");
const MAIN = PAD.main, COIN = PAD.supported[0].mint;

// ---------------- the split
{ const A = kp(), B = kp(), Cc = kp();
  const { out, perPool } = splitHour([{ id: "p1", kind: "sol", tvl: 1000, eligible: 10, holders: { [A]: 5, [B]: 5 } }, { id: "p2", kind: "main", tvl: 1000, eligible: 4, holders: { [Cc]: 4 } }], 100, 1.5);
  ok(Math.abs(perPool.p1 - 40) < 1e-9 && Math.abs(perPool.p2 - 60) < 1e-9, "pools by liquidity, main-coin pairs ×1.5 (1000 : 1500 → 40 / 60)");
  ok(Math.abs(out[A] - 20) < 1e-9 && Math.abs(out[B] - 20) < 1e-9 && Math.abs(out[Cc] - 60) < 1e-9, "inside a pool by LP held");
  ok(Object.keys(splitHour([{ id: "x", kind: "sol", tvl: 0, eligible: 1, holders: { [A]: 1 } }], 100).out).length === 0, "an empty pool pays nothing"); }
ok(lpCfg().minPoolUsd === 1000, "a pool needs $1,000 of liquidity to earn");
ok(lpCfg().wallet === REWARDS && lpCfg().daily === 2400, "the rewards wallet and the daily amount come from the environment");

// ---------------- a store, Raydium's API and the chain, made up
const docs = new Map();
const store = { get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null), put: async (k, v, o = {}) => { if (o.create && docs.has(k)) return { conflict: true }; docs.set(k, JSON.parse(JSON.stringify(v))); return {}; }, list: async (p) => [...docs.keys()].filter((k) => k.startsWith(p)) };
const LP1 = kp(), LP2 = kp(), POOL1 = kp(), POOL2 = kp(), H1 = kp(), H2 = kp(), H3 = kp(), TINY = kp();
const fetchImpl = async (u) => {
  const m1 = /mint1=([^&]+)&mint2=([^&]+)/.exec(u), pool = m1 && m1[1] === COIN ? (m1[2] === WSOL ? { id: POOL1, lp: LP1, tvl: 3000 } : m1[2] === MAIN ? { id: POOL2, lp: LP2, tvl: 2000 } : null) : null;
  return { ok: true, json: async () => ({ data: { data: pool ? [{ id: pool.id, programId: CPMM, lpMint: { address: pool.lp, decimals: 9 }, tvl: pool.tvl, mintA: { address: COIN, symbol: "DCTY" }, mintB: { address: m1[2], symbol: m1[2] === WSOL ? "WSOL" : "GTAFUN" } }, { id: kp(), programId: "AMM-v4", lpMint: { address: kp() }, tvl: 9e9 }] : [] } }) };
};
const acct = (owner, n) => ({ account: { data: { parsed: { info: { owner, tokenAmount: { uiAmount: n } } } } } });
let txs = {};
const rpc = async (m, p) => {
  if (m === "getProgramAccounts") { const mint = p[1].filters[1].memcmp.bytes; return mint === LP1 ? [acct(H1, 75), acct(H2, 24.99), acct(TINY, 0.01), acct("1nc1nerator11111111111111111111111111111111", 50)] : mint === LP2 ? [acct(H3, 10), acct(REWARDS, 10)] : []; }
  if (m === "getTransaction") return txs[p[0]] || null;
  throw new Error("unexpected " + m);
};
let clock = Date.UTC(2026, 10, 24, 10, 5);
const pad = { list: async () => ({ items: [{ mint: MAIN, priceUsd: 0.000002 }], cfg: { main: MAIN } }) };
const L = makeLp({ store, pad, now: () => clock, fetchImpl, rpc });
const ps = await L.pools();
ok(ps.length === 2 && ps.every((p) => p !== null) && ps.find((p) => p.kind === "sol").lpMint === LP1 && ps.find((p) => p.kind === "main").lpMint === LP2, "the CPMM pools of a supported coin with SOL and with the main coin (other programs left out)");
const s1 = await L.tick();
ok(s1.hour === "2026-11-24T10" && Math.abs(s1.reward - 100) < 1e-9 && s1.pools.length === 2, "an hour's snapshot: 2400 a day → 100 this hour");
const led = docs.get("lp/ledger.json");
// weights: 3000 (sol) vs 2000 × 1.5 = 3000 (main) → 50 / 50; the burned LP, the tiny holder (< $10) and the rewards wallet don't earn
ok(Math.abs(led.earned[H3] - 50) < 1e-6 && Math.abs(led.earned[H1] + led.earned[H2] - 50) < 1e-4 && !led.earned[TINY] && !led.earned[REWARDS], "burned LP, dust and the rewards wallet earn nothing; the rest is split");
ok(Math.abs(led.earned[H1] / led.earned[H2] - 75 / 24.99) < 1e-3, "pro rata to LP held");
ok((await L.tick()).done === true && docs.get("lp/ledger.json").hours === 1, "the same hour isn't counted twice");
clock += 3600e3; await L.tick(); ok(docs.get("lp/ledger.json").hours === 2 && Math.abs(docs.get("lp/ledger.json").earned[H3] - 100) < 1e-6, "the next hour adds up");
const v = await L.view(H3);
{ const dust = splitHour([], 100); ok(Object.keys(dust.out).length === 0, "nothing to split, nothing paid"); }
ok(v.daily === 2400 && v.pools.length === 2 && v.me.pending === 100 && v.pools.every((p) => p.apr > 0), "the view: pools with an APR, a wallet's pending reward");
ok((await L.due()).map((x) => x.owner).includes(H3), "owed ≥ the minimum shows in the due list");

// ---------------- a payout from the rewards wallet
const tb = (owner, n) => ({ mint: MAIN, owner, uiTokenAmount: { uiAmount: n } });
const SIG = "5".repeat(88), BAD = "6".repeat(88);
txs[SIG] = { meta: { err: null, preTokenBalances: [tb(REWARDS, 1000), tb(H3, 0)], postTokenBalances: [tb(REWARDS, 900), tb(H3, 100)] }, transaction: { message: { accountKeys: [{ pubkey: REWARDS, signer: true }] } } };
txs[BAD] = { meta: { err: null, preTokenBalances: [], postTokenBalances: [tb(H1, 5)] }, transaction: { message: { accountKeys: [{ pubkey: H1, signer: true }] } } };
ok((await L.paid({ sig: BAD })).status === 403, "a transfer not signed by the rewards wallet doesn't count");
const p1 = await L.paid({ sig: SIG }); ok(p1.status === 200 && p1.body.got[H3] === 100 && docs.get("lp/ledger.json").paid[H3] === 100, "the rewards wallet's transfer marks the owner paid");
ok((await L.paid({ sig: SIG })).body.already === true && docs.get("lp/ledger.json").paid[H3] === 100, "the same payout counts once");
ok((await L.view(H3)).me.pending === 0, "nothing pending after the payout");
console.log(`lp: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
