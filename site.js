// site.js — the website: the hour, the numbers, EXPLORE (every drop as a card), TODAY'S 24, the launch, FEES and the
// creators' space (your drops, the fees they've earned, paying them out). The drop itself is launch.js.
import { $, esc, short, usd, hh, sleep, note, DEMO, loadCfg, loadCoins, loadSlot, stars, pic, sol, kit, conn, dropState, poke, getJ } from "/common.js";
import { walletButton } from "/wallet.js";
import { openDrop, finishSplit, why, logsBox } from "/launch.js";
import { feeBox, wireFees } from "/fees.js";
import { t, initLang, initSound, tone, roll, paintVote, tickVote, paintLive, paintRanks, initCheck, paintWallets, openCreator, gradeChip, gradeBox, takeoverTick, showDrop, confetti } from "/site-x.js";

let CFG = { split: { creator: 6000, vault: 3000, buyer: 1000 } }, coins = [], slot = null;
const S = { q: "", sort: "wanted", filt: "all", quiet: false };
const tiers = new Map(); // a coin's wanted stars last time, to flash a new one
const drop = () => openDrop({ cfg: CFG, onDone: refresh, paintWallet: () => paintWallet() });
document.querySelectorAll("[data-drop]").forEach((b) => (b.onclick = drop));
$("burger").onclick = () => $("links").classList.toggle("open");
$("links").addEventListener("click", () => $("links").classList.remove("open"));

async function refresh() {
  const was = slot;
  [coins, slot] = await Promise.all([loadCoins(), loadSlot()]);
  paintAll();
  // a new hourly drop while the page is open → the takeover
  if (was && slot && slot.state === "dropped" && slot.drop && (!was.drop || was.drop.mint !== slot.drop.mint)) { const c = coins.find((x) => x.mint === slot.drop.mint); if (c) showDrop(c); }
}
async function start() {
  CFG = await loadCfg();
  document.querySelectorAll("[data-name]").forEach((e) => (e.textContent = CFG.name));
  document.title = `${CFG.name} — one drop every hour`;
  initLang(() => { paintAll(); paintVote(CFG); paintWallets(CFG); }); initSound();
  await refresh(); paintFees(); paintMe(); readVault(); setInterval(readVault, 60e3);
  initCheck(CFG, openCoin); paintWallets(CFG); setInterval(() => paintWallets(CFG), 60e3);
  paintVote(CFG); setInterval(() => paintVote(CFG), 20e3);
  paintLive(coins, flashTrade); setInterval(() => paintLive(coins, flashTrade), DEMO ? 3000 : 8000);
  if (window.__COIN) setTimeout(() => openCoin(window.__COIN), 300);
  const q = new URLSearchParams(location.search).get("coin"); if (q) setTimeout(() => openCoin(q), 300);
}
setInterval(refresh, 20e3); setInterval(() => { paintHour(); tickVote(); takeoverTick(slot, coins); }, 1000);
/// a trade lands: its card pulses
function flashTrade(x) { const el = document.querySelector(`.cc[data-m="${CSS.escape(x.mint)}"]`); if (!el) return; el.classList.remove("ping"); void el.offsetWidth; el.classList.add("ping"); }
function paintAll() { paintHour(); paintMain(); paintStats(); paintGrid(); paintHours(); paintLaunch(); paintMe(); paintTicker(); paintRanks(coins, openCoin, (w) => openCreator(w, coins, openCoin)); const sl = $("suffixline"); if (CFG.suffix) { sl.hidden = false; sl.innerHTML = `${esc(t("caEnds", "Every coin's CA ends in"))} <b>${esc(CFG.suffix)}</b>`; } }

// ---------------- THE MAIN COIN (beside the hero)
/// the address with its suffix lit
const caHtml = (m) => { const k = (CFG.suffix || "").length; return k && m.endsWith(CFG.suffix) ? `${esc(m.slice(0, -k))}<b>${esc(m.slice(-k))}</b>` : esc(m); };
function paintMain() {
  const el = $("mainc"), m = CFG.main || (DEMO ? coins[0] && coins[0].mint : null), c = m && coins.find((x) => x.mint === m);
  if (!m) { el.hidden = true; return; }
  el.hidden = false;
  const sym = c ? c.symbol : CFG.ticker, prog = c ? (c.graduated ? 100 : c.progress || 0) : 0;
  el.innerHTML = `<span class="mc-k">THE MAIN COIN</span>
    <div class="mc-h">${c ? pic(c) : `<span class="ini">${esc(String(sym).slice(0, 3))}</span>`}<div><b>$${esc(sym)}</b><small>${esc(c ? c.name : CFG.name)}</small></div></div>
    <div class="mc-n"><div><b>${usd(c && c.mcapUsd)}</b><small>Market cap</small></div><div><b>${c && c.priceUsd ? "$" + c.priceUsd.toPrecision(3) : "–"}</b><small>Price</small></div><div><b>${c ? (c.graduated ? "MADE" : prog.toFixed(1) + "%") : "–"}</b><small>${c && c.graduated ? "Graduated" : "Bonding curve"}</small></div></div>
    <div class="bar"><i style="width:${Math.max(2, prog)}%"></i></div>
    <button type="button" class="mc-ca" id="mc-ca" title="Copy the address">${caHtml(m)}<span>COPY</span></button>
    <p class="mc-p">${(CFG.split.buyer / 100)}% of the creator fees of every coin launched on the platform buys $${esc(sym)}. The main coin is the dev's own: its creator fees go 100% to the dev.</p>
    <div class="mc-a"><a class="btn hot" href="https://pump.fun/coin/${esc(m)}" target="_blank" rel="noopener">Buy $${esc(sym)}</a><a class="btn ghost" href="https://dexscreener.com/solana/${esc(m)}" target="_blank" rel="noopener">Chart</a><a class="btn ghost" href="/city?coin=${esc(m)}${DEMO ? "&demo=1" : ""}">City</a></div>`;
  $("mc-ca").onclick = async () => { try { await navigator.clipboard.writeText(m); note("Address copied."); } catch { note(m, 6000); } };
}

// ---------------- the hour
function paintHour() {
  const now = Date.now(); $("h-h").textContent = hh(now).slice(0, 2) + ":00 UTC";
  const st = $("h-s"); st.className = "st";
  const left = slot ? Math.max(0, slot.next - now) : 0, mm = String(Math.floor(left / 60e3)).padStart(2, "0"), ss = String(Math.floor((left % 60e3) / 1000)).padStart(2, "0");
  if (slot) { digits(mm + ss); const rv = $("ringv"); if (rv) rv.style.strokeDashoffset = String(Math.max(0, Math.min(100, (left / 3600e3) * 100))); }
  const [txt, cls] = dropState(slot, CFG); st.textContent = txt; if (cls) st.classList.add(cls);
  poke(slot);
}
const lastDig = {};
function digits(str) { ["d-m1", "d-m2", "d-s1", "d-s2"].forEach((id, i) => { const el = $(id); if (!el || lastDig[id] === str[i]) return; lastDig[id] = str[i]; el.textContent = str[i]; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }); }
let vaultSol = null;
async function readVault() { if (!CFG.vault) return; try { const K = await kit(), c = await conn(); vaultSol = (await c.getBalance(new K.PublicKey(CFG.vault))) / 1e9; paintStats(); } catch {} }
function paintStats() {
  const today = new Date().toISOString().slice(0, 10), t = coins.filter((c) => c.hour && c.hour.startsWith(today)).length;
  const mc = coins.reduce((a, c) => a + (c.mcapUsd || 0), 0), made = coins.filter((c) => c.graduated).length;
  const rows = [["n", coins.length, (v) => String(Math.round(v)), "coins"], ["t", t, (v) => `${Math.round(v)}/24`, "drops today"], ["mc", mc, usd, "total mcap"], ["made", made, (v) => String(Math.round(v)), "graduated"], ...(vaultSol != null ? [["v", vaultSol, (v) => v.toFixed(2) + " SOL", "the vault"]] : [])];
  const el = $("stats");
  if (el.children.length !== rows.length) el.innerHTML = rows.map(([k, , , l]) => `<div><b data-k="${k}">–</b><small>${esc(l)}</small></div>`).join("");
  for (const [k, v, f] of rows) roll(el.querySelector(`[data-k="${k}"]`), v, f);
}

// ---------------- EXPLORE
$("q").oninput = (e) => { S.q = e.target.value.trim().toLowerCase(); paintGrid(); };
for (const [id, k, a] of [["sort", "sort", "s"], ["filt", "filt", "f"]]) $(id).onclick = (e) => { const b = e.target.closest(`[data-${a}]`); if (!b) return; S[k] = b.dataset[a]; $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); paintGrid(); };
function paintGrid() {
  const today = new Date().toISOString().slice(0, 10);
  let list = coins.filter((c) => !S.q || [c.name, c.symbol, c.mint].some((v) => String(v || "").toLowerCase().includes(S.q)));
  if (S.filt === "drops") list = list.filter((c) => c.kind === "drop");
  if (S.filt === "users") list = list.filter((c) => c.kind !== "drop");
  if (S.filt === "curve") list = list.filter((c) => !c.graduated);
  if (S.filt === "made") list = list.filter((c) => c.graduated);
  // quiet coins (a day old, under $5K) wait behind a switch so the streets stay lively
  if (!S.quiet && !S.q) list = list.filter((c) => c.mint === CFG.main || !(c.launchedAt && Date.now() / 1000 - c.launchedAt > 86400 && (c.mcapUsd || 0) < 5000 && !c.graduated));
  list.sort(S.sort === "new" ? (a, b) => (b.launchedAt || 0) - (a.launchedAt || 0) || String(b.hour).localeCompare(String(a.hour)) : S.sort === "curve" ? (a, b) => (b.graduated ? 100 : b.progress || 0) - (a.graduated ? 100 : a.progress || 0) : (a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0));
  $("grid").innerHTML = list.length ? list.map((c, i) => card(c, i)).join("") : `<div class="empty"><b>${coins.length ? "NOTHING MATCHES" : "THE STREETS ARE QUIET"}</b>${coins.length ? "Try another search." : "No coins yet — launch the first, or wait for the agent’s next drop."}</div>`;
}
function card(c, i) {
  const fresh = c.launchedAt && Date.now() / 1000 - c.launchedAt < 3600;
  const st = stars(c), was = tiers.get(c.mint), up = was != null && was !== st && st.indexOf("☆") > was.indexOf("☆"); tiers.set(c.mint, st);
  return `<article class="cc${c.graduated ? " made" : ""}${c.mint === CFG.main ? " main" : ""}" data-m="${esc(c.mint)}" style="--i:${Math.min(i, 16)}"><span class="glare"></span><div class="poster"><span class="tag">${c.mint === CFG.main ? "THE MAIN COIN" : c.kind === "drop" ? "HOURLY DROP" : "WANTED"}</span>${c.graduated ? `<span class="badge">MADE</span>` : fresh ? `<span class="badge new">NEW</span>` : ""}${pic(c)}<span class="bounty">BOUNTY ${usd(c.mcapUsd)}</span></div>
    <div class="body"><h3>${esc(c.name)}</h3><span class="sym">$${esc(c.symbol)}</span>${c.quote ? `<span class="qtag">${esc(c.quote.id)} PAIR</span>` : ""}${gradeChip(c.grade)} <span class="stars${up ? " up" : ""}">${st}</span>
      <div class="row"><b>${usd(c.mcapUsd)}</b><small>${c.hour ? "dropped " + esc(c.hour.slice(5, 10).replace("-", "/")) + " " + esc(c.hour.slice(11, 13)) + ":00" : c.launchedAt ? "launched " + esc(new Date(c.launchedAt * 1000).toISOString().slice(5, 16).replace("-", "/").replace("T", " ")) : ""}</small></div>
      <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small style="color:var(--dim)">${c.graduated ? "graduated to PumpSwap" : `curve ${(c.progress || 0).toFixed(0)}%`}</small>
      <div class="acts"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade</a><a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">City</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a></div></div></article>`;
}

// ---------------- TODAY'S 24
function paintHours() {
  const today = new Date().toISOString().slice(0, 10), byH = new Map(coins.filter((c) => c.hour && c.hour.startsWith(today)).map((c) => [Number(c.hour.slice(11, 13)), c])), nowH = new Date().getUTCHours();
  $("hours").innerHTML = Array.from({ length: 24 }, (_, h) => { const c = byH.get(h); return `<div class="${h === nowH ? "now" : ""} ${c ? "drop" : ""}"><b>${String(h).padStart(2, "0")}:00</b>${c ? `<a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}" style="color:var(--ink)">$${esc(c.symbol)}</a>` : h < nowH ? "—" : h === nowH ? "…" : ""}</div>`; }).join("");
}

// ---------------- LAUNCH
function paintLaunch() {
  $("how-suffix").textContent = CFG.suffix ? `Your browser finds an address that ends in ${CFG.suffix} — every coin here carries it. The key never leaves your browser.` : "Your browser makes the coin's address. The key never leaves it.";
  $("l-hint").textContent = !CFG.open && !DEMO ? CFG.why || "The city opens soon." : "Open now — launch any time, as many coins as you like.";
}

// ---------------- FEES
function paintFees() {
  const s = CFG.split, parts = [[s.creator, "var(--lime)", "The creator", "You — the wallet that launched the coin. Paid out any time from Creators. On the agent’s hourly drops this share goes on to THE VAULT."], [s.vault, "var(--gold)", "THE VAULT", "The city fund: buys back and burns the coins at the top of MOST WANTED.", CFG.vault], [s.buyer, "var(--cyan)", `Buys $${CFG.ticker}`, "A separate wallet that buys the city's main coin.", CFG.buyer]];
  $("splitbar").innerHTML = parts.map(([b, c]) => `<div style="flex:${b};background:${c}">${b / 100}%</div>`).join("");
  $("feecards").innerHTML = parts.map(([b, c, h, p, w]) => `<div><b style="color:${c}">${b / 100}%</b><h3>${esc(h)}</h3><p>${esc(p)}</p>${w ? `<code>${esc(w)}</code>` : h === "THE VAULT" ? "<code>wallet being set up</code>" : ""}</div>`).join("");
}

// ---------------- CREATORS: your drops and their fees
let paintWallet = async () => {};
walletButton($("wallet"), () => { paintMe(); paintVote(CFG); }).then((f) => (paintWallet = f));
$("quiet").onchange = (e) => { S.quiet = e.target.checked; paintGrid(); };
async function paintMe() {
  const W = await sol(), el = $("me");
  if (!W || !W.key) { el.innerHTML = `<div class="me-box"><p style="color:var(--dim);margin:0 0 12px">Connect the wallet you launch from to see your drops and the fees they've earned.</p><button type="button" class="btn hot" id="me-c">Connect wallet</button></div>`; $("me-c").onclick = () => $("wallet").click(); return; }
  const mine = coins.filter((c) => c.creator === W.key);
  const earned = mine.reduce((a, c) => a + (c.feesWaitingSol || 0), 0);
  el.innerHTML = `<div class="me-box"><div class="stats" style="padding:0;max-width:none"><div><b>${mine.length}</b><small>your drops</small></div><div><b>${earned.toFixed(4)} SOL</b><small>fees waiting (all shares)</small></div><div><b>${(CFG.split.creator / 100)}%</b><small>your share</small></div><div><b>OPEN</b><small>launching</small></div></div>
    ${mine.length ? `<div class="my">${mine.map((c) => `<div class="r">${pic(c)}<span><b>$${esc(c.symbol)}</b> ${esc(c.name)}<br><small>${usd(c.mcapUsd)} · ${c.graduated ? "made" : `curve ${(c.progress || 0).toFixed(0)}%`} · ${(c.quote ? c.feesWaiting || 0 : c.feesWaitingSol || 0).toFixed(4)} ${c.quote ? esc(c.quote.id) : "SOL"} waiting</small></span><button type="button" class="btn cy" data-pay="${esc(c.mint)}" ${!c.noSplit && (c.quote ? c.feesWaiting || 0 : c.feesWaitingSol || 0) > 0.0001 ? "" : "disabled"}>Pay out fees</button><a class="btn ghost" href="/city?coin=${esc(c.mint)}" style="text-decoration:none">In the city</a></div>`).join("")}</div>` : `<p style="color:var(--dim)">No coins from this wallet yet. Launch one any time.</p><button type="button" class="btn hot" data-drop2>Drop a coin</button>`}
    <div class="fix"><b>Launched but not in the city?</b> If the page closed or the fee split didn't lock, paste the coin's address — the wallet that launched it finishes the split and lists it.<div class="fix-row"><input id="fix-m" placeholder="Coin address" autocomplete="off"><button type="button" class="btn ghost" id="fix-go">Check & finish</button></div><p class="err" id="fix-err" hidden></p></div>
    <p class="fine">Paying out sends every share at once — ${(CFG.split.creator / 100)}% to you, ${(CFG.split.vault / 100)}% to the vault, ${(CFG.split.buyer / 100)}% to the buyer — straight from pump.fun's fee program. Anyone may press it; the split can't change.</p></div>`;
  el.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = () => payOut(b.dataset.pay, b)));
  const fx = $("fix-go"); if (fx) fx.onclick = async () => {
    const m = String($("fix-m").value || "").trim(), e = $("fix-err"); e.hidden = true; e.innerHTML = "";
    if (!m) return; fx.disabled = true; fx.textContent = "Checking…";
    try { const r = await finishSplit({ mint: m, S: W, CFG }); if (r.listed) { note("Done — it's in the city."); refresh(); } else { e.hidden = false; e.textContent = r.why || "Not listed."; } }
    catch (x) { e.hidden = false; e.textContent = why(x); logsBox(e, x); }
    fx.disabled = false; fx.textContent = "Check & finish";
  };
  const d2 = el.querySelector("[data-drop2]"); if (d2) d2.onclick = drop;
}
async function payOut(mint, btn) {
  const W = await sol(); if (!W || !W.key) return;
  btn.disabled = true; btn.textContent = "Paying…";
  try {
    const K = await kit(), c = await conn(), me = new K.PublicKey(W.key), m = new K.PublicKey(mint), coin = coins.find((x) => x.mint === mint) || {};
    const acc = await c.getAccountInfo(K.feeSharingConfigPda(m)); if (!acc) throw new Error("no fee-sharing config found");
    const bh = await c.getLatestBlockhash("confirmed");
    const tx = await K.distributeTx({ payer: me, mint: m, sharingConfig: K.PUMP_SDK.decodeSharingConfig(acc), graduated: !!coin.graduated, blockhash: bh.blockhash, quote: coin.quote ? { mint: coin.quote.mint, program: coin.quote.program } : null });
    const [signed] = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions([tx]) : [await W.p.signTransaction(tx)];
    const sig = await c.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
    for (let i = 0; i < 20; i++) { await sleep(1500); const st = await c.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null); if (st && st.err) throw new Error("failed on Solana"); if (st && st.confirmationStatus) break; }
    note("Fees paid out."); refresh();
  } catch (e) { const s = String((e && e.message) || e); note(/reject|denied|cancel/i.test(s) ? "Cancelled in your wallet." : s.slice(0, 140), 5000); btn.disabled = false; btn.textContent = "Pay out fees"; }
}
start();

// ---------------- motion: the ticker, reveals, card tilt, the coin's window
function paintTicker() {
  const now = Date.now(), H = new Date().getUTCHours(), latest = coins.slice().sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0)).slice(0, 12);
  const head = `<span><i class="dot"></i><b>HOUR ${String(H).padStart(2, "0")}:00</b> ${dropState(slot, CFG)[0]}</span>`;
  const items = latest.map((c) => `<span><b>$${esc(c.symbol)}</b><i>${usd(c.mcapUsd)}</i>${c.graduated ? "MADE" : `curve ${(c.progress || 0).toFixed(0)}%`}</span>`);
  const one = [head, ...(items.length ? items : ["<span>THE CITY IS WAITING FOR ITS FIRST DROP</span>"]), `<span><b>${CFG.split.creator / 100} / ${CFG.split.vault / 100} / ${CFG.split.buyer / 100}</b> FEES LOCKED ON CHAIN</span>`].join("");
  const el = $("ticker"), html = one + one; if (el.innerHTML !== html) el.innerHTML = html;
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 }) : null;
document.querySelectorAll("[data-rv]").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
$("grid").addEventListener("pointermove", (e) => { if (!fine) return; const c = e.target.closest(".cc"); if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-4px)`; c.style.setProperty("--gx", x * 100 + "%"); c.style.setProperty("--gy", y * 100 + "%"); });
$("grid").addEventListener("pointerout", (e) => { const c = e.target.closest(".cc"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
$("grid").addEventListener("click", (e) => { if (e.target.closest("a")) return; const c = e.target.closest(".cc"); if (c) openCoin(c.dataset.m); });
function openCoin(mint) {
  const c = coins.find((x) => x.mint === mint); if (!c) return;
  const el = $("cmodal"), share = encodeURIComponent(`$${c.symbol} — ${c.kind === "drop" ? `the ${c.hour.slice(11, 13)}:00 drop` : "launched"} in the city. CA ends in ${CFG.suffix || ""}.\n`), link = encodeURIComponent(`${location.origin}/coin/${c.mint}`);
  el.innerHTML = `<div class="cm-card"><button type="button" class="wm-x" aria-label="Close">×</button><div class="poster"><span class="tag">${c.mint === CFG.main ? "THE MAIN COIN" : c.kind === "drop" ? "HOURLY DROP" : "WANTED"}</span>${pic(c)}</div><div class="cm-in">
    <h2>${esc(c.name)}</h2><span class="sym" style="color:var(--hot);font:700 13px var(--mono)">$${esc(c.symbol)}</span>${c.quote ? `<span class="qtag">${esc(c.quote.id)} PAIR</span>` : ""} <span class="stars">${stars(c)}</span>
    <p class="addr">${caHtml(c.mint)}</p>
    <div class="kv"><div><b>${usd(c.mcapUsd)}</b><small>Market cap</small></div><div><b>${c.priceUsd ? "$" + c.priceUsd.toPrecision(3) : "–"}</b><small>Price</small></div><div><b>${c.hour ? c.hour.slice(5, 10).replace("-", "/") + " " + c.hour.slice(11, 13) + ":00" : "–"}</b><small>Dropped (UTC)</small></div><div><b>${c.kind === "drop" ? "AGENT" : c.creator ? `<button type="button" class="creator-link" data-creator="${esc(c.creator)}">${esc(short(c.creator))}</button>` : "–"}</b><small>${c.kind === "drop" ? "The hourly drop" : "Creator"}</small></div></div>
    <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small style="color:var(--dim)">${c.graduated ? "MADE — graduated to PumpSwap" : `bonding curve ${(c.progress || 0).toFixed(1)}%`}</small>
    ${c.raid ? `<div class="raid"><b>🚨 POLICE RAID</b><span>Its creator sold ${Number(c.raid.sol).toFixed(c.raid.sol < 1 ? 3 : 2)} SOL of it ${Math.max(1, Math.round((Date.now() - c.raid.at) / 3600e3))} h ago — seen on chain. The tape comes down after a day without another sale.</span></div>` : ""}
    ${c.description ? `<p style="color:var(--dim)">${esc(c.description)}</p>` : ""}${feeBox(c, CFG)}<div id="cm-x"></div>
    <div class="links" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a><a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">Tower</a><a href="https://x.com/intent/tweet?text=${share}&url=${link}" target="_blank" rel="noopener">Share</a><button type="button" data-copy>Copy CA</button></div>
    ${[c.twitter, c.telegram, c.website].filter(Boolean).length ? `<p style="margin:12px 0 0;font-size:13px">${[["X", c.twitter], ["Telegram", c.telegram], ["Website", c.website]].filter((x) => x[1]).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n} ↗</a>`).join(" · ")}</p>` : ""}</div></div>`;
  el.hidden = false;
  const close = () => { el.hidden = true; document.removeEventListener("keydown", k); }, k = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", k);
  el.onclick = async (e) => { if (e.target === el || e.target.closest(".wm-x")) return close(); const cr = e.target.closest("[data-creator]"); if (cr) return openCreator(cr.dataset.creator, coins, openCoin); if (e.target.closest("[data-copy]")) { try { await navigator.clipboard.writeText(c.mint); note("Address copied"); } catch {} } };
  wireFees(el, c, CFG, refresh);
  if (!DEMO) getJ("?coin=" + encodeURIComponent(c.mint)).then((d) => { const x = $("cm-x"); if (!x || !d || d.error) return; x.innerHTML = gradeBox(d) + (d.trades && d.trades.length ? `<div class="cm-tr">${d.trades.slice(0, 6).map((r) => `<div class="tr ${r.side}"><span class="sd">${r.side.toUpperCase()}</span><span><b>${r.sol.toFixed(3)} SOL</b></span><small>${esc(short(r.who))}</small></div>`).join("")}</div>` : ""); }).catch(() => {});
}
