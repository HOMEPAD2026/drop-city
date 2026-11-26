// lib/_flows.mjs — the platform wallets' latest moves, read from the chain (the owner, 2026-11-26: "응 다 진행하자" — the
// transparency page). Each wallet's newest transactions (getSignaturesForAddress → getTransaction jsonParsed) are read
// as one move from that wallet's side: a buyback (SOL out, a token in), a burn (a burn instruction it signed), a payout
// (a token out to someone else), SOL in (fees arriving) or SOL out. Nothing here is a claim the chain doesn't show:
// every row links its transaction. Kept 5 minutes in the function's memory and in flows.json.
import * as C from "./_chain.mjs";

const WSOL = "So11111111111111111111111111111111111111112";
const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

/// one parsed transaction → the move from `w`'s side (or null when it's nothing we can name)
export function moveOf(tx, w) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const keys = ((tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) || []).map((k) => (typeof k === "string" ? k : String(k.pubkey)));
  const i = keys.indexOf(w); if (i < 0) return null;
  const fee = i === 0 ? tx.meta.fee || 0 : 0;
  const dSol = (tx.meta.postBalances[i] - tx.meta.preBalances[i] + fee) / 1e9;
  const toks = {}; const add = (arr, s) => { for (const b of arr || []) if (b.owner === w && b.mint !== WSOL) toks[b.mint] = (toks[b.mint] || 0) + s * (Number(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0); };
  add(tx.meta.postTokenBalances, 1); add(tx.meta.preTokenBalances, -1);
  const ins = [...((tx.transaction.message.instructions) || []), ...((tx.meta.innerInstructions || []).flatMap((x) => x.instructions || []))];
  const burn = ins.find((x) => x && x.parsed && /^burn/.test(String(x.parsed.type)) && x.parsed.info && x.parsed.info.authority === w);
  const at = (tx.blockTime || 0) * 1000;
  if (burn) { const inf = burn.parsed.info, amt = inf.tokenAmount ? Number(inf.tokenAmount.uiAmount) : Number(inf.amount) || 0; return { kind: "burn", mint: inf.mint || Object.keys(toks)[0] || "", amount: round(Math.abs(toks[inf.mint] || amt)), at }; }
  const gained = Object.entries(toks).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0], lost = Object.entries(toks).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
  if (gained && dSol < -0.0005) return { kind: "buy", mint: gained[0], amount: round(gained[1]), sol: round(-dSol, 4), at };
  if (lost && dSol > 0.0005) return { kind: "sell", mint: lost[0], amount: round(-lost[1]), sol: round(dSol, 4), at };
  if (lost) return { kind: "pay", mint: lost[0], amount: round(-lost[1]), at };
  if (dSol > 0.000001) return { kind: "in", sol: round(dSol, 4), at };
  if (dSol < -0.000001) return { kind: "out", sol: round(-dSol, 4), at };
  return null;
}

export function makeFlows({ store, wallets, rpc = C.rpc, now = () => Date.now(), per = 8 }) {
  let mem = null;
  async function read() {
    const out = [];
    for (const [role, w] of wallets()) {
      if (!C.isPubkey(w)) continue;
      const sigs = await rpc("getSignaturesForAddress", [w, { limit: per, commitment: "confirmed" }]).catch(() => []);
      for (const s of sigs || []) {
        if (!s || !s.signature || s.err) continue;
        const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]).catch(() => null);
        const m = moveOf(tx, w); if (m) out.push({ role, w, sig: s.signature, ...m, at: m.at || (s.blockTime || 0) * 1000 });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 60);
  }
  async function view() {
    const t = now();
    if (mem && t - mem.at < 300e3) return mem;
    const saved = await store.get("flows.json").catch(() => null);
    if (saved && t - saved.at < 300e3) return (mem = saved);
    let moves; try { moves = await read(); } catch { moves = saved ? saved.moves : []; }
    const tot = {}; for (const m of moves) { const k = m.role + ":" + m.kind; tot[k] = round((tot[k] || 0) + (m.sol || 0), 4); }
    // all time (since this list began): each transaction counted once
    const all = (await store.get("flows/all.json").catch(() => null)) || { since: t, seen: [], buySol: 0, inSol: 0, burns: 0, pays: 0, burned: {} };
    const seen = new Set(all.seen);
    for (const m of moves.slice().reverse()) { const k = m.sig + ":" + m.role; if (seen.has(k)) continue; seen.add(k); all.seen.push(k);
      if (m.kind === "buy") all.buySol = round(all.buySol + (m.sol || 0), 4); else if (m.kind === "in") all.inSol = round(all.inSol + (m.sol || 0), 4); else if (m.kind === "burn") { all.burns++; all.burned[m.mint] = round((all.burned[m.mint] || 0) + (m.amount || 0)); } else if (m.kind === "pay") all.pays++; }
    all.seen = all.seen.slice(-3000);
    await store.put("flows/all.json", all, {}).catch(() => {});
    mem = { at: t, moves, tot, all: { since: all.since, buySol: all.buySol, inSol: all.inSol, burns: all.burns, pays: all.pays, burned: all.burned } };
    await store.put("flows.json", mem, {}).catch(() => {});
    return mem;
  }
  return { view, read };
}
