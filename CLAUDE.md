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
- **LP rewards (the owner, 2026-11-24 — planned, not built):** the city's liquidity will be paired with the supported coins
  and LPs rewarded; design and decisions pending.
- **Supported coins (the owner, 2026-11-20):** pad-config.js `supported` — coins the city supports without launching them
  ($DCTY 9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump first; 2026-11-24: + DKYcjob…pump, 2xCd5q…cJjX, 6MKD1N…pump, 9jhs5q…pump; a token without Metaplex metadata gets its card from Dexscreener, a partner off the pump.fun curve is priced there). The list carries them as kind "partner" (no creator, no
  fees, never in creator ranks), EXPLORE pins them after the main coin with a gold SUPPORTED tag, and they'll be on the
  slot mini-game's reels. The slot game itself is "coming soon" (the 🎰 GAME button in the top bar) — not built yet.
- **Pages (the owner, 2026-11-20):** the bottom bar (Home · Explore · Launch · City · More — More opens the desk: vote, ranks, fees, wallets, check a CA, my coins, about) and the nav switch pages
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
