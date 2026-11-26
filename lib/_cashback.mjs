// lib/_cashback.mjs — trader cashback (the owner, 2026-11-25: "거래자 캐시백 GTAFUN에 붙여줘"). Every trade of a coin
// launched here — and of the main coin — on any venue (the pump.fun curve, PumpSwap, Raydium, an aggregator: every trade
// touches the coin's mint, so the mint's own transaction list is read) earns its trader a share of the trade back, paid in
// the main coin. Read a few times an hour (?lp=tick from the GitHub workflow): new transactions per coin from a cursor,
// each one decoded from its balance changes (the signer's coin and SOL move in opposite directions = a trade), valued at
// SOL's price, credited at `bps` of the trade's dollar value in main coins, inside a day's total and a wallet's day cap.
// The coin's creator and the platform's own wallets earn nothing. Credits land in cb/ledger.json; the LP rewards'
// payout (lib/_lp.mjs due / paid: the rewards wallet, a GM's own, signs; the server only reads the transfer) pays both.
import { PAD } from "../pad-config.js";
import * as C from "./_chain.mjs";
import { cfg as padCfg } from "./_pad.mjs";
import { ed25519 } from "@noble/curves/ed25519.js";

const WSOL = "So11111111111111111111111111111111111111112";
const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
const round6 = (x) => Math.floor(x * 1e6) / 1e6;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/// the settings: pad-config.js cashback, with PAD_CB_BPS / PAD_CB_DAILY / PAD_CB_WALLET_DAY from the environment winning
export function cbCfg() {
  const c = { on: true, bps: 30, daily: 500000, perWallet: 50000, minUsd: 2, maxTx: 120, refBps: 1000, exclude: [], ...(PAD.cashback || {}) };
  for (const [k, e] of [["bps", "PAD_CB_BPS"], ["daily", "PAD_CB_DAILY"], ["perWallet", "PAD_CB_WALLET_DAY"]]) if (env(e) && Number(env(e)) >= 0) c[k] = Number(env(e));
  if (env("PAD_CB") === "0") c.on = false;
  c.bps = Math.min(Math.max(0, c.bps), 500); c.refBps = Math.min(Math.max(0, Number(c.refBps) || 0), 5000);
  return c;
}

/// a transaction → the signer's trade of `mint`: { who, side, sol } — or null when it isn't a trade by its signer (a
/// transfer, an LP add, a failed tx, a trade against something other than SOL). The SOL side counts native SOL (the fee
/// given back) and wrapped SOL; the coin side the signer's own token accounts of that mint.
export function tradeOf(tx, mint) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const m = tx.transaction && tx.transaction.message, keys = ((m && m.accountKeys) || []).map((k) => (typeof k === "string" ? k : String(k.pubkey)));
  const who = keys[0]; if (!who) return null;
  const tok = (arr, mt) => (arr || []).filter((b) => b.mint === mt && b.owner === who).reduce((s, b) => s + (Number(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0), 0);
  const dTok = tok(tx.meta.postTokenBalances, mint) - tok(tx.meta.preTokenBalances, mint);
  const dSol = (tx.meta.postBalances[0] - tx.meta.preBalances[0] + (tx.meta.fee || 0)) / 1e9 + (tok(tx.meta.postTokenBalances, WSOL) - tok(tx.meta.preTokenBalances, WSOL));
  if (!(Math.abs(dTok) > 0) || Math.abs(dSol) < 0.0005) return null;
  if (dTok > 0 && dSol < 0) return { who, side: "buy", sol: -dSol, tokens: dTok };
  if (dTok < 0 && dSol > 0) return { who, side: "sell", sol: dSol, tokens: -dTok };
  return null;
}

/// referrals (2026-11-26): a wallet links the one that invited it once, with its own signature; the inviter then earns
/// refBps (1000 = 10 %) of that wallet's cashback on top — counted inside the day's total, not the trader's own cap
export const refMessage = (wallet, ref, issued) => `GTAFUN referral\nWallet: ${wallet}\nInvited by: ${ref}\nIssued: ${issued}`;
/// the inviter's share of one cashback, inside what's left of the day
export function refShare(amt, st, L) { return round6(Math.max(0, Math.min((amt * L.refBps) / 1e4, L.daily - st.spent))); }

/// one trade's cashback in main coins, inside the day's caps (state.spent, state.per[who]) — 0 when it's too small
export function creditOf(usd, st, who, L, mainPx) {
  if (!(usd >= L.minUsd) || !(mainPx > 0)) return 0;
  const want = (usd * L.bps) / 1e4 / mainPx;
  return round6(Math.max(0, Math.min(want, L.perWallet - (st.per[who] || 0), L.daily - st.spent)));
}

export function makeCashback({ store, pad, now = () => Date.now(), rpc = C.rpc, solUsd = C.solUsd }) {
  async function tick() {
    const t = now(), L = cbCfg(), slot = Math.floor(t / 240e3);
    if (!L.on || !(L.bps > 0)) return { off: true };
    const lock = await store.put(`cb/lock/${slot}.json`, { at: t }, { create: true }).catch(() => ({ conflict: true }));
    if (lock && lock.conflict) return { busy: true };
    const pc = padCfg(), list = await pad.list().catch(() => ({ items: [] })), items = list.items || [];
    const main = items.find((x) => x.mint === pc.main), mainPx = main && main.priceUsd, sol = await solUsd().catch(() => null);
    if (!(mainPx > 0) || !(sol > 0)) return { noPrice: true }; // nothing is read (the cursors stay) until both prices are known
    const coins = items.filter((x) => x.mint === pc.main || x.kind === "drop" || x.kind === "user");
    const never = new Set([pc.vault, pc.buyer, pc.agent, env("PAD_LP_WALLET"), env("PAD_CARDS_WALLET"), ...(PAD.lp && PAD.lp.wallet ? [PAD.lp.wallet] : []), ...(L.exclude || [])].filter(Boolean));
    const st = (await store.get("cb/state.json").catch(() => null)) || { cur: {}, day: "", spent: 0, per: {} };
    if (st.day !== dayOf(t)) { st.day = dayOf(t); st.spent = 0; st.per = {}; }
    const led = (await store.get("cb/ledger.json").catch(() => null)) || { earned: {}, total: 0, n: 0, volUsd: 0, last: [] };
    const refs = (await store.get("cb/refmap.json").catch(() => null)) || {};
    let budget = L.maxTx, read = 0, credited = 0, full = 0;
    for (const x of coins) {
      if (budget <= 0) break;
      const cur = st.cur[x.mint];
      let sigs; try { sigs = await rpc("getSignaturesForAddress", [x.mint, { limit: 50, commitment: "confirmed", ...(cur ? { until: cur } : {}) }]); } catch { continue; }
      sigs = (sigs || []).filter((s) => s && s.signature);
      if (!cur) { if (sigs[0]) st.cur[x.mint] = sigs[0].signature; continue; } // a coin seen for the first time: from now on, no back pay
      if (sigs.length >= 50) full++;
      for (const s of sigs.reverse()) { // oldest first, so the cursor only moves past what was read
        if (budget <= 0) break;
        budget--; st.cur[x.mint] = s.signature;
        if (s.err) continue;
        const tx = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]).catch(() => null);
        read++;
        const tr = tradeOf(tx, x.mint); if (!tr || never.has(tr.who) || tr.who === x.creator) continue;
        const usd = tr.sol * sol, amt = creditOf(usd, st, tr.who, L, mainPx);
        led.volUsd = Math.round((led.volUsd || 0) + usd); led.n = (led.n || 0) + 1;
        if (!(amt > 0)) continue;
        st.spent = round6(st.spent + amt); st.per[tr.who] = round6((st.per[tr.who] || 0) + amt);
        led.earned[tr.who] = round6((led.earned[tr.who] || 0) + amt); led.total = round6((led.total || 0) + amt); credited++;
        const inv = refs[tr.who];
        if (inv && inv !== tr.who && !never.has(inv) && L.refBps > 0) { const ra = refShare(amt, st, L); if (ra > 0) { st.spent = round6(st.spent + ra); led.earned[inv] = round6((led.earned[inv] || 0) + ra); led.ref = led.ref || {}; led.ref[inv] = round6((led.ref[inv] || 0) + ra); led.total = round6(led.total + ra); } }
        led.last = [{ w: tr.who, side: tr.side, usd: Math.round(usd * 100) / 100, amt, sym: x.symbol || "", at: (s.blockTime || 0) * 1000 || t, sig: s.signature }, ...(led.last || [])].slice(0, 24);
      }
    }
    led.at = t;
    await store.put("cb/state.json", st, {});
    await store.put("cb/ledger.json", led, {});
    return { coins: coins.length, read, credited, spentToday: st.spent, pageFull: full };
  }
  /// the page's view: the rate, the day's room, the totals, the latest cashbacks and a wallet's own
  async function view(w = "") {
    const L = cbCfg(), [led, st] = await Promise.all([store.get("cb/ledger.json").catch(() => null), store.get("cb/state.json").catch(() => null)]);
    const l = led || { earned: {}, total: 0, n: 0, volUsd: 0, last: [] }, today = st && st.day === dayOf(now()) ? st : { spent: 0, per: {} };
    const refs = (await store.get("cb/refmap.json").catch(() => null)) || {};
    const board = Object.entries(l.earned || {}).sort((a, b) => b[1] - a[1]), day = Object.entries(today.per || {}).sort((a, b) => b[1] - a[1]);
    const rank = C.isPubkey(w) ? board.findIndex(([x]) => x === w) + 1 : 0;
    return { on: L.on, bps: L.bps, refBps: L.refBps, daily: L.daily, perWallet: L.perWallet, minUsd: L.minUsd, total: l.total || 0, trades: l.n || 0, volUsd: l.volUsd || 0, spentToday: today.spent || 0,
      earners: board.length, top: board.slice(0, 10).map(([x, a]) => ({ w: x, amt: a })), topToday: day.slice(0, 5).map(([x, a]) => ({ w: x, amt: a })),
      last: (l.last || []).slice(0, 12),
      me: C.isPubkey(w) ? { earned: l.earned[w] || 0, today: (today.per || {})[w] || 0, rank, ref: refs[w] || null, invited: Object.values(refs).filter((x) => x === w).length, refEarned: (l.ref || {})[w] || 0 } : null };
  }
  /// what each wallet has earned in cashback (lib/_lp.mjs adds it to what the rewards wallet owes)
  async function earned() { const l = await store.get("cb/ledger.json").catch(() => null); return (l && l.earned) || {}; }
  /// link the wallet that invited this one (once, signed by this wallet, within 10 minutes of signing)
  async function ref(b) {
    const t = now(), wallet = String(b.wallet || ""), inv = String(b.ref || ""), it = Date.parse(String(b.issued || ""));
    if (!C.isPubkey(wallet) || !C.isPubkey(inv)) return { status: 400, body: { error: "bad wallet" } };
    if (wallet === inv) return { status: 400, body: { error: "a wallet can't invite itself" } };
    if (!(it > 0) || Math.abs(t - it) > 10 * 60e3) return { status: 400, body: { error: "the signature is too old — sign again" } };
    let ok = false; try { ok = ed25519.verify(C.b58dec(String(b.sig || "")), new TextEncoder().encode(refMessage(wallet, inv, b.issued)), C.b58dec(wallet)); } catch {}
    if (!ok) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    const made = await store.put(`cb/ref/${wallet}.json`, { ref: inv, at: t }, { create: true }).catch(() => ({ conflict: true }));
    if (made && made.conflict) return { status: 409, body: { error: "this wallet is already linked to an inviter" } };
    const map = (await store.get("cb/refmap.json").catch(() => null)) || {};
    map[wallet] = inv; await store.put("cb/refmap.json", map, {});
    return { status: 200, body: { ok: true, ref: inv } };
  }
  return { tick, view, earned, ref };
}
