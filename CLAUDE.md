# Notes for Claude (drop-city)

The owner's standing facts — keep every page, bot message, post and tweet true to them:

- **The main coin** (`PAD.main` / env `PAD_MAIN`, 8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA) is the dev's own coin, launched
  before the fee-split fix: **no split — its creator fees go 100 % to the dev** (the owner, 2026-11-18). Never describe it as
  60 / 30 / 10.
- **The 60 / 30 / 10 split** (creator · THE VAULT · the main-coin buyer) applies only to coins **launched on the platform**:
  the agent's hourly drops (its 60 % goes on to THE VAULT, keeping a 0.5 SOL reserve) and everyone's own launches.
- Replies to the owner are in Korean; bot messages, site copy and tweets are in English.
- The site's name, ticker and CA suffix come from config (Vercel env); code and generated promo material stay name-neutral.
- **Pairs (the owner, 2026-11-18):** a launch can pick SOL or TTWO (Backpack's tokenized Take-Two share,
  TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo, on pump.fun's QuoteControl list) as its pair — pad-config.js `quotes`. A TTWO
  coin's first buy and creator fees are in TTWO; the 60 / 30 / 10 split is the same. Agent drops stay SOL.
- The agent's logos come from images/agent (the owner's mascot art); a drop's name is picked from those subjects.
- **STREET mode (the owner, 2026-11-19):** the city opens on foot (roam.js) with a random crime-flavoured handle and a
  KayKit crew body (CC0). Handles stay generic (no game titles, studios, cities or characters from other games). Street
  cash / wanted stars are a toy score on the device — never describe them as rewards, tokens or anything on chain.
- **The website (the owner, 2026-11-19):** one short page — a compact hero over the coast at dusk, EXPLORE (two rows of
  cards, then Show all), the city band, and THE DESK: eight tabs (This hour · Ranks · Launch · Fees · Wallets · Check a CA ·
  My coins · About; the head script picks the tab from the hash before first paint, every old #link still lands). The
  entry intro "Last light" and the hero's sky are coast.js — original art drawn in code (sky, sun, skyline with the clock
  tower, water, palms, neon). A warm coast-at-dusk mood is fine; never imitate a game's logo treatment, cover art,
  characters or names, and never draw text into the canvas. Words live in i18n.js (en in the code, ko / zh / tr there).
