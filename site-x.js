// site-x.js — the website's extras: languages, sound, the vote on the next drop, the live trades, leaderboards, the CA
// check, the wallets out in the open, the creator window, the top-of-the-hour takeover, numbers that roll.
import { $, esc, short, usd, note, DEMO, getJ, post, sol, kit, conn, b58, pic } from "/common.js";
import { openWallet } from "/wallet.js";

// ---------------- languages (the static page: data-i18n keys; the code: t(key, fallback))
const DICT = {
  ko: { caEnds: "모든 코인의 CA 끝자리", nMain: "메인 코인", nExplore: "탐색", nVote: "투표", nLive: "실시간", nLaunch: "런칭", nCity: "도시 플레이", nCheck: "CA 확인", nCreators: "크리에이터",
    kicker: "pump.fun · 솔라나 런치패드", l1k: "매시간", l1h: "에이전트가 코인을 드롭", l1p: "매 정각 도시의 에이전트가 Clock Plaza에 새 코인을 런칭합니다. 다음에 뭘 드롭할지 여러분이 투표하세요.",
    l2k: "언제든지", l2h: "내 코인을 런칭", l2p: "제한도, 대기도 없습니다. 내 지갑, pump.fun, 온체인에 잠기는 수수료 분배 — 그리고 도시의 타워 하나.",
    launch: "코인 런칭", explore: "코인 둘러보기", enter: "도시 입장 ▸", hExplore: "탐색", pExplore: "여기서 런칭된 모든 코인 — 에이전트의 시간별 드롭과 모두의 코인. 카드를 눌러 거래하거나 도시의 타워를 보세요.",
    quiet: "조용한 코인 보기 (하루 이상, $5K 미만)", hVote: "다음 드롭 투표", pVote: "다음 정각에 에이전트가 드롭할 코인을 고르세요. 지갑당 한 표, 서명만 — 수수료 없음.",
    hLive: "실시간 거래", pLive: "도시 코인들의 모든 매수·매도가 들어오는 대로.", hRanks: "리더보드", pRanks: "도시의 MOST WANTED, 최고의 크리에이터, 졸업한 코인들.",
    hToday: "오늘의 24", pToday: "에이전트의 시간별 드롭(UTC). 각자 Clock Plaza의 자기 시간 자리에 섭니다.", hLaunch: "런칭", pLaunch: "내 코인, 내 지갑, 언제든. 제한 없음.", launchNow: "지금 코인 런칭",
    hCheck: "CA 확인", pCheck: "코인 주소를 붙여넣으세요: 이 도시 출신인지, 수수료 분배가 잠겼는지, 체인 기준 안전도는 어떤지.", checkBtn: "확인",
    hWallets: "모두 공개", pWallets: "도시가 쓰는 모든 지갑과 실시간 잔액. 모든 움직임은 공개 트랜잭션입니다.", hCreators: "크리에이터", pCreators: "내 코인과 쌓인 수수료.", hFees: "수수료", hAbout: "소개",
    bLaunch: "런칭", bExplore: "탐색", bVote: "투표", bCity: "도시",
    vote: "투표하기", voted: "투표함", votes: "표", closes: "마감", next: "다음 드롭", connect: "지갑 연결", noTrades: "아직 거래가 없어요 — 첫 거래가 곧 여기 나타납니다.",
    rWanted: "MOST WANTED", rCreators: "톱 크리에이터", rMade: "명예의 전당", rNone: "아직 없음",
    yes: "예", no: "아니오", fromHere: "이 도시에서 런칭됨", notHere: "이 도시 목록에 없음", suffixOk: "주소 끝자리 일치", splitOk: "수수료 분배 잠김", notMine: "가 아닌 주소",
    wVault: "THE VAULT", wVaultP: "모든 코인 크리에이터 수수료의 30% — 도시 펀드.", wBuyer: "메인 코인 구매", wBuyerP: "모든 코인 수수료의 10% — 메인 코인을 삽니다.", wAgent: "에이전트", wAgentP: "매시간 드롭하는 지갑. 런칭 비용 0.5 SOL만 남기고 나머지는 금고로.",
    dropIn: "다음 드롭까지", dropped: "드롭!", newDrop: "새 드롭", trade: "거래", see: "타워 보기", close: "닫기" },
  zh: { caEnds: "每枚币的合约地址结尾", nMain: "主币", nExplore: "探索", nVote: "投票", nLive: "实时", nLaunch: "发币", nCity: "进入城市", nCheck: "查合约", nCreators: "创作者",
    kicker: "pump.fun · Solana 发射台", l1k: "每小时", l1h: "代理发一枚币", l1p: "每个整点，城市代理在 Clock Plaza 发行一枚新币。下一枚发什么，由你投票决定。",
    l2k: "随时", l2h: "发你自己的币", l2p: "不限量，不排队。你的钱包、pump.fun、链上锁定的手续费分配——还有城里的一座塔。",
    launch: "发币", explore: "浏览代币", enter: "进入城市 ▸", hExplore: "探索", pExplore: "在这里发行的所有代币——代理的整点发币和大家的币。点卡片交易，或去城里看它的塔。",
    quiet: "显示冷门币（一天以上、市值低于 $5K）", hVote: "投票下一枚", pVote: "选择代理下个整点发行的币。每个钱包一票，只需签名——免费。",
    hLive: "实时交易", pLive: "城市里每一笔买卖，实时到达。", hRanks: "排行榜", pRanks: "城市的头号通缉、最强创作者和毕业的币。",
    hToday: "今日 24", pToday: "代理的整点发币（UTC），各占 Clock Plaza 的整点地块。", hLaunch: "发币", pLaunch: "你的币，你的钱包，随时，不限量。", launchNow: "立即发币",
    hCheck: "查合约地址", pCheck: "粘贴代币地址：是否来自本城、手续费分配是否锁定、链上安全度如何。", checkBtn: "检查",
    hWallets: "公开透明", pWallets: "城市使用的所有钱包和实时余额。每一笔都是公开交易。", hCreators: "创作者", pCreators: "你的币和累计的手续费。", hFees: "手续费", hAbout: "关于",
    bLaunch: "发币", bExplore: "探索", bVote: "投票", bCity: "城市",
    vote: "投票", voted: "已投", votes: "票", closes: "截止", next: "下一枚", connect: "连接钱包", noTrades: "还没有交易——第一笔很快出现。",
    rWanted: "头号通缉", rCreators: "顶级创作者", rMade: "名人堂", rNone: "暂无",
    yes: "是", no: "否", fromHere: "来自本城", notHere: "不在本城列表", suffixOk: "地址后缀相符", splitOk: "手续费分配已锁定", notMine: "",
    wVault: "金库", wVaultP: "每枚币创作者手续费的 30%——城市基金。", wBuyer: "主币买家", wBuyerP: "每枚币手续费的 10%——用于买入主币。", wAgent: "代理", wAgentP: "整点发币的钱包。保留 0.5 SOL 发币费用，其余转入金库。",
    dropIn: "距离下一枚", dropped: "发币！", newDrop: "新发币", trade: "交易", see: "看塔", close: "关闭" },
  tr: { caEnds: "Her coinin CA sonu", nMain: "Ana coin", nExplore: "Keşfet", nVote: "Oyla", nLive: "Canlı", nLaunch: "Başlat", nCity: "Şehri oyna", nCheck: "CA kontrol", nCreators: "Yaratıcılar",
    kicker: "pump.fun · Solana launchpad", l1k: "HER SAAT", l1h: "Ajan bir coin düşürür", l1p: "Her saat başı şehrin ajanı Clock Plaza'da yeni bir coin çıkarır. Sıradakini siz oylarsınız.",
    l2k: "HER ZAMAN", l2h: "Kendininkini başlat", l2p: "Limit yok, bekleme yok. Cüzdanın, pump.fun, zincirde kilitli ücret paylaşımı — ve şehirde bir kule.",
    launch: "Coin başlat", explore: "Coinleri keşfet", enter: "Şehre gir ▸", hExplore: "KEŞFET", pExplore: "Burada çıkan her coin — ajanın saatlik düşüşleri ve herkesinkiler.",
    quiet: "Sessiz coinleri göster (bir günlük, $5K altı)", hVote: "SIRADAKİNİ OYLA", pVote: "Ajanın bir sonraki saat başı düşüreceği coini seç. Cüzdan başına bir oy, imzayla — ücretsiz.",
    hLive: "CANLI İŞLEMLER", pLive: "Şehrin coinlerindeki her alım satım, anında.", hRanks: "LİDERLİK", pRanks: "En çok arananlar, en iyi yaratıcılar ve mezun olan coinler.",
    hToday: "BUGÜNÜN 24'Ü", pToday: "Ajanın saatlik düşüşleri (UTC).", hLaunch: "BAŞLAT", pLaunch: "Coinin, cüzdanın, her zaman. Limit yok.", launchNow: "Şimdi coin başlat",
    hCheck: "CA KONTROL", pCheck: "Bir coin adresi yapıştır: bu şehirden mi, ücret paylaşımı kilitli mi, zincire göre ne kadar güvenli?", checkBtn: "Kontrol",
    hWallets: "HER ŞEY AÇIKTA", pWallets: "Şehrin kullandığı tüm cüzdanlar ve canlı bakiyeleri.", hCreators: "YARATICILAR", pCreators: "Coinlerin ve kazandıkları ücretler.", hFees: "ÜCRETLER", hAbout: "HAKKINDA",
    bLaunch: "Başlat", bExplore: "Keşfet", bVote: "Oyla", bCity: "Şehir",
    vote: "Oy ver", voted: "Oy verildi", votes: "oy", closes: "kapanış", next: "Sıradaki", connect: "Cüzdan bağla", noTrades: "Henüz işlem yok — ilki yakında burada.",
    rWanted: "EN ÇOK ARANAN", rCreators: "EN İYİ YARATICILAR", rMade: "ŞÖHRETLER", rNone: "henüz yok",
    yes: "evet", no: "hayır", fromHere: "bu şehirde çıktı", notHere: "şehrin listesinde yok", suffixOk: "adres soneki doğru", splitOk: "ücret paylaşımı kilitli", notMine: "",
    wVault: "KASA", wVaultP: "Her coinin yaratıcı ücretlerinin %30'u — şehir fonu.", wBuyer: "Ana coin alıcısı", wBuyerP: "Her coinin ücretlerinin %10'u — ana coini alır.", wAgent: "Ajan", wAgentP: "Saatlik düşüş cüzdanı. 0.5 SOL tutar, gerisi kasaya.",
    dropIn: "Sıradaki düşüşe", dropped: "DÜŞTÜ!", newDrop: "Yeni düşüş", trade: "İşlem", see: "Kuleyi gör", close: "Kapat" },
};
let LANG = "en";
try { LANG = localStorage.getItem("dc.lang") || (navigator.language || "en").slice(0, 2); } catch {}
if (!DICT[LANG]) LANG = "en";
export const t = (k, en) => (DICT[LANG] && DICT[LANG][k]) || en;
const EN = {};
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.dataset.i18n; if (!(k in EN)) EN[k] = el.textContent; el.textContent = t(k, EN[k]); });
  for (const id of ["lang", "lang2"]) { const sel = $(id); if (sel) sel.value = LANG; }
}
export function initLang(onChange) {
  applyLang();
  for (const id of ["lang", "lang2"]) { const sel = $(id); if (sel) sel.onchange = () => { LANG = sel.value; try { localStorage.setItem("dc.lang", LANG); } catch {} applyLang(); onChange && onChange(); }; }
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
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) { el.textContent = fmt(to); return; }
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
export function tickVote() { const el = $("vclose"); if (!el || !V) return; const l = Math.max(0, V.closes - Date.now()); el.textContent = `${String(Math.floor(l / 60e3)).padStart(2, "0")}:${String(Math.floor((l % 60e3) / 1000)).padStart(2, "0")}`; }

// ---------------- live trades
const seenTr = new Set(); let firstTr = true;
export async function paintLive(coins, onTrade) {
  const el = $("livebox"); if (!el) return;
  let items = [];
  if (DEMO) { const c = coins[Math.floor(Math.random() * coins.length)]; if (c) items = [{ sig: "d" + Date.now(), at: Date.now(), mint: c.mint, symbol: c.symbol, side: Math.random() < 0.7 ? "buy" : "sell", sol: +(Math.random() * 3).toFixed(3), usd: null, who: "Demo1111" }]; items = [...items, ...[...(paintLive.d || [])]].slice(0, 30); paintLive.d = items; }
  else { try { items = (await getJ("?trades=1")).items || []; } catch { return; } }
  const fresh = items.filter((x) => !seenTr.has(x.sig)); fresh.forEach((x) => seenTr.add(x.sig));
  if (!firstTr) fresh.slice(0, 4).forEach((x) => { tone(x.side === "buy" ? "buy" : "sell"); onTrade && onTrade(x); });
  firstTr = false;
  el.innerHTML = items.length ? items.slice(0, 18).map((x) => `<div class="tr ${x.side}${x.sol >= 1 ? " big" : ""}" data-m="${esc(x.mint)}"><span class="sd">${x.side.toUpperCase()}</span><span><b>$${esc(x.symbol)}</b> <small>${x.sol.toFixed(3)} SOL${x.usd ? " · $" + x.usd.toFixed(0) : ""}</small></span><small class="who">${esc(short(x.who))}</small><small>${ago(x.at)}</small></div>`).join("") : `<div class="live-empty">${t("noTrades", "No trades yet — the first one shows up here.")}</div>`;
}
const ago = (ms) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m" : Math.floor(s / 3600) + "h"; };

// ---------------- leaderboards
export function paintRanks(coins, openCoin, openCreator) {
  const el = $("ranksbox"); if (!el) return;
  const wanted = coins.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 7);
  const by = new Map(); for (const c of coins) { if (c.kind === "drop") continue; const k = c.creator; const v = by.get(k) || { w: k, n: 0, mc: 0, made: 0, top: c }; v.n++; v.mc += c.mcapUsd || 0; v.made += c.graduated ? 1 : 0; if ((c.mcapUsd || 0) > (v.top.mcapUsd || 0)) v.top = c; by.set(k, v); }
  const creators = [...by.values()].sort((a, b) => b.mc - a.mc).slice(0, 7), made = coins.filter((c) => c.graduated).slice(0, 7);
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
  if (d.partial) return `<div class="cm-grade"><span class="big grade">…</span><span><b>Safety check — partial</b><small>The holders couldn't be read just now; the grade shows once they are.</small></span></div>`;
  return `<div class="cm-grade"><span class="big grade g${esc(d.grade)}">${esc(d.grade)}</span><span><b>Safety ${d.score}/100</b><small>What the chain shows right now — not a promise.</small></span></div>
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
export async function paintWallets(CFG) {
  const el = $("walletsbox"); if (!el) return;
  const list = [[t("wVault", "THE VAULT"), CFG.vault, t("wVaultP", "30 % of the creator fees of every coin launched on the platform — the city fund.")], [t("wBuyer", "Buys the main coin"), CFG.buyer, t("wBuyerP", "10 % of the creator fees of every coin launched on the platform — it buys the main coin.")], [t("wAgent", "The agent"), CFG.agent, t("wAgentP", "Drops a coin every hour. Keeps 0.5 SOL for launches; the rest goes to THE VAULT.")]].filter((x) => x[1]);
  let bal = {};
  if (!DEMO) try { const K = await kit(), c = await conn(); const r = await c.getMultipleAccountsInfo(list.map((x) => new K.PublicKey(x[1]))); list.forEach((x, i) => (bal[x[1]] = r[i] ? r[i].lamports / 1e9 : 0)); } catch {}
  el.innerHTML = list.map(([k, w, p]) => `<div class="wl"><span class="k">${esc(k)}</span><b>${bal[w] != null ? bal[w].toFixed(3) + " SOL" : "–"}</b><p>${esc(p)}</p><a href="https://solscan.io/account/${esc(w)}" target="_blank" rel="noopener">${esc(w)} ↗</a></div>`).join("");
}

// ---------------- a creator's window
export function openCreator(w, coins, openCoin) {
  const el = $("cmodal"), mine = coins.filter((c) => c.creator === w), mc = mine.reduce((a, c) => a + (c.mcapUsd || 0), 0);
  el.innerHTML = `<div class="cm-card"><button type="button" class="wm-x" aria-label="Close">×</button><div class="cm-in" style="grid-column:1/-1"><span class="mc-k">CREATOR</span><h2 style="word-break:break-all">${esc(short(w))}</h2>
    <div class="kv"><div><b>${mine.length}</b><small>Coins</small></div><div><b>${usd(mc)}</b><small>Market cap</small></div><div><b>${mine.filter((c) => c.graduated).length}</b><small>Made it</small></div></div>
    <div class="rk-col" style="padding:0;border:0;background:none"><ol>${mine.map((c, i) => `<li data-m="${esc(c.mint)}"><span class="n">${i + 1}</span>${pic(c)}<span><b>$${esc(c.symbol)}</b> ${esc(c.name)}</span><small>${usd(c.mcapUsd)}</small></li>`).join("")}</ol></div>
    <p style="margin-top:12px"><a href="https://solscan.io/account/${esc(w)}" target="_blank" rel="noopener">Solscan ↗</a></p></div></div>`;
  el.hidden = false;
  el.onclick = (e) => { if (e.target === el || e.target.closest(".wm-x")) el.hidden = true; const li = e.target.closest("[data-m]"); if (li) openCoin(li.dataset.m); };
}

// ---------------- the top-of-the-hour takeover: the last ten seconds, then the drop
let toState = { hour: null, shown: false };
export function takeoverTick(slot, coins) {
  const el = $("takeover"); if (!el || !slot) return;
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
