// i18n.js — the languages, shared by the website, the city and the entry intro: the dictionary (ko / zh / tr; English is
// the fallback written in the code), the chosen language (localStorage dc.lang, else the browser's) and t / tf.
export const DICT = {
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
export const lang = () => LANG;
export function setLang(l) { LANG = DICT[l] ? l : "en"; try { localStorage.setItem("dc.lang", LANG); } catch {} return LANG; }
// t(key, english): the chosen language's line, else the English given
export const t = (k, en) => (DICT[LANG] && DICT[LANG][k]) || en;
// tf(key, english, { name: value }): the same with {name} filled in
export const tf = (k, en, vars = {}) => String(t(k, en)).replace(/\{(\w+)\}/g, (m, v) => (v in vars ? vars[v] : m));
