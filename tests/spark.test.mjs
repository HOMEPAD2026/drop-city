import test from "node:test";
import assert from "node:assert/strict";
import { fromChanges, closesOf, bestPair, makeSpark } from "../lib/_spark.mjs";

test("five points from the four changes", () => {
  const pts = fromChanges(2, { h24: 100, h6: 0, h1: -50, m5: 0 });
  assert.deepEqual(pts, [1, 2, 4, 2, 2]);
  assert.equal(fromChanges(0, { h24: 1 }), null);
  assert.equal(fromChanges(1, { h24: null, h6: 1, h1: 1, m5: 1 }), null);
});
test("closes come oldest first; too few is none", () => {
  const l = Array.from({ length: 8 }, (_, i) => [1000 - i, 0, 0, 0, 10 + i, 0]);
  assert.deepEqual(closesOf(l), [17, 16, 15, 14, 13, 12, 11, 10]);
  assert.equal(closesOf(l.slice(0, 3)), null);
});
test("the busiest pair with the coin as its base", () => {
  const m = "M";
  const p = bestPair([{ baseToken: { address: "X" }, liquidity: { usd: 9e9 } }, { baseToken: { address: m }, liquidity: { usd: 5 }, pairAddress: "a" }, { baseToken: { address: m }, liquidity: { usd: 50 }, pairAddress: "b" }], m);
  assert.equal(p.pairAddress, "b");
});
test("view: hourly closes when GeckoTerminal answers, the changes when it doesn't", async () => {
  const dex = [{ baseToken: { address: "M" }, pairAddress: "P", priceUsd: "0.5", priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 }, liquidity: { usd: 1 }, volume: { h24: 100 } }];
  const list = Array.from({ length: 24 }, (_, i) => [2000 - i, 0, 0, 0, 1, 0]);
  const ok = (j) => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  const s1 = makeSpark({ fetch: (u) => ok(u.includes("dexscreener") ? dex : { data: { attributes: { ohlcv_list: list } } }) });
  const v1 = await s1.view("M");
  assert.equal(v1.src, "hourly"); assert.equal(v1.pts.length, 24); assert.equal(v1.pts[23], 0.5);
  const s2 = makeSpark({ fetch: (u) => (u.includes("dexscreener") ? ok(dex) : Promise.resolve({ ok: false })) });
  const v2 = await s2.view("M");
  assert.equal(v2.src, "changes"); assert.equal(v2.pts.length, 5);
  const s3 = makeSpark({ fetch: () => Promise.resolve({ ok: false }) });
  assert.equal((await s3.view("M")).ok, false);
});
