// lib/_pad.mjs — the launchpad's rules on the server.
//
// A drop is an ordinary pump.fun coin made from the sponsor's own Solana wallet, its creator fees shared through
// pump.fun's fee-sharing program [sponsor 60 % · THE VAULT 30 % · the main-coin buyer 10 %] and locked in the same
// signing. Every address ends with PAD.suffix (the browser grinds the mint key before the launch).
//
// One drop an hour (UTC): the sponsor first RESERVES the hour (a signed message naming the mint address they ground),
// launches on pump.fun, then REGISTERS the coin — the server checks it on chain (curve, locked split, suffix, the
// hour's reservation for that mint) and lists it. A reservation that isn't launched within holdMin lets the next
// sponsor take the hour.
//
// The store is any { get(key), put(key, value, { create }) , list(prefix) }: Vercel Blob in production (lib/_blob.mjs),
// a Map in the tests. `create: true` must fail when the key exists — that's what makes an hour go to one sponsor.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PAD } from "../pad-config.js";
import * as C from "./_chain.mjs";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
const B58 = /^[1-9A-HJ-NP-Za-km-z]*$/;
export function cfg() {
  const c = { ...PAD, split: { ...PAD.split } };
  for (const [k, e] of [["name", "PAD_NAME"], ["ticker", "PAD_TICKER"], ["suffix", "PAD_SUFFIX"], ["vault", "PAD_VAULT"], ["buyer", "PAD_BUYER"]]) if (env(e)) c[k] = env(e);
  c.suffix = String(c.suffix || "").trim();
  if (!B58.test(c.suffix) || c.suffix.length > 4) c.suffixError = "the suffix must be 0–4 base58 letters (no 0, O, I or l)";
  c.open = C.isPubkey(c.vault) && C.isPubkey(c.buyer) && !c.suffixError;
  return c;
}
/// the public view of the config (what the page needs)
export const publicCfg = () => { const c = cfg(); return { name: c.name, ticker: c.ticker, suffix: c.suffixError ? "" : c.suffix, vault: c.vault || null, buyer: c.buyer || null, split: c.split, dropsPerDay: c.dropsPerDay, holdMin: c.holdMin, open: c.open, why: c.open ? null : c.suffixError || "the city vault wallet isn't set yet" }; };

export const hourOf = (ms) => new Date(ms).toISOString().slice(0, 13); // "2026-11-18T05"
export const nextHourMs = (ms) => Math.floor(ms / 3600e3) * 3600e3 + 3600e3;
export const reserveMessage = (wallet, mint, hour, issued) => `Reserve a drop\nWallet: ${wallet}\nCoin: ${mint}\nHour (UTC): ${hour}\nIssued: ${issued}`;
const verify = (msg, sig, pub) => { try { return ed25519.verify(C.b58dec(String(sig || "")), new TextEncoder().encode(msg), C.b58dec(pub)); } catch { return false; } };

/// is this sharing config the launchpad's split? → { ok, creator, why }
export function splitCheck(sc, mint, c = cfg()) {
  if (!sc) return { ok: false, why: "this coin has no fee-sharing config" };
  if (sc.mint !== mint) return { ok: false, why: "the fee-sharing config is for another coin" };
  if (sc.status !== "active") return { ok: false, why: "the fee-sharing config is paused" };
  if (!sc.adminRevoked) return { ok: false, why: "the fee split isn't locked yet" };
  const v = sc.shareholders.find((s) => s.address === c.vault), b = sc.shareholders.find((s) => s.address === c.buyer);
  const k = sc.shareholders.find((s) => s.address !== c.vault && s.address !== c.buyer);
  if (sc.shareholders.length !== 3 || !v || !b || !k || v.shareBps !== c.split.vault || b.shareBps !== c.split.buyer || k.shareBps !== c.split.creator)
    return { ok: false, why: `the fee split isn't ${c.split.creator / 100} / ${c.split.vault / 100} / ${c.split.buyer / 100}` };
  return { ok: true, creator: k.address };
}

export function makePad({ store, now = () => Date.now() }) {
  const C2 = () => cfg();
  // ---------------- the hour
  /// the hour's state: { hour, next, taken: { mint, wallet, state, until } | null, free }
  async function slot(t = now()) {
    const hour = hourOf(t), keys = (await store.list(`slots/${hour}/`)).sort();
    let last = null;
    if (keys.length) last = await store.get(keys[keys.length - 1]);
    const launched = last && last.state === "launched";
    const held = last && !launched && last.until > t;
    return { hour, next: nextHourMs(t), n: keys.length, taken: last ? { mint: last.mint, wallet: last.wallet, state: launched ? "launched" : held ? "held" : "expired", until: last.until, symbol: last.symbol || "" } : null, free: !launched && !held };
  }
  async function reserve(b) {
    const c = C2(), t = now(), wallet = String(b.wallet || ""), mint = String(b.mint || "");
    if (!c.open) return { status: 503, body: { error: c.suffixError || "launching opens once the city vault wallet is set" } };
    if (!C.isPubkey(wallet) || !C.isPubkey(mint)) return { status: 400, body: { error: "bad wallet or coin address" } };
    if (c.suffix && !mint.endsWith(c.suffix)) return { status: 400, body: { error: `the coin's address must end with ${c.suffix}` } };
    if (wallet === c.vault || wallet === c.buyer) return { status: 400, body: { error: "launch from another wallet" } };
    const it = Date.parse(String(b.issued || ""));
    if (!(it > 0) || Math.abs(t - it) > 10 * 60e3) return { status: 400, body: { error: "the signature is too old — sign again" } };
    const hour = hourOf(t);
    if (!verify(reserveMessage(wallet, mint, hour, b.issued), b.sig, wallet)) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    const s = await slot(t);
    if (s.taken && s.taken.state === "launched") return { status: 409, body: { error: "this hour's drop is out — the next one opens at the top of the hour", next: s.next } };
    if (s.taken && s.taken.state === "held") {
      if (s.taken.wallet === wallet && s.taken.mint === mint) return { status: 200, body: { ok: true, hour, until: s.taken.until, again: true } };
      return { status: 409, body: { error: "another sponsor holds this hour", until: s.taken.until, next: s.next } };
    }
    const until = Math.min(t + c.holdMin * 60e3, s.next - 15e3);
    if (until - t < 3 * 60e3) return { status: 409, body: { error: "too close to the end of the hour — reserve the next one", next: s.next } };
    const key = `slots/${hour}/${String(s.n + 1).padStart(3, "0")}.json`;
    const r = await store.put(key, { wallet, mint, hour, at: t, until, state: "held" }, { create: true }).catch((e) => ({ conflict: true, e }));
    if (r && r.conflict) return { status: 409, body: { error: "someone took the hour a moment ago", next: s.next } };
    return { status: 200, body: { ok: true, hour, until } };
  }

  // ---------------- a launched coin
  async function register(b) {
    const c = C2(), t = now(), mint = String(b.mint || "").trim();
    let sig = String(b.sig || "").trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) sig = "";
    if (!C.isPubkey(mint)) return { status: 400, body: { error: "mint must be a Solana address" } };
    if (c.suffix && !mint.endsWith(c.suffix)) return { status: 400, body: { error: `the coin's address must end with ${c.suffix}` } };
    const known = await store.get(`coins/${mint}.json`);
    if (known) return { status: 200, body: { ok: true, mint, already: true } };
    // the hour it was reserved in: this one, or the one before (a launch that crossed the hour)
    let res = null, resKey = null;
    for (const h of [hourOf(t), hourOf(t - 3600e3)]) {
      const keys = (await store.list(`slots/${h}/`)).sort();
      // only the hour's latest claim counts: a hold that ran out and was taken by the next sponsor is gone
      if (keys.length) { const k = keys[keys.length - 1], v = await store.get(k); if (v && v.mint === mint) { res = v; resKey = k; } }
      if (res) break;
    }
    if (!res) return { status: 409, body: { error: "this coin didn't reserve an hour here" } };
    const ch = await C.chainOf(mint);
    if (!ch.curve) return { status: 404, body: { error: "no pump.fun bonding curve yet — wait a few seconds" } };
    const chk = splitCheck(ch.sharing, mint, c);
    if (!chk.ok) return { status: 409, body: { error: chk.why } };
    if (ch.curve.creator !== ch.scA) return { status: 409, body: { error: "the coin's creator fees don't go to its fee-sharing config" } };
    if (chk.creator !== res.wallet) return { status: 409, body: { error: "the coin was launched from another wallet than the one that reserved the hour" } };
    const m = await C.mintMeta(mint), j = await C.metaJson(m.uri);
    const item = {
      mint, creator: chk.creator, curve: ch.cvA, sharingConfig: ch.scA, vault: C.creatorVaultPda(ch.scA), sig, hour: res.hour,
      name: m.name, symbol: m.symbol, uri: m.uri, image: j.image || "", description: j.description || "",
      twitter: j.twitter || "", telegram: j.telegram || "", website: j.website || "", launchedAt: Math.floor(t / 1000),
    };
    const put = await store.put(`coins/${mint}.json`, item, { create: true }).catch(() => ({ conflict: true }));
    if (put && put.conflict) return { status: 200, body: { ok: true, mint, already: true } };
    await store.put(resKey, { ...res, state: "launched", symbol: item.symbol, launchedAt: t }, {});
    mem.view = null;
    return { status: 200, body: { ok: true, mint, hour: res.hour } };
  }

  // ---------------- the city's coins, live
  const mem = { view: null };
  async function list() {
    if (mem.view && now() - mem.view.at < 30e3) return mem.view;
    const keys = await store.list("coins/");
    const items = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).sort((a, b) => a.launchedAt - b.launchedAt);
    const rows = await withPrices(items).catch(() => items);
    mem.view = { at: now(), items: rows, cfg: publicCfg() };
    return mem.view;
  }
  async function withPrices(items) {
    if (!items.length) return [];
    const sol = await C.solUsd();
    const acc = await C.accounts(items.flatMap((x) => [x.curve, x.vault]));
    const grads = [];
    const rows = items.map((x, j) => {
      const [cv, va] = acc.slice(2 * j, 2 * j + 2);
      const curve = cv && cv.owner === C.PROGRAM.pump ? C.decodeCurve(cv.data) : null;
      let priceSol = null, progress = null, graduated = false, supply = 1e9;
      if (curve) {
        graduated = curve.complete; supply = Number(curve.tokenTotalSupply) / 1e6 || 1e9;
        if (!curve.complete && curve.virtualTokenReserves > 0n) priceSol = (Number(curve.virtualQuoteReserves) / 1e9) / (Number(curve.virtualTokenReserves) / 1e6);
        progress = curve.complete ? 100 : Math.max(0, Math.min(100, (Number(C.INITIAL_REAL_TOKENS - curve.realTokenReserves) / Number(C.INITIAL_REAL_TOKENS)) * 100));
      }
      if (graduated) grads.push(x.mint);
      const priceUsd = priceSol != null && sol ? priceSol * sol : null;
      return { ...x, graduated, progress: progress != null ? Math.round(progress * 10) / 10 : null, priceUsd, mcapUsd: priceUsd != null ? priceUsd * supply : null,
        feesWaitingSol: va ? Number(va.lamports > C.RENT_EMPTY ? va.lamports - C.RENT_EMPTY : 0n) / 1e9 : 0 };
    });
    if (grads.length) { const d = await C.dexPrices(grads).catch(() => ({})); for (const r of rows) if (r.graduated && d[r.mint]) { r.priceUsd = d[r.mint].priceUsd; r.mcapUsd = d[r.mint].mcapUsd; } }
    return rows;
  }

  // ---------------- the coin's metadata and logo (hosted in the store; pump.fun reads the uri)
  async function meta(b) {
    const name = C.clean(b.name, 32), symbol = C.clean(b.symbol, 13);
    if (!name || !symbol) return { status: 400, body: { error: "name and ticker are needed" } };
    const image = C.httpsOr(b.image); if (b.image && !image) return { status: 400, body: { error: "the logo must be an https:// link" } };
    const doc = { name, symbol, description: C.clean(b.description, 1000), image, showName: true };
    for (const k of ["twitter", "telegram", "website"]) { const v = C.httpsOr(b[k]); if (v) doc[k] = v; }
    const id = hex(sha256(new TextEncoder().encode(JSON.stringify(doc))).subarray(0, 12));
    const r = await store.put(`meta/${id}.json`, doc, { create: true, public: true }).catch((e) => (e && e.exists ? null : Promise.reject(e)));
    return { status: 200, body: { ok: true, id, uri: (r && r.url) || (await store.url(`meta/${id}.json`)) } };
  }
  async function logo(b) {
    const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
    if (!m) return { status: 400, body: { error: "upload a PNG, JPEG, WebP or GIF image" } };
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 400_000) return { status: 413, body: { error: "the image is too large (400 KB at most)" } };
    if (!sniff(bytes, m[1])) return { status: 400, body: { error: "that file isn't the image it says it is" } };
    const id = hex(sha256(bytes)), ext = m[1] === "jpeg" ? "jpg" : m[1];
    const r = await store.put(`logos/${id}.${ext}`, bytes, { create: true, public: true, type: "image/" + m[1] }).catch((e) => (e && e.exists ? null : Promise.reject(e)));
    return { status: 200, body: { ok: true, id, url: (r && r.url) || (await store.url(`logos/${id}.${ext}`)) } };
  }
  return { slot, reserve, register, list, meta, logo };
}
const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, "0")).join("");
/// the file's first bytes match its type
export function sniff(b, t) {
  if (t === "png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (t === "jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (t === "gif") return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  if (t === "webp") return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
  return false;
}
