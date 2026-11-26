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
  c.drops = env("PAD_DROPS") ? env("PAD_DROPS") === "1" : !!PAD.drops;
  return c;
}
/// the agent's address from its secret (base58 64-byte key as Phantom exports it, or a JSON byte array) — "" if unset / bad
export function agentPub(secret) {
  const s = String(secret || "").trim(); if (!s) return "";
  try { const b = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : C.b58dec(s); if (b.length !== 64) return ""; const pub = C.b58enc(ed25519.getPublicKey(b.slice(0, 32))); return pub === C.b58enc(b.slice(32)) ? pub : ""; } catch { return ""; }
}
/// the public view of the config (what the page needs)
export const quotesOf = (c = cfg()) => (c.quotes || []).filter((q) => C.isPubkey(q.mint) && C.isPubkey(q.program));
export const publicCfg = () => { const c = cfg(); return { quotes: quotesOf(c), name: c.name, ticker: c.ticker, suffix: c.suffixError ? "" : c.suffix, vault: c.vault || null, buyer: c.buyer || null, split: c.split, dropsPerDay: c.dropsPerDay, drops: c.drops, open: c.open, agent: c.agent || null, main: c.main || null, links: { x: env("PAD_X_URL") || (c.links && c.links.x) || "", tg: env("PAD_TG_URL") || (c.links && c.links.tg) || "" }, why: c.open ? null : c.suffixError || "the city vault wallet isn't set yet" }; };

export const hourOf = (ms) => new Date(ms).toISOString().slice(0, 13); // "2026-11-18T05"
export const nextHourMs = (ms) => Math.floor(ms / 3600e3) * 3600e3 + 3600e3;

/// is this sharing config the launchpad's split? → { ok, creator, why }
/// a crew launch: the creator's share split between 1–CREW_MAX wallets — equal parts, the launcher (first) keeps the odd bps
export const CREW_MAX = 4;
export const crewBps = (n, total) => { n = Math.max(1, Math.min(CREW_MAX, n | 0)); const each = Math.floor(total / n); return Array.from({ length: n }, (_, i) => (i === 0 ? total - each * (n - 1) : each)); };
export function splitCheck(sc, mint, c = cfg()) {
  if (!sc) return { ok: false, why: "this coin has no fee-sharing config" };
  if (sc.mint !== mint) return { ok: false, why: "the fee-sharing config is for another coin" };
  if (sc.status !== "active") return { ok: false, why: "the fee-sharing config is paused" };
  if (!sc.adminRevoked) return { ok: false, why: "the fee split isn't locked yet" };
  const v = sc.shareholders.find((s) => s.address === c.vault), b = sc.shareholders.find((s) => s.address === c.buyer);
  const ks = sc.shareholders.filter((s) => s.address !== c.vault && s.address !== c.buyer);
  const bad = { ok: false, why: `the fee split isn't ${c.split.creator / 100} / ${c.split.vault / 100} / ${c.split.buyer / 100}` };
  if (!v || !b || v.shareBps !== c.split.vault || b.shareBps !== c.split.buyer || !ks.length || ks.length > CREW_MAX || sc.shareholders.length !== ks.length + 2) return bad;
  // the creator's share: one wallet, or a crew that splits it in equal parts (crewBps)
  const want = crewBps(ks.length, c.split.creator).slice().sort((x, y) => x - y).join(), got = ks.map((k) => k.shareBps).sort((x, y) => x - y).join();
  if (want !== got) return bad;
  const lead = ks.find((k) => k.address === sc.admin) || ks.slice().sort((x, y) => y.shareBps - x.shareBps)[0];
  return ks.length > 1 ? { ok: true, creator: lead.address, crew: ks.map((k) => ({ address: k.address, bps: k.shareBps })) } : { ok: true, creator: lead.address };
}

export function makePad({ store, now = () => Date.now() }) {
  const C2 = () => cfg();
  // ---------------- the hour's drop (the agent's run log: agent/run/<hour>/NN.json, see lib/_agent.mjs)
  /// { hour, next, state: "dropped" | "dropping" | "failed" | "waiting" | "off", drop: { mint, symbol } | null }
  async function slot(t = now()) {
    const c = C2(), hour = hourOf(t);
    if (!c.drops) return { hour, state: "off", off: true, next: (Math.floor(t / 3600e3) + 1) * 3600e3, tries: 0 }; // hourly drops are off
    const keys = (await store.list(`agent/run/${hour}/`)).sort();
    const runs = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean);
    const done = runs.find((r) => r.state === "launched"), last = runs[runs.length - 1];
    // the agent's health (lib/_agent.mjs health): paused while its wallet can't pay for a drop — said as it is
    if (!mem.health || t - mem.health.at > 30e3) mem.health = { at: t, v: (await store.get("agent/state.json").catch(() => null)) || {} };
    const paused = !done && mem.health.v.paused && t - (mem.health.v.at || 0) < 2 * 3600e3;
    const state = done ? "dropped" : !c.agent || !c.open ? "off" : paused ? "paused" : last && last.state === "running" && t - last.at < 5 * 60e3 ? "dropping" : last && last.state === "failed" ? "failed" : "waiting";
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
      mint, kind, creator: chk.creator, ...(chk.crew ? { crew: chk.crew } : {}), curve: ch.cvA, sharingConfig: noSplit ? null : ch.scA, vault: quote ? C.ata(C.creatorVaultPda(noSplit ? chk.creator : ch.scA), quote.mint, quote.program) : C.creatorVaultPda(noSplit ? chk.creator : ch.scA), sig, hour, ...(noSplit ? { noSplit: true } : {}),
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
    // Clean Launch: block 0 read from the chain (lib/_clean.mjs) — true / false, absent while unread
    const clean = (await store.get("clean.json").catch(() => null)) || {};
    items = items.map((x) => (clean[x.mint] ? { ...x, clean: clean[x.mint].clean } : x));
    // the creator's own page (lib/_creator.mjs): links they set win, plus their note and the big link-card picture
    const own = (await store.get("creator.json").catch(() => null)) || {};
    items = items.map((x) => { const o = own[x.mint]; if (!o || x.kind === "partner") return x; return { ...x, twitter: o.twitter || x.twitter, telegram: o.telegram || x.telegram, website: o.website || x.website, note: o.note || "", poster: o.poster || "", byCreator: true }; });
    // a tower the police raided: its creator sold in the last day (lib/_extra.mjs trades)
    const raids = (await store.get("raids.json").catch(() => null)) || {};
    items = items.map((x) => (raids[x.mint] && now() - raids[x.mint].at < 24 * 3600e3 ? { ...x, raid: raids[x.mint] } : x));
    items = items.concat(await supported().catch(() => []));
    const rows = (await withPrices(items).catch(() => items)).map((x) => (x.kind === "partner" ? { ...x, feesWaitingSol: 0 } : x));
    mem.view = { at: now(), items: rows, cfg: publicCfg() };
    return mem.view;
  }
  /// does a picture URL still answer? (a dead one shows as a blank box in the LP tab; the page draws the ticker instead)
  async function imgAlive(u) {
    if (!/^https:\/\//.test(String(u || ""))) return false;
    if (C.CFG.imgAlive) return C.CFG.imgAlive(u);
    try { const r = await fetch(u, { method: "GET", headers: { range: "bytes=0-0" }, signal: AbortSignal.timeout(4000) }); return r.ok || r.status === 206; } catch { return false; }
  }
  /// the coins the city supports (pad-config.js supported): their name, logo and links read once a day; priced with the rest
  async function supported() {
    const L = (PAD.supported || []).filter((x) => x && C.isPubkey(x.mint));
    if (!L.length) return [];
    if (mem.sup && now() - mem.sup.at < 24 * 3600e3 && mem.sup.items.length === L.length) return mem.sup.items;
    const kept = (await store.get("sup/logos.json").catch(() => null)) || {};
    let keptDirty = false;
    const items = (await Promise.all(L.map(async (cfgRow) => {
      const row = await supRow(cfgRow);
      if (!row) return null;
      // the owner's own name / ticker for it (pad-config.js supported[].name / .symbol), over what the chain carries
      if (cfgRow.name) row.name = String(cfgRow.name);
      if (cfgRow.symbol) row.symbol = String(cfgRow.symbol);
      // its logo copied into our own store once, so a host that drops it later can't blank it (2026-11-26)
      if (row.image) {
        const k = kept[row.mint];
        if (k && k.src === row.image) row.image = k.url;
        else { const url = await keepLogo(row.image).catch(() => null); if (url) { kept[row.mint] = { src: row.image, url }; keptDirty = true; row.image = url; } }
      } else if (kept[row.mint]) row.image = kept[row.mint].url;
      return row;
    }))).filter(Boolean);
    if (keptDirty) await store.put("sup/logos.json", kept, {}).catch(() => {});
    mem.sup = { at: now(), items };
    return items;
  }
  /// a picture from another host, copied into our store (≤ 3 MB, an image by its bytes); its public URL
  async function keepLogo(src) {
    if (!/^https:\/\//.test(String(src || ""))) return null;
    if (C.CFG.keepLogo) return C.CFG.keepLogo(src);
    const r = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length || bytes.length > 3_000_000) return null;
    const kind = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpeg" : bytes[0] === 0x47 && bytes[1] === 0x49 ? "gif" : bytes[8] === 0x57 && bytes[9] === 0x45 ? "webp" : null;
    if (!kind) return null;
    const id = hex(sha256(bytes)), ext = kind === "jpeg" ? "jpg" : kind;
    const p = await store.put(`logos/${id}.${ext}`, bytes, { create: true, public: true, type: "image/" + kind }).catch((e) => (e && e.exists ? null : Promise.reject(e)));
    return (p && p.url) || (await store.url(`logos/${id}.${ext}`));
  }
  async function supRow({ mint, note }) {
    {
      const cvA = C.bondingCurvePda(mint), base = { mint, kind: "partner", note: String(note || ""), creator: null, curve: cvA, vault: cvA, launchedAt: 0 };
      try {
        const m = await C.mintMeta(mint), j = await C.metaJson(m.uri).catch(() => ({}));
        const row = { ...base, name: m.name, symbol: m.symbol, uri: m.uri, image: j.image || "", description: j.description || "", twitter: j.twitter || "", telegram: j.telegram || "", website: j.website || "" };
        // Dexscreener's logo first (its CDN stays up; metadata hosts like j7tracker / ipfs.io often don't answer a server, and
        // a coin's own picture can vanish — Mandy's went 404 on 2026-11-26); then the metadata's picture only if it still loads
        const d = await C.dexInfo(mint).catch(() => null);
        if (d) { for (const k of ["twitter", "telegram", "website"]) if (!row[k] && d[k]) row[k] = d[k]; }
        row.image = (d && d.image) || ((await imgAlive(row.image)) ? row.image : "");
        return row;
      } catch { /* no Metaplex metadata (a Token-2022 coin, or not a pump.fun one): Dexscreener's card */ }
      try { const d = await C.dexInfo(mint); if (d && d.symbol) return { ...base, name: d.name || d.symbol, symbol: d.symbol, uri: "", image: d.image || "", description: "", twitter: d.twitter || "", telegram: d.telegram || "", website: d.website || "" }; } catch {}
      return null;
    }
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
      if (graduated || (x.kind === "partner" && !curve)) grads.push(x.mint);
      // a token pair: its price in the token × the token's dollar price; its fees wait as that token
      const qUsd = x.quote ? (qd[x.quote.mint] && qd[x.quote.mint].priceUsd) || null : sol;
      const priceUsd = priceSol != null && qUsd ? priceSol * qUsd : null;
      const fees = x.quote ? { feesWaitingSol: 0, feesWaiting: va ? Number(C.tokenAmount(va.data)) / 10 ** x.quote.decimals : 0, feesUnit: x.quote.id, quoteUsd: qUsd }
        : { feesWaitingSol: va ? Number(va.lamports > C.RENT_EMPTY ? va.lamports - C.RENT_EMPTY : 0n) / 1e9 : 0 };
      return { ...x, graduated, progress: progress != null ? Math.round(progress * 10) / 10 : null, priceUsd, mcapUsd: priceUsd != null ? priceUsd * supply : null, ...fees };
    });
    if (grads.length) { const d = await C.dexPrices(grads).catch(() => ({})); for (const r of rows) if ((r.graduated || (r.kind === "partner" && r.progress == null)) && d[r.mint]) { r.priceUsd = d[r.mint].priceUsd; r.mcapUsd = d[r.mint].mcapUsd; } }
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
  return { slot, register, addDrop, list, meta, logo, check, store, setHealth: (v) => { mem.health = { at: now(), v }; } };
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
