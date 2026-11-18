// pad-config.js — EVERYTHING the owner sets lives here (the page and the server both read it).
// Change a value, push, and the next deploy uses it. The same values can also be set without a code change as
// Vercel environment variables (they win over this file): PAD_NAME, PAD_TICKER, PAD_SUFFIX, PAD_VAULT, PAD_BUYER.
export const PAD = {
  name: "DROP CITY", // the site's name (working name)
  ticker: "DROP", // the main coin's ticker — it launches here as the first drop
  // every coin launched here gets an address that ENDS with these letters (case-sensitive base58: no 0 O I l).
  // "" = a normal random address. 1–4 letters; each extra letter makes finding one about 58 times slower
  // (3 letters ≈ 195,000 tries — seconds on a computer; 4 letters ≈ 11 million — minutes).
  suffix: "",
  vault: "", // THE VAULT — 30 % of every coin's creator fees (the city fund). Empty = launching is closed
  buyer: "7yajVrzpMV8MBmvWnVrniD14FVs73muNqSqGsvG9B9Jb", // 10 % — this wallet buys the main coin with it
  split: { creator: 6000, vault: 3000, buyer: 1000 }, // basis points, locked on chain at every launch
  dropsPerDay: 24, // one drop an hour (UTC hours)
  holdMin: 10, // a reserved hour waits this long for its launch, then the next sponsor may take it
};
