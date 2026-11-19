import test from "node:test";
import assert from "node:assert/strict";
import { shuffled, PLAYLIST, TITLES } from "../music.js";
test("the playlist shuffles every track once and never repeats the last one first", () => {
  for (let k = 0; k < 200; k++) { const last = PLAYLIST[k % PLAYLIST.length], o = shuffled(PLAYLIST, last); assert.equal(o.length, 6); assert.equal(new Set(o).size, 6); assert.notEqual(o[0], last); }
  for (const id of PLAYLIST) assert.ok(TITLES[id]);
});
