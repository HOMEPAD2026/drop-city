// lib/_cards.mjs — GTAFUN CARDS (NFT packs) on the server: which Candy Machine sells them, its state read from the
// chain, the pulls people made (each mint transaction read back, its cards decoded from the assets' names) and the
// collection board. The machine is set up from the page by the operations wallet (PAD_CARDS_WALLET, else the LP
// rewards wallet) — the server only checks on chain that the machine's authority is that wallet. It holds no key.
import { PAD } from "../pad-config.js";
import * as C from "./_chain.mjs";
import { SEASON, CARDS, cardOfName, itemMap, CARD_LAMPORTS } from "../cards-data.js";

export const CM_PROGRAM = "CMACYFENjoBMHzapRXyo1JZkVS6EtaDDzkjMrmQLvr4J";
export const CORE_PROGRAM = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const u64 = (b, o) => { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]); return Number(v); };
export function cardsCfg() {
  const c = { cm: "", collection: "", wallet: "", ...(PAD.cards || {}) };
  for (const [k, e] of [["cm", "PAD_CARDS_CM"], ["collection", "PAD_CARDS_COLLECTION"], ["wallet", "PAD_CARDS_WALLET"]]) if (C.isPubkey(env(e))) c[k] = env(e);
  if (!C.isPubkey(c.wallet) && C.isPubkey(env("PAD_LP_WALLET"))) c.wallet = env("PAD_LP_WALLET");
  for (const k of ["cm", "collection", "wallet"]) if (!C.isPubkey(c[k])) c[k] = "";
  return c;
}
/// a Core Candy Machine account → authority, mint authority (its guard), collection, items redeemed / available
export function decodeMachine(data) {
  const b = typeof data === "string" ? b64(data) : data;
  if (!b || b.length < 120) return null;
  return { authority: C.b58enc(b.slice(8, 40)), mintAuthority: C.b58enc(b.slice(40, 72)), collection: C.b58enc(b.slice(72, 104)), redeemed: u64(b, 104), available: u64(b, 112) };
}
/// a Core asset account → owner and name (key u8, owner, update authority (u8 + key), name, uri)
export function decodeAsset(data) {
  const b = typeof data === "string" ? b64(data) : data;
  if (!b || b.length < 70 || b[0] !== 1) return null;
  const owner = C.b58enc(b.slice(1, 33)), o = 66, n = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
  return { owner, name: new TextDecoder().decode(b.slice(o + 4, o + 4 + n)) };
}

export function makeCards({ store, now = () => Date.now(), rpc = C.rpc }) {
  const mem = { st: null };
  async function machine() {
    const c = cardsCfg(), saved = (await store.get("cards/state.json").catch(() => null)) || {};
    const cm = c.cm || saved.cm || "", collection = c.collection || saved.collection || "";
    if (!cm) return { cm: "", collection: "", wallet: c.wallet, ready: false };
    if (mem.st && mem.st.cm === cm && now() - mem.st.at < 15e3) return mem.st.v;
    const a = await rpc("getAccountInfo", [cm, { encoding: "base64" }]).catch(() => null), m = a && a.value && a.value.owner === CM_PROGRAM ? decodeMachine(a.value.data[0]) : null;
    const v = { cm, collection: (m && m.collection) || collection, wallet: c.wallet, ready: !!m && m.redeemed < m.available, redeemed: m ? m.redeemed : null, available: m ? m.available : null, authority: m ? m.authority : null };
    mem.st = { cm, at: now(), v }; return v;
  }
  /// the operations wallet registers the machine it created (checked on chain: its authority is that wallet)
  async function setup(b) {
    const c = cardsCfg(), cm = String((b && b.cm) || "");
    if (!c.wallet) return { status: 409, body: { error: "the operations wallet isn't set (PAD_CARDS_WALLET)" } };
    if (!C.isPubkey(cm)) return { status: 400, body: { error: "not an address" } };
    const a = await rpc("getAccountInfo", [cm, { encoding: "base64" }]), m = a && a.value && a.value.owner === CM_PROGRAM ? decodeMachine(a.value.data[0]) : null;
    if (!m) return { status: 404, body: { error: "no Core Candy Machine at that address yet" } };
    if (m.authority !== c.wallet) return { status: 403, body: { error: "that machine belongs to another wallet" } };
    if (m.available !== SEASON.supply) return { status: 409, body: { error: `the machine holds ${m.available} items, the season ${SEASON.supply}` } };
    await store.put("cards/state.json", { cm, collection: m.collection, at: now() }, {});
    mem.st = null;
    return { status: 200, body: { ok: true, cm, collection: m.collection } };
  }
  /// a pack someone opened: the transaction must be a confirmed mint from our machine; each asset is read back and
  /// its card decoded from its name (#index) — kept for the board and the buyer's collection (once a transaction)
  async function minted(b) {
    const sig = String((b && b.sig) || ""), ids = Array.isArray(b && b.assets) ? b.assets.filter(C.isPubkey).slice(0, 5) : [];
    if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig) || !ids.length) return { status: 400, body: { error: "a signature and the minted assets, please" } };
    const m = await machine(); if (!m.cm) return { status: 409, body: { error: "the cards aren't on sale yet" } };
    const tx = await rpc("getTransaction", [sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    if (!tx || !tx.meta || tx.meta.err) return { status: 404, body: { error: "the transaction isn't confirmed (or failed)" } };
    const keys = tx.transaction.message.accountKeys.map(String);
    if (!keys.includes(m.cm) || !ids.every((x) => keys.includes(x))) return { status: 400, body: { error: "not a mint from this machine" } };
    const r = await rpc("getMultipleAccounts", [ids, { encoding: "base64" }]);
    const got = ((r && r.value) || []).map((a, i) => { const d = a && a.owner === CORE_PROGRAM ? decodeAsset(a.data[0]) : null, card = d ? cardOfName(d.name, MAP) : null; return d && card ? { id: ids[i], owner: d.owner, name: d.name, card: card.id } : null; }).filter(Boolean);
    if (!got.length) return { status: 400, body: { error: "the cards couldn't be read yet — try again in a moment" } };
    const once = await store.put(`cards/tx/${sig}.json`, { at: now(), got }, { create: true }).catch(() => ({ conflict: true }));
    if (once && once.conflict) return { status: 200, body: { ok: true, already: true, cards: got } };
    const owner = got[0].owner, mine = (await store.get(`cards/own/${owner}.json`).catch(() => null)) || { cards: [] };
    mine.cards = [...got.map((g) => ({ id: g.id, card: g.card, name: g.name, at: now() })), ...mine.cards].slice(0, 500);
    await store.put(`cards/own/${owner}.json`, mine, {});
    const board = (await store.get("cards/board.json").catch(() => null)) || { by: {}, pulls: [], total: 0 };
    for (const g of got) { board.by[g.card] = (board.by[g.card] || 0) + 1; board.total++; }
    board.pulls = [...got.map((g) => ({ card: g.card, owner, at: now() })), ...board.pulls].slice(0, 40);
    await store.put("cards/board.json", board, {});
    return { status: 200, body: { ok: true, cards: got } };
  }
  async function view(w = "") {
    const [m, board, mine] = await Promise.all([machine(), store.get("cards/board.json").catch(() => null), C.isPubkey(w) ? store.get(`cards/own/${w}.json`).catch(() => null) : null]);
    return { season: SEASON.id, price: CARD_LAMPORTS, pack: SEASON.pack, ...m, board: board || { by: {}, pulls: [], total: 0 }, mine: mine ? mine.cards : null, cards: CARDS.length };
  }
  return { machine, setup, minted, view };
}
const MAP = itemMap();
