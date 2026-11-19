import test from "node:test";
import assert from "node:assert/strict";
import { makeDiag, reportOf, bucketOf } from "../lib/_diag.mjs";
const mem = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : null), put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); return {}; } }; };
test("reports are cleaned; buckets", () => {
  assert.equal(reportOf({ fps: "x" }), null); assert.equal(reportOf({ fps: 999 }), null);
  const r = reportOf({ fps: 31.26, min: 9, phone: 1, gpu: "Mali-G57<script>", errs: ["a", "", "b"], mode: "street", sid: "ab$c1" });
  assert.equal(r.fps, 31.3); assert.equal(r.gpu, "Mali-G57 script "); assert.deepEqual(r.errs, ["a", "b"]); assert.equal(r.sid, "abc1");
  assert.equal(bucketOf(10), 0); assert.equal(bucketOf(20), 1); assert.equal(bucketOf(29), 2); assert.equal(bucketOf(40), 3); assert.equal(bucketOf(60), 4);
});
test("a day's view: devices by frame rate, sessions, errors", async () => {
  let t = Date.UTC(2026, 10, 19, 6); const store = mem(), D = makeDiag({ store, now: () => t });
  await D.report({ sid: "s1", fps: 18, min: 9, phone: true, gpu: "Mali-G52", low: true, auto: true, errs: ["boom"] }, "UA1");
  await D.report({ sid: "s2", fps: 58, min: 50, phone: false, gpu: "Apple M2" });
  t += 31e3; await D.report({ sid: "s1", fps: 22, min: 12, phone: true, gpu: "Mali-G52", low: true });
  const v = (await D.view())["2026-11-19"];
  assert.equal(v.reports, 3); assert.equal(v.sessions, 2); assert.equal(v.switchedAuto, 1); assert.equal(v.errors[0].m, "boom");
  assert.equal(v.slowest[0].device, "phone · Mali-G52"); assert.equal(v.slowest[0].fps, 20); assert.equal(v.slowest[0].worst, 9);
  assert.ok(store.m.has("diag/2026-11-19.json"));
});
