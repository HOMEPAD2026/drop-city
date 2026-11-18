// lib/_chain.mjs — the Solana side the server needs: base58, program addresses, pump.fun's curve and fee-sharing
// accounts, a JSON-RPC client with failover, prices, and the browser's RPC relay (only the calls a launch makes).
import { sha256 } from "@noble/hashes/sha2.js";
import { ed25519 } from "@noble/curves/ed25519.js";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
export const CFG = {
  rpcs: () => [env("SOLANA_RPC_URL"), "https://api.mainnet-beta.solana.com"].filter(Boolean),
  rpc: null, // tests: (method, params) => result
  solUsd: null, dex: null, metaFetch: null,
};
export const PROGRAM = {
  pump: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  fees: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
};
export const INITIAL_REAL_TOKENS = 793_100_000_000_000n;
export const RENT_EMPTY = 890_880n;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58enc(bytes) {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ""; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
}
export function b58dec(s) {
  s = String(s || "");
  let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error("not base58"); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c !== "1") break; out.unshift(0); }
  return Uint8Array.from(out);
}
export const isPubkey = (s) => { try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || "")) && b58dec(s).length === 32; } catch { return false; } };
const onCurve = (b) => { try { ed25519.Point.fromBytes(b); return true; } catch { return false; } };
const te = new TextEncoder();
/// findProgramAddress: the first bump (255 down) whose hash is off the ed25519 curve
export function pda(seeds, program) {
  const prog = b58dec(program), tail = te.encode("ProgramDerivedAddress");
  const parts = seeds.map((x) => (typeof x === "string" ? te.encode(x) : x));
  for (let bump = 255; bump >= 0; bump--) {
    const all = [...parts, Uint8Array.of(bump), prog, tail];
    const buf = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of all) { buf.set(p, o); o += p.length; }
    const h = sha256(buf);
    if (!onCurve(h)) return b58enc(h);
  }
  throw new Error("no program address");
}
export const sharingConfigPda = (mint) => pda(["sharing-config", b58dec(mint)], PROGRAM.fees);
export const bondingCurvePda = (mint) => pda(["bonding-curve", b58dec(mint)], PROGRAM.pump);
export const creatorVaultPda = (creator) => pda(["creator-vault", b58dec(creator)], PROGRAM.pump);

// ---------------- account layouts (pump-public-docs idl/pump.json, idl/pump_fees.json) ----------------
const DISC = { curve: [23, 183, 248, 55, 96, 216, 172, 96], sharing: [216, 74, 9, 0, 56, 140, 93, 75] };
const disc = (b, d) => b.length >= 8 && d.every((x, i) => b[i] === x);
const u64 = (b, o) => { let n = 0n; for (let i = 7; i >= 0; i--) n = n * 256n + BigInt(b[o + i]); return n; };
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 2 ** 24;
const key = (b, o) => b58enc(b.subarray(o, o + 32));
export function decodeCurve(b) {
  if (!b || !disc(b, DISC.curve) || b.length < 81) return null;
  return {
    virtualTokenReserves: u64(b, 8), virtualQuoteReserves: u64(b, 16), realTokenReserves: u64(b, 24), realQuoteReserves: u64(b, 32),
    tokenTotalSupply: u64(b, 40), complete: b[48] === 1, creator: key(b, 49),
    quoteMint: b.length >= 115 ? key(b, 83) : "11111111111111111111111111111111",
  };
}
export function decodeSharing(b) {
  if (!b || !disc(b, DISC.sharing) || b.length < 8 + 3 + 64 + 1 + 4) return null;
  let o = 8;
  const bump = b[o++], version = b[o++], status = b[o++] === 1 ? "active" : "paused";
  const mint = key(b, o); o += 32;
  const admin = key(b, o); o += 32;
  const adminRevoked = b[o++] === 1;
  const n = u32(b, o); o += 4;
  if (n > 10 || b.length < o + n * 34) return null;
  const shareholders = [];
  for (let i = 0; i < n; i++) { shareholders.push({ address: key(b, o), shareBps: u16(b, o + 32) }); o += 34; }
  return { bump, version, status, mint, admin, adminRevoked, shareholders };
}
/// is this sharing config ArcPad's 70 / 30? → { ok, creator, why }

export async function rpc(method, params) {
  if (CFG.rpc) return CFG.rpc(method, params);
  let last = null;
  for (const u of CFG.rpcs()) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(8000) });
      const j = await r.json().catch(() => null);
      if (j && j.error) { last = new Error(String(j.error.message || "rpc error")); continue; }
      if (j && "result" in j) return j.result;
      last = new Error(`rpc ${r.status}`);
    } catch (e) { last = e; }
  }
  throw last || new Error("no Solana RPC");
}
const b64 = (s) => Uint8Array.from(Buffer.from(String(s || ""), "base64"));
/// addresses → [{ owner, lamports, data: Uint8Array } | null]
export async function accounts(addrs) {
  const out = [];
  for (let i = 0; i < addrs.length; i += 100) {
    const r = await rpc("getMultipleAccounts", [addrs.slice(i, i + 100), { encoding: "base64", commitment: "confirmed" }]);
    for (const a of (r && r.value) || []) out.push(a ? { owner: a.owner, lamports: BigInt(a.lamports || 0), data: b64(Array.isArray(a.data) ? a.data[0] : "") } : null);
  }
  return out;
}
/// name / symbol / uri from the Token-2022 mint's metadata extension
export async function mintMeta(mint) {
  const r = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]).catch(() => null);
  const ext = r && r.value && r.value.data && r.value.data.parsed && r.value.data.parsed.info && r.value.data.parsed.info.extensions;
  const md = Array.isArray(ext) ? (ext.find((e) => e && e.extension === "tokenMetadata") || {}).state : null;
  return md ? { name: String(md.name || "").slice(0, 32), symbol: String(md.symbol || "").slice(0, 13), uri: String(md.uri || "").slice(0, 200) } : { name: "", symbol: "", uri: "" };
}
export const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
export const httpsOr = (v) => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || "")) ? String(v).slice(0, 300) : "");
/// the metadata JSON the uri points at (https only, small)
export async function metaJson(uri) {
  if (!/^https:\/\//i.test(uri)) return {};
  try {
    const j = CFG.metaFetch ? await CFG.metaFetch(uri) : await fetch(uri, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return null;
      const t = await r.text();
      return t.length > 20000 ? null : JSON.parse(t);
    });
    if (!j || typeof j !== "object") return {};
    return { image: httpsOr(j.image), description: clean(j.description, 400), twitter: httpsOr(j.twitter), telegram: httpsOr(j.telegram), website: httpsOr(j.website) };
  } catch { return {}; }
}

// ---------------- prices ----------------
const px = { usd: null, at: 0 };
export async function solUsd() {
  if (CFG.solUsd) return CFG.solUsd;
  if (px.usd && Date.now() - px.at < 60e3) return px.usd;
  const get = (u) => fetch(u, { signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const cb = await get("https://api.coinbase.com/v2/prices/SOL-USD/spot");
  let p = cb && cb.data ? Number(cb.data.amount) : null;
  if (!(p > 0)) { const cg = await get("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"); p = cg && cg.solana ? Number(cg.solana.usd) : null; }
  if (p > 0) { px.usd = p; px.at = Date.now(); }
  return px.usd;
}
/// graduated coins trade on PumpSwap: their price from Dexscreener
export async function dexPrices(mints) {
  if (!mints.length) return {};
  if (CFG.dex) return CFG.dex(mints);
  const out = {};
  for (let i = 0; i < mints.length; i += 30) {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.slice(i, i + 30).join(",")}`, { signal: AbortSignal.timeout(5000) }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    for (const p of Array.isArray(r) ? r : []) {
      const m = p && p.baseToken && p.baseToken.address;
      if (!m || (out[m] && (out[m].liq || 0) >= ((p.liquidity && p.liquidity.usd) || 0))) continue;
      out[m] = { priceUsd: Number(p.priceUsd) || null, mcapUsd: Number(p.marketCap || p.fdv) || null, liq: (p.liquidity && p.liquidity.usd) || 0 };
    }
  }
  return out;
}

// ---------------- storage ----------------

/// mint → { curve, sharing } read live
export async function chainOf(mint) {
  const scA = sharingConfigPda(mint), cvA = bondingCurvePda(mint);
  const [sc, cv] = await accounts([scA, cvA]);
  const curve = cv && cv.owner === PROGRAM.pump ? decodeCurve(cv.data) : null;
  const sharing = sc && sc.owner === PROGRAM.fees ? decodeSharing(sc.data) : null;
  return { scA, cvA, curve, sharing };
}



// ---------------- the RPC relay ----------------
// only what arc-pump.js (web3.js Connection + the pump SDK) calls; no account scans
const ALLOW = new Set(["getAccountInfo", "getMultipleAccounts", "getBalance", "getLatestBlockhash", "getSignatureStatuses", "sendTransaction",
  "simulateTransaction", "getMinimumBalanceForRentExemption", "getFeeForMessage", "getSlot", "getBlockHeight", "getRecentPrioritizationFees", "getTokenAccountBalance", "getEpochInfo", "getGenesisHash", "getVersion", "isBlockhashValid"]);
export async function proxy(body) {
  const qs = Array.isArray(body) ? body : [body];
  if (!qs.length || qs.length > 20) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "batch too large" } };
  const bad = qs.find((q) => !q || q.jsonrpc !== "2.0" || !ALLOW.has(q.method));
  if (bad) return { jsonrpc: "2.0", id: bad && bad.id != null ? bad.id : null, error: { code: -32601, message: "not available through this relay" } };
  const clean = qs.map((q) => ({ jsonrpc: "2.0", id: q.id != null ? q.id : null, method: q.method, params: Array.isArray(q.params) ? q.params : [] }));
  const send = Array.isArray(body) ? clean : clean[0];
  if (CFG.rpc) { const one = async (q) => { try { return { jsonrpc: "2.0", id: q.id, result: await CFG.rpc(q.method, q.params) }; } catch (e) { return { jsonrpc: "2.0", id: q.id, error: { code: -32000, message: String(e.message || e) } }; } }; return Array.isArray(body) ? Promise.all(clean.map(one)) : one(clean[0]); }
  // the node's answer as it is (a failed simulation's logs included); the next node only when this one is down or busy
  let last = null;
  for (const u of CFG.rpcs()) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(send), signal: AbortSignal.timeout(12000) });
      if (r.status === 429 || r.status >= 500) { last = `rpc ${r.status}`; continue; }
      const j = await r.json().catch(() => null);
      if (j) return j;
      last = `rpc ${r.status}`;
    } catch (e) { last = String((e && e.message) || e); }
  }
  return { jsonrpc: "2.0", id: Array.isArray(body) ? null : clean[0].id, error: { code: -32000, message: "Solana RPC unreachable: " + String(last || "").slice(0, 120) } };
}
