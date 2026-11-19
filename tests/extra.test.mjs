// The site's extras: the safety grade, the CA check, the vote on the next drop, the coin page's link card, X's signature.
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kp = () => { const sk = ed25519.utils.randomSecretKey(); return { sk, pub: C.b58enc(ed25519.getPublicKey(sk)) }; };
const VAULT = kp().pub, BUYER = kp().pub, W1 = kp(), W2 = kp();
process.env.PAD_VAULT = VAULT; process.env.PAD_BUYER = BUYER; process.env.PAD_SUFFIX = "";
const { makePad } = await import("../lib/_pad.mjs");
const { makeExtra, gradeOf, oauth1 } = await import("../lib/_extra.mjs");

// ---------------- the grade
const A = gradeOf({ split: true, creatorPct: 2, top10Pct: 15, ageH: 30, progress: 100, graduated: true });
ok(A.grade === "A" && A.score === 100, "a locked, spread, old, graduated coin is an A");
const F = gradeOf({ split: false, creatorPct: 40, top10Pct: 70, ageH: 1, progress: 3, graduated: false });
ok(F.grade === "F", "no split, a big creator bag, few holders → F");
ok(gradeOf({ split: true, creatorPct: 0, top10Pct: 10, ageH: 2, progress: 90, graduated: false }).score <= 64, "under 6 hours is never better than a C");
ok(gradeOf({ split: true, creatorPct: null, top10Pct: null, ageH: 30, progress: 0 }).parts.find((p) => p.k === "holders").note === "holders not read", "unread parts say so");

// ---------------- a store like Blob's
const docs = new Map();
const store = {
  get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null),
  put: async (k, v, o = {}) => { if (o.create && docs.has(k)) { const e = new Error("exists"); e.exists = true; throw e; } docs.set(k, JSON.parse(JSON.stringify(v))); return { url: "https://blob.test/" + k }; },
  list: async (p) => [...docs.keys()].filter((k) => k.startsWith(p)),
  url: async (k) => "https://blob.test/" + k,
};
C.CFG.rpc = async (m) => (m === "getMultipleAccounts" ? { value: [] } : null);
let clock = Date.UTC(2026, 10, 18, 9, 20);
const P = makePad({ store, now: () => clock }), X = makeExtra({ pad: P, now: () => clock });

// ---------------- the vote
const v0 = await X.voteView("");
ok(v0.hour === "2026-11-18T10" && v0.ideas.length === 3 && v0.votes.join() === "0,0,0", "three ideas for the next hour, no votes yet");
ok((await X.voteView("")).ideas[0].symbol === v0.ideas[0].symbol, "the ideas stay the same for the hour");
const sign = (k, pick, hour = v0.hour) => { const issued = new Date(clock).toISOString(); return { action: "vote", wallet: k.pub, hour, pick, issued, sig: C.b58enc(ed25519.sign(new TextEncoder().encode(X.voteMessage(k.pub, hour, pick, issued)), k.sk)) }; };
ok((await X.vote({ ...sign(W1, 1), sig: "1111" })).status === 403, "a bad signature can't vote");
const r1 = await X.vote(sign(W1, 1));
ok(r1.status === 200 && r1.body.votes.join() === "0,1,0", "a signed vote counts");
ok((await X.vote(sign(W1, 2))).status === 409, "one vote a wallet an hour");
await X.vote(sign(W2, 1));
ok((await X.voteView(W1.pub)).mine === 1, "the page knows my vote");
ok((await X.vote(sign(W2, 0, "2026-11-18T09"))).status === 409, "a closed hour takes no votes");
const w = await X.winner("2026-11-18T10");
ok(w && w.symbol === v0.ideas[1].symbol && w.votes === 2 && w.by === "vote", "the agent drops the winner");
ok((await X.winner("2026-11-18T11")) === null, "no votes → no winner");

// ---------------- the coin page's link card
const html = `<html><head><title>Old</title><meta name="description" content="x"><meta property="og:title" content="x"><meta property="og:image" content="/i.webp"></head><body></body></html>`;
const pg = X.page(html, { mint: "8MU9UNSTvFxfxttvmaQoVR2DDs9F9kKNbdXMd6hQRGTA", symbol: "OWL", name: "Night <Owl>", description: "hoot", image: "https://blob.test/o.webp" }, "https://site.test");
ok(pg.includes('<meta property="og:image" content="https://blob.test/o.webp">') && pg.includes("Night &lt;Owl&gt;") && !pg.includes("<title>Old") && pg.includes("window.__COIN") && (pg.match(/og:title/g) || []).length === 1, "the coin page carries its own escaped link card");

// ---------------- X's OAuth 1.0a (the example from X's docs)
const h = oauth1("POST", "https://api.twitter.com/1.1/statuses/update.json", { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
  { ck: "xvz1evFS4wEEPTGEFPHBog", cs: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", tk: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", ts: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE" },
  "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", 1318622958);
ok(h.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'), "the OAuth signature matches X's example");

// ---------------- the police raid: a coin's creator selling it shows on the list for a day
{
  const RM = "Raid" + "1".repeat(40), RC = kp().pub, CURVE = kp().pub;
  docs.set(`coins/${RM}.json`, { mint: RM, kind: "user", creator: RC, curve: CURVE, vault: kp().pub, name: "Raided", symbol: "RAID", launchedAt: Math.floor(clock / 1000) - 600 });
  docs.delete("index.json");
  const seenSig = "S" + "2".repeat(60), other = kp().pub;
  C.CFG.solUsd = 150;
  C.CFG.rpc = async (m, p) => {
    if (m === "getSignaturesForAddress") return p[0] === CURVE ? [{ signature: seenSig, blockTime: Math.floor(clock / 1000) }] : [];
    if (m === "getTransaction") return { transaction: { message: { accountKeys: [RC, CURVE, other] } }, meta: { preBalances: [1e9, 5e9, 0], postBalances: [2e9, 4e9, 0] } };
    if (m === "getMultipleAccounts") return { value: [] };
    return null;
  };
  const X2 = makeExtra({ pad: makePad({ store, now: () => clock }), now: () => clock });
  const tr = await X2.trades();
  ok(tr.items.some((t) => t.mint === RM && t.side === "sell"), "the creator's sell is in the trades feed");
  const raids = docs.get("raids.json");
  ok(raids && raids[RM] && raids[RM].sol === 1 && raids[RM].n === 1, "a creator's sell raids the tower");
  const L2 = await makePad({ store, now: () => clock }).list();
  ok(L2.items.find((x) => x.mint === RM).raid.sol === 1, "the list carries the raid");
  clock += 25 * 3600e3;
  const L3 = await makePad({ store, now: () => clock }).list();
  ok(!L3.items.find((x) => x.mint === RM).raid, "a raid is over after a day");
}

// ---------------- a cold start keeps the trades that came after the last saved one (the feed once froze for hours)
{
  const TM = "Cold" + "3".repeat(40), TC = kp().pub, CV = kp().pub;
  docs.set(`coins/${TM}.json`, { mint: TM, kind: "user", creator: TC, curve: CV, vault: kp().pub, name: "Cold", symbol: "COLD", launchedAt: Math.floor(clock / 1000) - 7200 });
  docs.delete("index.json");
  docs.set("trades.json", { at: clock - 3600e3, items: [{ sig: "OLD" + "1".repeat(60), at: clock - 3600e3, mint: TM, symbol: "COLD", side: "buy", sol: 0.1 }] });
  const NEW = "N" + "4".repeat(70), buyer = kp().pub;
  C.CFG.rpc = async (m, p) => {
    if (m === "getSignaturesForAddress") return p[0] === CV ? [{ signature: NEW, blockTime: Math.floor(clock / 1000) - 60 }, { signature: "OLD" + "1".repeat(60), blockTime: Math.floor((clock - 3600e3) / 1000) }] : [];
    if (m === "getTransaction") return { transaction: { message: { accountKeys: [buyer, CV] } }, meta: { preBalances: [5e9, 1e9], postBalances: [4e9, 2e9] } };
    if (m === "getMultipleAccounts") return { value: [] };
    return null;
  };
  const X3 = makeExtra({ pad: makePad({ store, now: () => clock }), now: () => clock });
  const tr = await X3.trades();
  ok(tr.items.some((t) => t.sig === NEW && t.side === "buy" && t.sol === 1), "a fresh instance keeps a trade newer than the last saved one");
  ok(tr.scan && tr.scan.ok >= 1 && tr.scan.err === 0, "the feed says how its read went");
}
console.log(`extra: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
