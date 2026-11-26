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
- **GTAFUN CARDS (the owner, 2026-11-24; the art 2026-11-25):** NFT gacha — packs of 3 cards for 0.1 SOL (cards-data.js SEASON / CARDS /
  RARITY). The art is the owner's sheet of ten meme cards (#1 DOGE · PEPE · PENGU · SHIB · FLOKI · BONK · WIF · SPX6900 ·
  TRUMP · #10 BRETT), cut into nft/src/<id>.png (white corners made transparent, 2× up); 3,000 items: 1 legendary (doge)
  ×30 · 2 epic (pepe, pengu) ×150 · 3 rare (shib, floki, bonk) ×290 · 4 common (wif, spx, trump, brett) ×450 =
  1 % / 10 % / 29 % / 60 %, shuffled by the season's seed. Swap the art before the machine is set up: the metadata
  (nft/m) is read off our site, so changing it later changes NFTs people already hold. Metaplex Core assets from a Core Candy Machine (random on chain, solPayment 1/3 of 0.1 SOL a card to the
  operations wallet, 5 % royalties), names "GTAFUN Card #<i+1>", metadata nft/m/<i>.json + pictures nft/img (600×960, built by
  tools/cards-build.mjs from nft/src). vendor/cards-kit.js (tools/cards-kit: Umi + mpl-core-candy-machine)
  builds the transactions; the visitor's wallet signs. The operations wallet (PAD_CARDS_WALLET, else PAD_LP_WALLET) sets
  the machine up from the CARDS tab (collection + machine, then the item lines); the server (lib/_cards.mjs) only checks the
  machine's authority on chain and records each pack read back from the chain. It holds no key.
- **Supported coins aren't "graduated" here (the owner, 2026-11-26):** they weren't launched or graduated through GTAFUN —
  no MADE badge, no "graduated to PumpSwap" line, not in the Made filter / the graduated count / the hall of fame; their
  card says "Supported by the city · not launched here" (site.js isSup / isMade). Their logo: Dexscreener's first, else
  the metadata picture only if it still loads (lib/_pad.mjs imgAlive — Mandy's went 404); the LP page falls back to the
  ticker badge (common.js pic).
- **Supported coins (the owner, 2026-11-20):** pad-config.js `supported` — coins the city supports without launching them
  ($DCTY 9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump first; 2026-11-24: + DKYcjob…pump, 2xCd5q…cJjX, 6MKD1N…pump, 9jhs5q…pump; a token without Metaplex metadata gets its card from Dexscreener, a partner off the pump.fun curve is priced there). The list carries them as kind "partner" (no creator, no
  fees, never in creator ranks), EXPLORE pins them after the main coin with a gold SUPPORTED tag, and they'll be on the
  slot mini-game's reels. **CITY SLOTS is built (2026-11-26):** the 🎰 GAME button opens slot.js (rules in slot-data.js,
  tests/slot.test.mjs): the main coin + the supported coins + 7 + ★ (wild) on three reels, the middle line pays; 10 free spins a
  UTC day, +1 a day of streak (≤ +5), titles by streak; points live on the device only (dc.slot) — a toy, never money,
  tokens or rewards. NFT: the set shows its progress and ★ SET COMPLETE at 10 / 10.
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
- **Pass 2 of the clean look (the owner, 2026-11-25: "아래 메뉴도 공간 위쪽이 더 넓은데 … 하나씩 다 스샷 찍어서"):** the dock's five
  items are one height (56 px) and centred (it was bottom-aligned: 16 px above, 7 below), the Launch key a 26 px box; no
  letter-spacing anywhere (Korean spread letter by letter); the phone menu a solid full-screen list (the nav's blur made
  the open menu size itself to the 60 px bar — .nav:has(.navlinks.open) drops it); the desk's chosen tab scrolls into
  view; ranks / filters one row of pills; the coin window's actions an even grid; the footer clears the dock once. The
  wallet, fee, coin and launch windows read in ko / zh / tr (t() in wallet.js, fees.js, launch.js, site.js openCoin).
  The screenshot walk (every page + window, phone in Korean, desktop in English, listing any English left on the Korean
  screens) is the check after a design change.
  The phone menu (2026-11-25, "정리가 안되어 있어"): Launch · NFT · LP · Game · Explore · More as icon tiles in two
  columns (Launch pink, icons as CSS masks keyed by href), the desk's extra pages as compact two-column buttons, the
  language at the foot — one screen, no scroll. Coins with no picture: lib/_pad.mjs supported() takes Dexscreener's logo;
  the page draws the ticker's letters in a round pink badge.
- **No flicker on arrival + the loading scene (the owner, 2026-11-25: "처음 들어가면 깜빡거리던데 … 새로고침 하는듯이 그런것도
  없애줘", "로딩 장면도 수정해봐"):** Pretendard is SELF-HOSTED (fonts/pretendard: the npm package's 92-file dynamic subset,
  OFL — the CDN copy arrived after first paint and every line swapped face); subsets 90 + 91 (Latin + common Hangul) are
  preloaded, and a font gate in index.html's head keeps the page at opacity 0 until the face is loaded (≤ 0.9 s);
  numbers no longer count up from 0 (site-x.js roll sets them); the headline has no slam-in / neon flicker; the hero's
  stand-in sky is the coast's own dark tones (it was a bright pink gradient that turned dark); cards don't pop in on
  every paint; no repainting animation over the hero (the cashback dot's pulse cost desktop 30 fps). The intro: black
  throughout (BG #000), the burst is light only (glow + rays, no cartoon star body, pink / white, no orange), the end
  card = logo + the tag in Pretendard + a pink loading line, a readable skip button.
- **The intro, round 3 (the owner, 2026-11-26: "로딩화면 … 진행하자"):** intro.js — four tableaux (s1 hotel, s2 pergola, s5
  flamingos, s6 sunset), the logo by ~4–5 s (BURST 700 · PER 780/820 · OUT 750; the wait for the first two paintings ≤ 1.2 s,
  the rest load behind them); the first painting fills the screen from the start; graded black & white with pink in the
  light (soft-light; Safari without canvas filters: grey by blend mode); a caption a scene (ixCap1–4), letterbox + grain,
  a pink light leak at each doorway, a lens flare + tiny shake at the burst, the rush-out is a warp of streaks into the
  star; a slow device (> 48 ms a frame) jumps to the warp; swipe up = ×3.2; a big "Tap to skip" at the bottom; 🔇/🔊
  (dc.snd, off by default, Web Audio only). Shared links (/coin, /w, /nft, /lp, #hash, ?coin=) skip it; returning
  visitors get the short end. The end card: the logo landing + sparkle + glow pulse, the live numbers (site.js sets
  window.__dcCoins and fires dc:coins), Launch · Play · Enter, a line that fills when the coins arrive.
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
- **Cashback dashboard + referrals (the owner, 2026-11-26: "응 다 진행하자"):** under the LP pools (cb-ui.js): my cashback,
  today, my rank, what's waiting to be paid (LP + cashback), the top 10 earners (all time + today), my invite link
  (/?ref=<wallet>, kept on the device as dc.ref until linked) and "Link my inviter" — the trader signs
  refMessage once (POST cb-ref; cb/ref/<wallet>.json create-only + cb/refmap.json); the inviter then earns
  cashback.refBps (1000 = 10 %) of that trader's cashback ON TOP (never out of theirs), inside the day's total. The
  coin window (coin-x.js): ★ Watch (dc.watch, a 20 % move → a toast / notification while the page is open, Explore's ★
  filter), Chart (Dexscreener embed), Buy here (Jupiter plugin-v1 modal; jup.ag/swap/SOL-<mint> if it can't load — its
  options are from memory: dev.jup.ag isn't reachable from here). Supported coins: name / symbol override in
  pad-config (AudaCity → AUDACITY) and their logos copied into our Blob (sup/logos.json).
- **Transparency, share pages, install, launch kit (the owner, 2026-11-26):** the Wallets tab ends with "Recent moves, read
  from the chain" (lib/_flows.mjs moveOf / makeFlows, ?flows=1, 5 min: each platform wallet's newest transactions read
  from its side — buy / burn / pay / sell / in / out — every row a Solscan link); /nft and /lp are share pages with their
  own link card (vercel rewrites → ?page=nft|lp, lib/_extra.mjs SECTIONS, images/og-nft.jpg / og-lp.jpg; the head script
  maps the path to the page); manifest.webmanifest + an "Install the app" button only when the browser offers it (fx.js;
  no service worker, so a deploy is never stuck behind a cache); after a launch the share kit (post on X with the CA +
  /coin/<mint>, copy CA / link, the mugshot card).
- **Telegram bot, round 2 (the owner, 2026-11-26):** /watch <CA|$TICKER> (per chat, ≤ 10, tg/watch.json; the poll posts a
  ±20 % move from the last alert into that chat), /unwatch, /watching, /cashback <wallet> (lib/_cashback.mjs view),
  /invite <wallet> (the /?ref= link); anyone's new launch also goes to X when X's keys are set (lib/_extra.mjs announce
  with no hour = "NEW LAUNCH ON GTAFUN"); the daily countdown no longer speaks of hourly drops. After changing the command
  list, GET /api/tg?setup=1 re-registers it with Telegram.
- **Wallet profiles (the owner, 2026-11-26):** /w/<wallet> (vercel rewrite → ?page=w&w= for its link card; the head script
  opens data-page "prof", section #pg-prof, profile.js) reads ?profile=<wallet> (lib/_profile.mjs: its launches, cashback
  + rank + invites, LP rewards, cards, and the badges BADGES — first launch, five launches, made it, cashback, top 10,
  recruiter, crew boss, liquidity, collector, full set; nothing new stored). The wallet window links My profile; the creator
  window links the profile; your own profile shows the slot title kept on the device.
- **ONE stylesheet (2026-11-26):** the home page loads site.min.css, built by `node tools/build-css.mjs` from pad.css +
  site → game → premium → cards → street → clean → motion (that cascade order, comments out, whitespace squeezed); the
  script also stamps index.html's ?v= hash. Edit the source sheets, then rebuild — tests/css.test.mjs fails on a stale
  build. city.html still loads its own sheets.
- **CITY SLOTS' weekly board + the motion pass (the owner, 2026-11-26):** the slot window has Practice (device-only, as
  before) and 🏆 Weekly board: a connected wallet signs slotMessage once a UTC day (POST slot-start → a day token, an
  HMAC — PAD_SLOT_SECRET or derived), every board spin is drawn by the SERVER (POST slot-spin, lib/_slots.mjs,
  crypto.randomInt, the same bag / pay table as slot-data.js), slot/u/<wallet>.json keeps the day's spins + streak,
  slot/week/<monday>.json the week's points; ?slots=1&w= = the top 10. Still a toy score. Motion: the lever pulls, the
  last reel lingers on a near miss, coins rain on 150+/500+; stats tick once when they change; the card zoom flips to
  its back; toasts slide in; launch steps draw their checks; pull to refresh on phones (fx.js → dc:refresh); Explore's
  Show all grows 24 at a time as you scroll; LP has section tabs; small grey text a little brighter. (The top nav isn't
  sticky: html/body overflow makes body its own scroll box — left as it has always been.)
- **Speed (2026-11-25):** the home page never loads the 1 MB Solana kit (vendor/pump-kit.js) — balances on first paint go
  through common.js rpc1 (one JSON-RPC call through ?solrpc); kit() loads only when a wallet action needs it. Inter is
  gone (Barlow Condensed reads everywhere).
- **Pages (the owner, 2026-11-20; order 2026-11-24):** the bottom bar by importance — Launch (a round key, never clipped) · NFT (#cards) · LP (#lp) · Game (/city — "the city" is called the Game everywhere a visitor reads it) · More (the desk: the rest); the top nav Launch · NFT · LP · Game · Explore · More and the nav switch pages
  (html[data-page] home / explore / desk) instead of scrolling; every old #link still lands on its page.
  **NFT and LP are pages of their own (the owner, 2026-11-26: "NFT, LP는 따로 빼 MORE 이랑 똑같은 곳에 두지 말고"):**
  #cards → html[data-page="nft"] (section #pg-nft), #lp → data-page "lp" (#pg-lp); they're no longer tabs in the desk
  (TABS / HASH_TAB without them); site.js paintPage fills each when it opens. MORE (#desk) keeps the rest.
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
- **The home page, round J (the owner, 2026-11-26: "다 진행"):** J1 — 🔥 Trending now + 🆕 Just launched rows (#hot, class
  hotsec — never `.hot`: that's the pink button) right under the hero. J2 — home-x.js: "Right now in the city" (#cityrn —
  never `#city`: pad.css fixes it to the screen) = trades + launches in the last day + cashback credits, newest 8; the
  trust tiles read ?cb=1 / ?flows=1 (no number made up; "–" until read); a notice bar under the ticker, closed for good
  once closed (dc.notice = its id).
