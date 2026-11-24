// tools/cards-build.mjs — GTAFUN CARDS, Season 1: renders each card's picture (tools/cards-render.html in a browser) to
// nft/img/<id>.png (750×1050, what the NFT shows) and nft/img/<id>-360.webp (the site), and writes the metadata every
// minted asset points at: nft/collection.json and nft/m/<index>.json (one per item; the machine's URIs are
// <site>/nft/m/$ID$.json). Run from the repo root with the local server up: node tools/cards-build.mjs [http://localhost:8791]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { SEASON, CARDS, RARITY, itemMap } from "../cards-data.js";
const require = createRequire(import.meta.url);
const base = process.argv[2] || "http://localhost:8791";
mkdirSync("nft/img", { recursive: true }); mkdirSync("nft/m", { recursive: true });
// ---- the pictures
const { chromium } = require(process.env.PW || "playwright");
const sharp = require(new URL("./cards-kit/node_modules/sharp", import.meta.url).pathname);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 750, height: 1050 }, deviceScaleFactor: 1 });
for (const c of CARDS) {
  await p.goto(`${base}/tools/cards-render.html?id=${c.id}`); await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  const png = await p.locator(".card").screenshot({ omitBackground: true });
  writeFileSync(`nft/img/${c.id}.png`, await sharp(png).png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 }).toBuffer());
  writeFileSync(`nft/img/${c.id}-360.webp`, await sharp(png).resize(360).webp({ quality: 84 }).toBuffer());
  console.log("card", c.id);
}
await b.close();
// ---- the metadata
const img = (c) => `${SEASON.site}/nft/img/${c.id}.png`;
writeFileSync("nft/collection.json", JSON.stringify({ name: SEASON.name, symbol: SEASON.symbol, description: `${CARDS.length} characters of the city, ${SEASON.supply} cards. Packs of ${SEASON.pack} on ${SEASON.site.replace(/^https?:\/\//, "")}.`, image: img(CARDS[0]), external_url: SEASON.site + "/#cards" }));
const map = itemMap();
map.forEach((id, i) => {
  const c = CARDS.find((x) => x.id === id);
  writeFileSync(`nft/m/${i}.json`, JSON.stringify({ name: `${c.name} #${i + 1}`, symbol: SEASON.symbol, description: c.line, image: img(c), external_url: SEASON.site + "/#cards",
    attributes: [{ trait_type: "Character", value: c.name }, { trait_type: "Rarity", value: RARITY[c.rarity].label }, { trait_type: "Card", value: `${c.no} / ${CARDS.length}` }, { trait_type: "Season", value: "1" }],
    properties: { files: [{ uri: img(c), type: "image/png" }], category: "image" } }));
});
console.log("metadata", map.length);
