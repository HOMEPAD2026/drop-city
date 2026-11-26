// lib/_slots.mjs — CITY SLOTS' weekly board (2026-11-26, the owner: "응 다 진행하자"). Spins for the board are drawn HERE
// (crypto.randomInt), so a page can't pick its own reels: the wallet signs once a UTC day (slotMessage), gets a day
// token (an HMAC, nothing stored), and each spin is one POST. The day's spins and streak follow the same rules as the
// page (slot-data.js today / payOf). Points are a toy score — never money, tokens or rewards.
import { createHmac, randomInt } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "./_chain.mjs";
import { today, payOf, bagOf, slotMessage, weekOf } from "../slot-data.js";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

export function makeSlots({ store, pad, now = () => Date.now(), rand = randomInt, secret = () => env("PAD_SLOT_SECRET") || "dc-slot\n" + (env("BLOB_READ_WRITE_TOKEN") || env("PAD_VAULT") || "local") }) {
  const tokenOf = (w, d) => createHmac("sha256", secret()).update(w + "|" + d).digest("hex").slice(0, 32);
  async function reels() {
    const L = await pad.list().catch(() => ({ items: [] })), main = L.cfg && L.cfg.main;
    const ids = [...(main ? [main] : []), ...(L.items || []).filter((c) => c.kind === "partner").slice(0, 6).map((c) => c.mint), "seven", "star"];
    return { ids, main: main || "" };
  }
  /// the day's sign-in: the wallet's signature over slotMessage → its day token
  async function start(b) {
    const t = now(), w = String(b.wallet || ""), d = dayOf(t), it = Date.parse(String(b.issued || ""));
    if (!C.isPubkey(w)) return { status: 400, body: { error: "bad wallet" } };
    if (!(it > 0) || Math.abs(t - it) > 10 * 60e3) return { status: 400, body: { error: "the signature is too old — sign again" } };
    let ok = false; try { ok = ed25519.verify(C.b58dec(String(b.sig || "")), new TextEncoder().encode(slotMessage(w, d, b.issued)), C.b58dec(w)); } catch {}
    if (!ok) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    return { status: 200, body: { ok: true, day: d, token: tokenOf(w, d), me: await me(w, t) } };
  }
  async function me(w, t = now()) {
    const u = (await store.get(`slot/u/${w}.json`).catch(() => null)) || {};
    const s = today(u, dayOf(t)), wk = (await store.get(`slot/week/${weekOf(t)}.json`).catch(() => null)) || {};
    return { spins: s.spins, streak: s.streak, pts: s.pts || 0, week: wk[w] || 0 };
  }
  /// one spin for the board: the server draws the three reels
  async function spin(b) {
    const t = now(), w = String(b.wallet || ""), d = dayOf(t);
    if (!C.isPubkey(w) || String(b.token || "") !== tokenOf(w, d)) return { status: 403, body: { error: "sign in to the board again" } };
    const u = (await store.get(`slot/u/${w}.json`).catch(() => null)) || {}, s = today(u, d);
    if (s.spins <= 0) return { status: 409, body: { error: "no spins left today", me: await me(w, t) } };
    const R = await reels(), bag = bagOf(R.ids, R.main), line = [0, 1, 2].map(() => bag[rand(bag.length)]), won = payOf(line, R.main);
    s.spins--; s.pts = (s.pts || 0) + won;
    await store.put(`slot/u/${w}.json`, s, {});
    const wk = weekOf(t), board = (await store.get(`slot/week/${wk}.json`).catch(() => null)) || {};
    if (won) { board[w] = (board[w] || 0) + won; await store.put(`slot/week/${wk}.json`, board, {}); }
    return { status: 200, body: { ok: true, line, won, me: { spins: s.spins, streak: s.streak, pts: s.pts, week: board[w] || 0 } } };
  }
  /// this week's top 10
  async function view(w = "") {
    const t = now(), wk = weekOf(t), board = (await store.get(`slot/week/${wk}.json`).catch(() => null)) || {};
    const top = Object.entries(board).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([x, pts]) => ({ w: x, pts }));
    return { week: wk, top, players: Object.keys(board).length, me: C.isPubkey(w) ? await me(w, t) : null };
  }
  return { start, spin, view, tokenOf };
}
