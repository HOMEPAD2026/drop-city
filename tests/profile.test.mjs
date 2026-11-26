// A wallet's profile: what it launched, its cashback, LP, cards and the badges they earn (no network).
import { makeProfile, badgesOf } from "../lib/_profile.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const W = "8GvmGzRCiT3Vsc4poLjJGdo2mKxds7NA6BqapiBVv3Zp", O = "FxPeUcKhAst5dTyELKk7aMHKLLP1BCxw6eynCKRQJfzx";
const items = [{ mint: "M1", symbol: "AAA", creator: W, kind: "user", mcapUsd: 9000, graduated: true }, { mint: "M2", symbol: "BBB", creator: W, kind: "user", mcapUsd: 2000 }, { mint: "M3", symbol: "CCC", creator: O, kind: "user", mcapUsd: 50000 }, { mint: "P1", symbol: "SUP", creator: W, kind: "partner", mcapUsd: 1e6 }];
let calls = 0;
const P = makeProfile({
  pad: { list: async () => { calls++; return { items, cfg: { ticker: "GTAFUN" } }; } },
  cashback: { view: async () => ({ earners: 40, me: { earned: 1200, today: 30, rank: 4, invited: 2, refEarned: 80, ref: null } }) },
  lp: { view: async () => ({ me: { earned: 500, paid: 200, pending: 300 } }) },
  cards: { view: async () => ({ cards: 10, mine: [{ card: "doge" }, { card: "pepe" }, { card: "pepe" }] }) },
});
const r = await P.view(W), p = r.body;
ok(r.status === 200 && p.coins.length === 2 && p.coins[0].symbol === "AAA" && p.mcapUsd === 11000, "its own launches (not a supported coin, not someone else's), biggest first");
ok(p.cashback.earned === 1200 && p.cashback.rank === 4 && p.cashback.of === 40 && p.lp.pending === 300, "cashback with its rank, LP rewards");
ok(p.cards.total === 3 && p.cards.kinds === 2 && p.cards.mine.pepe === 2 && p.cards.of === 10, "cards: 3 held, 2 kinds of 10");
ok(["launch1", "made", "cash", "top10", "invite1", "lp", "card1"].every((b) => p.badges.includes(b)) && !p.badges.includes("launch5") && !p.badges.includes("set") && !p.badges.includes("invite5"), "the badges it earned, and only those");
await P.view(W); ok(calls === 1, "read once in 30 seconds");
ok((await P.view("nope")).status === 400, "a bad wallet is refused");
ok(badgesOf({ coins: [], cashback: { earned: 0, rank: 0, invited: 0 }, lp: { earned: 0 }, cards: { kinds: 10, of: 10, total: 10 } }).join() === "card1,set", "a full set of ten is SET");
console.log(`profile: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
