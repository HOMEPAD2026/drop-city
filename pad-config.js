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
  // what a coin can trade against besides SOL (the launch form's "pair"): tokens pump.fun admits as a quote. TTWO =
  // Take-Two Interactive's tokenized share by Backpack Securities (Token-2022, 6 decimals) — on pump.fun's QuoteControl
  // list (checked with /api/pad?quotes). dev = the first-buy choices, in the token; live = shown in the launch form (off until a launch simulates clean)
  quotes: [
    { id: "TTWO", name: "Take-Two (TTWO)", mint: "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", decimals: 6, dev: [0.01, 0.05, 0.1], live: true },
  ], // the agent drops one coin at the top of every UTC hour; everyone else launches any time, no limit
};
