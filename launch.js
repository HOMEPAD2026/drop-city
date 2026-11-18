// launch.js — a launch: find an address ending with the suffix (in this browser), host the details, launch on pump.fun from the sponsor's own wallet with the fee split locked in the same signing,
// register the coin. Used by the website and the city. Nothing custodial: the server hosts the details and checks the chain.
import { $, esc, sleep, post, note, DEMO, sol, kit, conn } from "/common.js";
import { openWallet } from "/wallet.js";

// the first buy as a share of the supply, bought in the launch transaction itself. On a fresh pump.fun curve
// (30 SOL × 1.073B tokens virtual) t tokens cost x0·t / (y0 − t) SOL, plus the trade fee (about 1.25 %).
export const solForPct = (pct) => { const y0 = 1_073_000_000, x0 = 30, t = (pct / 100) * 1e9; return t <= 0 ? 0 : Math.ceil(((x0 * t) / (y0 - t)) * 1.0125 * 1e4) / 1e4; };
export const pctForSol = (sol) => { const y0 = 1_073_000_000, x0 = 30, x = sol / 1.0125; return sol > 0 ? ((y0 * x) / (x0 + x) / 1e9) * 100 : 0; };

// ---------------- the address: N workers grind until one ends with the suffix
export function grind(suffix, onTries) {
  const n = Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4)), ws = [];
  return new Promise((ok, no) => {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const w = new Worker("/grind-worker.js"); ws.push(w);
      w.onmessage = (e) => { total += e.data.tries || 0; onTries && onTries(total); if (e.data.secret) { ws.forEach((x) => x.terminate()); ok(e.data); } };
      w.onerror = (e) => { ws.forEach((x) => x.terminate()); no(new Error("the address finder stopped: " + (e.message || "error"))); };
      w.postMessage({ suffix });
    }
    grind.stop = () => { ws.forEach((x) => x.terminate()); no(new Error("stopped")); };
  });
}


// ---------------- the drop window; o: { cfg, onDone(), paintWallet() }
export function openDrop(o = {}) {
  const CFG = o.cfg || {};
  const sh = $("sheet"); sh.hidden = false;
  const f = { dev: 0, logo: "", logoData: "", quote: null };
  const QS = (CFG.quotes || []).filter((x) => x && x.mint);
  sh.innerHTML = `<div role="dialog" aria-label="Launch a coin" class="wide"><button type="button" class="sheet-x" data-f="x" aria-label="Close">×</button><h2>LAUNCH A COIN</h2><p class="sub">Any time, as many as you like. On pump.fun, from your own wallet.</p>
    <div class="lf"><div class="form">
      <label class="w logo-pick"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-f="file"><span class="pv" data-f="pv">+</span><span>Logo<br><small data-f="lmsg">square image, 512 px is plenty</small></span></label>
      <label>Name<input data-f="name" maxlength="32" placeholder="Night Owl"></label>
      <label>Ticker<input data-f="symbol" maxlength="13" placeholder="OWL"></label>
      <label class="w">Story<textarea data-f="description" rows="2" maxlength="500" placeholder="What's the coin about?"></textarea></label>
      <label>X link<input data-f="twitter" placeholder="https://x.com/…"></label>
      <label>Telegram<input data-f="telegram" placeholder="https://t.me/…"></label>
      <label class="w">Website<input data-f="website" placeholder="https://…"></label>
      ${QS.length ? `<div class="w pairset"><span class="lbl">Pair — what your coin trades against</span><div class="seg pairs" data-f="pairs"><button type="button" class="on" data-q="">SOL</button>${QS.map((x) => `<button type="button" data-q="${esc(x.id)}">${esc(x.id)}</button>`).join("")}</div><small class="pairline" data-f="pairline">Bought and sold with SOL — the usual pump.fun coin.</small></div>` : ""}
      <label class="w buyset"><span class="lbl">Your first buy (optional) — bought in the same signing, before anyone else</span>
        <span class="custom"><input data-f="devsol" inputmode="decimal" placeholder="0" style="max-width:180px"> <b data-f="unit">SOL</b></span><small class="buyline" data-f="buyline">Leave it empty for no first buy.</small></label>
    </div><div class="lprev"><p class="cap">PREVIEW</p><div data-f="prev"></div></div></div>
    <div class="note"><b>Fees, locked on chain<span data-f="feeunit"></span>:</b> ${(CFG.split.creator / 100)}% you · ${(CFG.split.vault / 100)}% THE VAULT · ${(CFG.split.buyer / 100)}% buys $${esc(CFG.ticker)}.${CFG.suffix ? ` <b>Your coin's address will end in ${esc(CFG.suffix)}</b> — found in this browser, the key never leaves it.` : ""} No launch fee; about 0.03 SOL of network costs.</div>
    <ol class="steps" data-f="steps" hidden></ol><p class="err" data-f="err" hidden></p>
    <div class="foot"><button type="button" class="btn ghost" data-f="close">Close</button><button type="button" class="btn hot" data-f="go">Launch on pump.fun</button></div></div>`;
  const q = (k) => sh.querySelector(`[data-f="${k}"]`);
  // the card as it will look in Explore, while you type
  const prev = () => { const v = (k) => String((q(k) && q(k).value) || "").trim(), sym = v("symbol") || "TICKER", nm = v("name") || "Your coin";
    q("prev").innerHTML = `<article class="cc"><div class="poster"><span class="tag">WANTED</span><span class="badge new">NEW</span>${f.logoData ? `<img src="${f.logoData}" alt="">` : `<span class="ini">${esc(sym.slice(0, 3))}</span>`}<span class="bounty">BOUNTY $0</span></div><div class="body"><h3>${esc(nm)}</h3><span class="sym">$${esc(sym)}</span> <span class="stars">★☆☆☆☆</span><div class="bar"><i style="width:2%"></i></div><small style="color:var(--dim)">${CFG.suffix ? `CA …${esc(CFG.suffix)}` : "curve 0%"}${f.quote ? ` · ${esc(f.quote.id)} pair` : ""}</small></div></article>`; };
  sh.addEventListener("input", prev); prev();
  const err = (s) => { q("err").hidden = !s; q("err").textContent = s || ""; };
  q("close").onclick = q("x").onclick = () => { try { grind.stop && grind.stop(); } catch {} sh.hidden = true; document.removeEventListener("keydown", esc0); };
  const esc0 = (e) => { if (e.key === "Escape" && !busy) q("close").onclick(); }; document.addEventListener("keydown", esc0);
  sh.onclick = (e) => { if (e.target === sh && !busy) q("close").onclick(); };
  const buyline = () => { const u = f.quote ? f.quote.id : "SOL";
    q("buyline").textContent = f.dev > 0 ? (f.quote ? `${f.dev} ${u} of your coin, bought in the very next transaction — you sign both at once.` : `≈ ${pctForSol(f.dev).toFixed(2)}% of the supply for ${f.dev} SOL, the moment it launches.`) : "Leave it empty for no first buy."; };
  q("devsol").oninput = (e) => { const v = Math.max(0, Math.min(f.quote ? 1000 : 50, parseFloat(e.target.value) || 0)); f.dev = Math.round(v * 1e6) / 1e6; buyline(); };
  if (QS.length) q("pairs").onclick = (e) => { const b = e.target.closest("[data-q]"); if (!b || busy) return;
    q("pairs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    f.quote = QS.find((x) => x.id === b.dataset.q) || null; q("unit").textContent = f.quote ? f.quote.id : "SOL";
    q("pairline").textContent = f.quote ? `Bought and sold with ${f.quote.name || f.quote.id} on pump.fun. Your first buy and the creator fees are in ${f.quote.id}; you still pay about 0.03 SOL of network costs.` : "Bought and sold with SOL — the usual pump.fun coin.";
    q("feeunit").textContent = f.quote ? `, paid in ${f.quote.id}` : ""; q("devsol").value = ""; f.dev = 0; buyline(); prev(); };
  q("symbol").oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  q("file").onchange = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try { const url = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); });
      const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error("not an image")); i.src = url; });
      const m = Math.min(img.width, img.height), d = Math.min(512, m), c = document.createElement("canvas"); c.width = c.height = d;
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, d, d);
      let data = c.toDataURL("image/webp", 0.86); if (!data.startsWith("data:image/webp")) data = c.toDataURL("image/png");
      f.logoData = data; q("pv").innerHTML = `<img src="${data}" alt="">`; q("lmsg").textContent = "ready"; err(""); prev();
    } catch (x) { err(String((x && x.message) || x)); }
  };
  const STEPS = [["find", CFG.suffix ? `Find an address ending in ${CFG.suffix}` : "Make the coin's address"], ["host", "Host the logo and details"], ["sign", "Sign the launch"], ["launch", "Launch on pump.fun"], ["split", "Lock the fee split"], ["list", "Move into the city"]];
  const step = (k, st, html) => { const li = q("steps").querySelector(`[data-s="${k}"]`); if (!li) return; li.className = st; if (html != null) li.querySelector("small").innerHTML = html; };
  const scan = (s) => `<a href="https://solscan.io/tx/${esc(s)}" target="_blank" rel="noopener">Solscan ↗</a>`;
  let busy = false;
  q("go").onclick = async () => {
    if (busy) return;
    const v = (k) => String(q(k).value || "").trim();
    const F = { name: v("name"), symbol: v("symbol"), description: v("description"), twitter: v("twitter"), telegram: v("telegram"), website: v("website") };
    if (!F.name || !F.symbol) return err("A name and a ticker are needed.");
    if (!f.logoData) return err("Add a logo.");
    for (const k of ["twitter", "telegram", "website"]) if (F[k] && !/^https:\/\/\S+$/.test(F[k])) return err("Links must start with https://");
    if (!CFG.open && !DEMO) return err(CFG.why || "The city isn't open yet.");
    const S = await sol(); if (!S) return err("No Solana wallet found — open this page in Phantom or Solflare.");
    if (!S.key) { await openWallet(); o.paintWallet && o.paintWallet(); if (!S.key) return err("Connect a wallet to launch."); }
    // pump.fun's fee split can't hold one wallet twice: the vault, the buyer and the agent can't be a coin's creator
    const role = S.key === CFG.vault ? "THE VAULT's wallet" : S.key === CFG.buyer ? `the wallet that buys $${CFG.ticker}` : S.key === CFG.agent ? "the agent's wallet" : "";
    if (role) return err(`This is ${role} — it already gets a share of every coin, so it can't be the creator too. Switch to another wallet (a new account in Phantom works) and launch from there.`);
    busy = true; err(""); q("go").disabled = true; q("steps").hidden = false;
    q("steps").innerHTML = STEPS.map(([k, t]) => `<li data-s="${k}"><i></i><span>${esc(t)}<small></small></span></li>`).join("");
    let cur = "find", g0 = null;
    try {
      // 1. the address
      step("find", "doing"); const t0 = Date.now(), want = 58 ** (CFG.suffix || "").length;
      // the slot machine: addresses spin past, the suffix's letters light up as they come
      const B = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", sx = CFG.suffix || "", rnd = (n) => Array.from({ length: n }, () => B[(Math.random() * 58) | 0]).join("");
      let spin = 0, info = ""; const reel = setInterval(() => { spin++; step("find", "doing", `<div class="slot">${rnd(44 - sx.length)}<b>${esc(sx)}</b></div>${info}`); }, 70);
      let g; try { g = g0 = await grind(sx, (n) => { const rate = n / Math.max(0.5, (Date.now() - t0) / 1000); info = `${Math.round(n).toLocaleString()} tried · ${Math.round(rate).toLocaleString()}/s${want > 1 ? ` · ~${Math.max(1, Math.round((want - n) / Math.max(rate, 1)))} s` : ""}`; }); } finally { clearInterval(reel); }
      step("find", "ok", `<div class="slot">${esc(g.pub.slice(0, g.pub.length - sx.length))}<b class="lock">${esc(sx)}</b></div>`);
      // 3. the details
      cur = "host"; step("host", "doing");
      const lg = await post({ action: "logo", image: f.logoData }); if (!lg.ok) throw new Error(lg.j.error || "couldn't host the logo");
      const md = await post({ action: "meta", ...F, image: lg.j.url }); if (!md.ok) throw new Error(md.j.error || "couldn't host the details");
      step("host", "ok");
      // 4–6. the launch
      cur = "sign"; step("sign", "doing");
      const K = await kit(), c = await conn(), me = new K.PublicKey(S.key), mint = K.Keypair.fromSecretKey(Uint8Array.from(g.secret));
      const V = new K.PublicKey(CFG.vault), Bw = new K.PublicKey(CFG.buyer);
      const shares = [{ address: me, shareBps: CFG.split.creator }, { address: V, shareBps: CFG.split.vault }, { address: Bw, shareBps: CFG.split.buyer }];
      const sdk = new K.OnlinePumpSdk(c);
      const Q = f.quote, quote = Q ? { mint: Q.mint, program: Q.program } : null;
      const [global, feeConfig, bh, bal, quoteControl] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null), c.getLatestBlockhash("confirmed"), c.getBalance(me), Q ? sdk.fetchQuoteControl().catch(() => null) : null]);
      if (global.createV2Enabled === false) throw new Error("pump.fun has paused new coins for a moment — try again later.");
      if (bal / 1e9 < 0.03 + (Q ? 0.01 : f.dev)) throw new Error(`Not enough SOL — about ${(0.03 + (Q ? 0.01 : f.dev)).toFixed(2)} SOL is needed.`);
      if (Q && quoteControl && !(quoteControl.mints || []).some((m) => String(m.mint) === Q.mint) && !(global.whitelistedQuoteMints || []).some((m) => String(m) === Q.mint)) throw new Error(`pump.fun doesn't take ${Q.id} as a pair right now.`);
      const devUnits = Q ? Math.round(f.dev * 10 ** Q.decimals) : Math.round(f.dev * 1e9);
      if (Q && devUnits > 0) { const qa = K.spl.getAssociatedTokenAddressSync(new K.PublicKey(Q.mint), me, true, new K.PublicKey(Q.program)); const have = await c.getTokenAccountBalance(qa).then((r) => Number(r.value.uiAmount || 0)).catch(() => 0);
        if (have < f.dev) throw new Error(`Not enough ${Q.id} — your wallet has ${have} ${Q.id}, the first buy needs ${f.dev}.`); }
      // one transaction (create → split → first buy) through the city's lookup table, so nothing trades in between; else the old steps
      const lut = CFG.lut ? await K.lutOf(c, CFG.lut).catch(() => null) : null;
      let b = null;
      const L0 = { global, feeConfig, creator: me, mint: mint.publicKey, name: F.name, symbol: F.symbol, uri: md.j.uri, treasury: V, shares, blockhash: bh.blockhash, slipBps: 300, quote, quoteControl };
      if (Q) {
        // a token pair: create + the locked split as one v0 transaction (nothing can trade before the split), the first buy right after
        if (!lut) throw new Error("The city's lookup table didn't load — try again in a moment.");
        b = await K.launchV0({ lut, ...L0, devBuyLamports: 0 }); b.txs[0].sign([mint]);
        if (devUnits > 0) { const bt = await K.buyTx({ ...L0, amount: devUnits }); b.txs.push(bt.tx); b.single = false; }
      } else {
        if (lut) b = await K.launchV0({ lut, ...L0, devBuyLamports: devUnits }).catch(() => null);
        if (b) b.txs[0].sign([mint]);
        else { b = await K.launchTxs({ ...L0, devBuyLamports: devUnits }); b.txs[0].partialSign(mint); }
      }
      const signed = typeof S.p.signAllTransactions === "function" ? await S.p.signAllTransactions(b.txs) : await Promise.all(b.txs.map((t) => S.p.signTransaction(t)));
      step("sign", "ok");
      // the coin, then its split, then the first buy (one, two or three transactions — see the kit's launchTxs)
      cur = "launch"; step("launch", "doing");
      const sig1 = await send(c, signed[0], bh.lastValidBlockHeight); step("launch", "ok", scan(sig1));
      cur = "split"; step("split", "doing");
      let sig2 = sig1; for (let i = 1; i < signed.length; i++) sig2 = await send(c, signed[i], bh.lastValidBlockHeight);
      step("split", "ok", scan(sig2));
      cur = "list"; step("list", "doing");
      let listed = false; for (let i = 0; i < 6 && !listed; i++) { if (i) await sleep(2500 + i * 1000); const r = await post({ action: "register", mint: g.pub, sig: sig1 }); listed = r.ok; if (!r.ok && r.status !== 404) { step("list", "bad", esc(r.j.error || "")); break; } }
      if (listed) step("list", "ok");
      const tw = encodeURIComponent(`$${F.symbol} just launched in the city.\n`), link = encodeURIComponent(`${location.origin}/city?coin=${g.pub}`);
      q("go").outerHTML = `<a class="btn ghost" href="https://x.com/intent/tweet?text=${tw}&url=${link}" target="_blank" rel="noopener">Share on X</a><a class="btn cy" href="/city?coin=${esc(g.pub)}">See its tower</a><a class="btn hot" href="https://pump.fun/coin/${esc(g.pub)}" target="_blank" rel="noopener">pump.fun ↗</a>`;
      sh.querySelector(".sub").innerHTML = `<b style="color:var(--lime)">$${esc(F.symbol)} is live.</b> Its tower is going up in the city.`; burst(sh.firstChild);
      note(`$${F.symbol} launched — welcome to the city.`, 5000); o.onDone && o.onDone();
    } catch (x) {
      step(cur, "bad"); err(why(x)); logsBox(q("err"), x);
      busy = false; q("go").disabled = false;
      // the coin is out but its split didn't lock: offer to finish it (the same wallet signs the split alone)
      if (cur === "split" || cur === "list") {
        q("go").textContent = "Finish the fee split"; q("go").onclick = async () => {
          q("go").disabled = true; err(""); step("split", "doing");
          try { const r = await finishSplit({ mint: g0.pub, S, CFG }); step("split", "ok", r.sig ? scan(r.sig) : "already locked"); step("list", r.listed ? "ok" : "bad", r.listed ? "" : esc(r.why || "")); if (r.listed) { q("go").outerHTML = `<a class="btn hot" href="/city?coin=${esc(g0.pub)}">See its tower</a>`; o.onDone && o.onDone(); } else q("go").disabled = false; }
          catch (y) { step("split", "bad"); err(why(y)); logsBox(q("err"), y); q("go").disabled = false; }
        };
      }
    }
  };
}
/// a launch whose split didn't land: the creator's wallet signs the split alone, then the coin registers
export async function finishSplit({ mint, S, CFG }) {
  const K = await kit(), c = await conn(), me = new K.PublicKey(S.key), m = new K.PublicKey(mint);
  const [acc, cv] = await Promise.all([c.getAccountInfo(K.feeSharingConfigPda(m)), c.getAccountInfo(K.bondingCurvePda(m))]);
  if (!cv) throw new Error("this coin has no pump.fun bonding curve");
  const sc = acc ? K.PUMP_SDK.decodeSharingConfig(acc) : null;
  let sig = null;
  if (!(sc && sc.adminRevoked)) {
    if (sc && !sc.admin.equals(me)) throw new Error("Connect the wallet that launched this coin.");
    const shares = [{ address: me, shareBps: CFG.split.creator }, { address: new K.PublicKey(CFG.vault), shareBps: CFG.split.vault }, { address: new K.PublicKey(CFG.buyer), shareBps: CFG.split.buyer }];
    const bh = await c.getLatestBlockhash("confirmed");
    const tx = await K.splitTx({ creator: me, mint: m, treasury: new K.PublicKey(CFG.vault), shares, blockhash: bh.blockhash, sharingConfig: sc });
    const [signed] = typeof S.p.signAllTransactions === "function" ? await S.p.signAllTransactions([tx]) : [await S.p.signTransaction(tx)];
    sig = await send(c, signed, bh.lastValidBlockHeight);
  }
  let r = null; for (let i = 0; i < 6; i++) { if (i) await sleep(2000 + i * 800); r = await post({ action: "register", mint, sig: sig || "" }); if (r.ok || r.status !== 404) break; }
  return { sig, listed: !!(r && r.ok), why: r && r.j && r.j.error };
}
/// the transaction's logs under the error, to copy
export function logsBox(el, x) {
  const logs = ((x && (x.logs || x.transactionLogs)) || []).join("\n") || (/Logs:/.test(String((x && x.message) || "")) ? String(x.message) : "");
  if (!el || !logs) return;
  el.insertAdjacentHTML("beforeend", `<details style="margin-top:6px;font:500 11px var(--mono);color:var(--dim)"><summary>Details (copy this if you ask for help)</summary><pre style="white-space:pre-wrap;max-height:180px;overflow:auto;user-select:all">${esc(logs)}</pre></details>`);
}
// pump.fun's errors in words (the full logs go to the console)
const PUMP_ERR = { TooMuchSolRequired: "The first buy's price moved — try again, or a little less SOL.", NotEnoughTokensToBuy: "The first buy is too big for a new coin.", NameTooLong: "The name is too long (32 letters at most).", SymbolTooLong: "The ticker is too long (13 letters at most).", CreateV2Disabled: "pump.fun has paused new coins for a moment — try again later.", 6077: "pump.fun isn't taking custom creator fees right now.", 6082: "pump.fun no longer creates cashback coins." };
export function why(e) {
  if (!e) return "";
  const m = String((e && e.message) || e), logs = ((e && (e.logs || e.transactionLogs)) || []).join("\n");
  if (e.code === 4001 || /reject|denied|cancel/i.test(m)) return "Cancelled in your wallet.";
  if (logs) console.warn("launch logs:\n" + logs);
  const am = /Error Code: (\w+)\. Error Number: (\d+)\. Error Message: ([^\n.]+)/.exec(logs + "\n" + m);
  if (am) return PUMP_ERR[am[1]] || PUMP_ERR[am[2]] || am[3];
  if (/insufficient lamports|insufficient funds|Attempt to debit an account but found no record/i.test(logs + m)) return "Not enough SOL in this wallet for the launch, the first buy and the network fee.";
  const cu = /"Custom":(\d+)|custom program error: 0x([0-9a-f]+)/i.exec(logs + "\n" + m);
  if (cu) { const n = cu[1] ? Number(cu[1]) : parseInt(cu[2], 16); if (PUMP_ERR[n]) return PUMP_ERR[n]; if (n === 1) return "Not enough SOL in this wallet for the launch, the first buy and the network fee."; return `pump.fun refused it (error ${n}).`; }
  if (/block ?height exceeded|blockhash not found|expired/i.test(m)) return "The transaction expired before it landed — try again.";
  return m.slice(0, 220);
}
async function send(c, signed, lastValid) {
  const by = typeof signed.serialize === "function" ? signed.serialize() : signed;
  const sig = await c.sendRawTransaction(by, { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 2 });
  for (let i = 0; i < 90; i++) {
    await sleep(i < 4 ? 1200 : 2000);
    const st = await c.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null);
    if (st && st.err) throw new Error("failed on Solana: " + JSON.stringify(st.err));
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return sig;
    if (i % 3 === 2) { const h = await c.getBlockHeight("confirmed").catch(() => null); if (h != null && lastValid && h > lastValid) throw new Error("The transaction expired before it landed — try again."); c.sendRawTransaction(by, { skipPreflight: true, maxRetries: 0 }).catch(() => {}); }
  }
  throw new Error("not confirmed yet — check Solscan");
}


/// a quick confetti burst over the window (one canvas, ~1.2 s); nothing with reduced motion
export function burst(host) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !host) return;
  const c = document.createElement("canvas"), r = host.getBoundingClientRect(); c.width = r.width; c.height = r.height; c.className = "burst"; host.appendChild(c);
  const x = c.getContext("2d"), P = Array.from({ length: 120 }, () => ({ x: r.width / 2, y: r.height * 0.3, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3, c: ["#ff2e88", "#ffffff", "#ff6fae", "#ffc2dc"][(Math.random() * 4) | 0], s: 3 + Math.random() * 5 }));
  let t = 0; const step = () => { t++; x.clearRect(0, 0, c.width, c.height); for (const p of P) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; x.fillStyle = p.c; x.fillRect(p.x, p.y, p.s, p.s * 0.6); } if (t < 75) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
