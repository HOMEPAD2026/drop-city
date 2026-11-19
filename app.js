// app.js — the city (the web game): the 3D city, the phone (MOST WANTED · TODAY · THE VAULT · RULES), a coin's card,
// the hour on the top bar, and the drop (launch.js). ?coin=<mint> opens that coin.
import { makeCity } from "/city.js";
import { $, esc, short, usd, hh, note, DEMO, loadCfg, loadCoins, loadSlot as getSlot, stars, ini, pic, sol, dropState, poke } from "/common.js";
import { walletButton } from "/wallet.js";
import { openDrop as drop, grind } from "/launch.js";
import { feeBox, wireFees } from "/fees.js";
import { showDrop, takeoverTick, initSound, tone } from "/site-x.js";
import { makeRoam, LOOKS, randomHandle } from "/roam.js?v=1";
import { streetNet } from "/street-net.js";
import { streetCar } from "/street-car.js";
import { streetJobs } from "/street-jobs.js";

let CFG = { split: { creator: 6000, vault: 3000, buyer: 1000 } };
let coins = [], slot = null, tab = "wanted", sel = new URLSearchParams(location.search).get("coin");
const city = makeCity($("city"), { onPick: (m) => openCard(m) });
// on foot (roam.js): a street name and a crew member on the first visit, then the streets; MAP is the old view
const roam = makeRoam(city, { onOpen: (m) => openCard(m, true), toast: (t) => note(t), sound: tone });
streetCar(roam.api); const net = streetNet(roam.api); const jobs = streetJobs(roam.api, { pid: () => net.pid });
const go = (m) => { if (roam.active) roam.goTo(m); else city.flyTo(m); };
async function setMode(m) {
  if (m === "street" && !roam.active) { if (!(await roam.enter())) return; }
  if (m === "map" && roam.active) { roam.leave(); document.body.classList.remove("ph-open"); }
  try { localStorage.setItem("dc.mode", m); } catch { /* */ }
  $("m-street").classList.toggle("on", m === "street"); $("m-map").classList.toggle("on", m === "map");
}
$("m-street").onclick = () => setMode("street"); $("m-map").onclick = () => setMode("map");
$("m-phone").onclick = () => document.body.classList.toggle("ph-open");
$("me-chip").onclick = () => openMe();
function openMe() {
  const w = document.createElement("div"); w.className = "mesheet"; let look = roam.me.look;
  w.innerHTML = `<div><button type="button" class="x" aria-label="Close">×</button><h3>YOUR STREET NAME</h3><p>Kept on this device. Letters, numbers and _ (up to 20).</p>
    <div class="row"><input id="me-in" maxlength="20" value="${esc(roam.me.name)}" autocomplete="off" spellcheck="false"><button type="button" class="dice" title="Random name">🎲</button></div>
    <div class="looks">${Object.entries(LOOKS).map(([k, v]) => `<button type="button" data-l="${k}" class="${k === look ? "on" : ""}">${v.name}</button>`).join("")}</div>
    <div class="ft"><button type="button" class="btn ghost" data-c>Cancel</button><button type="button" class="btn hot" data-s>Save</button></div>
    <small class="fine">Street cash and wanted stars are just for fun — nothing here touches a wallet or the chain.</small></div>`;
  document.body.appendChild(w);
  const close = () => w.remove();
  w.onclick = (e) => { if (e.target === w || e.target.closest(".x,[data-c]")) close(); };
  w.querySelector(".dice").onclick = () => { w.querySelector("#me-in").value = randomHandle(); };
  w.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => { look = b.dataset.l; w.querySelectorAll("[data-l]").forEach((x) => x.classList.toggle("on", x === b)); }));
  w.querySelector("[data-s]").onclick = async () => { roam.setName(w.querySelector("#me-in").value); if (look !== roam.me.look) await roam.setLook(look); close(); };
}
const openDrop = () => drop({ cfg: CFG, onDone: () => { loadList(); loadSlot(); }, paintWallet: () => paintWallet() });

async function load() {
  CFG = await loadCfg();
  document.querySelectorAll("[data-name]").forEach((e) => (e.textContent = CFG.name)); document.title = CFG.name + " — the city";
  await Promise.all([loadList(), loadSlot()]);
  if (sel) { city.flyTo(sel); openCard(sel, true); }
  let m = "street"; try { m = localStorage.getItem("dc.mode") || "street"; } catch { /* */ }
  if (sel || /[?&]view=map\b/.test(location.search)) m = "map";
  setMode(m);
}
async function loadList() { coins = await loadCoins(); city.setCoins(coins, new Date().getUTCHours()); paintPhone(); if (sel) openCard(sel, true); }
async function loadSlot() {
  const was = slot; slot = await getSlot(); paintClock();
  // a new hourly drop while the city is open: fly there, fireworks, the takeover
  if (was && slot && slot.state === "dropped" && slot.drop && (!was.drop || was.drop.mint !== slot.drop.mint)) {
    await loadList(); const c = coins.find((x) => x.mint === slot.drop.mint);
    if (c) { if (!roam.active) city.flyTo(c.mint); const t = city.towers.get(c.mint); if (t) setTimeout(() => city.burst(t.group.position.x, t.h + 14, t.group.position.z, 1.6), 1200); showDrop(c); }
  }
}
setInterval(loadList, 20e3); setInterval(loadSlot, 15e3);
setInterval(() => { paintClock(); takeoverTick(slot, coins); $("ph-time").textContent = hh(Date.now()) + " UTC"; }, 1000);
initSound();

// ---------------- the top bar: this hour's drop
function paintClock() {
  const now = Date.now(); $("clk-h").textContent = hh(now).slice(0, 2) + ":00";
  const st = $("clk-s"), btn = $("drop");
  btn.disabled = !CFG.open && !DEMO;
  const [txt, cls] = dropState(slot, CFG); st.className = "st " + cls;
  const left = slot ? Math.max(0, slot.next - now) : 0, mm = String(Math.floor(left / 60e3)).padStart(2, "0"), ss = String(Math.floor((left % 60e3) / 1000)).padStart(2, "0");
  st.textContent = slot && slot.state === "dropped" ? `${txt} · NEXT ${mm}:${ss}` : txt;
  poke(slot);
}

// ---------------- the phone
document.querySelector(".ph-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; document.querySelectorAll(".ph-tabs button").forEach((x) => x.classList.toggle("on", x === b)); paintPhone(); });
function paintPhone() {
  const el = $("ph-body");
  if (tab === "wanted") {
    const list = coins.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0));
    el.innerHTML = `<h3>MOST WANTED</h3>${list.length ? `<ul class="wanted">${list.slice(0, 30).map((c, i) => `<li data-m="${esc(c.mint)}"><span class="rk">${i + 1}</span>${pic(c)}<span><b>$${esc(c.symbol)}</b><span class="stars">${stars(c)}</span><small>${c.graduated ? "MADE · graduated" : `curve ${(c.progress || 0).toFixed(0)}%`}</small></span><span class="mc">${usd(c.mcapUsd)}<small>mcap</small></span></li>`).join("")}</ul>` : `<div class="empty"><b>THE STREETS ARE QUIET</b>No coins yet. Launch the first, or wait for the agent’s next drop.</div>`}`;
  } else if (tab === "today") {
    const today = new Date().toISOString().slice(0, 10), byH = new Map(coins.filter((c) => c.hour && c.hour.startsWith(today)).map((c) => [Number(c.hour.slice(11, 13)), c])), nowH = new Date().getUTCHours();
    el.innerHTML = `<h3>TODAY · 24 DROPS</h3><p>The agent drops one coin at the top of every hour (UTC); each rises on its lot in Clock Plaza.</p><div class="hours">${Array.from({ length: 24 }, (_, h) => { const c = byH.get(h); return `<div class="${h === nowH ? "now" : ""} ${c ? "drop" : ""}" ${c ? `data-m="${esc(c.mint)}"` : ""}><b>${String(h).padStart(2, "0")}:00</b>${c ? "$" + esc(c.symbol) : h < nowH ? "—" : h === nowH ? "…" : ""}</div>`; }).join("")}</div>`;
  } else if (tab === "vault") {
    const s = CFG.split || {};
    const mc = CFG.main && coins.find((x) => x.mint === CFG.main);
    el.innerHTML = `${mc ? `<h3>THE MAIN COIN</h3><ul class="wanted"><li data-m="${esc(mc.mint)}"><span class="rk">★</span>${pic(mc)}<span><b>$${esc(mc.symbol)}</b><small>${mc.graduated ? "MADE · graduated" : `curve ${(mc.progress || 0).toFixed(0)}%`}</small></span><span class="mc">${usd(mc.mcapUsd)}<small>mcap</small></span></li></ul>` : ""}<h3>THE VAULT</h3><p>Every coin dropped here splits its pump.fun creator fees three ways, locked on chain the moment it launches.</p>
      <div class="split"><div class="s1"><b>${(s.creator || 0) / 100}%</b><span>The creator<small>the wallet that launched the coin (the agent's share goes on to THE VAULT)</small></span></div>
      <div class="s2"><b>${(s.vault || 0) / 100}%</b><span>THE VAULT — the city fund<small>${CFG.vault ? esc(CFG.vault) : "wallet being set up"}</small></span></div>
      <div class="s3"><b>${(s.buyer || 0) / 100}%</b><span>Buys $${esc(CFG.ticker)}<small>${CFG.buyer ? esc(CFG.buyer) : ""}</small></span></div></div>
      <p>The vault buys back and burns the city's hottest coins. Every move is a public transaction.</p>`;
  } else {
    el.innerHTML = `<h3>RULES OF THE CITY</h3><ol class="rules">
      <li><b>The hourly drop.</b> The city's agent launches one coin at the top of every UTC hour — 24 a day on Clock Plaza.</li>
      <li><b>Launch any time.</b> Anyone can launch their own coin, as many as they like. It stands in the districts around the plaza.</li>
      <li><b>On pump.fun, from your own wallet.</b> The coin is an ordinary pump.fun coin; you're its creator.</li>
      ${CFG.suffix ? `<li><b>Every address ends in ${esc(CFG.suffix)}.</b> Your browser finds one before the launch; the key never leaves it.</li>` : ""}
      <li><b>The split is locked forever:</b> ${(CFG.split.creator / 100)}% you · ${(CFG.split.vault / 100)}% the vault · ${(CFG.split.buyer / 100)}% buys $${esc(CFG.ticker)}.</li>
      <li><b>The vault fights for the city:</b> buybacks and burns for the coins at the top of MOST WANTED.</li></ol>
      <p>Not financial advice. Coins can go to zero.</p>`;
  }
  el.querySelectorAll("[data-m]").forEach((x) => (x.onclick = () => { go(x.dataset.m); openCard(x.dataset.m, true); document.body.classList.remove("ph-open"); }));
}

const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60e3)); return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
// ---------------- a coin's card
function openCard(mint, quiet) {
  const c = coins.find((x) => x.mint === mint); if (!c) return; sel = mint;
  const el = $("card"); el.hidden = false; document.body.classList.add("card-open");
  el.innerHTML = `<button type="button" class="x" aria-label="Close">×</button>
    <div class="wp"><div class="tag">WANTED</div>${c.image ? `<img src="${esc(c.image)}" alt="">` : ini(c)}<div class="stars">${stars(c)}</div></div>
    <h2>${esc(c.name)}</h2><span class="sym">$${esc(c.symbol)} · ${esc(short(c.mint))}</span>${c.quote ? `<span class="qtag">${esc(c.quote.id)} PAIR</span>` : ""}
    <div class="kv"><div><b>${usd(c.mcapUsd)}</b><small>Market cap</small></div><div><b>${c.priceUsd ? "$" + c.priceUsd.toPrecision(3) : "–"}</b><small>Price</small></div><div><b>${c.hour ? c.hour.slice(11, 13) + ":00" : "–"}</b><small>Dropped</small></div></div>
    <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small style="color:var(--dim)">${c.graduated ? "MADE — graduated to PumpSwap" : `bonding curve ${(c.progress || 0).toFixed(1)}%`}</small>
    ${c.raid ? `<div class="raid"><b>🚨 POLICE RAID</b><span>Its creator sold ${Number(c.raid.sol).toFixed(c.raid.sol < 1 ? 3 : 2)} SOL of it ${ago(c.raid.at)} — seen on chain${c.raid.sig ? ` · <a href="https://solscan.io/tx/${esc(c.raid.sig)}" target="_blank" rel="noopener">the sale</a>` : ""}. The tape comes down after a day without another sale.</span></div>` : ""}
    ${c.description ? `<p style="color:var(--dim);font-size:13px">${esc(c.description)}</p>` : ""}
    ${feeBox(c, CFG)}
    <div class="links"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade on pump.fun</a><a href="https://solscan.io/token/${esc(c.mint)}" target="_blank" rel="noopener">Solscan</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a></div>`;
  el.querySelector(".x").onclick = () => { el.hidden = true; sel = null; document.body.classList.remove("card-open"); };
  wireFees(el, c, CFG, loadList);
  if (!quiet) city.flyTo(mint);
}

// ---------------- the wallet
let paintWallet = async () => {};
walletButton($("wallet"), () => { }).then((f) => (paintWallet = f));

$("drop").onclick = () => openDrop();
load();
window.__dc = { city, roam, net, jobs, setMode, openDrop, grind, coins: () => coins };
