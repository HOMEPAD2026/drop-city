// tools/cards-kit/entry.mjs — the browser side of GTAFUN CARDS (window.CardsKit, built to vendor/cards-kit.js with
import "./polyfill.mjs";
// `npm run build`): Metaplex Core + the Core Candy Machine through Umi. Every function returns ready-to-sign web3.js
// VersionedTransactions: the fresh keypairs (the collection, the machine, each new card) have already signed, the
// visitor's wallet signs last (one approval for the lot) and the page sends them through its own connection.
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, createNoopSigner, signerIdentity, publicKey, some, sol, transactionBuilder } from "@metaplex-foundation/umi";
import { mplCandyMachine, create, addConfigLines, mintV1, fetchCandyMachine, safeFetchCandyGuard } from "@metaplex-foundation/mpl-core-candy-machine";
import { mplCore, createCollection, fetchAsset, ruleSet } from "@metaplex-foundation/mpl-core";
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

const umiOf = (endpoint, wallet) => createUmi(endpoint).use(mplCandyMachine()).use(mplCore()).use(signerIdentity(createNoopSigner(publicKey(wallet))));
async function seal(umi, builder) { const bh = await umi.rpc.getLatestBlockhash(); const tx = await builder.setBlockhash(bh).buildAndSign(umi); return { tx: toWeb3JsTransaction(tx), lastValid: bh.lastValidBlockHeight }; }

/// one-time setup, signed by the operations wallet: the collection (5 % royalties to it), then the machine with its
/// guard (solPayment: `lamports` a card to `destination`), random order, names "<prefixName>$ID+1$", URIs "<prefixUri>$ID$.json"
export async function setupTxs({ endpoint, wallet, name, uri, royaltyBps = 500, supply, prefixName, prefixUri, lamports, destination }) {
  const umi = umiOf(endpoint, wallet), collection = generateSigner(umi), cm = generateSigner(umi);
  const t1 = await seal(umi, transactionBuilder().add(setComputeUnitPrice(umi, { microLamports: 100000 })).add(createCollection(umi, { collection, name, uri,
    plugins: [{ type: "Royalties", basisPoints: royaltyBps, creators: [{ address: publicKey(destination), percentage: 100 }], ruleSet: ruleSet("None") }] })));
  const make = await create(umi, { candyMachine: cm, collection: collection.publicKey, collectionUpdateAuthority: umi.identity, itemsAvailable: supply, isMutable: true,
    configLineSettings: some({ prefixName, nameLength: 0, prefixUri, uriLength: 0, isSequential: false }),
    guards: { solPayment: some({ lamports: sol(lamports / 1e9), destination: publicKey(destination) }) } });
  const t2 = await seal(umi, transactionBuilder().add(setComputeUnitLimit(umi, { units: 600000 })).add(setComputeUnitPrice(umi, { microLamports: 100000 })).add(make));
  return { txs: [t1.tx, t2.tx], collection: String(collection.publicKey), candyMachine: String(cm.publicKey) };
}
/// load the items (empty lines: every name and URI comes from the prefixes) — `per` a transaction
export async function linesTxs({ endpoint, wallet, candyMachine, from, count, per = 110 }) {
  const umi = umiOf(endpoint, wallet), out = [];
  for (let i = from; i < from + count; i += per) {
    const n = Math.min(per, from + count - i);
    out.push((await seal(umi, transactionBuilder().add(setComputeUnitPrice(umi, { microLamports: 50000 })).add(addConfigLines(umi, { candyMachine: publicKey(candyMachine), index: i, configLines: Array.from({ length: n }, () => ({ name: "", uri: "" })) })))).tx);
  }
  return out;
}
/// a pack: `n` cards, one transaction each (a fresh asset keypair signs each); the wallet pays `lamports` a card to `destination`
export async function packTxs({ endpoint, wallet, candyMachine, collection, destination, n = 3, cuPrice = 100000 }) {
  const umi = umiOf(endpoint, wallet), txs = [], assets = [];
  for (let k = 0; k < n; k++) {
    const asset = generateSigner(umi); assets.push(String(asset.publicKey));
    txs.push((await seal(umi, transactionBuilder().add(setComputeUnitLimit(umi, { units: 800000 })).add(setComputeUnitPrice(umi, { microLamports: cuPrice }))
      .add(mintV1(umi, { candyMachine: publicKey(candyMachine), asset, collection: publicKey(collection), mintArgs: { solPayment: some({ destination: publicKey(destination) }) } })))).tx);
  }
  return { txs, assets };
}
/// the machine's state: items loaded / redeemed / available, its authority, its collection, whether its guard exists
export async function machineState({ endpoint, candyMachine }) {
  const umi = createUmi(endpoint).use(mplCandyMachine()).use(mplCore());
  const m = await fetchCandyMachine(umi, publicKey(candyMachine)), g = await safeFetchCandyGuard(umi, m.mintAuthority).catch(() => null);
  return { authority: String(m.authority), mintAuthority: String(m.mintAuthority), collection: String(m.collectionMint), itemsAvailable: Number(m.data.itemsAvailable), itemsLoaded: Number(m.itemsLoaded), itemsRedeemed: Number(m.itemsRedeemed), guard: !!g };
}
/// minted cards: name, URI, owner
export async function assets({ endpoint, ids }) {
  const umi = createUmi(endpoint).use(mplCore());
  return Promise.all(ids.map((id) => fetchAsset(umi, publicKey(id)).then((a) => ({ id, name: a.name, uri: a.uri, owner: String(a.owner) })).catch(() => ({ id, missing: true }))));
}
const kit = { setupTxs, linesTxs, packTxs, machineState, assets, v: "mpl-core-candy-machine 0.3.0" };
if (typeof window !== "undefined") window.CardsKit = kit; else globalThis.CardsKit = kit;
