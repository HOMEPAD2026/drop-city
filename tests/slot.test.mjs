// CITY SLOTS: the day's spins + streak and the pay table (no network, no page).
import { today, titleOf, payOf, BASE } from "../slot-data.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const M = "MAINxx";
ok(payOf(["star", "star", "star"], M) === 1000 && payOf(["seven", "seven", "seven"], M) === 777, "★★★ 1,000 · 777 777");
ok(payOf([M, "star", M], M) === 500 && payOf(["dcty", "dcty", "star"], M) === 150, "three of a kind with a wild: the main coin 500, a supported coin 150");
ok(payOf(["star", "star", "dcty"], M) === 150 && payOf(["star", "star", "seven"], M) === 777, "two wilds + one coin is three of a kind");
ok(payOf([M, M, "dcty"], M) === 40 && payOf(["seven", "star", "dcty"], M) === 30 && payOf(["dcty", "dcty", M], M) === 15, "two from the left");
ok(payOf(["dcty", M, "dcty"], M) === 0 && payOf(["dcty", "pipi", "star"], M) === 0, "no match pays nothing");
const d1 = today({}, "2026-11-26"); ok(d1.spins === BASE && d1.streak === 1 && d1.pts === 0, "a first visit: 10 spins, streak 1");
const used = { ...d1, spins: 0, pts: 120 }; ok(today(used, "2026-11-26").spins === 0, "the same day keeps what's left");
const d2 = today(used, "2026-11-27"); ok(d2.spins === BASE + 1 && d2.streak === 2 && d2.pts === 120, "the next day: streak 2, one bonus spin, points kept");
const d9 = today({ day: "2026-12-04", streak: 8 }, "2026-12-05"); ok(d9.streak === 9 && d9.spins === BASE + 5, "the streak bonus stops at +5");
ok(today({ day: "2026-11-20", streak: 6 }, "2026-11-27").streak === 1, "a missed day starts the streak again");
ok(titleOf(1)[2] === "New in town" && titleOf(3)[2] === "Regular" && titleOf(7)[2] === "Made Man" && titleOf(30)[2] === "Kingpin", "titles by streak");
console.log(`slot: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
