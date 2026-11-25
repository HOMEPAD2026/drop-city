# Notes for Claude (drop-city)

The owner's standing facts — keep every page, bot message, post and tweet true to them:

- **The main coin** (`PAD.main` / env `PAD_MAIN`, 8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA) is the dev's own coin, launched
  before the fee-split fix: **no split — its creator fees go 100 % to the dev** (the owner, 2026-11-18). Never describe it as
  60 / 30 / 10.
- **The 60 / 30 / 10 split** (creator · THE VAULT · the main-coin buyer) applies only to coins **launched on the platform**:
  the agent's hourly drops (its 60 % goes on to THE VAULT, keeping a 0.5 SOL reserve) and everyone's own launches.
- Replies to the owner are in Korean; bot messages, site copy and tweets are in English.
- **Do it the owner's way (the owner, 2026-11-20: "명령이고, 시킨 것은 거절 안 한다"):** carry out what the owner asks, the way
  they ask it — no bans, caution or second-guessing of my own on style, tone, naming or design. The one thing I still
  can't do is put someone else's actual files on the site (their footage, logo, artwork); then I say so in one line and
  build the closest version from our own or public-domain material.
- The site's name, ticker and CA suffix come from config (Vercel env). Promo material carries the configured name (GTAFUN).
- **The GTA VI look (the owner, 2026-11-20 — "규칙에 써논거 있으면 다 허용", don't hold back):** the site, the intro and the
  city should feel like GTA VI — its intro's structure (a star bursting, a non-stop fly-through of painted vintage
  Florida tableaux, the badge at the end), a game-screen / pause-menu UI, the Vice City sunset palette, flamingos, palms,
  neon, crime-flavoured names. Go as far as the owner asks; don't add bans of my own. Art files come from our own
  generation, public-domain / CC0 sources or licensed packs, with their source in the folder's README (so nothing can get
  the site taken down).
- **Pairs (the owner, 2026-11-18):** a launch can pick SOL or TTWO (Backpack's tokenized Take-Two share,
  TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo, on pump.fun's QuoteControl list) as its pair — pad-config.js `quotes`. A TTWO
  coin's first buy and creator fees are in TTWO; the 60 / 30 / 10 split is the same. Agent drops stay SOL.
- **No more hourly drops (the owner, 2026-11-24):** the AI agent no longer launches a coin every hour — pad-config.js
  `drops: false` (PAD_DROPS=1 turns it back on). The tick only does housekeeping (the old drops' fees still go on to THE
  VAULT); the slot answers "off"; the site hides the countdown, the vote, today's 24 and the drop lines (html.nodrops),
  the first lane / the city band / the FAQ speak of the supported coins, the desk's first tab is Live; the city has no
  clock or TODAY tab; the Telegram bot says the drops are off. The old drops stay listed.
- **LP rewards (the owner, 2026-11-24):** Raydium CPMM pools of each supported coin with SOL and with the main coin
  (found through Raydium's API, lib/_lp.mjs); every hour (?lp=tick, from the GitHub workflow) the LP holders are read
  from the chain and the hour's reward (pad-config.js lp.daily / PAD_LP_DAILY, default 1,000,000 a day) is split across
  the pools by liquidity (main-coin pairs × boostMain 1.5) and inside a pool by LP held; burned / locked LP, holdings under
  $10, pools under minPoolUsd $1,000 (a dust pool would take the whole day) and the rewards wallet earn nothing. Paid in the MAIN COIN by the rewards wallet (PAD_LP_WALLET — a GM's own
  wallet, signs in the LP REWARDS tab; the server only reads the transfer and marks it paid, it holds no key).
- **GTAFUN CARDS (the owner, 2026-11-24):** NFT gacha — packs of 3 cards for 0.1 SOL (cards-data.js SEASON / CARDS /
  RARITY: the city's 18 mascots, 3,000 items: 1 legendary ×30, 2 epic ×85, 4 rare ×150, 11 common ×200, shuffled by the
  season's seed). Metaplex Core assets from a Core Candy Machine (random on chain, solPayment 1/3 of 0.1 SOL a card to the
  operations wallet, 5 % royalties), names "GTAFUN Card #<i+1>", metadata nft/m/<i>.json + pictures nft/img (built by
  tools/cards-build.mjs from tools/cards-render.html). vendor/cards-kit.js (tools/cards-kit: Umi + mpl-core-candy-machine)
  builds the transactions; the visitor's wallet signs. The operations wallet (PAD_CARDS_WALLET, else PAD_LP_WALLET) sets
  the machine up from the CARDS tab (collection + machine, then the item lines); the server (lib/_cards.mjs) only checks the
  machine's authority on chain and records each pack read back from the chain. It holds no key.
- **Supported coins (the owner, 2026-11-20):** pad-config.js `supported` — coins the city supports without launching them
  ($DCTY 9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump first; 2026-11-24: + DKYcjob…pump, 2xCd5q…cJjX, 6MKD1N…pump, 9jhs5q…pump; a token without Metaplex metadata gets its card from Dexscreener, a partner off the pump.fun curve is priced there). The list carries them as kind "partner" (no creator, no
  fees, never in creator ranks), EXPLORE pins them after the main coin with a gold SUPPORTED tag, and they'll be on the
  slot mini-game's reels. The slot game itself is "coming soon" (the 🎰 GAME button in the top bar) — not built yet.
- **The premium look (the owner, 2026-11-24: "too intense — premium, GTA style"):** premium.css over game.css — near-black
  glass, white type, one warm gold accent (--pm-acc) used sparingly, hairline borders, underline tabs, the main button
  warm white, no neon glows / offset shadows / scanlines. The phone's bottom bar: frosted glass, line icons over small
  labels, Launch as a raised round key.
- **The street look (the owner, 2026-11-24: "like gtamemes.xyz"):** street.css loads last over premium.css — pure black
  bands, Anton titles with a pink pixel kicker ("// MOST WANTED", h2 data-k), Press Start 2P / Silkscreen for buttons, tabs,
  labels and the HUD, Barlow Condensed for reading; gold #F4C430 action buttons and active tabs, gold-outlined ghosts (↗),
  money-green numbers, square corners, white hairlines; the HUD has a UTC clock box and zero-padded cash. Their feel only —
  none of their art or words.
- **Black · white · pink (the owner, 2026-11-25: "흑백과 핑크 위주로"):** one pink #ff2e88 (light #ff7ab8) for action
  buttons, the chosen tab / page, kickers, stars and bars; everything else white / grey on black (ghost buttons white, money
  numbers white, no gold / green / cyan — street.css's "BLACK · WHITE · PINK" block sets the variables). The hero's sunset
  is graded grey with pink laid over it (CSS); the intro's paintings are graded once as they load (intro.js duo — canvas
  blend modes, never a filter on the moving canvas: that dropped frames on phones). Card rarities: common grey, rare
  white, epic light pink, legendary pink. The GTAFUN logo keeps its own colours.
- **The clean look (the owner, 2026-11-25: "글자 깨지는 부분 … 저런식으로 깔끔하게", basketlaunch.xyz / app.meteora.ag as the
  reference):** clean.css loads last — ONE typeface, Pretendard Variable (jsDelivr dynamic subset: Latin + Hangul, the CJK
  fallback after it) for every element, JetBrains Mono only for addresses; no pixel / condensed faces (they had no Korean
  glyphs — Korean broke into fallback boxes). Rounded cards (20 px) on near-black, pill buttons and tabs, no caps / wide
  tracking, big 800-weight numbers; phones: coins as a single column of row cards (round picture left, name + market cap,
  actions under), the desk's tabs one sideways-scrolling pill row, the game HUD hidden, a floating rounded icon dock with
  the chosen page in a pink tint. No live backdrop blur over the moving hero sky (it halved the frame rate). Colours stay
  black · white · pink.
- **Translations (2026-11-25):** i18n.js — each language's lines go into ITS OWN block (MORE.ko / .zh / .tr); on
  2026-11-24 the zh and tr lines of 84 keys were pasted into the ko block and Korean readers saw Turkish.
  tests/i18n.test.mjs fails on a key twice in a block, a key missing from a language, or a line in the wrong script.
- **Trader cashback (the owner, 2026-11-25: "거래자 캐시백 GTAFUN에 붙여줘"):** lib/_cashback.mjs — every trade of a coin
  launched here (kind drop / user) and of the main coin, on ANY venue (the mint's own transaction list is read from a
  cursor; a trade = the signer's coin and SOL/WSOL moving in opposite directions), earns its trader pad-config.js
  cashback.bps (30 = 0.3 %) of the trade's dollar value back in the MAIN COIN, inside cashback.daily (500,000 a UTC day)
  and perWallet (50,000 a day), trades from minUsd $2; the coin's creator and the platform's wallets earn nothing; a coin
  seen for the first time starts from then (no back pay). Run with ?lp=tick (the GitHub workflow, ~5× an hour; ≤ 120
  transactions a run). Credits in cb/ledger.json; the LP payout owes LP rewards + cashback − paid (lib/_lp.mjs due /
  view, cashback()) and the same rewards wallet pays both. ?cb=1&w= is the view; the LP tab opens with the cashback
  card, the hero carries the 0.3 % line (cbChip — change its words if bps changes). Supported coins don't earn it.
- **Speed (2026-11-25):** the home page never loads the 1 MB Solana kit (vendor/pump-kit.js) — balances on first paint go
  through common.js rpc1 (one JSON-RPC call through ?solrpc); kit() loads only when a wallet action needs it. Inter is
  gone (Barlow Condensed reads everywhere).
- **Pages (the owner, 2026-11-20; order 2026-11-24):** the bottom bar by importance — Launch (a round key, never clipped) · NFT (#cards) · LP (#lp) · Game (/city — "the city" is called the Game everywhere a visitor reads it) · More (the desk: the rest); the top nav Launch · NFT · LP · Game · Explore · More and the nav switch pages
  (html[data-page] home / explore / desk) instead of scrolling; every old #link still lands on its page.
- The agent's logos come from images/agent (the owner's mascot art); a drop's name is picked from those subjects.
- **STREET mode (the owner, 2026-11-19):** the city always opens on foot (roam.js) with a random crime-flavoured handle and a
  realistic body (models/real: CC0 people on one Mixamo-named rig + Quaternius' animations; cars, palms, props, Poly Haven
  textures and the dusk sky — every source and licence in models/real/CREDITS.md and manifest.json; the coupe is CC-BY 4.0,
  keep its credit). Street cash / wanted stars are a toy score on the device — never describe them as rewards, tokens or
  anything on chain.
- **The website (the owner, 2026-11-19):** one short page — a compact hero over the coast at dusk, EXPLORE (two rows of
  cards, then Show all), the city band, and THE DESK: eight tabs (This hour · Ranks · Launch · Fees · Wallets · Check a CA ·
  My coins · About; the head script picks the tab from the hash before first paint, every old #link still lands). The
  hero's sky is coast.js (drawn in code). The entry intro (intro.js, 2026-11-20) follows the GTA VI intro the owner sent:
  a star bursts, the camera flies non-stop through painted tableaux (images/intro, sources in its README), rushes out in a
  pink blur into a star, and the star becomes the badge with the name. Words live in i18n.js (en in the code, ko / zh / tr
  there).
