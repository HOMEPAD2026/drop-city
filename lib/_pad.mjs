// lib/_pad.mjs — the launchpad's rules on the server.
//
// Every coin here is an ordinary pump.fun coin, its creator fees shared through pump.fun's fee-sharing program
// [creator 60 % · THE VAULT 30 % · the main-coin buyer 10 %] and locked in the same signing; every address ends with
// PAD.suffix (ground before the launch).
//
//   THE HOURLY DROP — the city's agent (lib/_agent.mjs) launches one coin at the top of every UTC hour from its own
//   wallet (env PAD_AGENT_KEY) and lists it here with its hour (kind "drop"). Its 60 % goes to the agent's wallet,
//   which keeps a small reserve for the next launches and sends the rest on to THE VAULT.
//   EVERYONE ELSE — launches whenever they like, as many as they like (kind "user"): launch on pump.fun from your own
//   wallet, then REGISTER the coin — the server checks it on chain (curve, locked split, suffix) and lists it.
//
// The store is any { get(key), put(key, value, { create }) , list(prefix) }: Vercel Blob in production (lib/_blob.mjs),
// a Map in the tests. `create: true` must fail when the key exists — that's what makes an hour's drop happen once.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PAD } from "../pad-config.js";
import * as C from "./_chain.mjs";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
const B58 = /^[1-9A-HJ-NP-Za-km-z]*$/;
export function cfg() {
  const c = { ...PAD, split: { ...PAD.split }, listAnyway: [...(PAD.listAnyway || [])] };
  for (const [k, e] of [["name", "PAD_NAME"], ["ticker", "PAD_TICKER"], ["suffix", "PAD_SUFFIX"], ["vault", "PAD_VAULT"], ["buyer", "PAD_BUYER"]]) if (env(e)) c[k] = env(e);
  c.suffix = String(c.suffix || "").trim();
  if (!B58.test(c.suffix) || c.suffix.length > 4) c.suffixError = "the suffix must be 0–4 base58 letters (no 0, O, I or l)";
  c.open = C.isPubkey(c.vault) && C.isPubkey(c.buyer) && !c.suffixError;
  c.main = C.isPubkey(env("PAD_MAIN")) ? env("PAD_MAIN") : C.isPubkey(PAD.main) ? PAD.main : "";
  c.agent = agentPub(env("PAD_AGENT_KEY"));
  return c;
}
/// the agent's address from its secret (base58 64-byte key as Phantom exports it, or a JSON byte array) — "" if unset / bad
export function agentPub(secret) {
  const s = String(secret || "").trim(); if (!s) return "";
  try { const b = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : C.b58dec(s); if (b.length !== 64) return ""; const pub = C.b58enc(ed25519.getPublicKey(b.slice(0, 32))); return pub === C.b58enc(b.slice(32)) ? pub : ""; } catch { return ""; }
}
/// the public view of the config (what the page needs)
export const quotesOf = (c = cfg()) => (c.quotes || []).filter((q) => C.isPubkey(q.mint) && C.isPubkey(q.program));
export const publicCfg = () => { const c = cfg(); return { quotes: quotesOf(c), name: c.name, ticker: c.ticker, suffix: c.suffixError ? "" : c.suffix, vault: c.vault || null, buyer: c.buyer || null, split: c.split, dropsPerDay: c.dropsPerDay, open: c.open, agent: c.agent || null, main: c.main || null, why: c.open ? null : c.suffixError || "the city vault wallet isn't set yet" }; };

export const hourOf = (ms) => new Date(ms).toISOString().slice(0, 13); // "2026-11-18T05"
export const nextHourMs = (ms) => Math.floor(ms / 3600e3) * 3600e3 + 3600e3;

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
  // ---------------- the hour's drop (the agent's run log: agent/run/<hour>/NN.json, see lib/_agent.mjs)
  /// { hour, next, state: "dropped" | "dropping" | "failed" | "waiting" | "off", drop: { mint, symbol } | null }
  async function slot(t = now()) {
    const c = C2(), hour = hourOf(t), keys = (await store.list(`agent/run/${hour}/`)).sort();
    const runs = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean);
    const done = runs.find((r) => r.state === "launched"), last = runs[runs.length - 1];
    const state = done ? "dropped" : !c.agent || !c.open ? "off" : last && last.state === "running" && t - last.at < 5 * 60e3 ? "dropping" : last && last.state === "failed" ? "failed" : "waiting";
    return { hour, next: nextHourMs(t), state, drop: done ? { mint: done.mint, symbol: done.symbol || "" } : null, tries: runs.length };
  }

  // ---------------- a launched coin
  async function register(b) {
    const c = C2(), t = now(), mint = String(b.mint || "").trim();
    let sig = String(b.sig || "").trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) sig = "";
    if (!C.isPubkey(mint)) return { status: 400, body: { error: "mint must be a Solana address" } };
    if (c.suffix && !mint.endsWith(c.suffix)) return { status: 400, body: { error: `the coin's address must end with ${c.suffix}` } };
    const known = await store.get(`coins/${mint}.json`);
    if (known) return { status: 200, body: { ok: true, mint, already: true } };
    const ch = await C.chainOf(mint);
    if (!ch.curve) return { status: 404, body: { error: "no pump.fun bonding curve yet — wait a few seconds" } };
    const chk = splitCheck(ch.sharing, mint, c);
    // a coin the owner lists without its split (PAD.listAnyway): all its creator fees go to its creator
    if (!chk.ok && (c.listAnyway || []).includes(mint) && !ch.sharing) return save({ mint, sig, ch, chk: { ok: true, creator: ch.curve.creator }, t, kind: "user", noSplit: true });
    if (!chk.ok) return { status: 409, body: { error: chk.why } };
    if (ch.curve.creator !== ch.scA) return { status: 409, body: { error: "the coin's creator fees don't go to its fee-sharing config" } };
    if (c.agent && chk.creator === c.agent) return { status: 409, body: { error: "the agent lists its own drops" } };
    return save({ mint, sig, ch, chk, t, kind: "user" });
  }
  /// the agent's hourly drop (lib/_agent.mjs, after it launched): the same chain checks, then listed with its hour
  async function addDrop({ mint, sig, hour }) {
    const c = C2(), t = now();
    const ch = await C.chainOf(mint);
    if (!ch.curve) return { status: 404, body: { error: "no bonding curve yet" } };
    const chk = splitCheck(ch.sharing, mint, c);
    if (!chk.ok) return { status: 409, body: { error: chk.why } };
    if (chk.creator !== c.agent) return { status: 409, body: { error: "not the agent's coin" } };
    return save({ mint, sig, ch, chk, t, kind: "drop", hour });
  }
  async function save({ mint, sig, ch, chk, t, kind, hour = "", noSplit = false }) {
    // the pair: SOL, or one of the configured quote tokens (anything else isn't listed)
    let quote = null;
    if (!C.isSolQuote(ch.curve.quoteMint)) { quote = quotesOf().find((q) => q.mint === ch.curve.quoteMint); if (!quote) return { status: 409, body: { error: "this coin trades against a token the city doesn't list" } }; }
    const m = await C.mintMeta(mint), j = await C.metaJson(m.uri);
    const item = {
      mint, kind, creator: chk.creator, curve: ch.cvA, sharingConfig: noSplit ? null : ch.scA, vault: quote ? C.ata(C.creatorVaultPda(noSplit ? chk.creator : ch.scA), quote.mint, quote.program) : C.creatorVaultPda(noSplit ? chk.creator : ch.scA), sig, hour, ...(noSplit ? { noSplit: true } : {}),
      ...(quote ? { quote: { id: quote.id, mint: quote.mint, program: quote.program, decimals: quote.decimals } } : {}),
      name: m.name, symbol: m.symbol, uri: m.uri, image: j.image || "", description: j.description || "",
      twitter: j.twitter || "", telegram: j.telegram || "", website: j.website || "", launchedAt: Math.floor(t / 1000),
    };
    const put = await store.put(`coins/${mint}.json`, item, { create: true }).catch(() => ({ conflict: true }));
    if (put && put.conflict) return { status: 200, body: { ok: true, mint, already: true } };
    mem.view = null;
    return { status: 200, body: { ok: true, mint, kind, hour } };
  }

  // ---------------- the city's coins, live
  const mem = { view: null };
  async function list() {
    if (mem.view && now() - mem.view.at < 30e3) return mem.view;
    // one index document instead of a read per coin; rebuilt whenever the coins' count says it's behind
    const keys = await store.list("coins/");
    let idx = await store.get("index.json").catch(() => null), items;
    if (idx && Array.isArray(idx.items) && idx.items.length === keys.length) items = idx.items;
    else {
      items = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).sort((a, b) => a.launchedAt - b.launchedAt);
      await store.put("index.json", { at: now(), items }, {}).catch(() => {});
    }
    const grades = (await store.get("grades.json").catch(() => null)) || {};
    items = items.map((x) => (grades[x.mint] && grades[x.mint].v === 2 ? { ...x, grade: grades[x.mint].g, score: grades[x.mint].s } : x));
    const rows = await withPrices(items).catch(() => items);
    mem.view = { at: now(), items: rows, cfg: publicCfg() };
    return mem.view;
  }
  async function withPrices(items) {
    if (!items.length) return [];
    const sol = await C.solUsd();
    const acc = await C.accounts(items.flatMap((x) => [x.curve, x.vault]));
    const qm = [...new Set(items.filter((x) => x.quote).map((x) => x.quote.mint))], qd = qm.length ? await C.dexPrices(qm).catch(() => ({})) : {};
    const grads = [];
    const rows = items.map((x, j) => {
      const [cv, va] = acc.slice(2 * j, 2 * j + 2);
      const curve = cv && cv.owner === C.PROGRAM.pump ? C.decodeCurve(cv.data) : null;
      let priceSol = null, progress = null, graduated = false, supply = 1e9;
      if (curve) {
        graduated = curve.complete; supply = Number(curve.tokenTotalSupply) / 1e6 || 1e9;
        if (!curve.complete && curve.virtualTokenReserves > 0n) priceSol = (Number(curve.virtualQuoteReserves) / 10 ** (x.quote ? x.quote.decimals : 9)) / (Number(curve.virtualTokenReserves) / 1e6);
        progress = curve.complete ? 100 : Math.max(0, Math.min(100, (Number(C.INITIAL_REAL_TOKENS - curve.realTokenReserves) / Number(C.INITIAL_REAL_TOKENS)) * 100));
      }
      if (graduated) grads.push(x.mint);
      // a token pair: its price in the token × the token's dollar price; its fees wait as that token
      const qUsd = x.quote ? (qd[x.quote.mint] && qd[x.quote.mint].priceUsd) || null : sol;
      const priceUsd = priceSol != null && qUsd ? priceSol * qUsd : null;
      const fees = x.quote ? { feesWaitingSol: 0, feesWaiting: va ? Number(C.tokenAmount(va.data)) / 10 ** x.quote.decimals : 0, feesUnit: x.quote.id, quoteUsd: qUsd }
        : { feesWaitingSol: va ? Number(va.lamports > C.RENT_EMPTY ? va.lamports - C.RENT_EMPTY : 0n) / 1e9 : 0 };
      return { ...x, graduated, progress: progress != null ? Math.round(progress * 10) / 10 : null, priceUsd, mcapUsd: priceUsd != null ? priceUsd * supply : null, ...fees };
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
  /// what the chain says about a coin, then the same registration a launch does (lists it if it passes) — for a
  /// launch whose page closed before it registered, and to see why one didn't
  async function check(mint) {
    mint = String(mint || "").trim();
    if (!C.isPubkey(mint)) return { status: 400, body: { error: "not a Solana address" } };
    const ch = await C.chainOf(mint);
    const chain = { curve: !!ch.curve, curveCreator: ch.curve ? ch.curve.creator : null, graduated: ch.curve ? ch.curve.complete : null, sharingConfig: ch.scA,
      sharing: ch.sharing ? { status: ch.sharing.status, locked: ch.sharing.adminRevoked, admin: ch.sharing.admin, holders: ch.sharing.shareholders } : null };
    const r = await register({ mint });
    return { status: 200, body: { mint, listed: r.status === 200, result: r.body, chain } };
  }
  return { slot, register, addDrop, list, meta, logo, check, store };
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
