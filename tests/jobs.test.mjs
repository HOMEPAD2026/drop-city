// street-jobs.js runs in the browser (it imports /common.js): its pure parts are loaded here without that import
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../street-jobs.js", import.meta.url), "utf8").replace(/^import .*$/m, "");
const m = await import("data:text/javascript," + encodeURIComponent(src));

test("three different jobs a day, the same for everyone, changing day to day", () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) { const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10), p = m.picksOf(d);
    assert.equal(p.length, 3); assert.equal(new Set(p).size, 3); p.forEach((x) => assert.ok(m.JOBS[x])); assert.deepEqual(m.picksOf(d), p); seen.add(p.join()); }
  assert.ok(seen.size > 15);
});
test("weeks start on Monday (UTC); titles by streak", () => {
  assert.equal(m.weekOf(Date.UTC(2026, 10, 19, 12)), "2026-11-16"); assert.equal(m.weekOf(Date.UTC(2026, 10, 16, 0)), "2026-11-16"); assert.equal(m.weekOf(Date.UTC(2026, 10, 15, 23)), "2026-11-09");
  assert.equal(m.titleOf(0), ""); assert.equal(m.titleOf(1), "STREET ROOKIE"); assert.equal(m.titleOf(3), "MADE CREW"); assert.equal(m.titleOf(9), "KINGPIN");
});
