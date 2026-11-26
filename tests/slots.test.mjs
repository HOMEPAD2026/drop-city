// CITY SLOTS' weekly board: a day's sign-in by signature, spins drawn by the server, the day's spins, the week's board.
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
import { makeSlots } from "../lib/_slots.mjs";
import { slotMessage, weekOf, BASE } from "../slot-data.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const sk = ed25519.utils.randomSecretKey(), W = C.b58enc(ed25519.getPublicKey(sk));
const docs = new Map(); const store = { get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null), put: async (k, v) => { docs.set(k, JSON.parse(JSON.stringify(v))); return {}; } };
const pad = { list: async () => ({ cfg: { main: "MAIN" }, items: [{ mint: "SUP1", kind: "partner" }] }) };
let clock = Date.parse("2026-11-26T10:00:00Z"), seq = [];
const rand = (n) => (seq.length ? seq.shift() % n : 0);
const S = makeSlots({ store, pad, now: () => clock, rand, secret: () => "test" });
const issued = new Date(clock).toISOString(), sign = (d, at) => C.b58enc(ed25519.sign(new TextEncoder().encode(slotMessage(W, d, at)), sk));
ok((await S.start({ wallet: W, issued, sig: C.b58enc(new Uint8Array(64)) })).status === 403, "the day's sign-in needs the wallet's signature");
const st = await S.start({ wallet: W, issued, sig: sign("2026-11-26", issued) });
ok(st.status === 200 && st.body.token && st.body.me.spins === BASE, "signed: a day token, 10 spins");
ok((await S.spin({ wallet: W, token: "nope" })).status === 403, "a spin needs the day's token");
// the bag: MAIN ×3, SUP1 ×4, seven ×2, star ×1 → index 0 = MAIN
seq = [0, 0, 0]; const s1 = await S.spin({ wallet: W, token: st.body.token });
ok(s1.status === 200 && s1.body.line.join() === "MAIN,MAIN,MAIN" && s1.body.won === 500 && s1.body.me.spins === BASE - 1 && s1.body.me.week === 500, "the server draws the reels: three main coins pay 500, on the week's board");
seq = [3, 7, 9]; const s2 = await S.spin({ wallet: W, token: st.body.token }); ok(s2.body.line.join() === "SUP1,seven,star" && s2.body.won === 0, "no match pays nothing");
for (let i = 0; i < BASE - 2; i++) await S.spin({ wallet: W, token: st.body.token });
ok((await S.spin({ wallet: W, token: st.body.token })).status === 409, "out of spins for the day");
const v = await S.view(W); ok(v.top[0].w === W && v.top[0].pts >= 500 && v.week === weekOf(clock) && v.me.spins === 0, "the week's board and my place");
clock += 86400e3; ok((await S.spin({ wallet: W, token: st.body.token })).status === 403, "yesterday's token doesn't spin today");
const i2 = new Date(clock).toISOString(), st2 = await S.start({ wallet: W, issued: i2, sig: sign("2026-11-27", i2) });
ok(st2.body.me.spins === BASE + 1 && st2.body.me.streak === 2, "the next day: streak 2, a bonus spin");
console.log(`slots: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
