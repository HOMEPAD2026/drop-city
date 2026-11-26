// The launchpad's rules: free launches checked on chain, the agent's hourly drop, the metadata / logo store.
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };

const kp = () => { const sk = ed25519.utils.randomSecretKey(); return { sk, pub: C.b58enc(ed25519.getPublicKey(sk)) }; };
const VAULT = kp().pub, BUYER = kp().pub, SPONSOR = kp(), OTHER = kp();
process.env.PAD_VAULT = VAULT; process.env.PAD_BUYER = BUYER; process.env.PAD_SUFFIX = "";
const { makePad, cfg, publicCfg, splitCheck, hourOf, sniff, agentPub } = await import("../lib/_pad.mjs");
const AG = await import("../lib/_agent.mjs");

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
const MINT = grind("Xy"), MINT2 = grind("Xy");
let s = await P.slot(); ok(s.state === "off" && !s.drop, "with no agent key the hour's drop is off");

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
ok((await P.register({ mint: MINT })).status === 404, "a coin with no curve yet waits");
ok((await P.register({ mint: kp().pub.replace(/..$/, "zz") })).status === 400, "an address without the suffix is refused");
put(MINT2, [[OTHER.pub, 7000], [VAULT, 3000]]);
ok((await P.register({ mint: MINT2 })).status === 409, "a 70 / 30 split is refused");
put(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]], false);
ok((await P.register({ mint: MINT2 })).status === 409, "an unlocked split is refused");
put(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]]);
const g = await P.register({ mint: MINT2 });
ok(g.status === 200 && docs.get(`coins/${MINT2}.json`).kind === "user" && !docs.get(`coins/${MINT2}.json`).hour, "anyone's 60 / 30 / 10 coin registers, any time, without an hour");
ok((await P.register({ mint: MINT2 })).body.already, "registering twice is harmless");
put(MINT, [[SPONSOR.pub, 6000], [VAULT, 3000], [BUYER, 1000]]);
ok((await P.register({ mint: MINT })).status === 200, "the same sponsor launches again in the same hour — no limit");
const NOSPLIT = "8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA", nsCv = C.bondingCurvePda(NOSPLIT);
process.env.PAD_SUFFIX = "GTA"; chain[nsCv] = [C.PROGRAM.pump, curveOf(SPONSOR.pub)];
const ns = await P.register({ mint: NOSPLIT });
ok(ns.status === 200 && docs.get(`coins/${NOSPLIT}.json`).noSplit && docs.get(`coins/${NOSPLIT}.json`).creator === SPONSOR.pub, "a coin on the owner's list is listed without a split, its creator from the curve");
process.env.PAD_SUFFIX = "Xy"; docs.delete(`coins/${NOSPLIT}.json`);
C.CFG.dexInfo = async (m) => ({ name: "Dex " + m.slice(0, 4), symbol: "DX", image: "https://img.example/" + m + ".png", twitter: "", telegram: "", website: "" });
const keptSrc = []; C.CFG.keepLogo = async (src) => { keptSrc.push(src); return "https://blob.example/kept/" + src.split("/").pop(); };
const L = await P.list();
{ const s = L.items.filter((x) => x.kind === "partner"), au = s.find((x) => x.mint === "DKYcjobF7HPtL9RyQBRdeRQ2iWvizpfbgWwPWNXdpump");
  ok(s.length >= 1 && s.every((x) => x.image.startsWith("https://blob.example/kept/")), "supported coins' logos are copied into our own store (a host that drops one can't blank it)");
  ok(au && au.symbol === "AUDACITY" && au.name === "AudaCity", "the owner's own name / ticker for a supported coin wins over the chain's");
  ok(docs.get("sup/logos.json") && Object.keys(docs.get("sup/logos.json")).length === s.length, "the copies are remembered (no refetch a day)"); }
delete C.CFG.dexInfo; delete C.CFG.keepLogo;
{ const own = L.items.filter((x) => x.kind !== "partner"), sup = L.items.filter((x) => x.kind === "partner");
  ok(own.length === 2 && own[0].progress === 0 && own[0].mcapUsd > 0, "the list reads the coin's curve live");
  ok(sup.length >= 1 && sup.some((x) => x.mint === "9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump") && sup.every((x) => x.feesWaitingSol === 0 && x.creator === null) && sup[0].mint === "9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump" && sup[0].feesWaitingSol === 0 && sup[0].creator === null, "a supported coin ($DCTY) is listed as a partner, no fees, no creator"); }
ok(splitCheck(C.decodeSharing(scOf(MINT2, [[OTHER.pub, 6000], [VAULT, 3000], [BUYER, 1000]])), MINT2).ok, "splitCheck reads the three holders");
// ---------------- a crew: the creator's 60 % in equal parts between 2–4 wallets
{ const { crewBps } = await import("../lib/_pad.mjs"); const k3 = [kp().pub, kp().pub, kp().pub];
  ok(crewBps(1, 6000).join() === "6000" && crewBps(2, 6000).join() === "3000,3000" && crewBps(4, 6000).join() === "1500,1500,1500,1500" && crewBps(3, 1000).join() === "334,333,333", "crew shares: equal parts, the launcher keeps the odd bps");
  const c3 = splitCheck(C.decodeSharing(scOf(MINT2, [[k3[0], 2000], [k3[1], 2000], [k3[2], 2000], [VAULT, 3000], [BUYER, 1000]])), MINT2);
  ok(c3.ok && c3.crew.length === 3 && k3.includes(c3.creator), "a crew of three passes, with its wallets");
  ok(!splitCheck(C.decodeSharing(scOf(MINT2, [[k3[0], 4000], [k3[1], 2000], [VAULT, 3000], [BUYER, 1000]])), MINT2).ok, "an uneven crew doesn't");
  const k5 = [kp().pub, kp().pub, kp().pub, kp().pub, kp().pub];
  ok(!splitCheck(C.decodeSharing(scOf(MINT2, [...k5.map((a) => [a, 1200]), [VAULT, 3000], [BUYER, 1000]])), MINT2).ok, "five in a crew is too many");
  ok(!splitCheck(C.decodeSharing(scOf(MINT2, [[k3[0], 3000], [k3[1], 3000], [VAULT, 2000], [BUYER, 2000]])), MINT2).ok, "the vault and the buyer keep their shares");
  ok(!splitCheck(C.decodeSharing(scOf(MINT2, [[k3[0], 3000], [k3[1], 3000], [VAULT, 3000], [BUYER, 1000]], false)), MINT2).ok, "an unlocked crew split doesn't pass"); }


// ---------------- metadata and logo
const m = await P.meta({ name: "Night Owl", symbol: "OWL", description: "hoot", image: "https://blob.test/logos/x.png", twitter: "https://x.com/a", website: "javascript:x" });
ok(m.status === 200 && /meta\/[0-9a-f]{24}\.json$/.test(m.body.uri) && !docs.get(`meta/${m.body.id}.json`).website, "metadata: https links only, stored by its hash");
ok((await P.meta({ name: "Night Owl", symbol: "OWL", description: "hoot", image: "https://blob.test/logos/x.png", twitter: "https://x.com/a" })).body.id === m.body.id, "the same metadata stores once");
const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).toString("base64");
ok((await P.logo({ image: png })).status === 200, "a PNG logo is stored");
ok((await P.logo({ image: "data:image/png;base64," + Buffer.from("<svg>").toString("base64") })).status === 400 && !sniff(Buffer.from("GIF8"), "png"), "a file that isn't what it says is refused");

// ---------------- the agent
const AK = ed25519.utils.randomSecretKey(), APUB = C.b58enc(ed25519.getPublicKey(AK)), ASEC = C.b58enc(Uint8Array.from([...AK, ...C.b58dec(APUB)]));
ok(agentPub(ASEC) === APUB && agentPub(JSON.stringify([...AK, ...C.b58dec(APUB)])) === APUB, "the agent's address from its key, base58 or a byte array");
ok(agentPub(ASEC.slice(0, -2) + "11") === "" && agentPub("nope") === "", "a broken key gives no agent");
process.env.PAD_AGENT_KEY = ASEC; ok(publicCfg().agent === APUB, "the config shows the agent's address");
// hourly drops are off by default (the owner, 2026-11-24): the hour says so, the tick launches nothing
ok(publicCfg().drops === false && (await P.slot()).state === "off", "drops off: the hour is 'off', no countdown to a drop");
process.env.PAD_DROPS = "1"; ok(publicCfg().drops === true, "PAD_DROPS=1 turns the hourly drops back on (the rest of these tests)");
s = await P.slot(); ok(s.state === "waiting" && !s.drop, "a new hour waits for the agent's drop");
const ci = AG.cityIdea("2026-11-18T05"); ok(ci.name && ci.symbol && ci.description && AG.cityIdea("2026-11-18T05").symbol === ci.symbol, "the city's own idea is the same for the same hour");
ok(AG.cityIdea("2026-11-18T05", new Set([ci.symbol])).symbol !== ci.symbol, "a taken ticker gets another idea");
ok(!AG.cleanIdea({ name: "GTA Night", symbol: "NITE", description: "x" }) && !AG.cleanIdea({ name: "Neon Owl", symbol: "OWL", description: "Vice City heist" }) && !AG.cleanIdea({ name: "Grand Theft Rat", symbol: "RAT", description: "x" }), "borrowed names are dropped");
ok(AG.cleanIdea({ name: "Felony Melon", symbol: "melon!", description: "a supersonic getaway" }).symbol === "MELON", "ordinary words that contain a blocked one pass");
for (let h = 0; h < 200; h++) { const x = AG.cityIdea("2026-11-" + String(h)); if (AG.BLOCK.test(x.name + " " + x.symbol + " " + x.description)) { ok(false, "the city's idea hit the block list: " + x.name); break; } }
const sec = new Uint8Array(64).map((_, i) => i), box = AG.seal(sec, ASEC);
ok(String(AG.open(box, ASEC)) === String(sec), "a pooled key opens with the agent's key");
let threw = false; try { AG.open(box, "other"); } catch { threw = true; } ok(threw, "and with no other");
const gk = await AG.grind("Ab", 20000); ok(gk.pub && gk.pub.endsWith("Ab") && C.b58enc(ed25519.getPublicKey(gk.secret.slice(0, 32))) === gk.pub, `grinding finds a key ending in the suffix (${gk.tries} tries)`);

// a drop with a stand-in kit (no network): the run record, the coin listed with its hour, once an hour
const sent = [];
const fakeKit = {
  Connection: class { async getBalance() { return 2e9; } async getLatestBlockhash() { return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1 }; } async sendRawTransaction() { sent.push(1); return "5".repeat(88); } async confirmTransaction() { return { value: { err: null } }; } },
  keypairOf: () => ({ publicKey: { toBase58: () => APUB } }),
  Keypair: { fromSecretKey: (sk) => ({ publicKey: { toBase58: () => C.b58enc(sk.slice(32)) } }) },
  PublicKey: class { constructor(a) { this.a = a; } },
  OnlinePumpSdk: class { async fetchGlobal() { return {}; } async fetchFeeConfig() { return {}; } },
  launchTxs: async (o) => { fakeKit.last = o; return { txs: [{ partialSign() {}, serialize: () => new Uint8Array(1) }] }; },
  sharingOf: async () => null, sweepTx: async () => null, splitTx: async () => ({ sign() {}, serialize: () => new Uint8Array(1) }), sendSolTx: () => ({ sign() {}, serialize: () => new Uint8Array(1) }),
};
process.env.PAD_SUFFIX = "Xy";
let dropMint = null;
const realGrind = AG.grind;
const AGT = AG.makeAgent({ pad: P, now: () => clock, fetchImpl: async () => ({ ok: false, status: 500 }), kit: async () => fakeKit });
// the chain shows the agent's coin once it's "sent"
const origRpc = C.CFG.rpc;
C.CFG.rpc = async (m, p) => { if (dropMint === null && fakeKit.last) { dropMint = fakeKit.last.mint.toBase58(); put(dropMint, [[APUB, 6000], [VAULT, 3000], [BUYER, 1000]]); } return origRpc(m, p); };
clock = Date.UTC(2026, 10, 18, 9, 1);
const t1 = await AGT.tick({ budgetMs: 40e3 });
ok(t1.state === "dropped" && t1.mint && t1.mint.endsWith("Xy"), "the agent drops this hour's coin: " + JSON.stringify(t1).slice(0, 160));
const dc = t1.mint && docs.get(`coins/${t1.mint}.json`);
ok(dc && dc.kind === "drop" && dc.hour === "2026-11-18T09" && dc.creator === APUB, "listed as the hour's drop, from the agent");
ok(fakeKit.last && fakeKit.last.shares.map((x) => x.shareBps).join() === "6000,3000,1000" && fakeKit.last.shares[1].address.a === VAULT, "its split: agent 60 · vault 30 · buyer 10");
s = await P.slot(); ok(s.state === "dropped" && s.drop.mint === t1.mint, "the hour shows its drop");
const before = sent.length, t2 = await AGT.tick({ budgetMs: 8e3 });
ok(t2.state === "dropped" && sent.length === before, "calling again drops nothing more");
ok((await P.register({ mint: t1.mint })).body.already, "the drop can't be registered as a user coin");
put(MINT2.replace(/.$/, ""), []);
clock = Date.UTC(2026, 10, 18, 11, 3);
fakeKit.Connection.prototype.getBalance = async () => 1e6;
const t3 = await AGT.tick({ budgetMs: 5e3 }), s3 = await P.slot();
ok(t3.state === "no-sol" && s3.tries === 0, "an empty wallet waits without using up the hour's tries");
ok(s3.state === "paused", "the site says the drops are paused while the wallet is empty");
{ const msgs = []; process.env.TG_OWNER_CHAT = "42";
  const AG2 = AG.makeAgent({ pad: P, now: () => clock, fetchImpl: async () => ({ ok: false, status: 500 }), kit: async () => fakeKit, tg: { send: async (chat, m) => { msgs.push([chat, m.text]); return {}; }, announceDrop: async () => null } });
  docs.delete("agent/state.json"); await AG2.tick({ budgetMs: 5e3 }); clock += 60e3; await AG2.tick({ budgetMs: 5e3 });
  ok(msgs.length === 1 && msgs[0][0] === "42" && /paused/.test(msgs[0][1]), "the owner hears once that the drops are paused (not the public chats)");
  clock += 3.1 * 3600e3; await AG2.tick({ budgetMs: 5e3 });
  ok(msgs.length === 2, "and again three hours later while it's still empty");
  delete process.env.TG_OWNER_CHAT; }
fakeKit.Connection.prototype.getBalance = async () => 2e9;
clock = Date.UTC(2026, 10, 18, 10, 57); ok((await AGT.tick({ budgetMs: 5e3 })).state === "late", "no drop after :55 — the next hour gets it");
const st = await AGT.status(); ok(st.agent === APUB && st.logs.some((l) => l.k === "drop"), "the status shows the agent and its drop");
console.log(`pad: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
