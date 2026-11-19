import test from "node:test";
import assert from "node:assert/strict";
import { makeStreet, rowOf, mondayOf } from "../lib/_street.mjs";

const mem = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); return {}; }, list: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };
const P = (id, x = 0, z = 0, o = {}) => ({ id: id.padEnd(10, "x"), name: "Neon" + id, look: "hood", x, z, c: "walk", ...o });

test("rowOf cleans and clamps", () => {
  const r = rowOf({ id: "abc<>defgh12", name: "Bad Name!!", look: "nope", x: 9999, z: -5, y: 3, r: 1.234, c: "fly", e: "dance", car: 40 });
  assert.equal(r.id, "abcdefgh12"); assert.equal(r.name, "BadName"); assert.equal(r.look, "hood"); assert.equal(r.x, 260); assert.equal(r.c, "idle"); assert.equal(r.e, ""); assert.equal(r.car, 12);
  assert.equal(rowOf({ id: "short", name: "Ok123" }), null);
});
test("players see each other, nearest first, and stale ones go", async () => {
  let t = 1e6; const st = makeStreet({ store: mem(), now: () => t });
  await st.beat(P("aaa", 0, 0)); await st.beat(P("ccc", 50, 0));
  const r = await st.beat(P("bbb", 3, 0));
  assert.deepEqual(r.body.others.map((o) => o.id.slice(0, 3)), ["aaa", "ccc"]);
  t += 13e3; const r2 = await st.beat(P("bbb", 3, 0)); assert.equal(r2.body.others.length, 0);
});
test("a punch reaches a close player once", async () => {
  let t = 1e6; const st = makeStreet({ store: mem(), now: () => t });
  await st.beat(P("aaa", 0, 0)); t += 10;
  await st.beat({ ...P("bbb", 1.5, 0), hit: P("aaa").id }); t += 10;
  await st.beat({ ...P("ccc", 40, 0), hit: P("aaa").id }); t += 10; // too far: nothing
  const r = await st.beat(P("aaa", 0, 0)); assert.equal(r.body.hits.length, 1); assert.equal(r.body.hits[0].name, "Neonbbb");
  const r2 = await st.beat(P("aaa", 0, 0)); assert.equal(r2.body.hits.length, 0);
});
test("two instances meet through their shards", async () => {
  let t = 1e6; const store = mem(); const A = makeStreet({ store, now: () => t, inst: "a" }), B = makeStreet({ store, now: () => t, inst: "b" });
  await A.beat(P("aaa", 0, 0)); await new Promise((r) => setTimeout(r, 5));
  t += 9e3; await A.beat(P("aaa", 0, 0)); await B.beat(P("bbb", 2, 0)); await new Promise((r) => setTimeout(r, 5));
  t += 9e3; await A.beat(P("aaa", 0, 0)); await new Promise((r) => setTimeout(r, 5)); const r = await B.beat(P("bbb", 2, 0)); await new Promise((r2) => setTimeout(r2, 5));
  t += 100; const r2 = await B.beat(P("bbb", 2, 0));
  assert.ok([...r.body.others, ...r2.body.others].some((o) => o.id.startsWith("aaa")));
});
test("the week's board keeps each player's best", async () => {
  const st = makeStreet({ store: mem(), now: () => Date.UTC(2026, 10, 19) });
  await st.score({ id: "p1xxxxxxxx", name: "Ace11", score: 500 }); await st.score({ id: "p2xxxxxxxx", name: "Boss22", score: 900 }); await st.score({ id: "p1xxxxxxxx", name: "Ace11", score: 300 });
  const b = await st.board(); assert.deepEqual(b.rows.map((r) => [r.name, r.s]), [["Boss22", 900], ["Ace11", 500]]); assert.equal(b.week, mondayOf(Date.UTC(2026, 10, 19)));
});
import { perkOf, holderOf, PERKS } from "../lib/_street.mjs";
test("holding the main coin picks a perk tier", async () => {
  assert.equal(perkOf(0), null); assert.equal(perkOf(5).id, "crew"); assert.equal(perkOf(1e6).id, "made"); assert.equal(perkOf(2.5e7).id, "boss");
  const acc = (ui) => ({ account: { data: { parsed: { info: { tokenAmount: { uiAmountString: String(ui) } } } } } });
  let calls = 0; const rpc = async (m, p) => { calls++; assert.equal(m, "getTokenAccountsByOwner"); assert.deepEqual(p[1], { mint: "MAIN" }); return { value: [acc(600000), acc(500000)] }; };
  const h = await holderOf(rpc, "W1", "MAIN", 1e6); assert.equal(h.amount, 1.1e6); assert.equal(h.perk, "made"); assert.equal(h.tiers.length, PERKS.length);
  await holderOf(rpc, "W1", "MAIN", 1e6 + 1000); assert.equal(calls, 1, "a minute's cache");
});

import { makeVault, hourNow } from "../lib/_street.mjs";
test("the hour's vault goes to the first player, once", async () => {
  const m = new Map(), store = { get: async (k) => m.get(k) ?? null, put: async (k, v, o = {}) => { if (o.create && m.has(k)) throw new Error("exists"); m.set(k, v); return {}; } };
  let t = Date.UTC(2026, 10, 19, 6, 5); const V = makeVault({ store, now: () => t }), h = hourNow(t);
  const a = await V.open({ id: "aaaaaaaaaa", name: "NeonAce11", hour: h }), b = await V.open({ id: "bbbbbbbbbb", name: "SlickBoss22", hour: h });
  assert.equal(a.body.won, true); assert.equal(b.body.won, false); assert.equal(b.body.by, "NeonAce11");
  assert.equal((await V.open({ id: "cccccccccc", name: "LateOne33", hour: "2026-11-19T05" })).status, 409);
  const V2 = makeVault({ store, now: () => t }); assert.equal((await V2.open({ id: "dddddddddd", name: "Other44", hour: h })).body.by, "NeonAce11", "another instance sees the same winner");
});
