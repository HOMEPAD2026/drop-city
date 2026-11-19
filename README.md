# DROP CITY (working name)

One drop an hour on pump.fun, in a neon coast city.

- Every coin is an ordinary pump.fun coin launched from the sponsor's own Solana wallet.
- Its creator fees are split on chain at launch: **60 % sponsor · 30 % THE VAULT (city fund) · 10 % buys the main coin**.
- One drop per UTC hour (24 a day): reserve the hour with a signed message, launch within 10 minutes, the server checks the chain and lists it.
- Every address can end with the same letters: set `suffix` in `pad-config.js` (or the `PAD_SUFFIX` env var); the visitor's browser finds a matching key before the launch — the key never leaves the browser.

## Settings (`pad-config.js`, or Vercel env vars that win over it)

| Setting | Env var | Meaning |
|---|---|---|
| name | PAD_NAME | site name |
| ticker | PAD_TICKER | the main coin's ticker |
| suffix | PAD_SUFFIX | every coin's address ends with these letters (0–4, base58) |
| vault | PAD_VAULT | THE VAULT wallet (30 %) — launching stays closed until it's set |
| buyer | PAD_BUYER | the wallet that buys the main coin (10 %) |

| quotes | — | other pairs a coin can launch with besides SOL (each `{ id, mint, program, decimals, live }`; TTWO = Backpack's tokenized Take-Two share). pump.fun must admit the token as a quote (`/api/pad?quotes` lists them); `/api/pad?simquote=TTWO` simulates a launch with it (nothing is sent). `live: false` keeps it out of the launch form. |

A token-pair launch is create + the locked split as one v0 transaction through the city's lookup table (the agent adds the pairs' shared accounts to it on its next tick), then the first buy as a second transaction; its creator fees wait in the token and are paid out in it.

Other env: `BLOB_READ_WRITE_TOKEN` (a connected Vercel Blob store), `SOLANA_RPC_URL` (optional, a paid RPC).

`?demo=1` shows a made-up city. Tests: `npm test`.

## The hourly agent

The city's agent launches one coin at the top of every UTC hour from its own wallet; everyone else launches any time,
with no limit. The agent runs when `/api/pad?tick=1` is called — by `.github/workflows/drop.yml` a few times an hour and by
visitors' pages when the hour has no drop yet. It drops at most once an hour.

Vercel environment variables (Sensitive where marked):

- `PAD_AGENT_KEY` (Sensitive) — the agent wallet's secret key (base58 as Phantom exports it, or a JSON byte array).
  Fund it with ~0.6 SOL: each drop costs ~0.03 SOL, and everything over 0.5 SOL goes on to THE VAULT.
- `SOLANA_RPC_URL` (Sensitive, recommended) — a private Solana RPC (Helius, QuickNode …); the public one rate-limits.
- `ANTHROPIC_API_KEY` (optional) — names and stories from Claude; without it the city's own word lists.
- `OPENAI_API_KEY` (optional) — logos from an image model; without it a neon badge with the ticker.
- `PAD_AGENT_BUY` (optional) — the agent's first buy in SOL (0–1, default 0).
- `PAD_MAIN` — the main coin's address once it's launched.

## The Telegram bot

1. Make a bot with @BotFather and put its token in the Vercel env `TG_BOT_TOKEN` (Sensitive).
2. Add the bot to your channel or group (as an admin in a channel). Send `/id` there — the bot answers with the chat's id.
   Put it (or several, comma-separated) in `TG_CHAT_ID`. Redeploy.
3. Open `https://<site>/api/tg?setup=1` once: it points the webhook here and sets the command list.

It answers /drop /new /top /main /coin /check /vote /fees /launch /gta6 /news /links /help, welcomes new members, and posts
the agent's hourly drops, new launches, graduations, big buys (`TG_WHALE_SOL`, default 2), GTA VI news (`TG_NEWS=0` turns it
off) and a daily countdown to GTA VI (`GTA6_DATE`, default 2026-11-19). The scheduler (.github/workflows/drop.yml) calls
`/api/tg?poll=1` after each agent tick.

## On foot (STREET mode, `roam.js`)

Opening the city puts you in the streets: a random crew handle (`dc.me` on the device, editable, 🎲) and one of four
crew looks (KayKit Adventurers by Kay Lousberg, CC0 — `models/crew/*.glb`, moves in `models/crew/moves.glb`, the same
rig and clips ARCIRCLE WORLD uses). WASD / thumb stick to move (Shift or a full push runs), Space / JUMP, F / PUNCH,
E / tap to open the coin tower you're standing at; drag to look. Rival crews wander the plaza and fight back; ATMs crack
after three punches; every crime raises the WANTED stars and three stars bring the helicopter. Street cash is a toy
score kept on the device — nothing touches a wallet or the chain. MAP brings back the overview; `?view=map` or
`?coin=<mint>` opens in it.
