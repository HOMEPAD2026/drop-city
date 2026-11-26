# larpcheck.app — reference capture (BLOCKED)

**Result: the site could not be read from this environment.** No checks, layout, design tokens or data
requests of larpcheck.app were captured. Nothing below is guessed or filled in from memory.

## What happened (2026-11-26, ~09:33 UTC)

1. `curl https://larpcheck.app/` → **HTTP/2 403**, `server: cloudflare`, `cf-mitigated: challenge`,
   page title "Just a moment..." — Cloudflare's *managed challenge* (Turnstile), zone `larpcheck.app`.
2. Playwright + the preinstalled Chromium (headless, 1440×900, plain `chromium.launch()`), waited 30 s:
   the page stayed on "Performing security verification … This page is displayed while the website verifies
   you are not a bot." (Ray ID a607e470ce7aaef5). The challenge never cleared, so no token address could be
   entered and no result page was reached. Screenshot: `shots/desktop-landing-cloudflare-challenge.png`.
   I did not try to get past the bot check (stealth plugins, spoofed fingerprints, solver services) —
   that's evading the site's protection, not reading a public page.
3. Fallback — the Internet Archive: `archive.org/wayback/available` reports a snapshot
   (`web.archive.org/web/20261013083828/https://larpcheck.app/`), but every connection to
   **web.archive.org** from here was reset (agent proxy: `ws_closed_mid_exchange`, 6 attempts with curl,
   1 with Chromium → 502). So the archived copy couldn't be read either.

## Requests seen

Only Cloudflare's challenge traffic (see `requests.json`): `larpcheck.app/` (403),
`/cdn-cgi/challenge-platform/...`, `challenges.cloudflare.com/turnstile/...`. **No app/API request was made**,
so the check-data endpoints and their JSON shapes are unknown.

## Not captured (all of step 3 of the brief)

- the list of safety checks, their labels, thresholds, score / verdict design
- layout (desktop + phone), sizes, column counts
- colours, fonts, radii, shadows, buttons, animations, breakpoints
- phone screenshots (the phone load would hit the same challenge)

## Ways to get it

- Someone opens larpcheck.app in a normal browser and shares screenshots (landing + a result page +
  each tab, desktop and phone) — enough to write the check list and the layout from.
- Retry the Wayback snapshot from a session where web.archive.org is reachable
  (`https://web.archive.org/web/20261013083828/https://larpcheck.app/`); it shows the landing page
  only, probably not a result page (results come from client-side API calls).
- Build our checker from the standard, documented Solana checks without their page: mint authority
  revoked, freeze authority revoked, metadata mutable, top-10 holder %, creator/dev holding %, LP
  burned/locked, bundled/sniper buys in the first block (we already read that: lib/_clean.mjs),
  honeypot/transfer-fee extension (Token-2022), liquidity size, coin age.
