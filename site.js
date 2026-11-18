// site.js — the website: the hour, the numbers, EXPLORE (every drop as a card), TODAY'S 24, the launch, FEES and the
// creators' space (your drops, the fees they've earned, paying them out). The drop itself is launch.js.
import { $, esc, short, usd, hh, sleep, note, DEMO, loadCfg, loadCoins, loadSlot, stars, pic, sol, kit, conn } from "/common.js";
import { openDrop } from "/launch.js";

let CFG = { split: { creator: 6000, vault: 3000, buyer: 1000 } }, coins = [], slot = null;
const S = { q: "", sort: "wanted", filt: "all" };
const drop = () => openDrop({ cfg: CFG, onDone: refresh, paintWallet });
document.querySelectorAll("[data-drop]").forEach((b) => (b.onclick = drop));
$("burger").onclick = () => $("links").classList.toggle("open");
$("links").addEventListener("click", () => $("links").classList.remove("open"));

async function refresh() { [coins, slot] = await Promise.all([loadCoins(), loadSlot()]); paintAll(); }
async function start() {
  CFG = await loadCfg();
  document.querySelectorAll("[data-name]").forEach((e) => (e.textContent = CFG.name));
  document.title = `${CFG.name} — one drop every hour`;
  await refresh(); paintFees(); paintMe();
}
setInterval(refresh, 20e3); setInterval(paintHour, 1000);
function paintAll() { paintHour(); paintStats(); paintGrid(); paintHours(); paintLaunch(); paintMe(); }

// ---------------- the hour
function paintHour() {
  const now = Date.now(); $("h-h").textContent = hh(now).slice(0, 2) + ":00 UTC";
  const st = $("h-s"); st.className = "st";
  if (!CFG.open && !DEMO) { st.textContent = "THE CITY OPENS SOON"; return; }
  if (!slot) { st.textContent = "…"; return; }
  const left = Math.max(0, slot.next - now), mm = String(Math.floor(left / 60e3)).padStart(2, "0"), ss = String(Math.floor((left % 60e3) / 1000)).padStart(2, "0");
  if (slot.free) { st.textContent = `OPEN — ${mm}:${ss} LEFT TO DROP`; st.classList.add("open"); }
  else if (slot.taken && slot.taken.state === "held") { st.textContent = `HELD BY ${short(slot.taken.wallet)} UNTIL ${hh(slot.taken.until)}`; st.classList.add("held"); }
  else { st.textContent = `DROPPED${slot.taken && slot.taken.symbol ? " $" + slot.taken.symbol : ""} · NEXT IN ${mm}:${ss}`; st.classList.add("done"); }
}
function paintStats() {
  const today = new Date().toISOString().slice(0, 10), t = coins.filter((c) => c.hour && c.hour.startsWith(today)).length;
  const mc = coins.reduce((a, c) => a + (c.mcapUsd || 0), 0), made = coins.filter((c) => c.graduated).length;
  $("stats").innerHTML = [[coins.length, "coins dropped"], [`${t}/24`, "dropped today"], [usd(mc), "total market cap"], [made, "made it (graduated)"]].map(([v, l]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join("");
}

// ---------------- EXPLORE
$("q").oninput = (e) => { S.q = e.target.value.trim().toLowerCase(); paintGrid(); };
for (const [id, k, a] of [["sort", "sort", "s"], ["filt", "filt", "f"]]) $(id).onclick = (e) => { const b = e.target.closest(`[data-${a}]`); if (!b) return; S[k] = b.dataset[a]; $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); paintGrid(); };
function paintGrid() {
  const today = new Date().toISOString().slice(0, 10);
  let list = coins.filter((c) => !S.q || [c.name, c.symbol, c.mint].some((v) => String(v || "").toLowerCase().includes(S.q)));
  if (S.filt === "today") list = list.filter((c) => c.hour && c.hour.startsWith(today));
  if (S.filt === "curve") list = list.filter((c) => !c.graduated);
  if (S.filt === "made") list = list.filter((c) => c.graduated);
  list.sort(S.sort === "new" ? (a, b) => (b.launchedAt || 0) - (a.launchedAt || 0) || String(b.hour).localeCompare(String(a.hour)) : S.sort === "curve" ? (a, b) => (b.graduated ? 100 : b.progress || 0) - (a.graduated ? 100 : a.progress || 0) : (a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0));
  $("grid").innerHTML = list.length ? list.map((c, i) => card(c, i)).join("") : `<div class="empty"><b>${coins.length ? "NOTHING MATCHES" : "THE STREETS ARE QUIET"}</b>${coins.length ? "Try another search." : "No drops yet — the first coin takes the first hour."}</div>`;
}
function card(c) {
  const fresh = c.launchedAt && Date.now() / 1000 - c.launchedAt < 3600;
  return `<article class="cc"><div class="poster"><span class="tag">WANTED</span>${c.graduated ? `<span class="badge">MADE</span>` : fresh ? `<span class="badge new">NEW</span>` : ""}${pic(c)}</div>
    <div class="body"><h3>${esc(c.name)}</h3><span class="sym">$${esc(c.symbol)}</span> <span class="stars">${stars(c)}</span>
      <div class="row"><b>${usd(c.mcapUsd)}</b><small>${c.hour ? "dropped " + esc(c.hour.slice(5, 10).replace("-", "/")) + " " + esc(c.hour.slice(11, 13)) + ":00" : ""}</small></div>
      <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small style="color:var(--dim)">${c.graduated ? "graduated to PumpSwap" : `curve ${(c.progress || 0).toFixed(0)}%`}</small>
      <div class="acts"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade</a><a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">In the city</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a></div></div></article>`;
}

// ---------------- TODAY'S 24
function paintHours() {
  const today = new Date().toISOString().slice(0, 10), byH = new Map(coins.filter((c) => c.hour && c.hour.startsWith(today)).map((c) => [Number(c.hour.slice(11, 13)), c])), nowH = new Date().getUTCHours();
  $("hours").innerHTML = Array.from({ length: 24 }, (_, h) => { const c = byH.get(h); return `<div class="${h === nowH ? "now" : ""} ${c ? "drop" : ""}"><b>${String(h).padStart(2, "0")}:00</b>${c ? `<a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}" style="color:var(--ink)">$${esc(c.symbol)}</a>` : h < nowH ? "—" : h === nowH ? (slot && slot.free ? "OPEN" : "…") : ""}</div>`; }).join("");
}

// ---------------- LAUNCH
function paintLaunch() {
  $("how-suffix").textContent = CFG.suffix ? `Your browser finds an address that ends in ${CFG.suffix} — every coin here carries it. The key never leaves your browser.` : "Your browser makes the coin's address. The key never leaves it.";
  $("l-hint").textContent = !CFG.open && !DEMO ? CFG.why || "The city opens soon." : slot && slot.free ? `This hour is open — ${CFG.holdMin || 10} minutes to launch once you take it.` : "This hour is taken — the next opens at the top of the hour.";
}

// ---------------- FEES
function paintFees() {
  const s = CFG.split, parts = [[s.creator, "var(--lime)", "The sponsor", "You — the wallet that dropped the coin. Paid out any time from Creators."], [s.vault, "var(--gold)", "THE VAULT", "The city fund: buys back and burns the coins at the top of MOST WANTED.", CFG.vault], [s.buyer, "var(--cyan)", `Buys $${CFG.ticker}`, "A separate wallet that buys the city's main coin.", CFG.buyer]];
  $("splitbar").innerHTML = parts.map(([b, c]) => `<div style="flex:${b};background:${c}">${b / 100}%</div>`).join("");
  $("feecards").innerHTML = parts.map(([b, c, h, p, w]) => `<div><b style="color:${c}">${b / 100}%</b><h3>${esc(h)}</h3><p>${esc(p)}</p>${w ? `<code>${esc(w)}</code>` : h === "THE VAULT" ? "<code>wallet being set up</code>" : ""}</div>`).join("");
}

// ---------------- CREATORS: your drops and their fees
async function paintWallet() { const W = await sol(); $("wallet").textContent = W && W.key ? short(W.key) : "Connect"; paintMe(); }
$("wallet").onclick = async () => {
  const W = await sol(); if (!W) { note("No Solana wallet found — open this page in Phantom or Solflare."); return; }
  if (W.key) { await W.disconnect(); paintWallet(); return; }
  const list = W.providers(); if (!list.length) { if (W.mobile()) location.href = W.openIn("Phantom"); else note("No Solana wallet found — install Phantom, Solflare or Backpack."); return; }
  try { await W.connect(0); } catch (e) { note(String((e && e.message) || e).slice(0, 120)); } paintWallet();
};
document.addEventListener("arc:solwallet", paintWallet);
sol().then((W) => W && W.quiet && W.quiet()).finally(paintWallet);
async function paintMe() {
  const W = await sol(), el = $("me");
  if (!W || !W.key) { el.innerHTML = `<div class="me-box"><p style="color:var(--dim);margin:0 0 12px">Connect the wallet you launch from to see your drops and the fees they've earned.</p><button type="button" class="btn hot" id="me-c">Connect wallet</button></div>`; $("me-c").onclick = () => $("wallet").click(); return; }
  const mine = coins.filter((c) => c.creator === W.key);
  const earned = mine.reduce((a, c) => a + (c.feesWaitingSol || 0), 0);
  el.innerHTML = `<div class="me-box"><div class="stats" style="padding:0;max-width:none"><div><b>${mine.length}</b><small>your drops</small></div><div><b>${earned.toFixed(4)} SOL</b><small>fees waiting (all shares)</small></div><div><b>${(CFG.split.creator / 100)}%</b><small>your share</small></div><div><b>${slot && slot.free ? "OPEN" : "TAKEN"}</b><small>this hour</small></div></div>
    ${mine.length ? `<div class="my">${mine.map((c) => `<div class="r">${pic(c)}<span><b>$${esc(c.symbol)}</b> ${esc(c.name)}<br><small>${usd(c.mcapUsd)} · ${c.graduated ? "made" : `curve ${(c.progress || 0).toFixed(0)}%`} · ${(c.feesWaitingSol || 0).toFixed(4)} SOL waiting</small></span><button type="button" class="btn cy" data-pay="${esc(c.mint)}" ${(c.feesWaitingSol || 0) > 0.0001 ? "" : "disabled"}>Pay out fees</button><a class="btn ghost" href="/city?coin=${esc(c.mint)}" style="text-decoration:none">In the city</a></div>`).join("")}</div>` : `<p style="color:var(--dim)">No drops from this wallet yet. Take an open hour and drop one.</p><button type="button" class="btn hot" data-drop2>Drop a coin</button>`}
    <p class="fine">Paying out sends every share at once — ${(CFG.split.creator / 100)}% to you, ${(CFG.split.vault / 100)}% to the vault, ${(CFG.split.buyer / 100)}% to the buyer — straight from pump.fun's fee program. Anyone may press it; the split can't change.</p></div>`;
  el.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = () => payOut(b.dataset.pay, b)));
  const d2 = el.querySelector("[data-drop2]"); if (d2) d2.onclick = drop;
}
async function payOut(mint, btn) {
  const W = await sol(); if (!W || !W.key) return;
  btn.disabled = true; btn.textContent = "Paying…";
  try {
    const K = await kit(), c = await conn(), me = new K.PublicKey(W.key), m = new K.PublicKey(mint), coin = coins.find((x) => x.mint === mint) || {};
    const acc = await c.getAccountInfo(K.feeSharingConfigPda(m)); if (!acc) throw new Error("no fee-sharing config found");
    const bh = await c.getLatestBlockhash("confirmed");
    const tx = await K.distributeTx({ payer: me, mint: m, sharingConfig: K.PUMP_SDK.decodeSharingConfig(acc), graduated: !!coin.graduated, blockhash: bh.blockhash });
    const [signed] = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions([tx]) : [await W.p.signTransaction(tx)];
    const sig = await c.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
    for (let i = 0; i < 20; i++) { await sleep(1500); const st = await c.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null); if (st && st.err) throw new Error("failed on Solana"); if (st && st.confirmationStatus) break; }
    note("Fees paid out."); refresh();
  } catch (e) { const s = String((e && e.message) || e); note(/reject|denied|cancel/i.test(s) ? "Cancelled in your wallet." : s.slice(0, 140), 5000); btn.disabled = false; btn.textContent = "Pay out fees"; }
}
start();
