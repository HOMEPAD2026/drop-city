// The launchpad's rules: the hour, the reservation, the on-chain checks at registration, the metadata / logo store.
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };

const kp = () => { const sk = ed25519.utils.randomSecretKey(); return { sk, pub: C.b58enc(ed25519.getPublicKey(sk)) }; };
const VAULT = kp().pub, BUYER = kp().pub, SPONSOR = kp(), OTHER = kp();
process.env.PAD_VAULT = VAULT; process.env.PAD_BUYER = BUYER; process.env.PAD_SUFFIX = "";
const { makePad, cfg, publicCfg, splitCheck, hourOf, reserveMessage, sniff } = await import("../lib/_pad.mjs");

// a mint whose address ends with a given suffix (ground like the browser does)
function grind(suffix) { for (;;) { const k = kp(); if (k.pub.endsWith(suffix)) return k.pub; } }

// ---------------- config
ok(publicCfg().open && publicCfg().split.creator === 6000 && publicCfg().buyer === BUYER, "the config opens once the vault and buyer are set");
process.env.PAD_SUFFIX = "0Ol"; ok(!cfg().open && /suffix/.test(publicCfg().why), "a suffix with letters base58 can't hold closes launching");
process.env.PAD_SUFFIX = "Xy"; ok(cfg().suffix === "Xy" && cfg().open, "the suffix comes from the environment when it's set");

// ---------------- a store like Blob's: create refuses to overwrite
const docs = new Map();
const store = {
  get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null),
  put: async (k, v, o = {}) => { if (o.create && docs.has(k)) { const e = new Error("exists"); e.exists = true; e.conflict = true; throw e; } docs.set(k, v instanceof Uint8Array ? { bytes: v.length } : JSON.parse(JSON.stringify(v))); return { url: "https://blob.test/" + k }; },
  list: async (p) => [...docs.keys()].filter((k) => k.startsWith(p)),
  url: async (k) => "https://blob.test/" + k,
};
let clock = Date.UTC(2026, 10, 18, 5, 2);
const P = makePad({ store, now: () => clock });
const sign = (k, msg) => C.b58enc(ed25519.sign(new TextEncoder().encode(msg), k.sk));
const reserve = (k, mint) => { const issued = new Date(clock).toISOString(); return P.reserve({ wallet: k.pub, mint, issued, sig: sign(k, reserveMessage(k.pub, mint, hourOf(clock), issued)) }); };

const MINT = grind("Xy");
ok((await reserve(SPONSOR, kp().pub.replace(/..$/, "zz"))).status === 400, "an address without the suffix can't reserve");
const bad = await P.reserve({ wallet: SPONSOR.pub, mint: MINT, issued: new Date(clock).toISOString(), sig: "1111" });
ok(bad.status === 403, "a bad signature can't reserve");
let s = await P.slot(); ok(s.free && !s.taken, "a new hour is free");
const r1 = await reserve(SPONSOR, MINT);
ok(r1.status === 200 && r1.body.until === clock + 10 * 60e3, "the sponsor holds the hour for 10 minutes");
ok((await reserve(SPONSOR, MINT)).body.again, "asking again with the same coin keeps the hold");
const MINT2 = grind("Xy");
ok((await reserve(OTHER, MINT2)).status === 409, "another sponsor can't take a held hour");
clock += 11 * 60e3;
s = await P.slot(); ok(s.free && s.taken.state === "expired", "an unused hold expires");
ok((await reserve(OTHER, MINT2)).status === 200, "after it expires the next sponsor takes the hour");

// ---------------- register: the coin on chain
const scOf = (mint, holders, revoked = true) => {
  const b = new Uint8Array(8 + 3 + 64 + 1 + 4 + holders.length * 34);
  b.set([216, 74, 9, 0, 56, 140, 93, 75]); let o = 8; b[o++] = 255; b[o++] = 1; b[o++] = 1;
  b.set(C.b58dec(mint), o); o += 32; o += 32; b[o++] = revoked ? 1 : 0;
  b[o] = holders.length; o += 4;
  for (const [a, bps] of holders) { b.set(C.b58dec(a), o); b[o + 32] = bps & 255; b[o + 33] = bps >> 8; o += 34; }
  return b;
};
const curveOf = (creator) => { const b = new Uint8Array(115); b.set([23, 183, 248, 55, 96, 216, 172, 96]); const w = (o, v) => { let n = BigInt(v); for (let i = 0; i < 8; i++) { b[o + i] = Number(n & 255n); n >>= 8n; } };
  w(8, 1_073_000_000_000_000n); w(16, 30_000_000_000n); w(24, 793_100_000_000_000n); w(32, 0); w(40, 1_000_000_000_000_000n); b[48] = 0; b.set(C.b58dec(creator), 49); return b; };
let chain = {};
C.CFG.rpc = async (m, p) => {
  if (m === "getMultipleAccounts") return { value: p[0].map((a) => (chain[a] ? { owner: chain[a][0], lamports: 2_000_000, data: [Buffer.from(chain[a][1]).toString("base64"), "base64"] } : null)) };
  if (m === "getAccountInfo") return { value: null };
  return null;
};
C.CFG.solUsd = 150;
const put = (mint, holders, revoked) => { const sc = C.sharingConfigPda(mint), cv = C.bondingCurvePda(mint); chain[sc] = [C.PROGRAM.fees, scOf(mint, holders, revoked)]; chain[cv] = [C.PROGRAM.pump, curveOf(sc)]; };
put(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]]);
ok((await P.register({ mint: MINT })).status === 409, "a coin whose hold expired (or never held) can't register");
put(MINT2, [[OTHER.pub, 7000], [VAULT, 3000]]);
ok((await P.register({ mint: MINT2 })).status === 409, "a 70 / 30 split is refused");
put(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]], false);
ok((await P.register({ mint: MINT2 })).status === 409, "an unlocked split is refused");
put(MINT2, [[SPONSOR.pub, 6000], [VAULT, 3000], [BUYER, 1000]]);
ok((await P.register({ mint: MINT2 })).status === 409, "launched from another wallet than the reserver → refused");
put(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]]);
const g = await P.register({ mint: MINT2 });
ok(g.status === 200 && docs.has(`coins/${MINT2}.json`), "the 60 / 30 / 10 coin of the hour's sponsor registers");
s = await P.slot(); ok(!s.free && s.taken.state === "launched", "the hour is done once its drop is out");
ok((await reserve(SPONSOR, grind("Xy"))).status === 409, "nobody reserves an hour that has dropped");
ok((await P.register({ mint: MINT2 })).body.already, "registering twice is harmless");
clock += 50 * 60e3; // the next hour
ok((await P.slot()).free, "the next hour opens at the top of the hour");
const L = await P.list();
ok(L.items.length === 1 && L.items[0].progress === 0 && L.items[0].mcapUsd > 0, "the list reads the coin's curve live");
clock = Date.UTC(2026, 10, 18, 7, 58);
ok((await reserve(SPONSOR, grind("Xy"))).status === 409, "too close to the end of an hour → the next one");
ok(splitCheck(C.decodeSharing(scOf(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]])), MINT2).ok, "splitCheck reads the three holders");

// ---------------- metadata and logo
const m = await P.meta({ name: "Night Owl", symbol: "OWL", description: "hoot", image: "https://blob.test/logos/x.png", twitter: "https://x.com/a", website: "javascript:x" });
ok(m.status === 200 && /meta\/[0-9a-f]{24}\.json$/.test(m.body.uri) && !docs.get(`meta/${m.body.id}.json`).website, "metadata: https links only, stored by its hash");
ok((await P.meta({ name: "Night Owl", symbol: "OWL", description: "hoot", image: "https://blob.test/logos/x.png", twitter: "https://x.com/a" })).body.id === m.body.id, "the same metadata stores once");
const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).toString("base64");
ok((await P.logo({ image: png })).status === 200, "a PNG logo is stored");
ok((await P.logo({ image: "data:image/png;base64," + Buffer.from("<svg>").toString("base64") })).status === 400 && !sniff(Buffer.from("GIF8"), "png"), "a file that isn't what it says is refused");
console.log(`pad: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
