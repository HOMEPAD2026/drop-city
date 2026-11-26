// lp-ui.js — the LP REWARDS tab (the owner, 2026-11-24): the supported coins' Raydium CPMM pools with SOL and with the main
// coin, how much of the day's main-coin reward each pool gets, an APR estimate, links to add liquidity (or create the pool),
// the connected wallet's earned / paid / pending, and — for the rewards wallet only — "Pay everyone due": the transfers are
// built here and signed in that wallet; the server then reads the transaction and marks the payouts (lib/_lp.mjs).
import { $, esc, short, sleep, note, DEMO, sol, kit, conn, getJ, usd, pic } from "/common.js";
import { openWallet } from "/wallet.js";
import { t } from "/i18n.js";

const API = "/api/pad";
const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : x >= 1 ? x.toFixed(0) : x > 0 ? x.toFixed(2) : "0");
const RAY_ADD = (id) => `https://raydium.io/liquidity/increase/?mode=add&pool_id=${encodeURIComponent(id)}`;
const RAY_NEW = "https://raydium.io/liquidity/create-pool/";
const SOLM = "So11111111111111111111111111111111111111112";

export async function paintLp(box, { coins, CFG }) {
  if (!box) return;
  let V = null;
  let CB = null;
  try { const W = await sol().catch(() => null), q = W && W.key ? "&w=" + W.key : ""; [V, CB] = await Promise.all([getJ(`?lp=1${q}`), getJ(`?cb=1${q}`).catch(() => null)]); }
  catch { V = null; }
  if (!V || !V.pools) { box.innerHTML = `<p class="fine">${esc(t("lpErr", "The LP rewards couldn't be read right now — try again in a moment."))}</p>`; return; }
  const main = coins.find((c) => c.mint === CFG.main), mainSym = main ? main.symbol : CFG.ticker || "MAIN";
  const sup = coins.filter((c) => c.kind === "partner");
  const pool = (coin, kind) => V.pools.filter((p) => p.coin === coin && p.kind === kind).sort((a, b) => b.tvl - a.tvl)[0];
  const cell = (c, kind) => {
    const p = pool(c.mint, kind), pair = kind === "sol" ? "SOL" : "$" + mainSym;
    if (!p) return `<div class="lp-cell none"><b>$${esc(c.symbol)} / ${esc(pair)}</b><small>${esc(t("lpNone", "No pool yet"))}</small><a class="btn ghost" href="${RAY_NEW}" target="_blank" rel="noopener">${esc(t("lpCreate", "Create on Raydium"))} ↗</a></div>`;
    return `<div class="lp-cell${kind === "main" ? " boost" : ""}"><b>$${esc(c.symbol)} / ${esc(pair)}</b>${kind === "main" ? `<i class="lp-x">×${V.boostMain}</i>` : ""}
      <div class="lp-kv"><span>${esc(t("lpTvl", "Liquidity"))}</span><b>${usd(p.tvl)}</b></div>
      <div class="lp-kv"><span>${esc(t("lpDay", "Reward / day"))}</span><b>${fmt(p.perDay)} $${esc(mainSym)}</b></div>
      <div class="lp-kv"><span>APR</span><b>${p.apr != null ? (p.apr * 100).toFixed(p.apr >= 1 ? 0 : 1) + "%" : "–"}</b></div>
      ${p.eligible === false ? `<small class="lp-min">${esc(t("lpMin", "Earns once the pool holds"))} ${usd(V.minPoolUsd)}</small>` : ""}
      <a class="btn hot" href="${RAY_ADD(p.id)}" target="_blank" rel="noopener">${esc(t("lpAdd", "Add liquidity"))} ↗</a></div>`;
  };
  const me = V.me;
  box.innerHTML = `${cbCard(CB, mainSym)}
    <div class="lp-stats"><div><b>${fmt(V.daily)}</b><small>$${esc(mainSym)} ${esc(t("lpPerDay", "a day to LPs"))}</small></div><div><b>${fmt(V.total)}</b><small>${esc(t("lpEarnedAll", "earned so far"))}</small></div><div><b>${fmt(V.paidTotal)}</b><small>${esc(t("lpPaidAll", "paid out"))}</small></div><div><b>${V.hours}</b><small>${esc(t("lpHours", "hours counted"))}</small></div></div>
    <div class="lp-me">${me ? `<div><span>${esc(t("lpEarned", "Earned"))}</span><b>${fmt(me.earned)}</b></div>${me.cashback ? `<div><span>${esc(t("cbMine", "Cashback"))}</span><b>${fmt(me.cashback)}</b></div>` : ""}<div><span>${esc(t("lpPaid", "Paid"))}</span><b>${fmt(me.paid)}</b></div><div class="hi"><span>${esc(t("lpPending", "Pending"))}</span><b>${fmt(me.pending)} $${esc(mainSym)}</b></div>`
      : `<p>${esc(t("lpConnect", "Connect your wallet to see what your liquidity has earned."))}</p><button type="button" class="btn ghost" data-lp="conn">${esc(t("connect", "Connect wallet"))}</button>`}</div>
    <div class="lp-grid">${sup.map((c) => `<div class="lp-coin"><div class="lp-ch">${pic(c)}<b>$${esc(c.symbol)}</b><small>${esc(c.name || "")}</small></div>${cell(c, "sol")}${cell(c, "main")}</div>`).join("") || `<p class="fine">${esc(t("lpNoSup", "No supported coins yet."))}</p>`}</div>
    <details class="lp-how"><summary>${esc(t("lpHowH", "How the rewards work"))}</summary><ol>
      <li>${esc(t("lpHow1", "Add liquidity to a supported coin's Raydium pool — paired with SOL, or with the main coin (those pools weigh more)."))}</li>
      <li>${esc(t("lpHow2", "Every hour the city reads who holds each pool's LP tokens and splits that hour's reward: across the pools by their liquidity, inside a pool by the LP tokens you hold."))}</li>
      <li>${esc(t("lpHow3", "Leave your LP tokens in your own wallet to be counted — LP that's burned, locked away or worth under $10 earns nothing."))}</li>
      <li>${esc(t("lpHow4", "Rewards are paid in the main coin from the rewards wallet; every payout is a public transaction."))}</li></ol></details>
    ${V.last && V.last.length ? `<div class="lp-paid"><h4>${esc(t("lpLast", "Latest payouts"))}</h4>${V.last.map((x) => `<a href="https://solscan.io/tx/${esc(x.sig)}" target="_blank" rel="noopener"><span>${new Date(x.at).toISOString().slice(5, 16).replace("T", " ")}</span><b>${fmt(x.amount)} $${esc(mainSym)}</b><small>${x.n} ${esc(t("lpWallets", "wallets"))}</small></a>`).join("")}</div>` : ""}
    <div class="lp-admin" hidden></div>`;
  const cb = box.querySelector('[data-lp="conn"]'); if (cb) cb.onclick = async () => { await openWallet(); paintLp(box, { coins, CFG }); };
  // the rewards wallet sees the payout desk
  const W = await sol().catch(() => null);
  if (V.wallet && W && W.key === V.wallet) adminDesk(box.querySelector(".lp-admin"), { V, CFG, mainSym, W, coins, again: () => paintLp(box, { coins, CFG }) });
}

/// the rewards wallet's desk: what's due, and one button that pays it in batches (signed here, checked by the server)
async function adminDesk(el, { CFG, mainSym, W, again }) {
  const { due = [] } = await getJ("?lp=due").catch(() => ({ due: [] }));
  el.hidden = false;
  el.innerHTML = `<h4>${esc(t("lpDesk", "Rewards wallet"))}</h4><p>${due.length ? `${due.length} ${esc(t("lpDue", "wallets are due"))} · ${fmt(due.reduce((s, x) => s + x.pending, 0))} $${esc(mainSym)}` : esc(t("lpNoneDue", "Nobody is due right now."))}</p>
    ${due.length ? `<div class="lp-due">${due.slice(0, 30).map((x) => `<span>${esc(short(x.owner))}</span><b>${fmt(x.pending)}</b>`).join("")}</div><button type="button" class="btn hot" data-lp="pay">${esc(t("lpPay", "Pay everyone due"))}</button>` : ""}`;
  const pb = el.querySelector('[data-lp="pay"]'); if (!pb) return;
  pb.onclick = async () => {
    if (DEMO) return note("Demo — nothing is sent.");
    pb.disabled = true; pb.textContent = t("lpPaying", "Paying…");
    try {
      const K = await kit(), cn = await conn(), me = new K.PublicKey(W.key), mint = new K.PublicKey(CFG.main);
      const mi = await cn.getParsedAccountInfo(mint), prog = mi.value.owner, dec = mi.value.data.parsed.info.decimals;
      const from = K.spl.getAssociatedTokenAddressSync(mint, me, true, prog);
      // transferChecked by hand (the kit carries the ATA helpers): [12, amount u64 LE, decimals]
      const xfer = (to, raw) => { const d = new Uint8Array(10); d[0] = 12; let v = BigInt(raw); for (let i = 1; i <= 8; i++) { d[i] = Number(v & 0xffn); v >>= 8n; } d[9] = dec;
        return new K.TransactionInstruction({ programId: prog, keys: [{ pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: me, isSigner: true, isWritable: false }], data: K.Buffer.from(d) }); };
      const batches = []; for (let i = 0; i < due.length; i += 6) batches.push(due.slice(i, i + 6));
      const bh = await cn.getLatestBlockhash("confirmed"), txs = batches.map((b) => { const tx = new K.Transaction(); tx.feePayer = me; tx.recentBlockhash = bh.blockhash;
        for (const x of b) { const o = new K.PublicKey(x.owner), ata = K.spl.getAssociatedTokenAddressSync(mint, o, true, prog); tx.add(K.spl.createAssociatedTokenAccountIdempotentInstruction(me, ata, o, mint, prog), xfer(ata, Math.floor(x.pending * 10 ** dec))); }
        return tx; });
      const signed = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions(txs) : await Promise.all(txs.map((x) => W.p.signTransaction(x)));
      let n = 0;
      for (const s of signed) {
        const sig = await cn.sendRawTransaction(s.serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
        for (let i = 0; i < 25; i++) { await sleep(1500); const st = await cn.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null); if (st && st.err) throw new Error("a payout failed on Solana"); if (st && st.confirmationStatus) break; }
        for (let i = 0; i < 5; i++) { const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "lp-paid", sig }) }).then((x) => x.json()).catch(() => null); if (r && (r.ok || r.already)) break; await sleep(2500); }
        n++; pb.textContent = `${t("lpPaying", "Paying…")} ${n}/${signed.length}`;
      }
      note(t("lpPaidOk", "Paid — the ledger is updated."), 4000); again();
    } catch (e) { const s = String((e && e.message) || e); note(/reject|denied|cancel/i.test(s) ? "Cancelled in your wallet." : s.slice(0, 160), 5000); pb.disabled = false; pb.textContent = t("lpPay", "Pay everyone due"); }
  };
}

/// the trader cashback card (lib/_cashback.mjs): the rate, how it works, today's room, the latest, my own
function cbCard(CB, mainSym) {
  if (!CB || !CB.on) return "";
  const pct = String(CB.bps / 100), ago = (at) => { const m = Math.max(0, Math.round((Date.now() - at) / 60e3)); return m < 60 ? m + "m" : Math.round(m / 60) + "h"; };
  const S = "$" + mainSym;
  return `<div class="cb-card">
    <div class="cb-top"><span class="cb-k">${esc(t("cbK", "Trader cashback"))}</span><b class="cb-h">${esc(tfill(t("cbH", "{p}% back on every trade"), { p: pct }))}</b>
      <p>${esc(tfill(t("cbP", "Trade any coin launched on GTAFUN — or {s} itself — anywhere (pump.fun, PumpSwap, Raydium, Jupiter …) and {p}% of the trade comes back to your wallet in {s}. Counted every few minutes, paid out with the LP rewards."), { p: pct, s: S }))}</p></div>
    <div class="cb-stats"><div><b>${fmt(CB.total)}</b><small>${esc(S)} ${esc(t("cbTotal", "earned by traders"))}</small></div><div><b>${CB.trades}</b><small>${esc(t("cbTrades", "trades counted"))}</small></div><div><b>${fmt(Math.max(0, CB.daily - CB.spentToday))}</b><small>${esc(t("cbLeft", "left today"))}</small></div>
      ${CB.me ? `<div class="hi"><b>${fmt(CB.me.earned)}</b><small>${esc(t("cbMe", "your cashback"))}</small></div>` : ""}</div>
    ${CB.last && CB.last.length ? `<div class="cb-last">${CB.last.slice(0, 6).map((x) => `<a href="https://solscan.io/tx/${esc(x.sig)}" target="_blank" rel="noopener"><span class="cb-w">${esc(short(x.w))}</span><span class="cb-s ${x.side === "sell" ? "sell" : "buy"}">${esc(x.side === "sell" ? t("tkSell", "SELL") : t("tkBuy", "BUY"))} $${esc(x.sym)} · ${usd(x.usd)}</span><b>+${fmt(x.amt)}</b><small>${ago(x.at)}</small></a>`).join("")}</div>` : ""}
    <p class="cb-fine">${esc(tfill(t("cbFine", "Up to {w} {s} a wallet a day · trades from {m} · the coin's own creator and the platform's wallets don't earn it."), { w: fmt(CB.perWallet), s: S, m: usd(CB.minUsd) }))}</p></div>`;
}
const tfill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
