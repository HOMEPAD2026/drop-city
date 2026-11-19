import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../street-vault.js", import.meta.url), "utf8").replace(/^import .*$/m, "");
const m = await import("data:text/javascript," + encodeURIComponent(src));
test("the vault lands in the plaza, the same spot for everyone that hour, clear of the hub", () => {
  for (let h = 0; h < 48; h++) { const hour = `2026-11-${19 + Math.floor(h / 24)}T${String(h % 24).padStart(2, "0")}`, [x, z] = m.spotOf(hour, 46), d = Math.hypot(x, z);
    assert.ok(d >= 16 && d <= 36, `${hour} at ${d}`); assert.deepEqual(m.spotOf(hour, 46), [x, z]); }
});
