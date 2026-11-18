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
