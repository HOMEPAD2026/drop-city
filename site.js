// site.js — the website: the hour, the numbers, EXPLORE (every drop as a card), the desk (this hour, ranks, the launch,
// FEES, wallets, the CA check, the creators' space, about) and the deep links into it. The drop itself is launch.js.
import { $, esc, short, usd, hh, sleep, note, DEMO, loadCfg, loadCoins, loadSlot, stars, pic, sol, kit, conn, dropState, poke, getJ } from "/common.js";
import { walletButton } from "/wallet.js";
import { openDrop, finishSplit, why, logsBox } from "/launch.js";
import { feeBox, wireFees } from "/fees.js";
import { t, tf, initLang, initSound, tone, roll, paintVote, tickVote, paintLive, paintRanks, initCheck, paintWallets, openCreator, gradeChip, gradeBox, takeoverTick, showDrop, confetti, voteLead, lastTrades } from "/site-x.js";

let CFG = { split: { creator: 6000, vault: 3000, buyer: 1000 } }, coins = [], slot = null;
const S = { q: "", sort: "wanted", filt: "all", quiet: false };
// what the visitor chose; every repaint reads it back (nothing is kept in the DOM that a repaint replaces)
const UI = { all: false, mcOpen: false, cap: 0 };
try { UI.all = sessionStorage.getItem("dc.all") === "1"; } catch {}
const tiers = new Map(); // a coin's wanted stars last time, to flash a new one
const html = document.documentElement;
const phoneQ = matchMedia("(max-width: 760px)"), stripQ = matchMedia("(max-width: 1100px)");
const finePtr = matchMedia("(hover: hover) and (pointer: fine)").matches;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const drop = () => openDrop({ cfg: CFG, onDone: refresh, paintWallet: () => paintWallet() });
document.querySelectorAll("[data-drop]").forEach((b) => (b.onclick = drop));
const links = $("links"), burger = $("burger");
const menu = (open) => { links.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
burger.onclick = () => menu(!links.classList.contains("open"));
// only a link closes the panel: the language select inside it must stay open while it's used
links.addEventListener("click", (e) => { if (e.target.closest("a")) menu(false); });

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
  const title = () => (document.title = `${CFG.name} — ${t("title", "the launchpad you can play")}`);
  // a coin page (/coin/<mint>) keeps the title the server gave it
  if (!window.__COIN) title();
  initLang(() => { if (!window.__COIN) title(); paintAll(); paintFees(); paintVote(CFG).then(paintTicker); paintWallets(CFG); });
  initSound();
  await refresh(); paintFees(); paintMe(); readVault(); setInterval(readVault, 60e3);
  initCheck(CFG, openCoin); paintWallets(CFG); setInterval(() => paintWallets(CFG), 60e3);
  paintVote(CFG).then(paintTicker); setInterval(() => paintVote(CFG), 20e3);
  paintLive(coins, flashTrade).then(paintTicker); setInterval(() => paintLive(coins, flashTrade), DEMO ? 3000 : 8000);
  if (location.hash.length > 1) route(location.hash, false);
  afterIntro(() => { if (location.hash.length > 1 && !touched) route(location.hash, false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (location.hash.length > 1 && !touched && introGone()) route(location.hash, false); });
  if (window.__COIN) setTimeout(() => openCoin(window.__COIN), 300);
  const q = new URLSearchParams(location.search).get("coin"); if (q) setTimeout(() => openCoin(q), 300);
}
setInterval(refresh, 20e3); setInterval(() => { paintHour(); tickVote(); takeoverTick(slot, coins); }, 1000);
/// a trade lands: its card pulses, and the THIS HOUR tab shows a dot while another tab is open
function flashTrade(x) {
  if (html.dataset.tab !== "now") { const d = document.querySelector("#t-now .dk-dot"); if (d) d.hidden = false; }
  const el = document.querySelector(`.cc[data-m="${CSS.escape(x.mint)}"]`); if (!el) return; el.classList.remove("ping"); void el.offsetWidth; el.classList.add("ping");
}
function paintAll() {
  dropsUi();
  paintHour(); paintMain(); paintStats(); paintGrid(); paintHours(); paintLaunch(); paintMe(); paintTicker();
  paintRanks(coins, openCoin, (w) => openCreator(w, coins, openCoin));
  const sl = $("suffixline"); if (CFG.suffix) { sl.hidden = false; sl.innerHTML = `${esc(t("caEnds", "Every coin's CA ends in"))} <b>${esc(CFG.suffix)}</b>`; }
}

// ---------------- THE MAIN COIN (beside the hero): a full card on wide screens, a two-row strip that unfolds below 1100 px
/// the address with its suffix lit
const caHtml = (m) => { const k = (CFG.suffix || "").length; return k && m.endsWith(CFG.suffix) ? `${esc(m.slice(0, -k))}<b>${esc(m.slice(-k))}</b>` : esc(m); };
function paintMain() {
  const el = $("mainc"), m = CFG.main || (DEMO ? coins[0] && coins[0].mint : null), c = m && coins.find((x) => x.mint === m);
  if (!m) { el.hidden = true; return; }
  el.hidden = false;
  const sym = c ? c.symbol : CFG.ticker, prog = c ? (c.graduated ? 100 : c.progress || 0) : 0, city = `/city?coin=${esc(m)}${DEMO ? "&demo=1" : ""}`;
  const buy = `https://pump.fun/coin/${esc(m)}`;
  el.innerHTML = `<span class="mc-k">${esc(t("mcTag", "THE MAIN COIN"))}</span>
    <div class="mc-h">${c ? pic(c) : `<span class="ini">${esc(String(sym).slice(0, 3))}</span>`}<div class="mc-id"><b>$${esc(sym)}</b><small>${esc(c ? c.name : CFG.name)}</small></div>
      <a class="btn hot mc-buy" href="${buy}" target="_blank" rel="noopener">${esc(t("buy", "Buy"))}</a>
      <button type="button" class="mc-more" id="mc-more" aria-controls="mainc" aria-expanded="${UI.mcOpen}" aria-label="${esc(UI.mcOpen ? t("mcLess", "Less") : t("mcMore", "More about the main coin"))}"><i aria-hidden="true"></i></button></div>
    <div class="mc-n"><div><b>${usd(c && c.mcapUsd)}</b><small>${esc(t("lMcap", "Market cap"))}</small></div><div><b>${c && c.priceUsd ? "$" + c.priceUsd.toPrecision(3) : "–"}</b><small>${esc(t("lPrice", "Price"))}</small></div><div><b>${c ? (c.graduated ? esc(t("lMade", "MADE")) : prog.toFixed(1) + "%") : "–"}</b><small>${esc(c && c.graduated ? t("lGrad", "Graduated") : t("lCurve", "Bonding curve"))}</small></div></div>
    <div class="bar mc-bar"><i style="width:${Math.max(2, prog)}%"></i></div>
    <button type="button" class="mc-ca" id="mc-ca" title="${esc(t("copyCa", "Copy the address"))}"><code><span class="ca-h">${esc(m.slice(0, -8))}</span><span class="ca-t">${caHtml(m).slice(esc(m.slice(0, -8)).length)}</span></code><span>${esc(t("copy", "COPY"))}</span></button>
    <p class="mc-p">${esc(tf("mcP1", "{p}% of the creator fees of every coin launched on the platform buys ${sym}.", { p: CFG.split.buyer / 100, sym }))} ${esc(t("mcP2", "The main coin is the dev's own: its creator fees go 100% to the dev."))}</p>
    <div class="mc-a"><a class="btn hot" href="${buy}" target="_blank" rel="noopener">${esc(t("buy", "Buy"))} $${esc(sym)}</a><a class="btn ghost" href="https://dexscreener.com/solana/${esc(m)}" target="_blank" rel="noopener">${esc(t("cChart", "Chart"))}</a><a class="btn ghost" href="${city}">${esc(t("cGame", "Game"))}</a></div>`;
  el.classList.toggle("open", UI.mcOpen);
  $("mc-ca").onclick = async () => { try { await navigator.clipboard.writeText(m); note(t("copied", "Address copied.")); } catch { note(m, 6000); } };
  $("mc-more").onclick = () => { UI.mcOpen = !UI.mcOpen; paintMain(); };
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
/// one quiet line of numbers under the hero's text
/// the hourly drops are off (the owner, 2026-11-24): the countdown, the vote, today's 24 and the drop lines go; the first
/// lane speaks of the supported coins instead, and the desk's first tab is the live trades
function dropsUi() {
  const off = CFG.drops === false; html.classList.toggle("nodrops", off);
  if (!off) return;
  const l1 = document.querySelector(".lane.l1"); if (l1) { l1.setAttribute("href", "#explore"); l1.querySelector(".ln-k").textContent = t("l1kS", "SUPPORTED"); l1.querySelector("b").textContent = t("l1hS", "The city backs these coins"); l1.querySelector("p").textContent = t("l1pS", "Hand-picked coins stand in the city beside everyone's launches — and the city's liquidity will be paired with them."); }
  const tn = document.querySelector("#t-now > span"); if (tn) tn.textContent = t("tLive", "Live");
  const pc = document.querySelector('[data-i18n="pCity"]'); if (pc) pc.textContent = t("pCityS", "Every coin is a tower. Walk the streets, drive the coast, open any tower — and see the city's supported coins standing beside everyone's launches.");
  const a1 = document.querySelector('[data-i18n="a1"]'); if (a1) a1.textContent = t("a1S", "A launchpad that turns pump.fun launches into a city. Anyone can launch their own coins any time, and the city backs a set of supported coins.");
}
function paintStats() {
  const today = new Date().toISOString().slice(0, 10), td = coins.filter((c) => c.hour && c.hour.startsWith(today)).length;
  const mc = coins.reduce((a, c) => a + (c.mcapUsd || 0), 0), made = coins.filter((c) => c.graduated).length;
  const rows = [["n", coins.length, (v) => String(Math.round(v)), t("stCoins", "coins")], ...(CFG.drops === false ? [] : [["t", td, (v) => `${Math.round(v)}/24`, t("stToday", "drops today")]]), ["mc", mc, usd, t("stMcap", "total mcap")], ["made", made, (v) => String(Math.round(v)), t("stMade", "graduated")], ...(vaultSol != null ? [["v", vaultSol, (v) => v.toFixed(2) + " SOL", t("stVault", "the vault")]] : [])];
  const el = $("stats"), sig = rows.map((r) => r[0] + r[3]).join("|");
  if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.innerHTML = rows.map(([k, , , l]) => `<div><b data-k="${k}">–</b><small>${esc(l)}</small></div>`).join(""); }
  for (const [k, v, f] of rows) roll(el.querySelector(`[data-k="${k}"]`), v, f);
  try { paintHud(mc); } catch {}
}
// the HUD over the hero (game-screen look): the city's money (every coin's market cap together, counted like a game's cash)
// and its wanted level — stars for how busy the curves were in the last 10 minutes
function paintHud(mc) {
  let h = document.querySelector(".gm-hud");
  if (!h) { h = document.createElement("div"); h.className = "gm-hud"; h.setAttribute("aria-hidden", "true"); h.innerHTML = `<b class="gm-cash">$0</b><span class="gm-stars">${"<i>★</i>".repeat(5)}</span>`; document.querySelector(".hero").appendChild(h); }
  roll(h.querySelector(".gm-cash"), mc, (v) => "$" + Math.round(v).toLocaleString("en-US"));
  const n = lastTrades(50).filter((x) => Date.now() - (x.at || 0) < 600e3).length, lv = n >= 16 ? 5 : n >= 10 ? 4 : n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
  h.querySelectorAll(".gm-stars i").forEach((i, k) => i.classList.toggle("on", k < lv));
}

// ---------------- EXPLORE
$("q").oninput = (e) => { S.q = e.target.value.trim().toLowerCase(); paintGrid(); };
/// one place sets the sort, so the buttons (wide screens) and the select (phones) never disagree
function setSort(v) { S.sort = v; $("sort").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.s === v)); $("sortsel").value = v; paintGrid(); }
$("sort").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) setSort(b.dataset.s); };
$("sortsel").onchange = (e) => setSort(e.target.value);
$("filt").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; S.filt = b.dataset.f; $("filt").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); paintGrid(); };
$("quiet").onchange = (e) => { S.quiet = e.target.checked; $("qnote").hidden = !S.quiet; paintGrid(); };
$("gmore").onclick = () => {
  UI.all = !UI.all; try { sessionStorage.setItem("dc.all", UI.all ? "1" : "0"); } catch {}
  paintGrid();
  if (!UI.all) { const ex = $("explore"); if (ex.getBoundingClientRect().top < 0) jump(ex, false); } // folding up shouldn't leave the visitor in the footer
};
/// how many cards show before "Show all": two rows, three on a two-column phone grid
function capNow() { const cols = getComputedStyle($("grid")).gridTemplateColumns.split(" ").filter(Boolean).length || 2; return cols * (cols <= 2 ? 3 : 2); }
function paintGrid() {
  let list = coins.filter((c) => !S.q || [c.name, c.symbol, c.mint].some((v) => String(v || "").toLowerCase().includes(S.q)));
  if (S.filt === "drops") list = list.filter((c) => c.kind === "drop");
  if (S.filt === "users") list = list.filter((c) => c.kind !== "drop");
  if (S.filt === "curve") list = list.filter((c) => !c.graduated);
  if (S.filt === "made") list = list.filter((c) => c.graduated);
  // quiet coins (a day old, under $5K) wait behind a switch so the streets stay lively
  // (only once the city is busy: with fewer than 12 lively coins every coin shows — a young city never looks empty)
  const quietOf = (c) => c.mint !== CFG.main && c.launchedAt && Date.now() / 1000 - c.launchedAt > 86400 && (c.mcapUsd || 0) < 5000 && !c.graduated;
  if (!S.quiet && !S.q) { const loud = list.filter((c) => !quietOf(c)); if (loud.length >= 12) list = loud; }
  const pin = (c) => (c.mint === CFG.main ? 2 : c.kind === "partner" ? 1 : 0);
  const by = S.sort === "new" ? (a, b) => (b.launchedAt || 0) - (a.launchedAt || 0) || String(b.hour).localeCompare(String(a.hour)) : S.sort === "curve" ? (a, b) => (b.graduated ? 100 : b.progress || 0) - (a.graduated ? 100 : a.progress || 0) : (a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0);
  list.sort((a, b) => (S.sort === "wanted" ? pin(b) - pin(a) : 0) || by(a, b));
  UI.cap = capNow();
  // a search, a filter or Quiet means the visitor is looking for something: show every match
  const looking = !!S.q || S.filt !== "all" || S.quiet, cut = !looking && list.length > UI.cap;
  const shown = cut && !UI.all ? list.slice(0, UI.cap) : list;
  $("grid").innerHTML = shown.length ? shown.map((c, i) => card(c, i)).join("") : `<div class="empty"><b>${esc(coins.length ? t("eNoneH", "NOTHING MATCHES") : t("eQuietH", "THE STREETS ARE QUIET"))}</b>${esc(coins.length ? t("eNoneP", "Try another search.") : t("eQuietP", "No coins yet — launch the first, or wait for the agent's next drop."))}</div>`;
  const g = $("gmore"); g.hidden = !cut; g.textContent = UI.all ? t("showLess", "Show fewer") : tf("showAll", "Show all {n} coins", { n: list.length }); g.setAttribute("aria-expanded", String(UI.all));
}
let capT = 0;
addEventListener("resize", () => { clearTimeout(capT); capT = setTimeout(() => { if (capNow() !== UI.cap) paintGrid(); }, 150); });
function card(c, i) {
  const fresh = c.launchedAt && Date.now() / 1000 - c.launchedAt < 3600;
  const st = stars(c), was = tiers.get(c.mint), up = was != null && was !== st && st.indexOf("☆") > was.indexOf("☆"); tiers.set(c.mint, st);
  const when = c.hour ? t("cDropped", "dropped") + " " + esc(c.hour.slice(5, 10).replace("-", "/")) + " " + esc(c.hour.slice(11, 13)) + ":00" : c.launchedAt ? t("cLaunched", "launched") + " " + esc(new Date(c.launchedAt * 1000).toISOString().slice(5, 16).replace("-", "/").replace("T", " ")) : "";
  return `<article class="cc${c.graduated ? " made" : ""}${c.mint === CFG.main ? " main" : ""}${c.kind === "partner" ? " sup" : ""}" data-m="${esc(c.mint)}" style="--i:${Math.min(i, 16)}"><span class="glare"></span><div class="poster"><span class="tag">${esc(c.mint === CFG.main ? t("mcTag", "THE MAIN COIN") : c.kind === "partner" ? t("tagSup", "SUPPORTED") : c.kind === "drop" ? t("tagDrop", "HOURLY DROP") : t("tagUser", "WANTED"))}</span>${c.graduated ? `<span class="badge">${esc(t("lMade", "MADE"))}</span>` : fresh ? `<span class="badge new">${esc(t("bNew", "NEW"))}</span>` : ""}${pic(c)}<span class="bounty">${esc(t("bounty", "BOUNTY"))} ${usd(c.mcapUsd)}</span></div>
    <div class="body"><h3>${esc(c.name)}</h3><span class="sym">$${esc(c.symbol)}</span>${c.quote ? `<span class="qtag">${esc(c.quote.id)} ${esc(t("pair", "PAIR"))}</span>` : ""}${gradeChip(c.grade)} <span class="stars${up ? " up" : ""}">${st}</span>
      <div class="row"><b>${usd(c.mcapUsd)}</b><small>${when}</small></div>
      <div class="bar"><i style="width:${c.graduated ? 100 : Math.max(2, c.progress || 0)}%"></i></div><small class="cv">${c.graduated ? esc(t("cGradTo", "graduated to PumpSwap")) : `${esc(t("cCurve", "curve"))} ${(c.progress || 0).toFixed(0)}%`}</small>
      ${c.kind === "partner" ? `<p class="supn">🎰 ${esc(t("supNote", "Supported coin · coming to the slot game"))}</p>` : ""}<div class="acts"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">${esc(t("trade", "Trade"))}</a><a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">${esc(t("cGame", "Game"))}</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">${esc(t("cChart", "Chart"))}</a></div></div></article>`;
}

// ---------------- TODAY'S 24 (a swipe row on phones: brought to the current hour on first paint and when the tab opens)
let hoursFirst = true;
function paintHours() {
  const today = new Date().toISOString().slice(0, 10), byH = new Map(coins.filter((c) => c.hour && c.hour.startsWith(today)).map((c) => [Number(c.hour.slice(11, 13)), c])), nowH = new Date().getUTCHours();
  const box = $("hours"), x = box.scrollLeft;
  box.innerHTML = Array.from({ length: 24 }, (_, h) => { const c = byH.get(h); return `<div class="${h === nowH ? "now" : ""} ${c ? "drop" : ""}"${h === nowH ? ' aria-current="time"' : ""}><b>${String(h).padStart(2, "0")}:00</b>${c ? `<a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">$${esc(c.symbol)}</a>` : h < nowH ? "—" : h === nowH ? "…" : ""}</div>`; }).join("");
  box.scrollLeft = x; // a repaint never moves the row
  if (hoursFirst) { hoursFirst = false; hoursToNow(); }
}
function hoursToNow() { const box = $("hours"), n = box.querySelector(".now"); if (!n || box.scrollWidth <= box.clientWidth) return; box.scrollLeft = n.offsetLeft - (box.clientWidth - n.offsetWidth) / 2; }

// ---------------- LAUNCH
function paintLaunch() {
  $("how-suffix").textContent = CFG.suffix ? tf("how1s", "Your browser finds an address that ends in {s} — every coin here carries it. The key never leaves your browser.", { s: CFG.suffix }) : t("how1p", "Your browser makes the coin's address. The key never leaves it.");
  $("l-hint").textContent = !CFG.open && !DEMO ? CFG.why || t("lSoon", "The city opens soon.") : t("lOpen", "Open now — launch any time, as many coins as you like.");
}

// ---------------- FEES (coins launched on the platform; the main coin is the dev's own and keeps 100 %)
function paintFees() {
  const s = CFG.split, parts = [[s.creator, "var(--lime)", t("fCreatorH", "The creator"), t("fCreatorP", "You — the wallet that launched the coin. Paid out any time from Creators. On the agent’s hourly drops this share goes on to THE VAULT.")], [s.vault, "var(--gold)", t("fVaultH", "THE VAULT"), t("fVaultP", "The city fund: buys back and burns the coins at the top of MOST WANTED."), CFG.vault, true], [s.buyer, "var(--cyan)", `${t("fBuyerH", "Buys")} $${CFG.ticker}`, t("fBuyerP", "A separate wallet that buys the city's main coin."), CFG.buyer]];
  $("splitbar").innerHTML = parts.map(([b, c]) => `<div style="flex:${b};background:${c}">${b / 100}%</div>`).join("");
  $("feecards").innerHTML = parts.map(([b, c, h, p, w, vault]) => `<div><b style="color:${c}">${b / 100}%</b><h3>${esc(h)}</h3><p>${esc(p)}</p>${w ? `<code>${esc(w)}</code>` : vault ? `<code>${esc(t("fSetup", "wallet being set up"))}</code>` : ""}</div>`).join("");
}

// ---------------- CREATORS: your drops and their fees
let paintWallet = async () => {};
walletButton($("wallet"), () => { paintMe(); paintVote(CFG); }).then((f) => (paintWallet = f));
async function paintMe() {
  const W = await sol(), el = $("me");
  if (!W || !W.key) { el.innerHTML = `<div class="me-box"><p class="me-p">${esc(t("meConnectP", "Connect the wallet you launch from to see your drops and the fees they've earned."))}</p><button type="button" class="btn hot" id="me-c">${esc(t("connect", "Connect wallet"))}</button></div>`; $("me-c").onclick = () => $("wallet").click(); return; }
  const mine = coins.filter((c) => c.creator === W.key);
  const earned = mine.reduce((a, c) => a + (c.feesWaitingSol || 0), 0);
  const keep = document.activeElement && document.activeElement.id === "fix-m" ? $("fix-m").value : null; // a repaint never eats an address being typed
  el.innerHTML = `<div class="me-box"><div class="me-n"><div><b>${mine.length}</b><small>${esc(t("meDrops", "your drops"))}</small></div><div><b>${earned.toFixed(4)} SOL</b><small>${esc(t("meFees", "fees waiting (all shares)"))}</small></div><div><b>${(CFG.split.creator / 100)}%</b><small>${esc(t("meShare", "your share"))}</small></div><div><b>${esc(t("meOpen", "OPEN"))}</b><small>${esc(t("meLaunching", "launching"))}</small></div></div>
    ${mine.length ? `<div class="my">${mine.map((c) => `<div class="r">${pic(c)}<span><b>$${esc(c.symbol)}</b> ${esc(c.name)}<br><small>${usd(c.mcapUsd)} · ${c.graduated ? "made" : `curve ${(c.progress || 0).toFixed(0)}%`} · ${(c.quote ? c.feesWaiting || 0 : c.feesWaitingSol || 0).toFixed(4)} ${c.quote ? esc(c.quote.id) : "SOL"} waiting</small></span><button type="button" class="btn cy" data-pay="${esc(c.mint)}" ${!c.noSplit && (c.quote ? c.feesWaiting || 0 : c.feesWaitingSol || 0) > 0.0001 ? "" : "disabled"}>${esc(t("payOut", "Pay out fees"))}</button><a class="btn ghost" href="/city?coin=${esc(c.mint)}">${esc(t("inCity", "In the city"))}</a></div>`).join("")}</div>` : `<p class="me-p">${esc(t("meNone", "No coins from this wallet yet. Launch one any time."))}</p><button type="button" class="btn hot" data-drop2>${esc(t("dropCoin", "Drop a coin"))}</button>`}
    <div class="fix"><b>${esc(t("fixH", "Launched but not in the city?"))}</b> ${esc(t("fixP", "If the page closed or the fee split didn't lock, paste the coin's address — the wallet that launched it finishes the split and lists it."))}<div class="fix-row"><input id="fix-m" placeholder="${esc(t("caPh", "Coin address"))}" aria-label="${esc(t("caPh", "Coin address"))}" autocomplete="off"><button type="button" class="btn ghost" id="fix-go">${esc(t("fixGo", "Check & finish"))}</button></div><p class="err" id="fix-err" hidden></p></div>
    <p class="fine">${esc(tf("meFine", "Paying out sends every share at once — {c}% to you, {v}% to the vault, {b}% to the buyer — straight from pump.fun's fee program. Anyone may press it; the split can't change.", { c: CFG.split.creator / 100, v: CFG.split.vault / 100, b: CFG.split.buyer / 100 }))}</p></div>`;
  if (keep != null) { const i = $("fix-m"); i.value = keep; i.focus(); }
  el.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = () => payOut(b.dataset.pay, b)));
  const fx = $("fix-go"); if (fx) fx.onclick = async () => {
    const m = String($("fix-m").value || "").trim(), e = $("fix-err"); e.hidden = true; e.innerHTML = "";
    if (!m) return; fx.disabled = true; fx.textContent = t("checking", "Checking…");
    try { const r = await finishSplit({ mint: m, S: W, CFG }); if (r.listed) { note("Done — it's in the city."); refresh(); } else { e.hidden = false; e.textContent = r.why || "Not listed."; } }
    catch (x) { e.hidden = false; e.textContent = why(x); logsBox(e, x); }
    fx.disabled = false; fx.textContent = t("fixGo", "Check & finish");
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
  } catch (e) { const s = String((e && e.message) || e); note(/reject|denied|cancel/i.test(s) ? "Cancelled in your wallet." : s.slice(0, 140), 5000); btn.disabled = false; btn.textContent = t("payOut", "Pay out fees"); }
}

// ---------------- THIS HOUR's extras: more trades, the phone leaderboard switch
$("live-more").onclick = () => { const b = $("livebox"), on = !b.classList.contains("all"); b.classList.toggle("all", on); const m = $("live-more"); m.dataset.i18n = on ? "liveLess" : "liveMore"; m.textContent = on ? t("liveLess", "Fewer") : t("liveMore", "More trades"); m.setAttribute("aria-expanded", String(on)); };
$("rseg").onclick = (e) => { const b = e.target.closest("[data-b]"); if (!b) return; $("ranksbox").dataset.b = b.dataset.b; $("rseg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); };

// ---------------- the desk: eight tabs (links, so they work before and without this script)
const TABS = ["now", "cards", "ranks", "launch", "fees", "lp", "wallets", "check", "mine", "about"];
const HASH_TAB = { vote: "now", live: "now", today: "now", ranks: "ranks", launch: "launch", fees: "fees", lp: "lp", cards: "cards", wallets: "wallets", check: "check", creators: "mine", about: "about" };
const tabEl = (k) => $("t-" + k);
function setTab(k) {
  if (!TABS.includes(k)) k = "now";
  html.dataset.tab = k; try { sessionStorage.setItem("dc.tab", k); } catch {}
  for (const x of TABS) { const a = tabEl(x); a.setAttribute("aria-selected", String(x === k)); a.tabIndex = x === k ? 0 : -1; }
  if (k === "now") { const d = document.querySelector("#t-now .dk-dot"); if (d) d.hidden = true; hoursToNow(); }
  if (k === "cards") import("/cards.js").then((m) => m.paintCards($("cardsbox"), { CFG })).catch(() => {});
  if (k === "lp" && coins.length) import("/lp-ui.js").then((m) => m.paintLp($("lpbox"), { coins, CFG })).catch(() => {});
  highlight();
}
setTab(html.dataset.tab);
$("dk-tabs").addEventListener("click", (e) => {
  const a = e.target.closest("[role=tab]"); if (!a) return;
  e.preventDefault(); e.stopPropagation(); // the delegated anchor handler below would scroll
  setTab(a.id.slice(2)); history.replaceState(null, "", a.getAttribute("href"));
});
$("dk-tabs").addEventListener("keydown", (e) => {
  const i = TABS.indexOf(html.dataset.tab), n = TABS.length;
  const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
  if (j < 0) return; e.preventDefault();
  const a = tabEl(TABS[j]); setTab(TABS[j]); history.replaceState(null, "", a.getAttribute("href")); a.focus();
});

// ---------------- deep links: every old hash still lands on its content
const stickyTop = () => { const nav = $("nav"), tk = document.querySelector(".ticker"); return nav.offsetHeight + (tk && getComputedStyle(tk).position === "sticky" ? tk.offsetHeight : 0); };
function jump(el, smooth) {
  if (!el) return;
  let y = -stickyTop() - 10; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; // layout position: a reveal's slide-in transform doesn't count
  if (smooth && !calm) { scrollTo({ top: y, behavior: "smooth" }); return; }
  html.style.scrollBehavior = "auto"; scrollTo(0, y); html.style.scrollBehavior = "";
}
/// what a hash opens and where it scrolls (the table in the build spec)
/// the page a hash belongs to: the site is a set of pages now (the owner, 2026-11-20 — the bottom bar switches pages
/// instead of scrolling): home (the hero + the city band), explore, desk (the tabs)
const pageOf = (k) => (k === "explore" ? "explore" : HASH_TAB[k] || k === "desk" ? "desk" : "home");
const PAGE_TOP = new Set(["home", "explore", "desk", "vote", "ranks", "launch", "fees", "lp", "cards", "wallets", "check", "creators", "about"]);
function setPage(pg) { if (html.dataset.page === pg) return false; html.dataset.page = pg; html.style.scrollBehavior = "auto"; scrollTo(0, 0); html.style.scrollBehavior = ""; pin = null; return true; }
function route(hash, smooth) {
  const k = String(hash || "").replace(/^#/, ""); if (!k) return;
  const tab = HASH_TAB[k];
  if (tab) setTab(tab);
  const moved = setPage(pageOf(k));
  if (PAGE_TOP.has(k)) { if (!moved) scrollTo({ top: 0, behavior: smooth && !calm ? "smooth" : "auto" }); highlight(); return; }
  let target = $(k);
  if (tab || k === "desk") target = k === "today" || k === "live" ? $(k) : $("dk-tabs");
  if (k === "main-coin") { target = $("mainc").hidden ? $("hour") : $("mainc"); if (stripQ.matches && !UI.mcOpen) { UI.mcOpen = true; paintMain(); } }
  if (!target) return;
  const rv = target.closest("[data-rv]"); if (rv) rv.classList.add("in"); // a deep link lands on it shown, not still sliding in
  jump(target, smooth);
  // while the page above it is still settling (pictures, fonts, the coins arriving), keep the target where it landed
  if (!smooth) pin = { el: target, until: performance.now() + 3000 };
  if (k === "check" && finePtr) $("ck-m").focus({ preventScroll: true });
  highlight();
}
// one delegated click for every in-page link (nav, burger, lanes, hero, footer, bottom bar, the Fees panel's link)
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"]'); if (!a || a.closest(".cmodal, .sheet")) return;
  const h = a.getAttribute("href"); if (h.length < 2) return;
  e.preventDefault();
  if (location.hash === h) history.replaceState(null, "", h); else history.pushState(null, "", h);
  route(h, true);
});
// Back / Forward: the browser restores the old scroll position itself; we only put the right tab back
let popped = false;
addEventListener("popstate", () => { popped = true; const h = location.hash.slice(1), k = HASH_TAB[h]; if (k) setTab(k); setPage(pageOf(h)); highlight(); setTimeout(() => (popped = false), 0); });
addEventListener("hashchange", () => { if (popped) return; route(location.hash, false); });
// did the visitor scroll by hand? then a late re-run of the router must not yank them back
var touched = false, pin = null; // var: route() can run before this line
if ("ResizeObserver" in window) new ResizeObserver(() => { if (pin && !touched && performance.now() < pin.until) jump(pin.el, false); else pin = null; }).observe(document.body);
for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, () => (touched = true), { passive: true, once: true });
const introGone = () => window.__introDone || !$("intro");
const afterIntro = (fn) => (introGone() ? fn({ detail: {} }) : addEventListener("intro:done", fn, { once: true }));

// ---------------- highlighting: the nav link and bottom-bar entry for what's in the middle of the screen
var inView = null; // var: setTab() runs (and reads it) before this line
var NAV_FOR = { now: "#vote", launch: "#launch", fees: "#fees", lp: "#lp", cards: "#cards", check: "#check", ranks: "#ranks", wallets: "#wallets", mine: "#creators", about: "#about" };
function highlight() {
  const tab = html.dataset.tab;
  const pg = html.dataset.page || "home";
  const deskLink = tab === "cards" ? "#cards" : tab === "lp" ? "#lp" : tab === "launch" ? "#launch" : "#desk"; // NAV_FOR (further down) is the old map, unused now
  const nav = pg === "explore" ? "#explore" : pg === "desk" ? deskLink : null;
  const bar = pg === "desk" ? deskLink : null;
  links.querySelectorAll("a").forEach((a) => { const on = a.getAttribute("href") === nav; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); });
  document.querySelectorAll(".bbar a").forEach((a) => { const on = a.getAttribute("href") === bar; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); });
}
if ("IntersectionObserver" in window) {
  const hio = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { inView = e.target.id || "hero"; highlight(); } }, { rootMargin: "-45% 0px -50% 0px" });
  [document.querySelector(".hero"), $("explore"), $("play"), $("desk")].forEach((el) => el && hio.observe(el));
}

// ---------------- the sunset over the hero: /coast.js is optional — without it the CSS gradient behind it stays
const HERO_PIN = null; // a number 0..1 pins the sky to one moment
function hourState() { // the sun is the hour's clock: high and golden at :00, half set by :59, gone in the last minute
  if (HERO_PIN != null) return { sun: 0.1 + 0.52 * HERO_PIN, night: 0.15 + 0.55 * HERO_PIN };
  const f = (Date.now() % 3600e3) / 3600e3, last = f > 59 / 60, k = last ? (f - 59 / 60) * 60 : (f * 60) / 59;
  return last ? { sun: 0.62 + 0.38 * k, night: 0.7 + 0.3 * k } : { sun: 0.1 + 0.52 * k, night: 0.15 + 0.55 * k };
}
async function mountCoast() {
  const cv = $("coast"), hero = document.querySelector(".hero");
  let mod; try { mod = await import("/coast.js"); } catch { return; } // missing or broken: the gradient stands in
  if (!mod || typeof mod.makeCoast !== "function") return;
  const save = (navigator.connection && navigator.connection.saveData) || false, still = calm || save, phone = phoneQ.matches;
  let coast;
  try { coast = mod.makeCoast(cv, { layout: "hero", fps: 12, horizon: phone ? 0.7 : 0.78, sunX: phone ? 0.72 : 0.6, palms: phone ? 1 : 2, birds: false, seed: 7 }); } catch { return; }
  const safe = (f) => { try { return f(); } catch {} };
  hero.classList.add("has-coast");
  let visible = true, running = false, lastHour = Math.floor(Date.now() / 3600e3);
  const run = (on) => { if (still) return; if (on && !running && visible) { running = true; safe(() => coast.start()); } else if (!on && running) { running = false; safe(() => coast.stop()); } };
  const go = (played) => {
    hero.classList.add("go");
    if (still) { safe(() => coast.set(hourState())); return; }
    if (played) safe(() => coast.set({ ...hourState(), sun: 1 })); else safe(() => coast.set(hourState()));
    run(true);
    if (played) safe(() => coast.drop(hourState()));
  };
  if (introGone()) go(false);
  else { safe(() => coast.set({ sun: 1, night: 1 })); afterIntro((e) => go(!!(e && e.detail && e.detail.played))); }
  // the sky keeps time: every 10 s, every second in the last minute; a new sun drops in at the top of the hour
  let lastSet = 0;
  setInterval(() => {
    if (!hero.classList.contains("go")) return;
    const now = Date.now(), h = Math.floor(now / 3600e3), lastMin = now % 3600e3 > 3540e3;
    if (h !== lastHour) { lastHour = h; if (!still) safe(() => coast.drop(hourState())); else safe(() => coast.set(hourState())); lastSet = now; return; }
    if (now - lastSet >= (still ? 60e3 : lastMin ? 1e3 : 10e3)) { lastSet = now; safe(() => coast.set(hourState())); }
  }, 1000);
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(visible && hero.classList.contains("go")); }).observe(hero);
  document.addEventListener("visibilitychange", () => run(!document.hidden && visible && hero.classList.contains("go")));
  let rt = 0, lastW = cv.clientWidth, lastH = cv.clientHeight;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (cv.clientWidth === lastW && cv.clientHeight === lastH) return; lastW = cv.clientWidth; lastH = cv.clientHeight; safe(() => coast.resize()); if (still) safe(() => coast.set(hourState())); }, 150); });
}
// the H1 slams in once the page is in view (after the intro, or at once), with or without the scene
afterIntro(() => document.querySelector(".hero").classList.add("go"));
mountCoast();
// the slot game in the top bar: coming soon (the owner, 2026-11-20 — built later)
$("slotbtn").onclick = () => {
  let m = document.querySelector(".soon-card"); if (m) return m.remove();
  m = document.createElement("div"); m.className = "soon-card"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", t("slotT", "GAME"));
  m.innerHTML = `<div class="sc-in"><div class="sc-ic">${$("slotbtn").querySelector("svg").outerHTML}</div><b>${esc(t("slotH", "SLOTS — COMING SOON"))}</b><p>${esc(t("slotP", "A slot mini-game is on the way — with the city's coins on the reels, starting with $DCTY."))}</p><button type="button" class="btn hot">${esc(t("ok", "OK"))}</button></div>`;
  m.onclick = (e) => { if (e.target === m || e.target.closest("button")) m.remove(); };
  document.body.appendChild(m); tone("tick");
};
{ const dim = () => document.documentElement.style.setProperty("--gm-dim", Math.min(1, scrollY / 520).toFixed(3)); addEventListener("scroll", dim, { passive: true }); dim(); }

start();

// ---------------- motion: the ticker, reveals, card tilt, the coin's window
function paintTicker() {
  const H = new Date().getUTCHours(), latest = coins.slice().sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0)).slice(0, 12);
  const head = CFG.drops === false ? "" : `<span><i class="dot"></i><b>${esc(t("tkHour", "HOUR"))} ${String(H).padStart(2, "0")}:00</b> ${esc(dropState(slot, CFG)[0])}</span>`;
  const lead = CFG.drops === false ? null : voteLead(), lv = lead ? [`<span class="tk-v">${esc(t("tkLead", "VOTE LEADS"))} <b>$${esc(lead.symbol)}</b> · ${lead.votes} ${esc(t("votes", "votes"))}</span>`] : [];
  const trs = lastTrades(3).map((x) => `<span class="tk-t ${x.side === "buy" ? "up" : ""}">${esc(x.side === "buy" ? t("tkBuy", "BUY") : t("tkSell", "SELL"))} <b>$${esc(x.symbol)}</b><i>${Number(x.sol).toFixed(2)} SOL</i></span>`);
  const items = latest.map((c) => `<span><b>$${esc(c.symbol)}</b><i>${usd(c.mcapUsd)}</i>${c.graduated ? esc(t("lMade", "MADE")) : `${esc(t("cCurve", "curve"))} ${(c.progress || 0).toFixed(0)}%`}</span>`);
  const one = [head, ...lv, ...trs, ...(items.length ? items : [`<span>${esc(t("tkWaiting", "THE CITY IS WAITING FOR ITS FIRST DROP"))}</span>`]), `<span><b>${CFG.split.creator / 100} / ${CFG.split.vault / 100} / ${CFG.split.buyer / 100}</b> ${esc(t("tkFees", "FEES LOCKED ON CHAIN"))}</span>`].join("");
  const el = $("ticker"), h = one + one; if (el.innerHTML !== h) el.innerHTML = h;
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.05 }) : null;
document.querySelectorAll("[data-rv]").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
const tilt = finePtr && !calm;
$("grid").addEventListener("pointermove", (e) => { if (!tilt) return; const c = e.target.closest(".cc"); if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-4px)`; c.style.setProperty("--gx", x * 100 + "%"); c.style.setProperty("--gy", y * 100 + "%"); });
$("grid").addEventListener("pointerout", (e) => { const c = e.target.closest(".cc"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
$("grid").addEventListener("click", (e) => { if (e.target.closest("a")) return; const c = e.target.closest(".cc"); if (c) openCoin(c.dataset.m); });
// a nav at a different height (bigger text, a wrap) moves the sticky ticker with it
const navH = () => html.style.setProperty("--navh", $("nav").offsetHeight + "px");
navH(); addEventListener("resize", navH); if (document.fonts && document.fonts.ready) document.fonts.ready.then(navH);
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
    <div class="links" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px"><a class="pri" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">Trade</a><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noopener">Chart</a><a href="/city?coin=${esc(c.mint)}${DEMO ? "&demo=1" : ""}">Tower</a><a href="https://x.com/intent/tweet?text=${share}&url=${link}" target="_blank" rel="noopener">Share</a><button type="button" data-copy>Copy CA</button><button type="button" data-mug>📸 Mugshot</button></div>
    ${[c.twitter, c.telegram, c.website].filter(Boolean).length ? `<p style="margin:12px 0 0;font-size:13px">${[["X", c.twitter], ["Telegram", c.telegram], ["Website", c.website]].filter((x) => x[1]).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n} ↗</a>`).join(" · ")}</p>` : ""}</div></div>`;
  el.hidden = false;
  const close = () => { el.hidden = true; document.removeEventListener("keydown", k); }, k = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", k);
  el.onclick = async (e) => { if (e.target === el || e.target.closest(".wm-x")) return close(); const cr = e.target.closest("[data-creator]"); if (cr) return openCreator(cr.dataset.creator, coins, openCoin); if (e.target.closest("[data-copy]")) { try { await navigator.clipboard.writeText(c.mint); note("Address copied"); } catch {} }
    const mg = e.target.closest("[data-mug]"); if (mg) { mg.disabled = true; try { const r = await (await import("/mugshot.js")).shareMugshot(c, CFG); if (r === "downloaded") note("Mugshot saved."); } catch { note("Couldn't make the mugshot."); } mg.disabled = false; } };
  wireFees(el, c, CFG, refresh);
  if (!DEMO) getJ("?coin=" + encodeURIComponent(c.mint)).then((d) => { const x = $("cm-x"); if (!x || !d || d.error) return; x.innerHTML = gradeBox(d) + (d.trades && d.trades.length ? `<div class="cm-tr">${d.trades.slice(0, 6).map((r) => `<div class="tr ${r.side}"><span class="sd">${r.side.toUpperCase()}</span><span><b>${r.sol.toFixed(3)} SOL</b></span><small>${esc(short(r.who))}</small></div>`).join("")}</div>` : ""); }).catch(() => {});
}
