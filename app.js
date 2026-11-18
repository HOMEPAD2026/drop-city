// app.js — the city (the web game): the 3D city, the phone (MOST WANTED · TODAY · THE VAULT · RULES), a coin's card,
// the hour on the top bar, and the drop (launch.js). ?coin=<mint> opens that coin.
import { makeCity } from "/city.js";
import { $, esc, short, usd, hh, note, DEMO, loadCfg, loadCoins, loadSlot as getSlot, stars, ini, pic, sol } from "/common.js";
import { walletButton } from "/wallet.js";
import { openDrop as drop, grind } from "/launch.js";

let CFG = { split: { creator: 6000, vault: 3000, buyer: 1000 } };
let coins = [], slot = null, tab = "wanted", sel = new URLSearchParams(location.search).get("coin");
const city = makeCity($("city"), { onPick: (m) => openCard(m) });
const openDrop = () => drop({ cfg: CFG, onDone: () => { loadList(); loadSlot(); }, paintWallet: () => paintWallet() });

async function load() {
  CFG = await loadCfg();
  document.querySelectorAll("[data-name]").forEach((e) => (e.textContent = CFG.name)); document.title = CFG.name + " — the city";
  await Promise.all([loadList(), loadSlot()]);
  if (sel) { city.flyTo(sel); openCard(sel, true); }
}
async function loadList() { coins = await loadCoins(); city.setCoins(coins, new Date().getUTCHours()); paintPhone(); if (sel) openCard(sel, true); }
async function loadSlot() { slot = await getSlot(); paintClock(); }
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
let paintWallet = async () => {};
walletButton($("wallet"), () => { }).then((f) => (paintWallet = f));

$("drop").onclick = () => openDrop();
load();
window.__dc = { city, openDrop, grind, coins: () => coins };
