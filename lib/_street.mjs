// lib/_street.mjs — the streets' shared side: who's walking the city right now (each player's position, look, the move
// they're playing, an emote, a car), the punches players throw at each other, and the week's street board.
// Presence lives in the warm function's memory (Fluid compute serves many players from one instance); each instance also
// writes its players to a small shard (street/i/<id>.json) at most every SHARD_MS while anyone's there, and reads the
// other instances' shards at most every MERGE_MS, so players on two instances still see each other a few seconds late.
// Everything here is a toy: positions and scores are what browsers say; nothing is paid or put on chain.
const LOOKS = new Set(["hood", "thief", "muscle", "runner"]);
const CLIPS = ["idle", "walk", "sprint", "jump", "punch", "hit", "die", "wave", "cheer", "drive", "spawn"];
const EMOS = new Set(["", "wave", "cheer"]);
/// holding the city's main coin dresses you up in the streets (cosmetic): the least each tier takes, in whole tokens
export const PERKS = [{ id: "boss", min: 10e6, name: "BOSS" }, { id: "made", min: 1e6, name: "MADE" }, { id: "crew", min: 1, name: "CREW" }];
export const perkOf = (amount) => (PERKS.find((p) => amount >= p.min) || null);
export const STREET = { TTL: 12e3, SHARD_MS: 4e3, MERGE_MS: 8e3, MAX: 60, BOARD: 50, E: 260 };
const num = (v, a, b, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
export const cleanName = (s) => String(s || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
export const cleanId = (s) => String(s || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
/// a browser's report → a clean row (or null)
export function rowOf(b, now = Date.now()) {
  const id = cleanId(b.id), name = cleanName(b.name);
  if (id.length < 8 || name.length < 3) return null;
  return { id, name, look: LOOKS.has(b.look) ? b.look : "hood", x: Math.round(num(b.x, -STREET.E, STREET.E) * 10) / 10, y: Math.round(num(b.y, 0, 40) * 10) / 10, z: Math.round(num(b.z, -STREET.E, STREET.E) * 10) / 10,
    r: Math.round(num(b.r, -7, 7) * 100) / 100, c: CLIPS.includes(b.c) ? b.c : "idle", e: EMOS.has(b.e) ? b.e : "", car: b.car ? num(b.car, 1, 12, 1) | 0 : 0,
    w: num(b.w, 0, 5) | 0, p: b.p ? String(b.p).replace(/[^a-z0-9-]/g, "").slice(0, 12) : "", at: now };
}
const mondayOf = (t = Date.now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export function makeStreet({ store, now = () => Date.now(), inst = Math.random().toString(36).slice(2, 10) } = {}) {
  const here = new Map(); // id → row (this instance)
  const far = new Map(); // id → row (other instances' shards)
  const hits = new Map(); // target id → [{ from, name, dmg, at }]
  let shardAt = 0, mergeAt = 0, merging = null;
  const sweep = () => { const t = now(); for (const m of [here, far]) for (const [k, v] of m) if (t - v.at > STREET.TTL) m.delete(k); for (const [k, v] of hits) if (!v.length || t - v[v.length - 1].at > STREET.TTL) hits.delete(k); };
  async function sync() {
    const t = now();
    if (store && here.size && t - shardAt > STREET.SHARD_MS) { shardAt = t; store.put(`street/i/${inst}.json`, { at: t, rows: [...here.values()].slice(0, STREET.MAX), hits: [...hits.entries()].slice(0, 100) }).catch(() => {}); }
    if (store && t - mergeAt > STREET.MERGE_MS && !merging) {
      mergeAt = t;
      merging = (async () => {
        const keys = (await store.list("street/i/").catch(() => [])).filter((k) => !k.endsWith(`/${inst}.json`)).slice(0, 12);
        const docs = await Promise.all(keys.map((k) => store.get(k).catch(() => null)));
        for (const d of docs) if (d && t - d.at < STREET.TTL) {
          for (const r of d.rows || []) if (!here.has(r.id)) far.set(r.id, r);
          for (const [k, v] of d.hits || []) if (here.has(k)) { const a = hits.get(k) || []; for (const h of v) if (!a.some((x) => x.at === h.at && x.from === h.from)) a.push(h); hits.set(k, a); }
        }
      })().catch(() => {}).finally(() => { merging = null; });
    }
  }
  return {
    /// a player's beat: { id, name, look, x, y, z, r, c, e, car, w, p, hit } → { others, hits }
    async beat(b) {
      const row = rowOf(b, now()); if (!row) return { status: 400, body: { error: "bad player" } };
      sweep(); here.set(row.id, row); far.delete(row.id);
      // a punch at another player: kept for them until their next beat (only if they're close)
      const tid = cleanId(b.hit);
      if (tid && tid !== row.id) { const o = here.get(tid) || far.get(tid); if (o && Math.hypot(o.x - row.x, o.z - row.z) < 3.5) { const a = hits.get(tid) || []; a.push({ from: row.id, name: row.name, dmg: 8, at: now() }); hits.set(tid, a.slice(-6)); } }
      await sync();
      const mine = (hits.get(row.id) || []).filter((h) => h.at > (Number(b.since) || 0)); if (mine.length) hits.delete(row.id);
      const others = [...here.values(), ...far.values()].filter((o) => o.id !== row.id).sort((a, c) => Math.hypot(a.x - row.x, a.z - row.z) - Math.hypot(c.x - row.x, c.z - row.z)).slice(0, STREET.MAX);
      return { status: 200, body: { others, hits: mine, n: here.size + far.size, at: now() } };
    },
    count() { sweep(); return here.size + far.size; },
    /// the week's street board: a player sends their week score (a toy: what the browser says, capped)
    async score(b) {
      const id = cleanId(b.id), name = cleanName(b.name), s = Math.round(num(b.score, 0, 1e7));
      if (id.length < 8 || name.length < 3) return { status: 400, body: { error: "bad player" } };
      if (!s) return { status: 200, body: { rows: [] } }; // nothing to put on the board yet
      const wk = mondayOf(now()), key = `street/week/${wk}.json`;
      const doc = (await store.get(key).catch(() => null)) || { week: wk, rows: [] };
      const was = doc.rows.find((r) => r.id === id);
      if (was && was.s >= s && was.name === name) return { status: 200, body: { week: wk, rows: doc.rows.slice(0, 20) } };
      if (was) { was.s = Math.max(was.s, s); was.name = name; was.at = now(); } else doc.rows.push({ id, name, s, at: now() });
      doc.rows.sort((a, c) => c.s - a.s); doc.rows = doc.rows.slice(0, STREET.BOARD);
      await store.put(key, doc);
      return { status: 200, body: { week: wk, rows: doc.rows.slice(0, 20) } };
    },
    async board() { const wk = mondayOf(now()); const doc = (await store.get(`street/week/${wk}.json`).catch(() => null)) || { rows: [] }; return { week: wk, rows: (doc.rows || []).filter((r) => r.s > 0).slice(0, 20).map(({ id, name, s }) => ({ id: id.slice(0, 4), name, s })) }; },
  };
}
export { mondayOf };

/// a wallet's balance of the main coin (every token account it owns for that mint, both token programs) → its perk
const holdCache = new Map();
export async function holderOf(rpc, owner, mint, now = Date.now()) {
  const k = owner + mint, hit = holdCache.get(k); if (hit && now - hit.at < 60e3) return hit.v;
  const r = await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const amount = ((r && r.value) || []).reduce((a, x) => a + Number((x.account && x.account.data && x.account.data.parsed && x.account.data.parsed.info && x.account.data.parsed.info.tokenAmount && x.account.data.parsed.info.tokenAmount.uiAmountString) || 0), 0);
  const p = perkOf(amount), v = { amount, perk: p ? p.id : "", name: p ? p.name : "", tiers: PERKS.map(({ id, min, name }) => ({ id, min, name })) };
  holdCache.set(k, { at: now, v }); if (holdCache.size > 3000) holdCache.clear();
  return v;
}

/// the hour's vault (street-vault.js): it falls into CLOCK PLAZA when the hour's coin drops; the first player to open it
/// gets it (a toy: a title and street cash on the device). One per hour (street/vault/<hour>.json, create-only).
export const hourNow = (t = Date.now()) => new Date(t).toISOString().slice(0, 13);
export function makeVault({ store, now = () => Date.now() }) {
  const mem = new Map(); // hour → { at, v }
  async function of(hour) {
    const h = mem.get(hour); if (h && (h.v || now() - h.at < 4e3)) return h.v;
    const v = (await store.get(`street/vault/${hour}.json`).catch(() => null)) || null; mem.set(hour, { at: now(), v }); if (mem.size > 50) mem.clear();
    return v;
  }
  return {
    of,
    async open(b) {
      const id = cleanId(b.id), name = cleanName(b.name), hour = String(b.hour || "");
      if (id.length < 8 || name.length < 3) return { status: 400, body: { error: "bad player" } };
      if (hour !== hourNow(now())) return { status: 409, body: { error: "that vault is gone" } };
      const was = await of(hour); if (was) return { status: 200, body: { won: was.id === id, by: was.name, at: was.at } };
      const doc = { id, name, at: now() };
      try { await store.put(`street/vault/${hour}.json`, doc, { create: true }); mem.set(hour, { at: now(), v: doc }); return { status: 200, body: { won: true, by: name, at: doc.at } }; }
      catch (e) { mem.delete(hour); const v = await of(hour); return { status: 200, body: { won: !!v && v.id === id, by: v ? v.name : "someone", at: v ? v.at : now() } }; }
    },
  };
}
