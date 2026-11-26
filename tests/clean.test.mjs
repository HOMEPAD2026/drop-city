// Clean Launch: the coin's first block read from its bonding curve's oldest transactions
import { makeClean } from "../lib/_clean.mjs";
let pass = 0, fail = 0; const ok = (c, m) => (c ? pass++ : (fail++, console.log("FAIL", m)));
const DEV = "DevDevDevDevDevDevDevDevDevDevDevDevDevDev11", CREW = "CrewCrewCrewCrewCrewCrewCrewCrewCrewCrew11", SNIPE = "SnipeSnipeSnipeSnipeSnipeSnipeSnipeSnipe11";
const coins = {
  clean: { mint: "M1", kind: "user", curve: "C1", creator: DEV, crew: [{ address: CREW }], sigs: [["s3", 101, "X"], ["s2", 100, CREW], ["s1", 100, DEV]] },
  sniped: { mint: "M2", kind: "user", curve: "C2", creator: DEV, sigs: [["t3", 205, "X"], ["t2", 200, SNIPE], ["t1", 200, DEV]] },
};
const byCurve = new Map(Object.values(coins).map((c) => [c.curve, c])), payer = new Map();
for (const c of Object.values(coins)) for (const [s, , p] of c.sigs) payer.set(s, p);
let calls = 0;
const rpc = async (m, p) => { calls++;
  if (m === "getSignaturesForAddress") { const c = byCurve.get(p[0]); return p[1].before ? [] : c.sigs.map(([signature, slot]) => ({ signature, slot, err: null })); }
  if (m === "getTransaction") return { transaction: { message: { accountKeys: [payer.get(p[0]), "other"] } } };
};
const docs = new Map(), store = { get: async (k) => docs.get(k) || null, put: async (k, v) => { docs.set(k, JSON.parse(JSON.stringify(v))); } };
const items = [...Object.values(coins), { mint: "P", kind: "partner", curve: "CP" }];
const C = makeClean({ rpc, store, list: async () => ({ items }) });
const a = await C.check(coins.clean); ok(a.clean === true && a.slot === 100 && a.n === 2, "the creator and their crew in block 0 → clean");
const b = await C.check(coins.sniped); ok(b.clean === false && b.snipers[0] === SNIPE, "another wallet in block 0 → not clean, named");
const t = await C.tick(); ok(t.read === 2 && docs.get("clean.json").M1.clean && !docs.get("clean.json").M2.clean, "the tick reads the launched coins (not supported ones) and keeps the answers");
calls = 0; const t2 = await C.tick(); ok(t2.read === 0 && calls === 0, "a coin is read once");
// older than the pages read: unknown, not guessed
const many = { mint: "M3", kind: "user", curve: "C3", creator: DEV };
const C2 = makeClean({ rpc: async (m, p) => (m === "getSignaturesForAddress" ? Array.from({ length: 1000 }, (_, i) => ({ signature: "x" + i, slot: 500 + i })) : null), store, list: async () => ({ items: [many] }) });
ok((await C2.check(many)) === null, "a coin whose start wasn't reached stays unknown");
console.log(`clean: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
