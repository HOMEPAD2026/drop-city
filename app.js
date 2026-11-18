// app.js — the page: the city, the phone (MOST WANTED · TODAY · THE VAULT · RULES), a coin's card, the hour on the top
// bar, and the drop: find an address that ends with the suffix (in this browser), reserve the hour (a signed message),
// host the details, launch on pump.fun from the sponsor's own wallet with the fee split locked in the same signing,
// and register the coin. Nothing custodial: the server hosts the details and checks the chain.
import { makeCity } from "/city.js";

const API = "/api/pad";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");
const usd = (v) => (v == null ? "–" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + v.toFixed(0));
const hh = (ms) => new Date(ms).toISOString().slice(11, 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJ = (q) => fetch(API + q, { cache: "no-store" }).then((r) => r.json());
const post = (b) => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }));
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (u8) => { let n = 0n; for (const b of u8) n = n * 256n + BigInt(b); let s = ""; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of u8) { if (b) break; s = "1" + s; } return s; };
const note = (s, ms = 3200) => { const t = $("toast"); t.textContent = s; t.hidden = false; clearTimeout(note.t); note.t = setTimeout(() => (t.hidden = true), ms); };
export const reserveMessage = (wallet, mint, hour, issued) => `Reserve a drop\nWallet: ${wallet}\nCoin: ${mint}\nHour (UTC): ${hour}\nIssued: ${issued}`;

let CFG = { name: "DROP CITY", ticker: "DROP", suffix: "", split: { creator: 6000, vault: 3000, buyer: 1000 }, open: false };
let coins = [], slot = null, tab = "wanted", sel = null;
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const city = makeCity($("city"), { onPick: (m) => openCard(m) });

// ---------------- data
async function load() {
  try { CFG = await getJ("?cfg"); } catch {}
  document.querySelectorAll("[data-name]").forEach((e) => (e.textContent = CFG.name)); document.title = CFG.name;
  await Promise.all([loadList(), loadSlot()]);
}
async function loadList() {
  if (DEMO) { coins = demoCoins(); }
  else { try { const j = await getJ("?list"); if (Array.isArray(j.items)) coins = j.items; } catch {} }
  city.setCoins(coins, new Date().getUTCHours()); paintPhone(); if (sel) openCard(sel, true);
}
async function loadSlot() {
  if (DEMO) { slot = { hour: new Date().toISOString().slice(0, 13), next: Math.ceil(Date.now() / 3600e3) * 3600e3, free: true, taken: null }; }
  else { try { slot = await getJ("?slot"); } catch { slot = null; } }
  paintClock();
}
setInterval(loadList, 20e3); setInterval(loadSlot, 15e3);
setInterval(() => { paintClock(); $("ph-time").textContent = hh(Date.now()) + " UTC"; }, 1000);

// ---------------- the top bar: this hour's drop
function paintClock() {
  const now = Date.now(); $("clk-h").textContent = hh(now).slice(0, 2) + ":00";
  const st = $("clk-s"), btn = $("drop"); st.className = "st";
  if (!CFG.open && !DEMO) { st.textContent = "CITY OPENS SOON"; btn.disabled = true; return; }
  if (!slot) { st.textContent = "…"; return; }
  const left = Math.max(0, slot.next - now), mm = String(Math.floor(left / 60e3)).padStart(2, "0"), ss = String(Math.floor((left % 60e3) / 1000)).padStart(2, "0");
  if (slot.free) { st.textContent = `OPEN · ${mm}:${ss} LEFT`; st.classList.add("open"); btn.disabled = false; }
  else if (slot.taken && slot.taken.state === "held") { st.textContent = `HELD BY ${short(slot.taken.wallet)} · ${hh(slot.taken.until)}`; st.classList.add("held"); btn.disabled = true; }
  else { st.textContent = `DROPPED${slot.taken && slot.taken.symbol ? " $" + slot.taken.symbol : ""} · NEXT ${mm}:${ss}`; st.classList.add("done"); btn.disabled = true; }
}

// ---------------- the phone
document.querySelector(".ph-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; document.querySelectorAll(".ph-tabs button").forEach((x) => x.classList.toggle("on", x === b)); paintPhone(); });
const stars = (c) => { const m = c.mcapUsd || 0, n = m >= 1e6 ? 5 : m >= 250e3 ? 4 : m >= 50e3 ? 3 : m >= 10e3 ? 2 : 1; return "★".repeat(n) + "☆".repeat(5 - n); };
const ini = (c, cls = "ini") => `<span class="${cls}">${esc((c.symbol || "?").slice(0, 3))}</span>`;
const pic = (c) => (c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ini>${esc((c.symbol || "?").slice(0, 3))}</span>'">` : ini(c));
function paintPhone() {
  const el = $("ph-body");
  if (tab === "wanted") {
    const list = coins.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0));
    el.innerHTML = `<h3>MOST WANTED</h3>${list.length ? `<ul class="wanted">${list.slice(0, 30).map((c, i) => `<li data-m="${esc(c.mint)}"><span class="rk">${i + 1}</span>${pic(c)}<span><b>$${esc(c.symbol)}</b><span class="stars">${stars(c)}</span><small>${c.graduated ? "MADE · graduated" : `curve ${(c.progress || 0).toFixed(0)}%`}</small></span><span class="mc">${usd(c.mcapUsd)}<small>mcap</small></span></li>`).join("")}</ul>` : `<div class="empty"><b>THE STREETS ARE QUIET</b>No drops yet. The first coin in the city takes the first hour.</div>`}`;
  } else if (tab === "today") {
    const today = new Date().toISOString().slice(0, 10), byH = new Map(coins.filter((c) => c.hour && c.hour.startsWith(today)).map((c) => [Number(c.hour.slice(11, 13)), c])), nowH = new Date().getUTCHours();
    el.innerHTML = `<h3>TODAY · 24 DROPS</h3><p>One coin an hour (UTC). Each hour's drop rises on its lot in Clock Plaza.</p><div class="hours">${Array.from({ length: 24 }, (_, h) => { const c = byH.get(h); return `<div class="${h === nowH ? "now" : ""} ${c ? "drop" : ""}" ${c ? `data-m="${esc(c.mint)}"` : ""}><b>${String(h).padStart(2, "0")}:00</b>${c ? "$" + esc(c.symbol) : h < nowH ? "—" : h === nowH ? (slot && slot.free ? "OPEN" : "…") : ""}</div>`; }).join("")}</div>`;
  } else if (tab === "vault") {
    const s = CFG.split || {};
    el.innerHTML = `<h3>THE VAULT</h3><p>Every coin dropped here splits its pump.fun creator fees three ways, locked on chain the moment it launches.</p>
      <div class="split"><div class="s1"><b>${(s.creator || 0) / 100}%</b><span>The sponsor<small>the wallet that dropped the coin</small></span></div>
      <div class="s2"><b>${(s.vault || 0) / 100}%</b><span>THE VAULT — the city fund<small>${CFG.vault ? esc(CFG.vault) : "wallet being set up"}</small></span></div>
      <div class="s3"><b>${(s.buyer || 0) / 100}%</b><span>Buys $${esc(CFG.ticker)}<small>${CFG.buyer ? esc(CFG.buyer) : ""}</small></span></div></div>
      <p>The vault buys back and burns the city's hottest coins. Every move is a public transaction.</p>`;
  } else {
    el.innerHTML = `<h3>RULES OF THE CITY</h3><ol class="rules">
      <li><b>One drop an hour.</b> 24 a day, on the UTC hour. Reserve the hour, then launch within ${CFG.holdMin || 10} minutes — or the next sponsor takes it.</li>
      <li><b>On pump.fun, from your own wallet.</b> The coin is an ordinary pump.fun coin; you're its creator.</li>
      ${CFG.suffix ? `<li><b>Every address ends in ${esc(CFG.suffix)}.</b> Your browser finds one before the launch; the key never leaves it.</li>` : ""}
      <li><b>The split is locked forever:</b> ${(CFG.split.creator / 100)}% you · ${(CFG.split.vault / 100)}% the vault · ${(CFG.split.buyer / 100)}% buys $${esc(CFG.ticker)}.</li>
      <li><b>The vault fights for the city:</b> buybacks and burns for the coins at the top of MOST WANTED.</li></ol>
      <p>Not financial advice. Coins can go to zero.</p>`;
  }
  el.querySelectorAll("[data-m]").forEach((x) => (x.onclick = () => { city.flyTo(x.dataset.m); openCard(x.dataset.m); }));
}

// ---------------- a coin's card
function openCard(mint, quiet) {
  const c = coins.find((x) => x.mint === mint); if (!c) return; sel = mint;
  const el = $("card"); el.hidden = false;
  el.innerHTML = `<button type="button" class="x" aria-label="Close">×</button>
    <div class="wp"><div class="tag">WANTED</div>${c.image ? `<img src="${esc(c.image)}" alt="">` : ini(c)}<div class="stars">${stars(c)}</div></div>
    <h2>${esc(c.name)}</h2><span class="sym">$${esc(c.symbol)} · ${esc(short(c.mint))}</span>
    <div class="kv"><div><b>${usd(c.mcapUsd)}</b><small>Market cap</small></div><div><b>${c.priceUsd ? "$" + c.priceUsd.toPrecision(3) : "–"}</b><small>Price</small></div><div><b>${c.hour ? c.hour.slice(11, 13) + ":00" : "–"}</b><small>Dropped</small></div></div>
    <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small style="color:var(--dim)">${c.graduated ? "MADE — graduated to PumpSwap" : `bonding curve ${(c.progress || 0).toFixed(1)}%`}</small>
    ${c.description ? `<p style="color:var(--dim);font-size:13px">${esc(c.description)}</p>` : ""}
    <div class="links"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade on pump.fun</a><a href="https://solscan.io/token/${esc(c.mint)}" target="_blank" rel="noopener">Solscan</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a></div>`;
  el.querySelector(".x").onclick = () => { el.hidden = true; sel = null; };
  if (!quiet) city.flyTo(mint);
}

// ---------------- the wallet
let solP = null;
const sol = () => (window.arcSol ? Promise.resolve(window.arcSol) : (solP = solP || new Promise((r) => { const t = setInterval(() => { if (window.arcSol) { clearInterval(t); r(window.arcSol); } }, 100); setTimeout(() => r(null), 6000); })));
async function paintWallet() { const S = await sol(); $("wallet").textContent = S && S.key ? short(S.key) : "Connect"; }
$("wallet").onclick = async () => {
  const S = await sol(); if (!S) { note("No Solana wallet found — open this page in Phantom or Solflare."); return; }
  if (S.key) { await S.disconnect(); paintWallet(); return; }
  const list = S.providers(); if (!list.length) { if (S.mobile()) location.href = S.openIn("Phantom"); else note("No Solana wallet found — install Phantom, Solflare or Backpack."); return; }
  try { await S.connect(0); } catch (e) { note(String((e && e.message) || e).slice(0, 120)); } paintWallet();
};
document.addEventListener("arc:solwallet", paintWallet);
sol().then((S) => S && S.quiet && S.quiet()).finally(paintWallet);

// ---------------- the kit (pump.fun SDK, web3, the fee split)
let kitP = null, connP = null;
const kit = () => (kitP = kitP || new Promise((ok, no) => { if (window.ArcPumpKit) return ok(window.ArcPumpKit); const s = document.createElement("script"); s.src = "/vendor/pump-kit.js"; s.onload = () => ok(window.ArcPumpKit); s.onerror = () => no(new Error("the Solana kit didn't load")); document.head.appendChild(s); }));
const conn = () => (connP = connP || kit().then((K) => new K.Connection(new URL(API + "?solrpc=1", location.origin).href, { commitment: "confirmed", disableRetryOnRateLimit: true })));

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

// ---------------- the drop
$("drop").onclick = () => openDrop();
function openDrop() {
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
    if (!S.key) { try { await S.connect(0); } catch (x) { return err(String((x && x.message) || x)); } paintWallet(); if (!S.key) return err("Connect a wallet first."); }
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
      step("hold", "ok", `held until ${hh(rr.j.until)} UTC`); loadSlot();
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
      note(`$${F.symbol} dropped — welcome to the city.`, 5000); loadList(); loadSlot();
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

// ---------------- ?demo=1: made-up coins to see the city full
function demoCoins() {
  const day = new Date().toISOString().slice(0, 10), nowH = new Date().getUTCHours();
  const names = [["Night Owl", "OWL"], ["Neon Rat", "NRAT"], ["Getaway Cat", "GCAT"], ["Pier Shark", "SHRK"], ["Vice Frog", "VFROG"], ["Cash Gull", "GULL"], ["Tow Truck", "TOW"], ["Palm Pump", "PALM"], ["Heat Wave", "HEAT"], ["Lowrider", "LOW"], ["Bail Out", "BAIL"], ["Big Score", "SCORE"]];
  return names.map(([n, s], i) => ({ mint: "Demo" + i + "x".repeat(38), name: n, symbol: s, image: "", hour: i < Math.min(nowH, 9) ? `${day}T${String(i * 2 % 24).padStart(2, "0")}` : "2026-11-10T0" + (i % 9),
    progress: [12, 48, 77, 100, 33, 91, 5, 64, 22, 58, 86, 40][i], graduated: i === 3 || i === 10, mcapUsd: [8e3, 31e3, 54e3, 410e3, 19e3, 72e3, 4e3, 45e3, 12e3, 38e3, 1.2e6, 26e3][i], priceUsd: 0.00004, description: "A made-up coin for the demo city." }));
}
load();
window.__dc = { city, openDrop, grind, coins: () => coins };
