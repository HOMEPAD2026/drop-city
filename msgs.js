// msgs.js — the messages the code shows (toasts, the launch form's errors, Solana's reasons) in the reader's language
// (round L, the owner 2026-11-26). note() and the launch form pass every message through tm(): an exact English line
// is looked up here, a few with a value in them by pattern; anything not here shows as it came.
import { lang } from "/i18n.js";

const M = {
  "Demo — nothing is sent.": ["데모 — 아무것도 보내지 않아요.", "演示——不会发送任何内容。", "Demo — hiçbir şey gönderilmez."],
  "Demo — nothing is signed.": ["데모 — 아무것도 서명하지 않아요.", "演示——不会签名任何内容。", "Demo — hiçbir şey imzalanmaz."],
  "Done — it's in the city.": ["완료 — 도시에 들어왔어요.", "完成——它已进城。", "Tamam — artık şehirde."],
  "Fees paid out.": ["수수료를 지급했어요.", "手续费已发放。", "Ücretler ödendi."],
  "Mugshot saved.": ["머그샷을 저장했어요.", "通缉照已保存。", "Sabıka fotoğrafı kaydedildi."],
  "Couldn't make the mugshot.": ["머그샷을 만들지 못했어요.", "无法生成通缉照。", "Sabıka fotoğrafı oluşturulamadı."],
  "No Solana wallet found — open this page in Phantom or Solflare.": ["솔라나 지갑이 없어요 — Phantom이나 Solflare에서 이 페이지를 여세요.", "没有找到 Solana 钱包——请在 Phantom 或 Solflare 中打开此页面。", "Solana cüzdanı bulunamadı — bu sayfayı Phantom ya da Solflare'de aç."],
  "The slots didn't load — try again.": ["슬롯을 불러오지 못했어요 — 다시 시도하세요.", "老虎机没有加载——请重试。", "Slotlar yüklenmedi — tekrar dene."],
  "Vote counted.": ["투표가 반영됐어요.", "投票已计入。", "Oy sayıldı."],
  "Address copied": ["주소를 복사했어요", "地址已复制", "Adres kopyalandı"],
  "Wallet connected": ["지갑이 연결됐어요", "钱包已连接", "Cüzdan bağlandı"],
  "Cancelled in your wallet.": ["지갑에서 취소했어요.", "已在钱包中取消。", "Cüzdanda iptal edildi."],
  "A crew wallet isn't a Solana address.": ["크루 지갑이 솔라나 주소가 아니에요.", "某个团队钱包不是 Solana 地址。", "Bir ekip cüzdanı Solana adresi değil."],
  "Each crew wallet must be different (and not your own).": ["크루 지갑은 모두 달라야 하고 내 지갑이면 안 돼요.", "每个团队钱包必须不同（也不能是你自己的）。", "Her ekip cüzdanı farklı olmalı (ve senin değil)."],
  "THE VAULT, the buyer and the agent can't be in a crew — they already get their share.": ["THE VAULT, 매수 지갑, 에이전트는 크루가 될 수 없어요 — 이미 몫을 받아요.", "THE VAULT、买入钱包和代理不能加入团队——它们已经有份额。", "THE VAULT, alıcı ve ajan ekipte olamaz — zaten paylarını alıyorlar."],
  "Connect the wallet that launched this coin.": ["이 코인을 런칭한 지갑을 연결하세요.", "请连接发行这枚币的钱包。", "Bu coini çıkaran cüzdanı bağla."],
  "The city's lookup table didn't load — try again in a moment.": ["도시의 조회 테이블을 불러오지 못했어요 — 잠시 후 다시 시도하세요.", "城市的查找表没有加载——请稍后再试。", "Şehrin arama tablosu yüklenmedi — birazdan tekrar dene."],
  "The transaction expired before it landed — try again.": ["트랜잭션이 처리되기 전에 만료됐어요 — 다시 시도하세요.", "交易在上链前已过期——请重试。", "İşlem zincire ulaşmadan süresi doldu — tekrar dene."],
  "pump.fun has paused new coins for a moment — try again later.": ["pump.fun이 잠시 새 코인 생성을 멈췄어요 — 나중에 다시 시도하세요.", "pump.fun 暂停了新币发行——请稍后再试。", "pump.fun yeni coinleri kısa süre durdurdu — sonra tekrar dene."],
  "Not enough SOL in this wallet for the launch, the first buy and the network fee.": ["런칭, 첫 매수, 네트워크 수수료에 쓸 SOL이 부족해요.", "钱包里的 SOL 不够支付发行、首次买入和网络费。", "Çıkış, ilk alım ve ağ ücreti için bu cüzdanda yeterli SOL yok."],
  "The first buy is too big for a new coin.": ["새 코인에 비해 첫 매수가 너무 커요.", "对新币来说首次买入太大了。", "İlk alım yeni bir coin için çok büyük."],
  "The name is too long (32 letters at most).": ["이름이 너무 길어요 (최대 32자).", "名称太长（最多 32 个字符）。", "İsim çok uzun (en fazla 32 harf)."],
  "The ticker is too long (13 letters at most).": ["티커가 너무 길어요 (최대 13자).", "代号太长（最多 13 个字符）。", "Ticker çok uzun (en fazla 13 harf)."],
  "the price moved past the first buy's room — try a little less": ["가격이 첫 매수 허용 범위를 넘었어요 — 조금 줄여서 시도하세요", "价格超出了首次买入的范围——请少买一点", "fiyat ilk alımın sınırını geçti — biraz daha az dene"],
  "not confirmed yet — check Solscan": ["아직 확인되지 않았어요 — Solscan에서 확인하세요", "尚未确认——请在 Solscan 查看", "henüz onaylanmadı — Solscan'e bak"],
  "this coin has no fee split on chain": ["이 코인은 체인에 수수료 분배가 없어요", "这枚币在链上没有手续费分配", "bu coinin zincirde ücret paylaşımı yok"],
  "this coin has no pump.fun bonding curve": ["이 코인은 pump.fun 본딩 커브가 없어요", "这枚币没有 pump.fun 联合曲线", "bu coinin pump.fun bonding eğrisi yok"],
  "the Solana kit didn't load": ["솔라나 도구를 불러오지 못했어요", "Solana 工具没有加载", "Solana kiti yüklenmedi"],
  "the cards kit didn't load": ["카드 도구를 불러오지 못했어요", "卡牌工具没有加载", "kart kiti yüklenmedi"],
  "not an image": ["이미지 파일이 아니에요", "不是图片", "bir görsel değil"],
  "Link copied.": ["링크를 복사했어요.", "链接已复制。", "Bağlantı kopyalandı."],
};
const P = [
  [/^\$(\S+) launched — welcome to the city\.$/, ["$$$1 런칭 완료 — 도시에 오신 걸 환영해요.", "$$$1 已发行——欢迎来到城市。", "$$$1 çıktı — şehre hoş geldin."]],
  [/^\$(\S+) just dropped\.$/, ["$$$1 방금 드롭됐어요.", "$$$1 刚刚空投。", "$$$1 az önce düştü."]],
  [/^Only the creator's wallet \((\S+)\) can claim these\.$/, ["크리에이터 지갑($1)만 받을 수 있어요.", "只有创作者钱包（$1）可以领取。", "Bunları sadece yaratıcının cüzdanı ($1) alabilir."]],
  [/^failed on Solana: (.*)$/, ["솔라나에서 실패했어요: $1", "在 Solana 上失败：$1", "Solana'da başarısız: $1"]],
  [/^the address finder stopped: (.*)$/, ["주소 찾기가 멈췄어요: $1", "地址查找已停止：$1", "adres bulucu durdu: $1"]],
];
const IX = { ko: 0, zh: 1, tr: 2 };
/// a message in the reader's language (English when there's no line for it)
export function tm(s) {
  const i = IX[lang()]; if (i == null || s == null) return s;
  const str = String(s), hit = M[str]; if (hit) return hit[i];
  for (const [re, tr] of P) if (re.test(str)) return str.replace(re, tr[i]);
  return str;
}
export const MSG_COUNT = Object.keys(M).length + P.length;
