// tools/cards-build.mjs — GTAFUN CARDS, Season 1: each card's picture from the owner's art (nft/src/<id>.png) to
// nft/img/<id>.png (600×960, what the NFT shows) and nft/img/<id>-360.webp (the site), and writes the metadata every
// minted asset points at: nft/collection.json and nft/m/<index>.json (one per item; the machine's URIs are
// <site>/nft/m/$ID$.json). Run from the repo root: node tools/cards-build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { SEASON, CARDS, RARITY, itemMap } from "../cards-data.js";
const require = createRequire(import.meta.url);
mkdirSync("nft/img", { recursive: true }); mkdirSync("nft/m", { recursive: true });
// ---- the pictures: the owner's card art (nft/src/<id>.png, cut from their sheet, 2026-11-25) centred on one 600×960
// transparent canvas, so every card has the same shape on the page and in wallets
const sharp = require(new URL("./cards-kit/node_modules/sharp", import.meta.url).pathname);
for (const c of CARDS) {
  const png = await sharp(`nft/src/${c.img}.png`).resize(600, 960, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  writeFileSync(`nft/img/${c.id}.png`, await sharp(png).png({ compressionLevel: 9, quality: 92, effort: 10 }).toBuffer());
  writeFileSync(`nft/img/${c.id}-360.webp`, await sharp(png).resize(360).webp({ quality: 86 }).toBuffer());
  console.log("card", c.id);
}
// ---- the metadata
const img = (c) => `${SEASON.site}/nft/img/${c.id}.png`;
writeFileSync("nft/collection.json", JSON.stringify({ name: SEASON.name, symbol: SEASON.symbol, description: `The ${CARDS.length} top meme characters, ${SEASON.supply} cards. Packs of ${SEASON.pack} on ${SEASON.site.replace(/^https?:\/\//, "")}.`, image: img(CARDS[0]), external_url: SEASON.site + "/#cards" }));
const map = itemMap();
map.forEach((id, i) => {
  const c = CARDS.find((x) => x.id === id);
  writeFileSync(`nft/m/${i}.json`, JSON.stringify({ name: `${c.name} #${i + 1}`, symbol: SEASON.symbol, description: c.line, image: img(c), external_url: SEASON.site + "/#cards",
    attributes: [{ trait_type: "Character", value: c.name }, { trait_type: "Rarity", value: RARITY[c.rarity].label }, { trait_type: "Card", value: `${c.no} / ${CARDS.length}` }, { trait_type: "Season", value: "1" }],
    properties: { files: [{ uri: img(c), type: "image/png" }], category: "image" } }));
});
console.log("metadata", map.length);
