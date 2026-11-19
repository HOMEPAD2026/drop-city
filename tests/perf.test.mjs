import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.matchMedia = () => ({ matches: false });
const src = readFileSync(new URL("../perf.js", import.meta.url), "utf8").replace(/^import .*$/m, "");
const m = await import("data:text/javascript," + encodeURIComponent(src));
test("GPU names are short and readable", () => {
  assert.equal(m.cleanGpu("ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)"), "Adreno (TM) 650");
  assert.equal(m.cleanGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)"), "NVIDIA GeForce RTX 3060");
  assert.equal(m.cleanGpu("Mali-G57 MC2"), "Mali-G57 MC2");
  assert.equal(m.median([30, 10, 20, 40]), 30);
});
