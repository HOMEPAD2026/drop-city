// site-x.js — the website's extras: languages, sound, the vote on the next drop, the live trades, leaderboards, the CA
// check, the wallets out in the open, the creator window, the top-of-the-hour takeover, numbers that roll.
import { $, esc, short, usd, note, DEMO, getJ, post, sol, kit, conn, rpc1, b58, pic } from "/common.js";
import { openWallet } from "/wallet.js";

// ---------------- languages (the static page: data-i18n keys; the code: t(key, fallback) — the dictionary is /i18n.js)
import { t, tf, lang, setLang } from "/i18n.js";
export { t, tf };
// the English of each key is read from the page once (the first time it's seen), so switching back to English works
const EN = {}, LANG_SELS = ["lang", "lang2", "lang3"];
const ATTR = [["i18n", null], ["i18nPh", "placeholder"], ["i18nAl", "aria-label"], ["i18nTt", "title"]];
function applyLang() {
  const LANG = lang(); document.documentElement.lang = LANG;
  for (const [ds, attr] of ATTR) {
    const sel = "[data-" + ds.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + "]";
    document.querySelectorAll(sel).forEach((el) => {
      const k = el.dataset[ds], id = ds + ":" + k;
      if (!(id in EN)) EN[id] = attr ? el.getAttribute(attr) || "" : el.textContent;
      const v = t(k, EN[id]); if (attr) el.setAttribute(attr, v); else el.textContent = v;
    });
  }
  for (const id of LANG_SELS) { const s = $(id); if (s) s.value = LANG; }
}
export function initLang(onChange) {
  applyLang();
  for (const id of LANG_SELS) { const sel = $(id); if (sel) sel.onchange = () => { setLang(sel.value); applyLang(); onChange && onChange(); }; }
}

// ---------------- sound (off until asked; Web Audio, no files)
let AC = null, SND = false;
try { SND = localStorage.getItem("dc.snd") === "1"; } catch {}
const ac = () => (AC = AC || new (window.AudioContext || window.webkitAudioContext)());
export function tone(kind) {
  if (!SND) return;
  try {
    const a = ac(), t0 = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination);
    const P = { buy: [880, 1320, 0.08, "triangle", 0.12], sell: [440, 330, 0.08, "sine", 0.08], siren: [600, 1200, 0.45, "sawtooth", 0.06], drop: [220, 880, 0.6, "square", 0.08], tick: [1200, 1200, 0.03, "sine", 0.05], win: [660, 1760, 0.4, "triangle", 0.12] }[kind] || [600, 600, 0.05, "sine", 0.05];
    o.type = P[3]; o.frequency.setValueAtTime(P[0], t0); o.frequency.exponentialRampToValueAtTime(P[1], t0 + P[2]);
    g.gain.setValueAtTime(P[4], t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + P[2] + 0.12); o.start(t0); o.stop(t0 + P[2] + 0.15);
  } catch {}
}
export function initSound() {
  const b = $("snd"); if (!b) return; b.classList.toggle("on", SND);
  b.onclick = () => { SND = !SND; try { localStorage.setItem("dc.snd", SND ? "1" : "0"); } catch {} b.classList.toggle("on", SND); if (SND) { ac().resume && ac().resume(); tone("win"); } };
}

// ---------------- numbers that roll
const shown = new WeakMap();
export function roll(el, to, fmt) {
  const from = shown.has(el) ? shown.get(el) : 0; shown.set(el, to);
  // no counting up (the owner, 2026-11-25: the numbers rolling from 0 on every visit looked like the page reloading its data)
  if (true || matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 900;
  const step = (n) => { const k = Math.min(1, (n - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ---------------- the vote on the next drop
let V = null;
export async function paintVote(CFG) {
  const el = $("votebox"); if (!el) return;
  const W = await sol(), wallet = W && W.key ? W.key : "";
  if (DEMO) V = V || { hour: new Date(Date.now() + 3600e3).toISOString().slice(0, 13), closes: Math.ceil(Date.now() / 3600e3) * 3600e3, ideas: [{ name: "Neon Croc", symbol: "CROC", description: "Last seen speeding past the harbour lights." }, { name: "Rooftop Moth", symbol: "MOTH", description: "Cracked the rooftop vault at 3 a.m." }, { name: "Jackpot Gull", symbol: "JGULL", description: "Every crew in the city wants it." }], votes: [12, 31, 7], mine: null };
  else { try { V = await getJ("?vote=1&wallet=" + encodeURIComponent(wallet)); } catch { if (!V) { el.innerHTML = ""; return; } } }
  const tot = V.votes.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...V.votes);
  el.innerHTML = `<div class="vote-h"><span>${t("next", "The next drop")}: <b>${esc(V.hour.slice(11, 13))}:00 UTC</b></span><span>${t("closes", "Voting closes")} <b id="vclose">--:--</b></span></div>` +
    V.ideas.map((x, i) => `<div class="vc${V.mine === i ? " mine" : ""}"><span class="vk">#${i + 1}${V.votes[i] === mx && mx > 0 ? " · LEADING" : ""}</span><h3>${esc(x.name)}</h3><span class="sym">$${esc(x.symbol)}</span><p>${esc(x.description)}</p>
      <div class="vbar"><i style="width:${(V.votes[i] / tot) * 100}%"></i></div><span class="vn">${V.votes[i]} ${t("votes", "votes")}</span>
      <button type="button" class="btn ${V.mine === i ? "hot" : "ghost"}" data-vote="${i}" ${V.mine != null ? "disabled" : ""}>${V.mine === i ? t("voted", "Voted") : t("vote", "Vote")}</button></div>`).join("");
  el.querySelectorAll("[data-vote]").forEach((b) => (b.onclick = () => castVote(Number(b.dataset.vote), CFG)));
}
async function castVote(pick, CFG) {
  if (DEMO) { V.votes[pick]++; V.mine = pick; tone("win"); return paintVote(CFG); }
  const S = await sol(); if (!S) return note("No Solana wallet found — open this page in Phantom or Solflare.");
  if (!S.key) { await openWallet(); if (!S.key) return; }
  try {
    const issued = new Date().toISOString(), msg = `Vote for the next drop\nWallet: ${S.key}\nHour (UTC): ${V.hour}\nPick: ${pick}\nIssued: ${issued}`;
    const sig = await S.signMessage(new TextEncoder().encode(msg));
    const r = await post({ action: "vote", wallet: S.key, hour: V.hour, pick, issued, sig: b58(sig) });
    if (!r.ok) note(r.j.error || "The vote didn't count.", 4000); else { tone("win"); note("Vote counted."); }
  } catch (e) { note(/reject|denied|cancel/i.test(String(e && e.message)) ? "Cancelled in your wallet." : String((e && e.message) || e).slice(0, 120), 4000); }
  paintVote(CFG);
}
/// the idea leading the vote, for the ticker: { symbol, votes } or null when nobody has voted yet
export function voteLead() { if (!V || !V.votes || !V.ideas) return null; const mx = Math.max(0, ...V.votes); if (!mx) return null; const i = V.votes.indexOf(mx); return V.ideas[i] ? { symbol: V.ideas[i].symbol, votes: mx } : null; }
export function tickVote() { const el = $("vclose"); if (!el || !V) return; const l = Math.max(0, V.closes - Date.now()); el.textContent = `${String(Math.floor(l / 60e3)).padStart(2, "0")}:${String(Math.floor((l % 60e3) / 1000)).padStart(2, "0")}`; }

// ---------------- live trades
const seenTr = new Set(); let firstTr = true, lastItems = [];
/// the newest n trades the feed has seen (for the ticker)
export const lastTrades = (n = 3) => lastItems.slice(0, n);
export async function paintLive(coins, onTrade) {
  const el = $("livebox"); if (!el) return;
  let items = [];
  if (DEMO) { const c = coins[Math.floor(Math.random() * coins.length)]; if (c) items = [{ sig: "d" + Date.now(), at: Date.now(), mint: c.mint, symbol: c.symbol, side: Math.random() < 0.7 ? "buy" : "sell", sol: +(Math.random() * 3).toFixed(3), usd: null, who: "Demo1111" }]; items = [...items, ...[...(paintLive.d || [])]].slice(0, 30); paintLive.d = items; }
  else { try { items = (await getJ("?trades=1")).items || []; } catch { return; } }
  lastItems = items;
  const fresh = items.filter((x) => !seenTr.has(x.sig)); fresh.forEach((x) => seenTr.add(x.sig));
  if (!firstTr) fresh.slice(0, 4).forEach((x) => { tone(x.side === "buy" ? "buy" : "sell"); onTrade && onTrade(x); });
  const isNew = new Set(firstTr ? [] : fresh.map((x) => x.sig));
  firstTr = false;
  el.innerHTML = items.length ? items.slice(0, 18).map((x) => `<div class="tr ${x.side}${x.sol >= 1 ? " big" : ""}${isNew.has(x.sig) ? " new" : ""}" data-m="${esc(x.mint)}"><span class="sd">${x.side.toUpperCase()}</span><span><b>$${esc(x.symbol)}</b> <small>${x.sol.toFixed(3)} SOL${x.usd ? " · $" + x.usd.toFixed(0) : ""}</small></span><small class="who">${esc(short(x.who))}</small><small>${ago(x.at)}</small></div>`).join("") : `<div class="live-empty">${t("noTrades", "No trades yet — the first one shows up here.")}</div>`;
}
const ago = (ms) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m" : Math.floor(s / 3600) + "h"; };

// ---------------- leaderboards
export function paintRanks(coins, openCoin, openCreator) {
  const el = $("ranksbox"); if (!el) return;
  const wanted = coins.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 7);
  const by = new Map(); for (const c of coins) { if (c.kind === "drop" || c.kind === "partner") continue; const k = c.creator; const v = by.get(k) || { w: k, n: 0, mc: 0, made: 0, top: c }; v.n++; v.mc += c.mcapUsd || 0; v.made += c.graduated ? 1 : 0; if ((c.mcapUsd || 0) > (v.top.mcapUsd || 0)) v.top = c; by.set(k, v); }
  const creators = [...by.values()].sort((a, b) => b.mc - a.mc).slice(0, 7), made = coins.filter((c) => c.graduated && c.kind !== "partner").slice(0, 7);
  const li = (c, i, right) => `<li data-m="${esc(c.mint)}"><span class="n">${i + 1}</span>${pic(c)}<span><b>$${esc(c.symbol)}</b></span><small>${right}</small></li>`;
  el.innerHTML = `<div class="rk-col"><h3>${t("rWanted", "MOST WANTED")}</h3><ol>${wanted.map((c, i) => li(c, i, usd(c.mcapUsd))).join("") || `<li>${t("rNone", "none yet")}</li>`}</ol></div>
    <div class="rk-col"><h3>${t("rCreators", "TOP CREATORS")}</h3><ol>${creators.map((v, i) => `<li data-w="${esc(v.w)}"><span class="n">${i + 1}</span>${pic(v.top)}<span><b>${esc(short(v.w))}</b><br><small>${v.n} coins${v.made ? " · " + v.made + " made" : ""}</small></span><small>${usd(v.mc)}</small></li>`).join("") || `<li>${t("rNone", "none yet")}</li>`}</ol></div>
    <div class="rk-col"><h3>${t("rMade", "HALL OF FAME")}</h3><ol>${made.map((c, i) => li(c, i, usd(c.mcapUsd))).join("") || `<li>${t("rNone", "none yet")}</li>`}</ol></div>`;
  el.querySelectorAll("[data-m]").forEach((x) => (x.onclick = () => openCoin(x.dataset.m)));
  el.querySelectorAll("[data-w]").forEach((x) => (x.onclick = () => openCreator(x.dataset.w)));
}

// ---------------- the CA check
export const gradeChip = (g) => (g ? `<span class="grade g${esc(g)}" title="Safety grade (what the chain shows, not a promise)">${esc(g)}</span>` : "");
export function gradeBox(d) {
  if (!d || !d.grade) return "";
  if (d.partial) return `<div class="cm-grade"><span class="big grade">…</span><span><b>${esc(t("gbPartH", "Safety check — partial"))}</b><small>${esc(t("gbPartP", "The holders couldn't be read just now; the grade shows once they are."))}</small></span></div>`;
  return `<div class="cm-grade"><span class="big grade g${esc(d.grade)}">${esc(d.grade)}</span><span><b>${esc(t("gbSafety", "Safety"))} ${d.score}/100</b><small>${esc(t("gbNote", "What the chain shows right now — not a promise."))}</small></span></div>
    <div class="parts" style="display:grid;gap:5px">${d.parts.map((p) => `<div class="pt" style="display:grid;grid-template-columns:1fr 90px 40px;gap:8px;align-items:center;font-size:12px;color:var(--dim)"><span>${esc(p.note)}</span><span class="pb" style="height:5px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden"><i style="display:block;height:100%;width:${(p.got / p.max) * 100}%;background:var(--hot)"></i></span><span>${p.got}/${p.max}</span></div>`).join("")}</div>`;
}
export function initCheck(CFG, openCoin) {
  const go = $("ck-go"); if (!go) return;
  const run = async () => {
    const m = String($("ck-m").value || "").trim(), out = $("ck-out"); if (!m) return;
    go.disabled = true; out.innerHTML = `<div class="ck">Checking…</div>`;
    try {
      const v = await getJ("?verify=" + encodeURIComponent(m));
      if (v.error) throw new Error(v.error);
      const d = v.listed ? await getJ("?coin=" + encodeURIComponent(m)).catch(() => null) : null;
      const row = (yes, txt) => `<div class="row ${yes ? "y" : "n"}"><i>${yes ? "✓" : "✕"}</i>${esc(txt)}</div>`;
      out.innerHTML = `<div class="ck"><h3>${v.symbol ? "$" + esc(v.symbol) + " — " + esc(v.name || "") : esc(short(m))}</h3>
        ${row(v.suffix, v.suffixWant ? `The address ends in ${v.suffixWant}` : "No suffix rule")}
        ${row(v.listed, v.listed ? (v.kind === "drop" ? "An hourly drop from the city's agent" : "Launched in this city") : "Not on this city's list")}
        ${v.mint === CFG.main ? row(true, "The main coin — the dev's own; its creator fees go 100% to the dev") : row(v.split, v.split ? "Fee split locked on chain (60 / 30 / 10)" : v.noSplit ? "Listed without a fee split" : "No locked fee split: " + (v.splitWhy || ""))}
        ${row(v.curve, v.graduated ? "Graduated from its pump.fun curve" : v.curve ? "On its pump.fun bonding curve" : "No pump.fun curve found")}
        ${d && !d.error ? gradeBox(d) : ""}
        ${v.listed ? `<div><button type="button" class="btn ghost" id="ck-open">Open the coin</button></div>` : ""}
        <p class="note2">A check reads the chain; it isn't advice. Meme coins can go to zero.</p></div>`;
      const o = $("ck-open"); if (o) o.onclick = () => openCoin(m);
    } catch (e) { out.innerHTML = `<div class="ck"><p class="err">${esc(String((e && e.message) || e))}</p></div>`; }
    go.disabled = false;
  };
  go.onclick = run; $("ck-m").onkeydown = (e) => { if (e.key === "Enter") run(); };
}

// ---------------- the wallets out in the open
export async function paintWallets(CFG, coins = []) {
  const el = $("walletsbox"); if (!el) return;
  const list = [[t("wVault", "THE VAULT"), CFG.vault, t("wVaultP", "30 % of the creator fees of every coin launched on the platform — the city fund.")], [t("wBuyer", "Buys the main coin"), CFG.buyer, t("wBuyerP", "10 % of the creator fees of every coin launched on the platform — it buys the main coin.")], [t("wAgent", "The agent"), CFG.agent, (CFG.drops === false ? t("wAgentOffP", "The agent's wallet. Its hourly drops are off; it still sends the old drops' creator fees on to THE VAULT.") : t("wAgentP", "Drops a coin every hour. Keeps 0.5 SOL for launches; the rest goes to THE VAULT."))]].filter((x) => x[1]);
  let bal = {};
  if (!DEMO) try { const r = (await rpc1("getMultipleAccounts", [list.map((x) => x[1]), { encoding: "base64", dataSlice: { offset: 0, length: 0 }, commitment: "confirmed" }])).value; list.forEach((x, i) => (bal[x[1]] = r[i] ? r[i].lamports / 1e9 : 0)); } catch {}
  el.innerHTML = list.map(([k, w, p]) => `<div class="wl"><span class="k">${esc(k)}</span><b>${bal[w] != null ? bal[w].toFixed(3) + " SOL" : "–"}</b><p>${esc(p)}</p><a href="https://solscan.io/account/${esc(w)}" target="_blank" rel="noopener">${esc(w)} ↗</a></div>`).join("") + `<div class="flw" id="flows"></div>`;
  paintFlows(CFG, coins);
}
/// the platform wallets' latest moves, read from the chain by the server (lib/_flows.mjs): every row is a transaction
const FL_ROLE = { vault: ["wVault", "THE VAULT"], buyer: ["wBuyer", "Buys the main coin"], agent: ["flAgent", "The agent"], rewards: ["flRewards", "Rewards wallet"], cards: ["flCards", "Cards wallet"] };
const FL_KIND = { buy: ["flBuy", "Bought"], burn: ["flBurn", "Burned"], pay: ["flPay", "Paid out"], sell: ["flSell", "Sold"], in: ["flIn", "Received"], out: ["flOut", "Sent"] };
async function paintFlows(CFG, coins) {
  const el = $("flows"); if (!el) return;
  let V = null;
  if (DEMO) { const n = Date.now(); V = { moves: [{ role: "vault", kind: "buy", mint: CFG.main, amount: 182000, sol: 0.42, at: n - 9e5, sig: "d1" }, { role: "vault", kind: "burn", mint: CFG.main, amount: 182000, at: n - 8e5, sig: "d2" }, { role: "rewards", kind: "pay", mint: CFG.main, amount: 50000, at: n - 3.6e6, sig: "d3" }, { role: "vault", kind: "in", sol: 0.083, at: n - 7.2e6, sig: "d4" }] }; }
  else try { V = await getJ("?flows=1"); } catch { V = null; }
  const sym = (m) => { const c = coins.find((x) => x.mint === m); return c ? "$" + c.symbol : m === CFG.main ? "$" + (CFG.ticker || "MAIN") : short(m); };
  const num = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : String(Math.round(x * 1000) / 1000));
  const rows = (V && V.moves) || [];
  const sum = (k) => rows.filter((m) => m.kind === k).reduce((a, m) => a + (m.sol || 0), 0);
  el.innerHTML = `<h4>${esc(t("flH", "Recent moves, read from the chain"))}</h4>
    <div class="fl-sum"><div><b>${sum("buy").toFixed(3)} SOL</b><small>${esc(t("flSumBuy", "spent on buybacks"))}</small></div><div><b>${rows.filter((m) => m.kind === "burn").length}</b><small>${esc(t("flSumBurn", "burns"))}</small></div><div><b>${rows.filter((m) => m.kind === "pay").length}</b><small>${esc(t("flSumPay", "payouts"))}</small></div><div><b>${sum("in").toFixed(3)} SOL</b><small>${esc(t("flSumIn", "fees in"))}</small></div></div>
    ${V && V.all ? `<p class="fl-all">${esc(t("flAll", "All time, since"))} ${esc(new Date(V.all.since).toISOString().slice(0, 10))}: <b>${V.all.buySol.toFixed(3)} SOL</b> ${esc(t("flSumBuy", "spent on buybacks"))} · <b>${V.all.burns}</b> ${esc(t("flSumBurn", "burns"))}${Object.entries(V.all.burned || {}).length ? ` (${Object.entries(V.all.burned).map(([m, a]) => `${num(a)} ${esc(sym(m))}`).join(", ")})` : ""} · <b>${V.all.pays}</b> ${esc(t("flSumPay", "payouts"))} · <b>${V.all.inSol.toFixed(3)} SOL</b> ${esc(t("flSumIn", "fees in"))}</p>` : ""}
    ${rows.length ? `<div class="fl-list">${rows.slice(0, 20).map((m) => { const r = FL_ROLE[m.role] || [m.role, m.role], k = FL_KIND[m.kind] || [m.kind, m.kind];
      const what = m.kind === "buy" ? `${num(m.amount)} ${sym(m.mint)} · ${m.sol} SOL` : m.kind === "burn" || m.kind === "pay" ? `${num(m.amount)} ${sym(m.mint)}` : m.kind === "sell" ? `${num(m.amount)} ${sym(m.mint)} · ${m.sol} SOL` : `${m.sol} SOL`;
      return `<a class="fl-r k-${esc(m.kind)}" href="https://solscan.io/tx/${esc(m.sig)}" target="_blank" rel="noopener"><span class="fl-k">${esc(t(k[0], k[1]))}</span><span class="fl-w">${esc(what)}</span><small>${esc(t(r[0], r[1]))}</small><small>${esc(m.at ? new Date(m.at).toISOString().slice(5, 16).replace("T", " ") : "")}</small></a>`; }).join("")}</div>`
      : `<p class="fine">${esc(t("flNone", "No moves read yet — the list fills as the wallets act."))}</p>`}
    <p class="fine">${esc(t("flFine", "Every row opens its transaction on Solscan. Read from the chain every few minutes."))}</p>`;
}

// ---------------- a creator's window
export function openCreator(w, coins, openCoin) {
  const el = $("cmodal"), mine = coins.filter((c) => c.creator === w), mc = mine.reduce((a, c) => a + (c.mcapUsd || 0), 0);
  el.innerHTML = `<div class="cm-card"><button type="button" class="wm-x" aria-label="Close">×</button><div class="cm-in" style="grid-column:1/-1"><span class="mc-k">${esc(t("crK", "CREATOR"))}</span><h2 style="word-break:break-all">${esc(short(w))}</h2>
    <div class="kv"><div><b>${mine.length}</b><small>${esc(t("crCoins", "Coins"))}</small></div><div><b>${usd(mc)}</b><small>${esc(t("lMcap", "Market cap"))}</small></div><div><b>${mine.filter((c) => c.graduated && c.kind !== "partner").length}</b><small>${esc(t("crMade", "Made it"))}</small></div></div><a class="btn ghost cr-prof" href="/w/${esc(w)}">${esc(t("crProfile", "Open the profile"))}</a>
    <div class="rk-col" style="padding:0;border:0;background:none"><ol>${mine.map((c, i) => `<li data-m="${esc(c.mint)}"><span class="n">${i + 1}</span>${pic(c)}<span><b>$${esc(c.symbol)}</b> ${esc(c.name)}</span><small>${usd(c.mcapUsd)}</small></li>`).join("")}</ol></div>
    <p style="margin-top:12px"><a href="https://solscan.io/account/${esc(w)}" target="_blank" rel="noopener">Solscan ↗</a></p></div></div>`;
  el.hidden = false;
  el.onclick = (e) => { if (e.target === el || e.target.closest(".wm-x")) el.hidden = true; const li = e.target.closest("[data-m]"); if (li) openCoin(li.dataset.m); };
}

// ---------------- the top-of-the-hour takeover: the last ten seconds, then the drop
let toState = { hour: null, shown: false };
export function takeoverTick(slot, coins) {
  const el = $("takeover"); if (!el || !slot || slot.off) return;
  const left = slot.next - Date.now(), cnt = document.getElementById("hour");
  if (cnt) cnt.classList.toggle("hot", left > 0 && left < 60e3);
  let off = false; try { off = localStorage.getItem("dc.to") === "0"; } catch {}
  if (off || el.dataset.coin || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (left > 0 && left <= 10e3 && document.visibilityState === "visible") {
    const n = Math.ceil(left / 1000);
    if (el.hidden || el.dataset.n !== String(n)) { el.hidden = false; el.dataset.n = String(n); el.innerHTML = `<div class="to-in"><div class="to-k">${t("dropIn", "THE NEXT DROP IN")}</div><div class="to-n" key="${n}">${n}</div><div class="to-a"><button type="button" class="btn ghost" id="to-x">${t("close", "Close")}</button></div></div>`; tone(n <= 3 ? "siren" : "tick"); $("to-x").onclick = () => { el.hidden = true; try { localStorage.setItem("dc.to", "0"); } catch {} }; }
    toState.hour = slot.hour; return;
  }
  if (!el.hidden && el.dataset.n && left > 10e3 && !el.dataset.coin) { el.dataset.n = ""; el.innerHTML = `<div class="to-in"><div class="to-k">${t("dropIn", "THE NEXT DROP")}</div><div class="to-t">${t("dropped", "DROPPING…")}</div><div class="to-s">The agent is launching this hour's coin.</div><div class="to-a"><button type="button" class="btn ghost" id="to-x">${t("close", "Close")}</button></div></div>`; $("to-x").onclick = () => (el.hidden = true); setTimeout(() => { if (!el.dataset.coin) el.hidden = true; }, 45e3); }
}
export function showDrop(c) {
  const el = $("takeover"); if (!el || !c) return;
  let off = false; try { off = localStorage.getItem("dc.to") === "0"; } catch {}
  if (off) return note(`$${c.symbol} just dropped.`, 5000);
  el.hidden = false; el.dataset.coin = c.mint;
  el.innerHTML = `<div class="to-in"><div class="to-k">${t("newDrop", "THE NEW DROP")} · ${esc((c.hour || "").slice(11, 13))}:00 UTC</div>${c.image ? `<img class="to-coin" src="${esc(c.image)}" alt="">` : `<div class="to-coin">${esc(c.symbol.slice(0, 4))}</div>`}<div class="to-t">$${esc(c.symbol)}</div><div class="to-s">${esc(c.name)}</div>
    <div class="to-a"><a class="btn hot" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">${t("trade", "Trade")}</a><a class="btn cy" href="/city?coin=${esc(c.mint)}">${t("see", "See its tower")}</a><button type="button" class="btn ghost" id="to-x">${t("close", "Close")}</button></div></div>`;
  $("to-x").onclick = () => { el.hidden = true; el.dataset.coin = ""; };
  tone("drop"); confetti(); setTimeout(() => { if (el.dataset.coin === c.mint) { el.hidden = true; el.dataset.coin = ""; } }, 14e3);
}
export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const W = (c.width = innerWidth), H = (c.height = innerHeight), x = c.getContext("2d");
  const P = Array.from({ length: 160 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 200, y: H * 0.35, vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 16 - 4, r: Math.random() * 6.28, s: 4 + Math.random() * 6, c: ["#ff2e88", "#ffffff", "#ff6fae", "#ffc2dc"][(Math.random() * 4) | 0] }));
  let n = 0; const step = () => { x.clearRect(0, 0, W, H); for (const p of P) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += 0.2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); } if (++n < 140) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
