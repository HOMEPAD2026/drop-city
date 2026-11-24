// pad-config.js — EVERYTHING the owner sets lives here (the page and the server both read it).
// Change a value, push, and the next deploy uses it. The same values can also be set without a code change as
// Vercel environment variables (they win over this file): PAD_NAME, PAD_TICKER, PAD_SUFFIX, PAD_VAULT, PAD_BUYER,
// PAD_MAIN (the main coin's address, once it's launched — featured on the site), PAD_AGENT_KEY (the agent wallet's
// secret key — Sensitive, never in a file).
export const PAD = {
  name: "DROP CITY", // the site's name (working name)
  ticker: "DROP", // the main coin's ticker — it launches here as the first drop
  // every coin launched here gets an address that ENDS with these letters (case-sensitive base58: no 0 O I l).
  // "" = a normal random address. 1–4 letters; each extra letter makes finding one about 58 times slower
  // (3 letters ≈ 195,000 tries — seconds on a computer; 4 letters ≈ 11 million — minutes).
  suffix: "",
  vault: "", // THE VAULT — 30 % of every coin's creator fees (the city fund). Empty = launching is closed
  buyer: "7yajVrzpMV8MBmvWnVrniD14FVs73muNqSqGsvG9B9Jb", // 10 % — this wallet buys the main coin with it
  main: "8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA", // the main coin (featured on the site; PAD_MAIN overrides)
  split: { creator: 6000, vault: 3000, buyer: 1000 }, // basis points, locked on chain at every launch
  // coins the owner lists although their split didn't lock (launched before the fix) — all their creator fees go to
  // their creator; the city shows them as "no split"
  listAnyway: ["8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA"],
  dropsPerDay: 24,
  // the agent's hourly drops — OFF since 2026-11-24 (the owner: the AI no longer launches a coin every hour; the city
  // supports the coins below instead). Its old drops stay listed and their fees still go on to THE VAULT. PAD_DROPS=1 turns it back on
  drops: false,
  // LP rewards (the owner, 2026-11-24): Raydium CPMM pools of the supported coins with SOL and with the main coin; the main
  // coin paid out, daily in total (split hour by hour across the pools by liquidity, main-coin pairs × boostMain, inside a
  // pool by LP held). wallet = the rewards wallet that pays (a GM's own; PAD_LP_WALLET overrides); PAD_LP_DAILY the amount
  lp: { daily: 1000000, boostMain: 1.5, minUsd: 10, minPoolUsd: 1000, minPay: 100, wallet: "", exclude: [] }, // minPoolUsd: a smaller pool earns nothing
  // GTAFUN CARDS (the owner, 2026-11-24): NFT packs of 3 for 0.1 SOL from a Core Candy Machine (cards-data.js). cm and
  // collection are filled by the operations wallet's setup on the page (or PAD_CARDS_CM / PAD_CARDS_COLLECTION); wallet =
  // the operations wallet that owns the machine and receives the SOL (PAD_CARDS_WALLET, else PAD_LP_WALLET)
  cards: { cm: "", collection: "", wallet: "" },
  // coins the city SUPPORTS (the owner, 2026-11-20): not launched here, shown in EXPLORE with a SUPPORTED tag and kept
  // for the slot mini-game to come. note = the line under the card
  supported: [
    { mint: "9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump", note: "We support $DCTY — it will also be in the slot mini-game." },
    // added 2026-11-24 (the owner) — also the coins the city's liquidity will be paired with (the LP rewards to come)
    { mint: "DKYcjobF7HPtL9RyQBRdeRQ2iWvizpfbgWwPWNXdpump", note: "" },
    { mint: "2xCd5qHX5tW6pGUo7zfgHSSAnRjJwPA7Sz1Fu4fWcJjX", note: "" },
    { mint: "6MKD1NkLvWRqdbFtqmgACBwUV5o6GJpZry8HkNgzpump", note: "" },
    { mint: "9jhs5qoJnUFU7AZXbsiD1Q6De6FVsino9Ysw8QU6pump", note: "" },
  ],
  // what a coin can trade against besides SOL (the launch form's "pair"): tokens pump.fun admits as a quote. TTWO =
  // Take-Two Interactive's tokenized share by Backpack Securities (Token-2022, 6 decimals) — on pump.fun's QuoteControl
  // list (checked with /api/pad?quotes). dev = the first-buy choices, in the token; live = shown in the launch form (off until a launch simulates clean)
  quotes: [
    { id: "TTWO", name: "Take-Two (TTWO)", mint: "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", decimals: 6, dev: [0.01, 0.05, 0.1], live: true },
  ], // the agent drops one coin at the top of every UTC hour; everyone else launches any time, no limit
};
