// cards-data.js — GTAFUN CARDS, Season 1 (the owner, 2026-11-24: GTA-style meme cards as NFTs, a gacha pack of 3 for
// 0.1 SOL, the city's own mascots as the art, the SOL to the operations wallet). Shared by the page, the build script
// (tools/cards-build.mjs: card pictures + metadata) and the server.
// The cards are Metaplex Core assets from a Core Candy Machine: every mint picks a random remaining item on chain
// (isSequential false), so the odds below are the share of each card among the 3,000 items — fixed and public.
export const SEASON = {
  id: "s1",
  name: "GTAFUN CARDS — Season 1",
  symbol: "GTAC",
  supply: 3000, // items in the machine (1,000 packs)
  pack: 3, // cards a pack
  packSol: 0.1, // SOL a pack
  royaltyBps: 500, // 5 % on resales, to the operations wallet
  site: "https://gtafun.vercel.app", // where the pictures and metadata are served (absolute: the NFTs point here)
  seed: 20261124, // the shuffle that assigns a card to each item index
};
// lamports a single card (3 make the 0.1 SOL pack: 33,333,334 × 3 = 100,000,002 ≈ 0.1 SOL)
export const CARD_LAMPORTS = Math.ceil((SEASON.packSol * 1e9) / SEASON.pack);
export const RARITY = {
  common: { label: "Common", each: 200, color: "#8d8d93" },
  rare: { label: "Rare", each: 150, color: "#ffffff" },
  epic: { label: "Epic", each: 85, color: "#ff7ab8" },
  legendary: { label: "Legendary", each: 30, color: "#ff2e88" },
};
// [id, name, picture (images/agent), rarity, the line on the card]
export const CARDS = [
  ["boss", "The Boss", "boss-1", "legendary", "Runs the city from the top floor. Nobody sees him; everybody pays him."],
  ["shark", "Pier Shark", "shark-1", "epic", "Owns the docks after midnight. Smiles before he bites."],
  ["cruiser", "Midnight Cruiser", "cruiser-1", "epic", "The fastest ride on the coast road, always one block ahead."],
  ["swamp", "Swamp King", "croc-2", "rare", "Came up from the canals with a gold chain and a plan."],
  ["flamingo", "Rooftop Flamingo", "flamingo-1", "rare", "Pink, sharp and never on the ground for long."],
  ["driver", "Gold Driver", "driver-1", "rare", "Gets the crew out. Never asks where to."],
  ["shadow", "Rooftop Shadow", "shadow-1", "rare", "You only see the outline against the sunset."],
  ["croc", "Dockside Croc", "croc-1", "common", "Cracked the rooftop vault at 3 a.m."],
  ["raccoon", "Alley Raccoon", "raccoon-1", "common", "Every back door in the city knows him."],
  ["bandit", "Palm Bandit", "bandit-1", "common", "Masked, quick, gone before the sirens."],
  ["cat", "Getaway Cat", "cat-1", "common", "Nine lives, one getaway car."],
  ["fox", "Jackpot Fox", "fox-1", "common", "Hits the jackpot, then hits the road."],
  ["gull", "Night Gull", "gull-1", "common", "Steals fries and secrets off the pier."],
  ["owl", "Neon Owl", "owl-1", "common", "Works the night shift. Sees everything."],
  ["pigeon", "Street Pigeon", "pigeon-1", "common", "Knows every rumour in the plaza first."],
  ["racer", "Overpass Racer", "racer-1", "common", "Born under the overpass, raised on neon."],
  ["rat", "Neon Rat", "rat-1", "common", "Small, fast, everywhere."],
  ["buckz", "Buckz", "next-buckz", "common", "Fresh cash on Clock Plaza."],
].map(([id, name, img, rarity, line], i) => ({ id, no: i + 1, name, img, rarity, line }));
export const cardById = (id) => CARDS.find((c) => c.id === id) || null;

/// the item → card map: every card repeated by its rarity's count, shuffled with the season's seed (mulberry32, Fisher–Yates)
export function itemMap(season = SEASON) {
  const list = []; for (const c of CARDS) for (let k = 0; k < RARITY[c.rarity].each; k++) list.push(c.id);
  if (list.length !== season.supply) throw new Error(`the cards make ${list.length} items, the season says ${season.supply}`);
  let a = season.seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
/// a minted asset's name is "GTAFUN Card #<index + 1>" (the machine's $ID+1$) → its card
export function cardOfName(name, map = itemMap()) { const m = /#(\d+)\s*$/.exec(String(name || "")); const i = m ? Number(m[1]) - 1 : -1; return i >= 0 && i < map.length ? cardById(map[i]) : null; }
export const odds = () => Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, (CARDS.filter((c) => c.rarity === k).length * r.each) / SEASON.supply]));
