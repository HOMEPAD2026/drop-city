// The transparency list: a platform wallet's transaction read as one move from its side (no network).
import { moveOf, makeFlows } from "../lib/_flows.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const W = "Vau1tWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1", X = "Someone1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1", M = "Mint1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1";
const tb = (owner, n) => ({ owner, mint: M, uiTokenAmount: { uiAmount: n } });
const tx = ({ keys = [W, X], pre = [5e9, 1e9], post = [5e9, 1e9], fee = 5000, preT = [], postT = [], ins = [], err = null } = {}) =>
  ({ blockTime: 1795600000, meta: { err, fee, preBalances: pre, postBalances: post, preTokenBalances: preT, postTokenBalances: postT, innerInstructions: [] }, transaction: { message: { accountKeys: keys.map((pubkey) => ({ pubkey })), instructions: ins } } });

const buy = moveOf(tx({ pre: [5e9, 0], post: [4e9 - 5000, 0], postT: [tb(W, 1000)] }), W);
ok(buy && buy.kind === "buy" && buy.mint === M && buy.amount === 1000 && Math.abs(buy.sol - 1) < 1e-9, "SOL out, a token in = a buyback");
const burn = moveOf(tx({ pre: [5e9, 0], post: [5e9 - 5000, 0], preT: [tb(W, 1000)], postT: [tb(W, 0)], ins: [{ parsed: { type: "burnChecked", info: { authority: W, mint: M, tokenAmount: { uiAmount: 1000 } } } }] }), W);
ok(burn && burn.kind === "burn" && burn.amount === 1000, "a burn it signed = a burn");
const pay = moveOf(tx({ pre: [5e9, 0], post: [5e9 - 5000, 0], preT: [tb(W, 500), tb(X, 0)], postT: [tb(W, 200), tb(X, 300)] }), W);
ok(pay && pay.kind === "pay" && pay.amount === 300, "a token out to someone else = a payout");
const fin = moveOf(tx({ keys: [X, W], pre: [5e9, 1e9], post: [4.5e9, 1.5e9] }), W);
ok(fin && fin.kind === "in" && Math.abs(fin.sol - 0.5) < 1e-9, "SOL arriving (fees) = in, the sender's network fee not counted against it");
ok(moveOf(tx({ err: { x: 1 } }), W) === null && moveOf(tx({ keys: [X] }), W) === null, "a failed transaction, or one without the wallet, is nothing");

// the view reads each wallet, newest first, and keeps it five minutes
const docs = new Map(); const store = { get: async (k) => docs.get(k) || null, put: async (k, v) => { docs.set(k, v); } };
let calls = 0, clock = 1e12;
const rpc = async (m, p) => { calls++; if (m === "getSignaturesForAddress") return [{ signature: "s-" + p[0].slice(0, 4) }]; return tx({ pre: [5e9, 0], post: [4e9 - 5000, 0], postT: [tb(W, 10)] }); };
const F = makeFlows({ store, wallets: () => [["vault", W]], rpc, now: () => clock });
const v = await F.view(); ok(v.moves.length === 1 && v.moves[0].role === "vault" && v.moves[0].kind === "buy" && v.tot["vault:buy"] === 1, "the view: the vault's buyback with its total");
const n = calls; await F.view(); ok(calls === n, "read once in five minutes");
clock += 301e3; await F.view(); ok(calls > n, "read again after five minutes");
{ const a1 = (await F.view()).all; clock += 301e3; const a2 = (await F.view()).all; ok(a1 && a1.buySol === 1 && a2.buySol === 1, "all-time totals count each transaction once"); }
console.log(`flows: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
