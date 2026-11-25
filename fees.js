// fees.js — a coin's creator fees in its window: how much is waiting (read live), how it splits, and the button that
// pays it out. A coin launched on the platform pays out to every shareholder at once (anyone may press it — pump.fun's
// fee program sends each share where the locked split says). A coin without a split (the main coin) is claimed by its
// creator's own wallet. Used by the website's coin window and the city's coin card.
import { $, esc, short, sleep, note, DEMO, sol, kit, conn } from "/common.js";
import { t } from "/i18n.js";
import { openWallet } from "/wallet.js";

const RENT = 890880; // lamports a vault keeps
const fmt = (x) => (x >= 1 ? x.toFixed(3) : x >= 0.001 ? x.toFixed(4) : x > 0 ? x.toFixed(6) : "0");

export function feeBox(c, CFG) {
  const s = CFG.split || { creator: 6000, vault: 3000, buyer: 1000 }, main = c.mint === CFG.main;
  const rows = c.noSplit || main ? `<div class="fb-r"><span>${main ? esc(t("fbDev", "The dev (100%)")) : esc(t("fbCre", "The creator (100%)"))}</span><b data-fb="all">…</b></div>`
    : [...(c.crew ? c.crew.map((m, i) => [`${i === 0 && m.address === c.creator ? "Crew lead" : "Crew"} ${esc(short(m.address))}`, m.bps]) : [[c.kind === "drop" ? "The agent → THE VAULT" : "The creator", s.creator]]), ["THE VAULT", s.vault], [`Buys $${esc(CFG.ticker || "")}`, s.buyer]].map(([n, b], i) => `<div class="fb-r"><span>${n} <small>${b / 100}%</small></span><b data-fb="p${i}">…</b></div>`).join("");
  return `<div class="fbox" data-fbox><div class="fb-h"><span class="mc-k">${esc(t("fbK", "CREATOR FEES"))}</span><button type="button" class="fb-re" data-fb="re" title="${esc(t("fbRe", "Read again"))}">↻</button></div>
    <div class="fb-big"><b data-fb="sum">…</b> <small>${c.quote ? esc(c.quote.id) : "SOL"} ${esc(t("fbWait", "waiting"))}</small></div>
    <div class="fb-rows">${rows}</div>
    <button type="button" class="btn hot fb-go" data-fb="go" disabled>${c.noSplit || main ? esc(t("fbClaim", "Claim (creator only)")) : esc(t("fbPay", "Pay out to every share"))}</button>
    <p class="fb-n" data-fb="n">${c.noSplit || main ? esc(t("fbSoloN", "Only the creator's wallet can claim these fees (pump.fun keeps one fee vault per creator, so it holds the fees of all their coins without a split).")) : esc(t("fbSplitN", "Anyone may press it — the split is locked, so each share goes where it should."))}${c.graduated ? " " + esc(t("fbGrad", "Fees earned on PumpSwap after graduation are swept in at payout.")) : ""}</p></div>`;
}

/// read the waiting amount live and wire the button; root = the element holding feeBox's HTML
export async function wireFees(root, c, CFG, onDone) {
  const box = root.querySelector("[data-fbox]"); if (!box) return;
  const q = (k) => box.querySelector(`[data-fb="${k}"]`), s = CFG.split || { creator: 6000, vault: 3000, buyer: 1000 }, solo = c.noSplit || c.mint === CFG.main;
  // a token pair's fees wait in the vault's account for that token (whole units here), SOL ones as lamports
  const U = c.quote ? c.quote.id : "SOL", D = c.quote ? 10 ** c.quote.decimals : 1e9;
  const paint = (lam) => {
    const v = Math.max(0, lam) / D; q("sum").textContent = fmt(v);
    if (solo) q("all").textContent = fmt(v) + " " + U;
    else [...(c.crew ? c.crew.map((m) => m.bps) : [s.creator]), s.vault, s.buyer].forEach((b, i) => { const e = q("p" + i); if (e) e.textContent = fmt((v * b) / 10000) + " " + U; });
    q("go").disabled = !(v > 0.00001); box.classList.toggle("has", v > 0.00001);
  };
  const read = async () => {
    if (DEMO) return paint(Math.round(((c.quote ? c.feesWaiting : c.feesWaitingSol) || 0.0123) * D));
    try { const K = await kit(), cn = await conn(), v = new K.PublicKey(c.vault);
      paint(c.quote ? await cn.getTokenAccountBalance(v).then((r) => Number(r.value.amount)).catch(() => 0) : (await cn.getBalance(v)) - RENT); }
    catch { paint(Math.round(((c.quote ? c.feesWaiting : c.feesWaitingSol) || 0) * D)); }
  };
  q("re").onclick = read;
  q("go").onclick = async () => {
    if (DEMO) return note("Demo — nothing is sent.");
    const W = await sol(); if (!W) return note("No Solana wallet found — open this page in Phantom or Solflare.");
    if (!W.key) { await openWallet(); if (!W.key) return; }
    if (solo && W.key !== c.creator) return note(`Only the creator's wallet (${short(c.creator)}) can claim these.`, 4500);
    const btn = q("go"); btn.disabled = true; const label = btn.textContent; btn.textContent = solo ? "Claiming…" : "Paying out…";
    try {
      const K = await kit(), cn = await conn(), me = new K.PublicKey(W.key), m = new K.PublicKey(c.mint), bh = await cn.getLatestBlockhash("confirmed");
      let tx;
      if (solo) {
        tx = new K.Transaction(); tx.feePayer = me; tx.recentBlockhash = bh.blockhash;
        tx.add(await K.PUMP_SDK.offlinePumpProgram.methods.collectCreatorFee().accountsPartial({ creator: me }).instruction());
      } else {
        const acc = await cn.getAccountInfo(K.feeSharingConfigPda(m)); if (!acc) throw new Error("this coin has no fee split on chain");
        tx = await K.distributeTx({ payer: me, mint: m, sharingConfig: K.PUMP_SDK.decodeSharingConfig(acc), graduated: !!c.graduated, blockhash: bh.blockhash, quote: c.quote ? { mint: c.quote.mint, program: c.quote.program } : null });
      }
      const [signed] = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions([tx]) : [await W.p.signTransaction(tx)];
      const sig = await cn.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
      for (let i = 0; i < 25; i++) { await sleep(1500); const st = await cn.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null); if (st && st.err) throw new Error("it failed on Solana"); if (st && st.confirmationStatus) break; }
      note(solo ? "Fees claimed." : "Fees paid out to every share."); q("n").innerHTML = `Done — <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">see it on Solscan ↗</a>`;
      await read(); onDone && onDone();
    } catch (e) { const t = String((e && e.message) || e); note(/reject|denied|cancel/i.test(t) ? "Cancelled in your wallet." : t.slice(0, 160), 5000); }
    btn.textContent = label; btn.disabled = false;
  };
  await read();
}
