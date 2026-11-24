# Design reference — gtamemes.xyz (captured 2026-11-24)

Screenshots of the live site, for **reference only**. Nothing of theirs (images, video, fonts, logos) is
downloaded or committed here — just our own screenshots and the facts read from the page's computed styles.

## Entry flow

1. `desktop-00-load.png` — for a split second the hero video's first frame shows (painted mural wall, crew
   standing in front).
2. Then a **black "title screen" gate**: the wordmark in Pricedown (white, centred), under it **PRESS START**
   in a pixel font, gold `#F4C430` with a soft glow, blinking; at the bottom a tiny "🔈 SOUND ON" toggle
   (`desktop-01-intro-2s.png`, `phone-02-after-6s.png`). It waits for a click — no auto-advance.
3. Click → straight into the hero (`desktop-press-start-1s/4s.png`), with music on.

## Fonts (from `document.fonts` + computed styles)

| Role | Font | Notes |
|---|---|---|
| Wordmark, h1/h2/h3 section titles | **Pricedown** 400 | the GTA-logo face; mostly lower-case ("the lineup", "rewards", "bounty board"); h1 96px, h2 60–96px, card h3 30px |
| Buttons, labels, tabs, HUD, kickers | **Press Start 2P** (pixel) | 8–12px, letter-spacing 0.8–1.8px, uppercase content; also **Silkscreen** for small HUD text |
| Body copy | **Barlow Condensed** 500/700 | 16px, condensed sans |
| The BAWSAQ stock-exchange block | **Archivo** 800/900 (900 italic for the "BAWSAQ®" logo, 64px) | in-game-website parody |
| Misc display | Titan One | |

## Colours

| Use | Value |
|---|---|
| Page background | pure black `#000000`; sections alternate `#000`, `#0A0512` (rewards, purple-black), `#07070C` (bounty) |
| Stock-exchange section bg | dark olive `oklch(0.2 0.025 120)` ≈ `#1A1D12`; rows ≈ `#444E2E`; text ≈ `#EFF0E8` |
| Text | white `#FFFFFF`, white at 85 / 70 / 55 % for secondary; warm grey `#B8B4A8` |
| Headline grey (as rendered) | Pricedown titles read as a light grey ≈ `#A0A0A0` on black in screenshots |
| Accent 1 — gold | `#F4C430` (filled buttons, active tab), `#E8B23A` (outlines, kickers, frames) |
| Accent 2 — hot pink | `#FF4FA3` / `#FF3EA5` (`// NEW MISSION` kickers, heart icons, HUD holders) |
| Accent 3 — money green | `#7CE577` (MCAP / $ numbers, "CA" label) |
| Red | `#E0243C` (stamps, bounty), `#FF4D4D` (decline-call) |
| Borders | white at 15 % (`rgba(255,255,255,.15)`) hairlines; gold `#E8B23A` on framed cards |
| Panels | black at 60–80 % over imagery |

## Buttons

- **Primary**: gold `#F4C430` fill, black Press Start 2P text, 12px, uppercase, letter-spacing 1.2px,
  padding 16×24px, radius 8px (SUBMIT IDEA); FOLLOW the same with a darker gold, radius ~2px.
- **Tabs** (TOP VIEWS / LATEST): 9px pixel font, ls 1.8px, padding 10×16, radius 0, 1px border; active = gold fill + black
  text, idle = black 60 % + white 70 % text + white hairline.
- **Ghost**: transparent / black 60 %, 1px gold or white border, gold pixel text, square corners, ↗ arrow
  (VIEW ALL MOST WANTED ↗, LOAD MORE POSTS).
- **Mission cards' buttons**: solid black, white pixel text, full width, square.
- **CA chip**: black 65 %, 1px white 78 % border, radius 6px, green "CA" + white truncated address + copy icon; next to it
  a square black X (Twitter) button.
- Hover (`desktop-btn-*-rest/-hover.png`): subtle — slight brighten / bg tint, transitions 0.15–0.3s
  `cubic-bezier(.4,0,.2,1)`; no big scale or glow.

## Navigation

- **No nav bar at all** — no top menu, no hamburger, no phone bottom bar. One long scrolling page.
- Instead, a fixed **game HUD** overlays everything:
  - top-left: clock `22:07 UTC` (hours in a black box), date `24.11`, `MCAP $000077373` (green, zero-padded like GTA
    money), `♥ 100 HOLDERS` (pink), `★ STREET CRED` (gold), tiny "SEASON 1 COMPLETE · SEE THE WINNERS";
  - top-right: "VI" + a **5-star wanted level** (3 gold, 2 dark);
  - bottom: a 28px **marquee "parody bar"** (disclaimer scrolling, pixel font);
  - bottom-right: an old **flip-phone with an "incoming call"** (character on pink screen, green/red answer buttons,
    vibrating animation) — a popup/CTA;
  - soft black gradients 8vh tall at top and bottom of the viewport.
- Phone: identical structure scaled down; HUD text gets bigger relative to the screen; no menu (`phone-*`).

## Sections (in order)

1. **Hero** — full-screen looping video background (painted street-mural scene: pink wall, palm shadows,
   sunset) under a black gradient; bottom-left: wordmark (Pricedown, 96px, white) + CA chip + X button; "SCROLL" cue.
2. **Most Wanted Posts** (`LIVE FROM X` kicker) — follow button, 5 stat tiles (followers, views, likes, reposts,
   replies; icon + big Pricedown number + pixel label), tabs, 3-column grid of video cards (16:9 thumb, "▶ VIDEO" pill,
   view count pill, caption, stats row); then "Street Talk" (comments).
3. **the lineup** (`// MOST WANTED`) — police line-up wall with height marks; 3 full-body renders with gold-framed
   black name plates ("CRIMINAL RANK #01", handle, $ amount in green), centre #1 raised.
4. **BAWSAQ®** — parody stock exchange in olive/terminal colours: market-leaders table, then **THE $200K HEIST**
   progress strip, then a billboard banner.
5. **rewards** (`// SEASON 1 REWARDS`) — 4 framed prize cards (#1 … #4-10) with "EARN CRED" buttons, on `#0A0512`.
6. **most wanted** — leaderboard teaser list.
7. **THE CREW** — full-screen dim cinematic still, centred title, "SEE THE WINNERS" button.
8. **bounty board** (`// WANTED`) — 96px title, dark stylised city **map** with pins.
9. **mission: get $GTA** (`// NEW MISSION`) — 4 staggered light-grey cards (01–04, black number tag, pink line icon,
   Pricedown h3, Barlow body, black button) = how-to-buy steps.
10. **Submit Your Ideas** — form over a dark collage, gold SUBMIT IDEA button.

Section headers share one pattern: pink or gold pixel kicker `// SOMETHING`, a huge Pricedown title, a gold pixel
sub-line in caps.

## Motion

Keyframes found: `intro-rise`, `star-pop`, `five-star-shimmer/glint`, `ca-pulse` (2.5s loop on the CA chip),
`marquee-x` (60s), `marquee-y` (42–58s vertical image columns), `parody-scroll`, `phone-vibrate` (0.65s loop),
`lineup-step-in` + `lineup-sway` (9s idle sway), `heist-enter/live/fill`, `mission-passed-in`, `pause-whoosh`,
`market-odometer-roll`, `bq-shimmer`, `bounty-stamp`, `blink-slow` (PRESS START). Sections fade-up on scroll
(opacity + transform 0.6s ease-out, staggered 0.1–0.2s).

## Imagery

AI-painted / rendered GTA-style characters and scenes (a mural wall, mugshot line-up, cinematic stills), a looping
hero video, dark map graphic, product photos for rewards. No noise texture; flat black backgrounds between image
sections; gradients only as dark vignettes.

## The feel

- A **game's title screen → in-game HUD** — PRESS START gate, clock/money/wanted stars always on screen.
- **Black, heavy and cinematic**: full-bleed imagery separated by flat black bands.
- **Three typographic voices**: Pricedown for shouting, pixel font for UI/labels, condensed sans for reading.
- **Small, saturated accents** on black: gold for action, hot pink for kickers, money-green for numbers.
- Square / near-square corners, hairline borders, gold-framed plates — no rounded "app" look, no glassmorphism.
- **Parody in-world websites** (BAWSAQ stock exchange, police line-up, bounty board, mission objectives) — every
  section is a GTA trope.
- Lots of small looping motion (marquees, vibrating phone, shimmering stars) but no flashy transitions.
- No navigation: one long scroll, story-like.

## Files

| File | What |
|---|---|
| `desktop-00-load.png` | first paint at ~0.4s (hero frame before the gate) |
| `desktop-01-intro-2s.png` | the PRESS START gate (same at 6s) |
| `desktop-press-start-1s.png`, `-4s.png` | right after clicking PRESS START |
| `desktop-03-first-screen.png` | hero, 1440×900, after scrolling the page once |
| `desktop-04-full.jpg` | full page, 1440 wide (q80) |
| `desktop-scroll-01…10.jpg` | each following viewport (900px steps) |
| `desktop-btn-N-*-rest.png` / `-hover.png` | button rest vs hover crops |
| `phone-01-intro-2s.png` | phone, 2s (hero frame) |
| `phone-02-after-6s.png` | phone PRESS START gate |
| `phone-press-start-1s.png`, `-4s.png` | phone after tapping PRESS START |
| `phone-03-first-screen.png` | phone hero 390×844 @2x |
| `phone-04-full.jpg` | phone full page (q70) |

(No phone menu screenshot: the site has no menu, drawer or bottom bar.)
