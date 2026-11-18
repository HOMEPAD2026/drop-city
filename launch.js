// launch.js — the drop: find an address ending with the suffix (in this browser), reserve the hour (a signed message),
// host the details, launch on pump.fun from the sponsor's own wallet with the fee split locked in the same signing,
// register the coin. Used by the website and the city. Nothing custodial: the server hosts the details and checks the chain.
import { $, esc, hh, sleep, post, b58, note, reserveMessage, DEMO, sol, kit, conn } from "/common.js";
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
  const f = { dev: 0, logo: "", logoData: "" };
  sh.innerHTML = `<div role="dialog" aria-label="Drop a coin"><h2>DROP A COIN</h2><p class="sub">This hour's drop is yours if you take it. On pump.fun, from your own wallet.</p>
    <div class="form">
      <label class="w logo-pick"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-f="file"><span class="pv" data-f="pv">+</span><span>Logo<br><small data-f="lmsg">square image, 512 px is plenty</small></span></label>
      <label>Name<input data-f="name" maxlength="32" placeholder="Night Owl"></label>
      <label>Ticker<input data-f="symbol" maxlength="13" placeholder="OWL"></label>
      <label class="w">Story<textarea data-f="description" rows="2" maxlength="500" placeholder="What's the coin about?"></textarea></label>
      <label>X link<input data-f="twitter" placeholder="https://x.com/…"></label>
      <label>Telegram<input data-f="telegram" placeholder="https://t.me/…"></label>
      <label class="w">Website<input data-f="website" placeholder="https://…"></label>
      <label class="w buyset"><span class="lbl">Your first buy (optional) — bought in the same signing, before anyone else</span>
        <span class="custom"><input data-f="devsol" inputmode="decimal" placeholder="0" style="max-width:180px"> SOL</span><small class="buyline" data-f="buyline">Leave it empty for no first buy.</small></label>
    </div>
    <div class="note"><b>Fees, locked on chain:</b> ${(CFG.split.creator / 100)}% you · ${(CFG.split.vault / 100)}% THE VAULT · ${(CFG.split.buyer / 100)}% buys $${esc(CFG.ticker)}.${CFG.suffix ? ` <b>Your coin's address will end in ${esc(CFG.suffix)}</b> — found in this browser, the key never leaves it.` : ""} No launch fee; about 0.03 SOL of network costs.</div>
    <ol class="steps" data-f="steps" hidden></ol><p class="err" data-f="err" hidden></p>
    <div class="foot"><button type="button" class="btn ghost" data-f="close">Close</button><button type="button" class="btn hot" data-f="go">Reserve the hour & drop</button></div></div>`;
  const q = (k) => sh.querySelector(`[data-f="${k}"]`);
  const err = (s) => { q("err").hidden = !s; q("err").textContent = s || ""; };
  q("close").onclick = () => { try { grind.stop && grind.stop(); } catch {} sh.hidden = true; };
  q("devsol").oninput = (e) => { const v = Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)); f.dev = Math.round(v * 1e4) / 1e4;
    q("buyline").textContent = f.dev > 0 ? `≈ ${pctForSol(f.dev).toFixed(2)}% of the supply for ${f.dev} SOL, the moment it launches.` : "Leave it empty for no first buy."; };
  q("symbol").oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  q("file").onchange = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try { const url = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); });
      const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error("not an image")); i.src = url; });
      const m = Math.min(img.width, img.height), d = Math.min(512, m), c = document.createElement("canvas"); c.width = c.height = d;
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, d, d);
      let data = c.toDataURL("image/webp", 0.86); if (!data.startsWith("data:image/webp")) data = c.toDataURL("image/png");
      f.logoData = data; q("pv").innerHTML = `<img src="${data}" alt="">`; q("lmsg").textContent = "ready"; err("");
    } catch (x) { err(String((x && x.message) || x)); }
  };
  const STEPS = [["find", CFG.suffix ? `Find an address ending in ${CFG.suffix}` : "Make the coin's address"], ["hold", "Reserve the hour (sign a message)"], ["host", "Host the logo and details"], ["sign", "Sign the launch"], ["launch", "Launch on pump.fun"], ["split", "Lock the fee split"], ["list", "Move into the city"]];
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
    if (!S.key) { await openWallet(); o.paintWallet && o.paintWallet(); if (!S.key) return err("Connect a wallet to drop."); }
    busy = true; err(""); q("go").disabled = true; q("steps").hidden = false;
    q("steps").innerHTML = STEPS.map(([k, t]) => `<li data-s="${k}"><i></i><span>${esc(t)}<small></small></span></li>`).join("");
    let cur = "find";
    try {
      // 1. the address
      step("find", "doing"); const t0 = Date.now(), want = 58 ** (CFG.suffix || "").length;
      const g = await grind(CFG.suffix || "", (n) => { const rate = n / Math.max(0.5, (Date.now() - t0) / 1000); step("find", "doing", `${Math.round(n).toLocaleString()} tried · ${Math.round(rate).toLocaleString()}/s${want > 1 ? ` · ~${Math.max(1, Math.round((want - n) / Math.max(rate, 1)))} s` : ""}`); });
      step("find", "ok", `<code>${esc(g.pub)}</code>`);
      // 2. the hour
      cur = "hold"; step("hold", "doing");
      const hour = new Date().toISOString().slice(0, 13), issued = new Date().toISOString();
      const sg = await S.signMessage(new TextEncoder().encode(reserveMessage(S.key, g.pub, hour, issued)));
      const rr = DEMO ? { ok: true, j: { until: Date.now() + 600e3 } } : await post({ action: "reserve", wallet: S.key, mint: g.pub, issued, sig: b58(sg) });
      if (!rr.ok) throw new Error(rr.j.error || "couldn't reserve the hour");
      step("hold", "ok", `held until ${hh(rr.j.until)} UTC`); o.onDone && o.onDone();
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
      const [global, feeConfig, bh, bal] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null), c.getLatestBlockhash("confirmed"), c.getBalance(me)]);
      if (global.createV2Enabled === false) throw new Error("pump.fun has paused new coins for a moment — try again later.");
      if (bal / 1e9 < 0.03 + f.dev) throw new Error(`Not enough SOL — about ${(0.03 + f.dev).toFixed(2)} SOL is needed.`);
      const b = await K.launchTxs({ global, feeConfig, creator: me, mint: mint.publicKey, name: F.name, symbol: F.symbol, uri: md.j.uri, devBuyLamports: Math.round(f.dev * 1e9), treasury: V, shares, blockhash: bh.blockhash });
      b.txs[0].partialSign(mint);
      const signed = typeof S.p.signAllTransactions === "function" ? await S.p.signAllTransactions(b.txs) : await Promise.all(b.txs.map((t) => S.p.signTransaction(t)));
      step("sign", "ok");
      cur = "launch"; step("launch", "doing");
      const sig1 = await send(c, signed[0], bh.lastValidBlockHeight); step("launch", "ok", scan(sig1));
      cur = "split"; step("split", "doing");
      let sig2 = sig1; if (signed.length > 1) sig2 = await send(c, signed[1], bh.lastValidBlockHeight);
      step("split", "ok", scan(sig2));
      cur = "list"; step("list", "doing");
      let listed = false; for (let i = 0; i < 6 && !listed; i++) { if (i) await sleep(2500 + i * 1000); const r = await post({ action: "register", mint: g.pub, sig: sig1 }); listed = r.ok; if (!r.ok && r.status !== 404) { step("list", "bad", esc(r.j.error || "")); break; } }
      if (listed) step("list", "ok");
      const tw = encodeURIComponent(`$${F.symbol} just dropped in the city — the ${hour.slice(11, 13)}:00 drop.\n`), link = encodeURIComponent(`${location.origin}/city?coin=${g.pub}`);
      q("go").outerHTML = `<a class="btn ghost" href="https://x.com/intent/tweet?text=${tw}&url=${link}" target="_blank" rel="noopener">Share on X</a><a class="btn cy" href="/city?coin=${esc(g.pub)}">See its tower</a><a class="btn hot" href="https://pump.fun/coin/${esc(g.pub)}" target="_blank" rel="noopener">pump.fun ↗</a>`;
      sh.querySelector(".sub").innerHTML = `<b style="color:var(--lime)">$${esc(F.symbol)} is live.</b> The ${hour.slice(11, 13)}:00 lot is yours.`; burst(sh.firstChild);
      note(`$${F.symbol} dropped — welcome to the city.`, 5000); o.onDone && o.onDone();
    } catch (x) {
      step(cur, "bad"); const s = String((x && x.message) || x); err(/reject|denied|cancel/i.test(s) ? "Cancelled in your wallet." : s.slice(0, 220));
      busy = false; q("go").disabled = false;
    }
  };
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
  const x = c.getContext("2d"), P = Array.from({ length: 120 }, () => ({ x: r.width / 2, y: r.height * 0.3, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3, c: ["#ff2bd6", "#22e6ff", "#ffb02e", "#7cff6b"][(Math.random() * 4) | 0], s: 3 + Math.random() * 5 }));
  let t = 0; const step = () => { t++; x.clearRect(0, 0, c.width, c.height); for (const p of P) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; x.fillStyle = p.c; x.fillRect(p.x, p.y, p.s, p.s * 0.6); } if (t < 75) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
