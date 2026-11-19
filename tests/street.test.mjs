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
