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
