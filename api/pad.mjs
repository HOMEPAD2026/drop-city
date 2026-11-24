// api/pad.mjs — the launchpad's one function.
//   GET  ?cfg           the public config (name, ticker, suffix, split, wallets, open)
//   GET  ?list          every coin launched here, live (price, market cap, curve %)
//   GET  ?slot          this hour's drop: dropped / dropping / waiting, and when the next hour opens
//   GET  ?tick          wakes the agent: drops this hour's coin if it hasn't yet (safe to call any number of times)
//   GET  ?check=<mint>  what the chain says about a coin; lists it if it passes (a launch whose page closed early)
//   GET  ?agent         the agent: its wallet, this hour, today's drops and transfers to THE VAULT
//   POST ?solrpc        the browser's Solana RPC relay (only the calls a launch makes)
//   GET  ?street        the streets: players here now + the week's street board
//   POST {action}       register · meta · logo · here (a player's beat in the streets) · score (the street board)
import { makePad, publicCfg, cfg, quotesOf } from "../lib/_pad.mjs";
import { proxy } from "../lib/_chain.mjs";
import { blobStore, blobEnabled } from "../lib/_blob.mjs";
import { makeAgent } from "../lib/_agent.mjs";
import { makeLp } from "../lib/_lp.mjs";
import { makeExtra } from "../lib/_extra.mjs";
import { makeTg } from "../lib/_tg.mjs";
import { makeStreet, holderOf, makeVault } from "../lib/_street.mjs";
import { makeDiag } from "../lib/_diag.mjs";
import * as C from "../lib/_chain.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const json = (status, body, cache = "no-store") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "access-control-allow-origin": "*" } });
let PAD = null;
const pad = () => (PAD = PAD || makePad({ store: blobStore() }));
let AG = null;
let EX = null;
const extra = () => (EX = EX || makeExtra({ pad: pad() }));
let LPX = null; const lp = () => (LPX = LPX || makeLp({ store: pad().store, pad: pad() }));
const agent = () => (AG = AG || makeAgent({ pad: pad(), extra: extra(), tg: makeTg({ pad: pad(), extra: extra() }) }));
let ST = null;
const street = () => (ST = ST || makeStreet({ store: blobEnabled() ? blobStore() : null }));
let VT = null;
const vault = () => (VT = VT || makeVault({ store: blobStore() }));
let DG = null;
const diag = () => (DG = DG || makeDiag({ store: blobStore() }));
let HTML = null;
const html = (status, body) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300" } });
const hits = new Map();
function limited(key, n, ms) { const t = Date.now(), a = (hits.get(key) || []).filter((x) => t - x < ms); a.push(t); hits.set(key, a); if (hits.size > 5000) hits.clear(); return a.length > n; }
const ipOf = (req) => String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";

async function simSplit(mint, ch) {
  const K = await import("../lib/_agentkit.mjs"), c = cfg();
  const conn = new K.Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const creator = new K.PublicKey(ch.sharing ? ch.sharing.admin : ch.curveCreator), m = new K.PublicKey(mint);
  let sc = null; if (ch.sharing) { const a = await conn.getAccountInfo(K.feeSharingConfigPda(m)); sc = a ? K.PUMP_SDK.decodeSharingConfig(a) : null; }
  const shares = [{ address: creator, shareBps: c.split.creator }, { address: new K.PublicKey(c.vault), shareBps: c.split.vault }, { address: new K.PublicKey(c.buyer), shareBps: c.split.buyer }];
  const bh = await conn.getLatestBlockhash("confirmed");
  const tx = await K.splitTx({ creator, mint: m, treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, sharingConfig: sc });
  const sw = await K.sweepTx(conn, creator, bh.blockhash).catch(() => null);
  if (sw) { const both = new tx.constructor(); both.feePayer = creator; both.recentBlockhash = bh.blockhash; both.add(...sw.instructions.slice(2), ...tx.instructions); try { return { as: creator.toBase58(), withSweep: sw.instructions.length - 2, ...(await K.simulate(conn, both)) }; } catch (e) { /* too big for one: the split alone */ } }
  return { as: creator.toBase58(), withSweep: 0, ...(await K.simulate(conn, tx)) };
}
/// the quote mints pump.fun takes for a new coin (besides SOL): Global's whitelist and the QuoteControl list, with names
let QUOTES = null;
async function quotes() {
  if (QUOTES && Date.now() - QUOTES.at < 600e3) return QUOTES.v;
  const K = await import("../lib/_agentkit.mjs"), conn = new K.Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed"), sdk = new K.OnlinePumpSdk(conn);
  const g = await sdk.fetchGlobal(), qc = await Promise.race([sdk.fetchQuoteControl().catch(() => null), new Promise((r) => setTimeout(() => r(null), 15e3))]);
  const list = [...(g.whitelistedQuoteMints || []).map((m) => ({ mint: String(m), via: "global" })), ...((qc && qc.mints) || []).map((m) => ({ mint: String(m.mint), via: "control", vqr: String(m.initialVirtualQuoteReserves) }))].filter((x) => x.mint !== "11111111111111111111111111111111");
  const named = async () => { for (let i = 0; i < list.length; i += 100) { const part = list.slice(i, i + 100), r = await conn.getMultipleParsedAccounts(part.map((x) => new K.PublicKey(x.mint)));
    r.value.forEach((a, j) => { const x = part[j], d = a && a.data && a.data.parsed && a.data.parsed.info; if (!a) return; x.program = String(a.owner); if (d) { x.decimals = d.decimals; const md = (d.extensions || []).find((e) => e.extension === "tokenMetadata"); if (md) { x.name = md.state.name; x.symbol = md.state.symbol; } } }); } };
  await Promise.race([named().catch(() => {}), new Promise((r) => setTimeout(r, 15e3))]);
  const v = { at: Date.now(), list, createV2: g.createV2Enabled ?? null };
  QUOTES = { at: Date.now(), v }; return v;
}
/// a token-pair launch, simulated (no signatures, nothing sent) with the agent's wallet as the creator: create + the
/// locked split in one v0 transaction through the city's lookup table, and the first buy alone when dev= is given
async function simQuote(id, dev) {
  const c = cfg(), qt = quotesOf(c).find((x) => x.id === String(id || "").toUpperCase());
  if (!qt) return { error: "unknown pair" };
  if (!c.agent) return { error: "no agent wallet to simulate with" };
  const K = await import("../lib/_agentkit.mjs"), conn = new K.Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed"), sdk = new K.OnlinePumpSdk(conn);
  const [global, feeConfig, quoteControl] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null), sdk.fetchQuoteControl().catch(() => null)]);
  const creator = new K.PublicKey(c.agent), mint = K.Keypair.generate().publicKey, quote = { mint: qt.mint, program: qt.program };
  const shares = [{ address: creator, shareBps: c.split.creator }, { address: new K.PublicKey(c.vault), shareBps: c.split.vault }, { address: new K.PublicKey(c.buyer), shareBps: c.split.buyer }];
  const bh = await conn.getLatestBlockhash("confirmed"), o = { global, feeConfig, creator, mint, name: "Simulated Pair Coin Long Name 32", symbol: "SIMPAIRCOI", uri: "https://tpt4oh98wh6pordk.public.blob.vercel-storage.com/meta/f794454d11ab95a483d07728.json", devBuyLamports: 0, treasury: new K.PublicKey(c.vault), shares, quote, quoteControl, blockhash: bh.blockhash };
  let lut = null; if (blobEnabled()) try { const d = await pad().store.get("agent/lut.json"); if (d && d.address) lut = await K.lutOf(conn, d.address); } catch {}
  const out = { pair: qt.id, creator: c.agent, lut: lut ? lut.state.addresses.length : null, lutHas: lut ? [qt.mint, String(K.QUOTE_CONTROL_PDA)].map((a) => lut.state.addresses.some((x) => String(x) === a)) : null };
  try {
    if (lut) { const v = await K.launchV0({ lut, ...o }); out.v0 = { size: v.size }; const r = await conn.simulateTransaction(v.txs[0], { sigVerify: false, replaceRecentBlockhash: true }); out.v0.err = r.value.err; out.v0.logs = (r.value.logs || []).slice(-14); out.v0.units = r.value.unitsConsumed; }
    else { const r = await K.launchTxs(o); out.legacy = { txs: r.txs.length }; const s = await K.simulate(conn, r.txs[0]); out.legacy.err = s.err; out.legacy.logs = s.logs.slice(-14); }
  } catch (e) { out.buildError = String((e && e.message) || e).slice(0, 200); }
  if (dev) try { const b = await K.buyTx({ ...o, amount: Math.round(Number(dev) * 10 ** qt.decimals), slipBps: 300 }); out.buyTokens = String(b.tokens); out.buySize = b.tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length; } catch (e) { out.buyError = String((e && e.message) || e).slice(0, 200); }
  return out;
}
/// a crew launch (SOL pair), simulated with the agent's wallet as the launcher and n−1 made-up crew wallets: the v0 size
/// through the lookup table and its result, and how many transactions the plain route needs (nothing signed or sent)
async function simCrew(n, as) {
  const c = cfg(); if (!c.agent && !as) return { error: "no agent wallet to simulate with" };
  const { crewBps } = await import("../lib/_pad.mjs");
  const K = await import("../lib/_agentkit.mjs"), conn = new K.Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed"), sdk = new K.OnlinePumpSdk(conn);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null)]);
  const creator = new K.PublicKey(as || c.agent), mint = K.Keypair.generate().publicKey, bps = crewBps(n, c.split.creator);
  const shares = [{ address: creator, shareBps: bps[0] }, ...bps.slice(1).map((b) => ({ address: K.Keypair.generate().publicKey, shareBps: b })), { address: new K.PublicKey(c.vault), shareBps: c.split.vault }, { address: new K.PublicKey(c.buyer), shareBps: c.split.buyer }];
  const bh = await conn.getLatestBlockhash("confirmed"), o = { global, feeConfig, creator, mint, name: "Simulated Crew Coin Long Name 32", symbol: "SIMCREWCOIN", uri: "https://tpt4oh98wh6pordk.public.blob.vercel-storage.com/meta/f794454d11ab95a483d07728.json", devBuyLamports: 0, treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, slipBps: 300 };
  const out = { crew: n, bps };
  let lut = null; if (blobEnabled()) try { const d = await pad().store.get("agent/lut.json"); if (d && d.address) lut = await K.lutOf(conn, d.address); } catch {}
  try { if (lut) { const v = await K.launchV0({ lut, ...o }); out.v0 = { size: v.size, txs: v.txs.length }; const r = await conn.simulateTransaction(v.txs[0], { sigVerify: false, replaceRecentBlockhash: true }); out.v0.err = r.value.err; out.v0.logs = (r.value.logs || []).slice(-8); } } catch (e) { out.v0Error = String((e && e.message) || e).slice(0, 200); }
  try { const b = await K.launchTxs(o); out.legacy = { txs: b.txs.length, sizes: b.txs.map((t) => t.serialize({ requireAllSignatures: false, verifySignatures: false }).length) }; const s1 = await K.simulate(conn, b.txs[0]); out.legacy.err = s1.err; } catch (e) { out.legacyError = String((e && e.message) || e).slice(0, 200); }
  return out;
}
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (q.has("cfg")) { let lut = null; if (blobEnabled()) try { const d = await pad().store.get("agent/lut.json"); lut = d && d.address; } catch {} return json(200, { ...publicCfg(), lut }, "public, max-age=30"); }
  if (q.has("simquote")) { if (limited("sq:" + ipOf(req), 6, 60e3)) return json(429, { error: "slow down" }); try { return json(200, await simQuote(q.get("simquote"), q.get("dev")), "no-store"); } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 300) }); } }
  if (q.has("simcrew")) { if (limited("sc:" + ipOf(req), 6, 60e3)) return json(429, { error: "slow down" }); try { return json(200, await simCrew(Math.max(1, Math.min(4, Number(q.get("simcrew")) || 2)), C.isPubkey(q.get("as") || "") ? q.get("as") : null), "no-store"); } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 300) }); } }
  if (q.has("quotes")) { try { return json(200, await quotes(), "public, max-age=300, s-maxage=600"); } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 200) }); } }
  if (q.has("holder")) { // a wallet's main-coin balance → its street perk (cosmetic)
    const w = String(q.get("holder") || ""), main = cfg().main;
    if (!C.isPubkey(w) || !main) return json(400, { error: main ? "bad wallet" : "no main coin set" });
    if (limited("h:" + ipOf(req), 20, 60e3)) return json(429, { error: "slow down" });
    try { return json(200, await holderOf(C.rpc, w, main), "public, max-age=30"); } catch (e) { return json(502, { error: "couldn't read the balance" }); }
  }
  if (q.has("vault")) { try { const v = await vault().of(String(q.get("vault") || "")); return json(200, { hour: q.get("vault"), by: v ? v.name : null, at: v ? v.at : null }, "public, max-age=3"); } catch (e) { return json(502, { error: "vault unavailable" }); } }
  if (q.has("diag")) { try { return json(200, await diag().view(), "no-store"); } catch (e) { return json(502, { error: "diag unavailable" }); } }
  if (q.has("street")) { try { return json(200, { here: street().count(), ...(blobEnabled() ? await street().board() : { rows: [] }) }, "public, max-age=15, s-maxage=20"); } catch (e) { return json(502, { error: "street board unavailable" }); } }
  if (!blobEnabled()) return json(503, { error: "the store isn't connected yet" });
  try {
    if (q.has("list")) return json(200, await pad().list(), "public, max-age=10, s-maxage=20");
    if (q.has("slot")) return json(200, { ...(await pad().slot()), cfg: publicCfg() }, "no-store");
    if (q.has("agent")) { const [st, tk, pl] = await Promise.all([agent().status(), pad().store.get("beat/tick.json").catch(() => null), pad().store.get("beat/poll.json").catch(() => null)]); return json(200, { ...st, lastTick: tk, lastPoll: pl }, "public, max-age=10"); }
    if (q.has("verify")) { if (limited("v:" + ipOf(req), 30, 60e3)) return json(429, { error: "slow down" }); const r = await extra().verify(q.get("verify")); return json(r.status, r.body, "public, max-age=15"); }
    if (q.has("coin")) { if (limited("c:" + ipOf(req), 30, 60e3)) return json(429, { error: "slow down" }); const r = await extra().detail(q.get("coin")); return json(r.status, r.body, "public, max-age=30"); }
    if (q.has("trades")) return json(200, await extra().trades(), "public, max-age=6, s-maxage=8");
    if (q.has("vote")) return json(200, await extra().voteView(q.get("wallet") || ""), "no-store");
    if (q.has("page")) {
      HTML = HTML || readFileSync(join(process.cwd(), "index.html"), "utf8");
      const m = String(q.get("page") || ""), coin = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m) ? await pad().store.get(`coins/${m}.json`).catch(() => null) : null;
      const u = new URL(req.url); return html(200, extra().page(HTML, coin, `${u.protocol}//${req.headers.get("host") || u.host}`));
    }
    if (q.has("check")) {
      if (limited("check:" + ipOf(req), 20, 60e3)) return json(429, { error: "slow down" });
      const r = await pad().check(q.get("check"));
      // not locked yet: simulate the split its creator would sign, so the reason shows (nothing is sent)
      const ch = r.body && r.body.chain;
      if (ch && ch.curve && !(ch.sharing && ch.sharing.locked)) r.body.splitSim = await simSplit(r.body.mint, ch).catch((e) => ({ error: String((e && e.message) || e).slice(0, 300) }));
      return json(r.status, r.body, "no-store");
    }
    if (q.has("lp")) { // LP rewards: ?lp=1&w=<wallet> the view · ?lp=tick the hour's snapshot · ?lp=due what is owed
      const m = q.get("lp");
      if (m === "tick") { if (limited("lpt:" + ipOf(req), 6, 60e3)) return json(429, { error: "slow down" }); return json(200, await lp().tick(), "no-store"); }
      if (m === "due") return json(200, { due: await lp().due() }, "no-store");
      return json(200, await lp().view(String(q.get("w") || "")), "public, max-age=20");
    }
    if (q.has("tick")) {
      await pad().store.put("beat/tick.json", { at: Date.now(), ua: String(req.headers.get("user-agent") || "").slice(0, 60) }, {}).catch(() => {});
      if (limited("tick:" + ipOf(req), 6, 60e3)) return json(429, { error: "slow down" });
      return json(200, await agent().tick(), "no-store");
    }
  } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); }
  return json(400, { error: "use ?cfg, ?list, ?slot, ?agent, ?tick, ?lp, ?check, ?verify, ?coin, ?trades, ?vote or ?page" });
}
export async function POST(req) {
  const ip = ipOf(req);
  if (new URL(req.url).searchParams.has("solrpc")) {
    if (limited("rpc:" + ip, 240, 60e3)) return json(429, { jsonrpc: "2.0", id: null, error: { code: 429, message: "slow down" } });
    let q; try { q = await req.json(); } catch { return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "bad JSON" } }); }
    return json(200, await proxy(q));
  }
  let b; try { b = (await req.json()) || {}; } catch { return json(400, { error: "bad JSON" }); }
  // the streets: a player's beat (positions, punches) and the week's street board — toys, nothing on chain
  if (b.action === "here") { if (limited("here:" + ip, 150, 60e3)) return json(429, { error: "slow down" }); const r = await street().beat(b); return json(r.status, r.body); }
  if (!blobEnabled()) return json(503, { error: "the store isn't connected yet" });
  if (b.action === "diag") { if (limited("diag:" + ip, 6, 60e3)) return json(429, { error: "slow down" }); const r = await diag().report(b, req.headers.get("user-agent") || ""); return json(r.status, r.body); }
  if (b.action === "vault") { if (limited("vault:" + ip, 12, 60e3)) return json(429, { error: "slow down" }); const r = await vault().open(b); return json(r.status, r.body); }
  if (b.action === "lp-paid") { if (limited("lpp:" + ip, 10, 60e3)) return json(429, { error: "slow down" }); try { const r = await lp().paid(b); return json(r.status, r.body); } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); } }
  if (b.action === "score") { if (limited("score:" + ip, 10, 60e3)) return json(429, { error: "slow down" }); const r = await street().score(b); return json(r.status, r.body); }
  const lim = { register: 30, meta: 20, logo: 20, vote: 10 }[b.action];
  if (!lim) return json(400, { error: "unknown action" });
  if (limited(b.action + ":" + ip, lim, 60e3)) return json(429, { error: "slow down" });
  try { const r = b.action === "vote" ? await extra().vote(b) : await pad()[b.action](b); return json(r.status, r.body); }
  catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); }
}
