// GTAFUN CARDS on the server: the card set, the machine read from the chain, the setup check, a pack's record (no network).
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kp = () => C.b58enc(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
const OPS = kp(); process.env.PAD_CARDS_WALLET = OPS;
const D = await import("../cards-data.js");
const { makeCards, decodeMachine, decodeAsset, cardsCfg, CM_PROGRAM, CORE_PROGRAM } = await import("../lib/_cards.mjs");

// ---- the set
const map = D.itemMap(); const n = {}; map.forEach((x) => (n[x] = (n[x] || 0) + 1));
ok(map.length === 3000 && D.CARDS.length === 18 && n.boss === 30 && n.shark === 85 && n.flamingo === 150 && n.croc === 200, "3,000 items: 1 legendary ×30, 2 epic ×85, 4 rare ×150, 11 common ×200");
ok(D.itemMap().join() === map.join(), "the shuffle is the same every time (the season's seed)");
ok(D.cardOfName("GTAFUN Card #1", map).id === map[0] && D.cardOfName("GTAFUN Card #3000", map).id === map[2999] && D.cardOfName("GTAFUN Card #3001", map) === null, "an asset's name (#index + 1) → its card");
ok(D.CARD_LAMPORTS * D.SEASON.pack >= 0.1e9 && D.CARD_LAMPORTS * D.SEASON.pack < 0.1e9 + 10, "three cards make the 0.1 SOL pack");
ok(Math.abs(D.odds().legendary - 0.01) < 1e-9 && Math.abs(Object.values(D.odds()).reduce((s, x) => s + x, 0) - 1) < 1e-9, "the odds add up to 100 % (legendary 1 %)");
ok(cardsCfg().wallet === OPS, "the operations wallet from the environment");

// ---- made-up chain
const pk = (s) => C.b58dec(s), u64 = (v) => { const b = new Uint8Array(8); let x = BigInt(v); for (let i = 0; i < 8; i++) { b[i] = Number(x & 0xffn); x >>= 8n; } return b; };
const machineBytes = (auth, coll, redeemed, avail) => new Uint8Array([...new Uint8Array(8), ...pk(auth), ...pk(kp()), ...pk(coll), ...u64(redeemed), ...u64(avail), 1]);
const str = (t) => { const e = new TextEncoder().encode(t); return [e.length, 0, 0, 0, ...e]; };
const assetBytes = (owner, coll, name) => new Uint8Array([1, ...pk(owner), 2, ...pk(coll), ...str(name), ...str("https://x")]);
const b64 = (u) => Buffer.from(u).toString("base64");
const COLL = kp(), CM = kp(), BAD = kp(), BUYER = kp(), A1 = kp(), A2 = kp(), A3 = kp();
ok(decodeMachine(machineBytes(OPS, COLL, 5, 3000)).authority === OPS && decodeMachine(machineBytes(OPS, COLL, 5, 3000)).available === 3000, "a machine account decodes");
ok(decodeAsset(assetBytes(BUYER, COLL, "GTAFUN Card #7")).name === "GTAFUN Card #7", "an asset account decodes");
const acc = { [CM]: { owner: CM_PROGRAM, data: [b64(machineBytes(OPS, COLL, 3, 3000)), "base64"] }, [BAD]: { owner: CM_PROGRAM, data: [b64(machineBytes(kp(), COLL, 0, 3000)), "base64"] },
  [A1]: { owner: CORE_PROGRAM, data: [b64(assetBytes(BUYER, COLL, "GTAFUN Card #1")), "base64"] }, [A2]: { owner: CORE_PROGRAM, data: [b64(assetBytes(BUYER, COLL, "GTAFUN Card #2")), "base64"] }, [A3]: { owner: CORE_PROGRAM, data: [b64(assetBytes(BUYER, COLL, "GTAFUN Card #3")), "base64"] } };
const SIG = "4".repeat(88), txs = { [SIG]: { meta: { err: null }, transaction: { message: { accountKeys: [BUYER, CM, A1, A2, A3] } } } };
const rpc = async (m, p) => m === "getAccountInfo" ? { value: acc[p[0]] || null } : m === "getMultipleAccounts" ? { value: p[0].map((k) => acc[k] || null) } : m === "getTransaction" ? txs[p[0]] || null : null;
const docs = new Map(), store = { get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null), put: async (k, v, o = {}) => { if (o.create && docs.has(k)) return { conflict: true }; docs.set(k, JSON.parse(JSON.stringify(v))); return {}; } };
let clock = 1e12; const K = makeCards({ store, rpc, now: () => clock });
ok((await K.view()).ready === false && (await K.view()).cm === "", "no machine yet: not on sale");
ok((await K.minted({ sig: SIG, assets: [A1] })).status === 409, "a pack before the machine is set up doesn't count");
ok((await K.setup({ cm: BAD })).status === 403, "a machine of another wallet is refused");
const su = await K.setup({ cm: CM }); ok(su.status === 200 && su.body.collection === COLL, "the operations wallet's machine is registered");
clock += 20e3; const v = await K.view(BUYER); ok(v.ready && v.redeemed === 3 && v.available === 3000 && v.price === D.CARD_LAMPORTS, "on sale: items redeemed / available, the price a card");
const r = await K.minted({ sig: SIG, assets: [A1, A2, A3] });
ok(r.status === 200 && r.body.cards.length === 3 && r.body.cards[0].card === map[0] && r.body.cards[2].card === map[2], "a pack's three cards read back from their names");
ok((await K.minted({ sig: SIG, assets: [A1, A2, A3] })).body.already === true && docs.get("cards/board.json").total === 3, "the same pack counts once");
clock += 20e3; const v2 = await K.view(BUYER); ok(v2.mine.length === 3 && v2.board.pulls.length === 3 && v2.board.by[map[0]] >= 1, "the buyer's collection and the board");
ok((await K.minted({ sig: "3".repeat(88), assets: [A1] })).status === 404, "an unknown transaction doesn't count");
console.log(`cards: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
