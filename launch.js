// launch.js — the drop: find an address ending with the suffix (in this browser), reserve the hour (a signed message),
// host the details, launch on pump.fun from the sponsor's own wallet with the fee split locked in the same signing,
// register the coin. Used by the website and the city. Nothing custodial: the server hosts the details and checks the chain.
import { $, esc, hh, sleep, post, b58, note, reserveMessage, DEMO, sol, kit, conn } from "/common.js";

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
      <label class="w">Your first buy<span class="chips" data-f="devs">${[0, 0.1, 0.5, 1].map((d) => `<button type="button" data-d="${d}" class="${d ? "" : "on"}">${d ? d + " SOL" : "None"}</button>`).join("")}</span></label>
    </div>
    <div class="note"><b>Fees, locked on chain:</b> ${(CFG.split.creator / 100)}% you · ${(CFG.split.vault / 100)}% THE VAULT · ${(CFG.split.buyer / 100)}% buys $${esc(CFG.ticker)}.${CFG.suffix ? ` <b>Your coin's address will end in ${esc(CFG.suffix)}</b> — found in this browser, the key never leaves it.` : ""} No launch fee; about 0.03 SOL of network costs.</div>
    <ol class="steps" data-f="steps" hidden></ol><p class="err" data-f="err" hidden></p>
    <div class="foot"><button type="button" class="btn ghost" data-f="close">Close</button><button type="button" class="btn hot" data-f="go">Reserve the hour & drop</button></div></div>`;
  const q = (k) => sh.querySelector(`[data-f="${k}"]`);
  const err = (s) => { q("err").hidden = !s; q("err").textContent = s || ""; };
  q("close").onclick = () => { try { grind.stop && grind.stop(); } catch {} sh.hidden = true; };
  q("devs").onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; f.dev = Number(b.dataset.d); q("devs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
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
    if (!S.key) { try { await S.connect(0); } catch (x) { return err(String((x && x.message) || x)); } o.paintWallet && o.paintWallet(); if (!S.key) return err("Connect a wallet first."); }
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
      q("go").outerHTML = `<a class="btn hot" href="https://pump.fun/coin/${esc(g.pub)}" target="_blank" rel="noopener">See it on pump.fun</a>`;
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

