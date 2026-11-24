// lib/_agent.mjs — the city's agent: one coin at the top of every UTC hour, from its own wallet.
//
//   tick()  — called by the hourly scheduler (.github/workflows/drop.yml) and by visitors' pages when the hour has no
//             drop yet; safe to call any number of times: an hour drops at most once (create-only run records
//             agent/run/<hour>/NN.json, at most MAX_TRIES an hour, one at a time).
//   A drop: an idea (name · ticker · story — Claude when ANTHROPIC_API_KEY is set, else the city's own word lists),
//   a logo (OpenAI's image model when OPENAI_API_KEY is set, else lib/_logo.mjs's badge), a mint key ending in the
//   suffix (from the encrypted pool, else ground here), the same pump.fun launch the page signs with the split
//   [agent 60 % · THE VAULT 30 % · buyer 10 %] locked, then listed with its hour.
//   After the drop (or when there's nothing to drop) the agent tidies up: pays out its coins' waiting creator fees,
//   sends everything over RESERVE_SOL on to THE VAULT, and grinds mint keys for the pool.
//
// Its themes are original: a neon night city — heists, getaways, rooftops, street racers, harbour smugglers, city
// animals. Never another company's game, film or brand: the names it makes are checked against BLOCK and dropped.
import { createCipheriv, createDecipheriv, createHash, randomBytes, webcrypto } from "node:crypto";
import * as C from "./_chain.mjs";
import { cfg, hourOf } from "./_pad.mjs";
import { badge } from "./_logo.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
export const A = {
  MAX_TRIES: 4, // launches an hour may try
  RUN_STALE_MS: 5 * 60e3, // a run that said "running" this long ago is over
  LATE_MIN: 55, // no new drop after :55 — the next hour gets it
  RESERVE_SOL: 0.5, // kept in the agent's wallet for launches; the rest goes to THE VAULT
  FORWARD_MIN_SOL: 0.05, // smaller amounts wait
  PAYOUT_MIN_SOL: 0.02, // a coin's waiting fees are paid out from this much
  NEED_SOL: 0.04, // a launch needs this much (rent + fees)
  LOW_SOL: 0.2, // below this the owner hears about it (TG_OWNER_CHAT), once a day; empty: every ALERT_MS
  ALERT_MS: 3 * 3600e3,
  POOL: 4, // mint keys kept ready
  GRIND_MS: 25e3, // grinding a key in one call at most
};
export const BLOCK = /(g\s*t\s*a\b|grand\s*theft|rockstar|vice\s*city|los\s*santos|liberty\s*city|san\s*andreas|leonida|lucia\s*caminos|jason\s*duval|niko\s*bellic|trevor\s*philips|franklin\s*clinton|tommy\s*vercetti|take[\s-]*two|\b(?:disney|marvel|nintendo|pok[eé]mon|mario|sonic|batman|nike|tesla|trump|elon|musk)\b)/i;

// ---------------- ideas
const ADJ = ["Neon", "Midnight", "Chrome", "Velvet", "Rogue", "Getaway", "Heist", "Turbo", "Rooftop", "Backstreet", "Pink", "Shadow", "Lucky", "Diamond", "Hustle", "Burnout", "Skyline", "Harbor", "Palm", "Sunset", "Nitro", "Gold", "Cash", "Night", "Downtown", "Overpass", "Alley", "Dockside", "Jackpot", "Smoke"];
const NOUN = ["Owl", "Shark", "Cat", "Rat", "Gull", "Croc", "Fox", "Pigeon", "Raccoon", "Flamingo", "Gator", "Bandit", "Driver", "Boss", "Racer", "Crew", "Kingpin", "Ghost", "Joker", "Hound", "Cobra", "Panther", "Moth", "Crab", "Mutt", "Goose", "Weasel", "Frog", "Bull", "Viper"];
const STORY = [
  (n) => `${n} runs the night shift in the city. Nobody saw it come in; everybody saw it leave.`,
  (n) => `Last seen speeding past the harbour lights. ${n} doesn't stop for red.`,
  (n) => `${n} cracked the rooftop vault at 3 a.m. and left a pink calling card.`,
  (n) => `Every crew in the city wants ${n}. ${n} wants the top floor.`,
  (n) => `Born under the overpass, raised on neon. ${n} is coming up.`,
  (n) => `The getaway car is idling. ${n} is already in the driver's seat.`,
];
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
/// the city's own idea for an hour (no model): deterministic per hour, a different pair when the ticker is taken
/// nouns: the subjects to pick from — the logo library's when it has pictures, so the name and its logo match
export function cityIdea(hour, taken = new Set(), nouns = libraryNouns()) {
  const NN = nouns && nouns.length ? nouns : NOUN;
  for (let k = 0; k < 50; k++) {
    const h = hash(hour + ":" + k), a = ADJ[h % ADJ.length], n = NN[(h >>> 8) % NN.length];
    const name = `${a} ${n}`, symbol = (k % 2 ? a.slice(0, 3) + n : n.length <= 4 ? a.slice(0, 1) + n : n).toUpperCase().slice(0, 8);
    if (!taken.has(symbol)) return { name, symbol, description: STORY[(h >>> 16) % STORY.length](name), by: "city" };
  }
  return { name: "Night Drop", symbol: "NDROP" + (hash(hour) % 90 + 10), description: "Another hour, another drop.", by: "city" };
}
/// an idea is usable: the shapes pump.fun takes, nothing borrowed
export function cleanIdea(x, taken = new Set()) {
  if (!x || typeof x !== "object") return null;
  const name = C.clean(x.name, 32), symbol = String(x.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10), description = C.clean(x.description, 280);
  if (name.length < 3 || symbol.length < 2 || !description) return null;
  if (BLOCK.test(name) || BLOCK.test(symbol) || BLOCK.test(description) || taken.has(symbol)) return null;
  return { name, symbol, description };
}
async function modelIdea(hour, recent, taken, fetchImpl) {
  const key = env("ANTHROPIC_API_KEY"); if (!key) return null;
  const prompt = `You name meme coins for a neon night city on Solana. One new coin drops every hour; this is the ${hour.slice(11, 13)}:00 UTC drop.
Invent ONE original coin: a character, crew, vehicle, animal or moment from a neon night city — heists, getaways, rooftop chases, street racers, harbour smugglers, lucky gamblers, city animals with attitude.
Rules: entirely original. Never use the name, places, characters or logos of any existing video game, film, show, company or brand, and never a real person. Keep it fun, not hateful or sexual.
Recent drops (don't repeat them): ${recent.slice(-24).join(", ") || "none"}.
Answer with JSON only: {"name": "2–4 words, ≤ 32 characters", "symbol": "3–8 capital letters or digits", "description": "one or two punchy sentences, ≤ 200 characters", "image": "a short visual description for its logo"}`;
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env("PAD_AGENT_MODEL") || "claude-haiku-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error("idea model " + r.status);
  const j = await r.json(), text = (j.content || []).map((c) => c.text || "").join("");
  const m = /\{[\s\S]*\}/.exec(text); if (!m) return null;
  const raw = JSON.parse(m[0]), x = cleanIdea(raw, taken);
  return x ? { ...x, image: C.clean(raw.image, 200), by: "model" } : null;
}
async function modelLogo(idea, fetchImpl) {
  const key = env("OPENAI_API_KEY"); if (!key) return null;
  const prompt = `Premium meme-coin logo for "${idea.name}". A glossy 3D collectible-toy style mascot that fits the name: ${idea.image || idea.description} Centered inside a round black coin badge with a thin hot-pink (#ff2e88) neon rim and a subtle white rim light, dramatic cinematic lighting, soft pink and white bokeh of a night city skyline behind, rich blacks, high detail, clean composition, square format. No text, no letters, no numbers, no watermark, no logos, no real brands, not resembling any existing video game, film or franchise character.`;
  const r = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST", signal: AbortSignal.timeout(45000),
    headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({ model: env("PAD_AGENT_IMAGE_MODEL") || "gpt-image-1", prompt, size: "1024x1024", n: 1, output_format: "webp", output_compression: 80, quality: "medium" }),
  });
  if (!r.ok) throw new Error("logo model " + r.status);
  const j = await r.json(), b64 = j.data && j.data[0] && j.data[0].b64_json;
  return b64 ? { bytes: Buffer.from(b64, "base64"), type: "webp", ext: "webp" } : null;
}

// ---------------- the logo library (images/agent/<subject>-<n>.webp, made once with an image model): the idea's
// subject (the last word of its name) when there's a picture of it, else one picked by the hour
let LIB = null;
export function libraryList(dir = join(process.cwd(), "images", "agent")) {
  if (LIB) return LIB;
  try { LIB = { dir, files: readdirSync(dir).filter((f) => /^[a-z]+-\d+\.webp$/.test(f)).sort() }; } catch { LIB = { dir, files: [] }; }
  return LIB;
}
/// the library's subjects as nouns ("owl-1.webp" → "Owl")
export function libraryNouns() { return [...new Set(libraryList().files.map((f) => f.replace(/-\d+\.webp$/, "")))].map((n) => n[0].toUpperCase() + n.slice(1)); }
/// the owner's pick for the next drop: used once (skipped once a coin with its ticker is listed), logo from images/agent
export const NEXT_DROP = { name: "BUCKZ", symbol: "BUCKZ", description: "BUCKZ — fresh cash on Clock Plaza.", file: "next-buckz.webp" };
function nextDrop(taken, N = NEXT_DROP) {
  if (!N || !N.symbol || taken.has(N.symbol.toUpperCase())) return null;
  try { return { idea: { name: N.name, symbol: N.symbol, description: N.description }, logo: { bytes: readFileSync(join(libraryList().dir, N.file)), type: "webp", ext: "webp" } }; } catch { return null; }
}
export function libraryPick(name, hour, files) {
  if (!files.length) return null;
  const subj = String(name || "").trim().split(/\s+/).pop().toLowerCase(), mine = files.filter((f) => f.startsWith(subj + "-"));
  const pool = mine.length ? mine : files;
  return pool[hash(hour + ":" + name) % pool.length];
}
function libraryLogo(idea, hour) {
  const L = libraryList(), f = libraryPick(idea.name, hour, L.files);
  if (!f) return null;
  try { return { bytes: readFileSync(join(L.dir, f)), type: "webp", ext: "webp" }; } catch { return null; }
}

// ---------------- mint keys: ground here, kept encrypted (the store is public) until used
const A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export async function grind(suffix, ms = A.GRIND_MS, now = Date.now) {
  const k = suffix.length, M = 58 ** k; let T = 0; for (const ch of suffix) T = T * 58 + A58.indexOf(ch);
  const S = webcrypto.subtle, end = now() + ms; let tries = 0;
  while (now() < end) {
    const keys = await Promise.all(Array.from({ length: 256 }, () => S.generateKey({ name: "Ed25519" }, true, ["sign"])));
    const pubs = await Promise.all(keys.map((x) => S.exportKey("raw", x.publicKey)));
    for (let i = 0; i < pubs.length; i++) {
      const pub = new Uint8Array(pubs[i]); tries++;
      let r = 0; if (k) for (let j = 0; j < 32; j++) r = (r * 256 + pub[j]) % M;
      if (r === T) {
        const pk = new Uint8Array(await S.exportKey("pkcs8", keys[i].privateKey)), secret = new Uint8Array(64);
        secret.set(pk.slice(pk.length - 32)); secret.set(pub, 32);
        return { pub: C.b58enc(pub), secret, tries };
      }
    }
  }
  return { pub: null, tries };
}
const boxKey = (secret) => createHash("sha256").update("drop-city mint pool\n" + secret).digest();
export function seal(bytes, secret) { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", boxKey(secret), iv), ct = Buffer.concat([c.update(Buffer.from(bytes)), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"); }
export function open(b64, secret) { const b = Buffer.from(b64, "base64"), d = createDecipheriv("aes-256-gcm", boxKey(secret), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return new Uint8Array(Buffer.concat([d.update(b.subarray(28)), d.final()])); }

// ---------------- the agent
export function makeAgent({ pad, extra = null, tg = null, site = () => env("PAD_SITE") || (env("VERCEL_PROJECT_PRODUCTION_URL") ? "https://" + env("VERCEL_PROJECT_PRODUCTION_URL") : ""), now = () => Date.now(), fetchImpl = fetch, kit = () => import("./_agentkit.mjs"), rpcUrl = () => env("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com" }) {
  const store = pad.store;
  const log = async (k, v) => store.put(`agent/log/${new Date(now()).toISOString().slice(0, 10)}/${now()}-${k}.json`, { at: now(), k, ...v }, {}).catch(() => {});

  async function pool(secret, suffix) {
    const keys = (await store.list("agent/pool/")).sort();
    for (const k of keys) {
      const doc = await store.get(k); if (!doc || doc.used || doc.suffix !== suffix) continue;
      try { const sk = open(doc.box, secret); if (C.b58enc(sk.slice(32)) === doc.pub) return { key: k, pub: doc.pub, secret: sk }; } catch {}
    }
    return null;
  }
  async function fillPool(secret, suffix, until) {
    let n = (await Promise.all((await store.list("agent/pool/")).map((k) => store.get(k)))).filter((d) => d && !d.used && d.suffix === suffix).length;
    while (n < A.POOL && now() < until - 3000) {
      const g = await grind(suffix, Math.min(A.GRIND_MS, until - now() - 3000), now); if (!g.pub) break;
      await store.put(`agent/pool/${g.pub}.json`, { pub: g.pub, suffix, at: now(), box: seal(g.secret, secret) }, { create: true }).catch(() => {});
      n++;
    }
    return n;
  }

  /// → { state, hour, mint?, why? }
  async function tick({ budgetMs = 50e3 } = {}) {
    const t0 = now(), until = t0 + budgetMs, c = cfg(), secret = env("PAD_AGENT_KEY"), hour = hourOf(t0);
    if (!c.open) return { state: "off", hour, why: c.suffixError || "the vault isn't set" };
    if (!c.agent) return { state: "off", hour, why: "PAD_AGENT_KEY isn't set (or isn't a valid key)" };
    const s = c.drops ? await pad.slot(t0) : null;
    let out;
    if (!c.drops) out = { state: "off", hour, why: "hourly drops are off (PAD_DROPS)" }; // the housekeeping below still runs
    else if (s.state === "dropped") out = { state: "dropped", hour, mint: s.drop.mint };
    else if (s.state === "dropping") out = { state: "dropping", hour };
    else if (s.tries >= A.MAX_TRIES) out = { state: "gave-up", hour };
    else if (new Date(t0).getUTCMinutes() >= A.LATE_MIN) out = { state: "late", hour };
    else {
      // no SOL: wait without using up the hour's tries (said once an hour in the log)
      const K0 = await kit(), bal = await new K0.Connection(rpcUrl(), "confirmed").getBalance(K0.keypairOf(secret).publicKey).catch(() => null);
      if (bal != null && bal / 1e9 < A.NEED_SOL) {
        await store.put(`agent/log/${new Date(t0).toISOString().slice(0, 10)}/${hour}-nosol.json`, { at: t0, k: "fail", why: `the agent's wallet has ${(bal / 1e9).toFixed(4)} SOL — it needs ${A.NEED_SOL} to drop` }, { create: true }).catch(() => {});
        out = { state: "no-sol", hour, sol: bal / 1e9 };
        await health({ paused: true, why: "no-sol", sol: bal / 1e9 }, c);
      } else {
        out = await drop(hour, s.tries + 1, secret, c, until);
        if (bal != null) await health({ paused: false, sol: bal / 1e9 }, c);
      }
    }
    // the rest of the call: the agent's housekeeping
    const K = await kit().catch(() => null);
    if (K && now() < until - 8000) out.tidy = await tidy(K, secret, c).catch((e) => ({ error: String((e && e.message) || e).slice(0, 120) }));
    if (K && (c.quotes || []).length && now() < until - 10000) out.lut = await (async () => { const conn = new K.Connection(rpcUrl(), "confirmed"), me = K.keypairOf(secret), doc = await store.get("agent/lut.json").catch(() => null);
      if (!doc || !doc.address) return null; const l = await K.lutOf(conn, doc.address); if (!l) return null; const n = await lutQuotes(K, conn, me, c, l, doc); return (n || l).state.addresses.length; })().catch((e) => "error: " + String((e && e.message) || e).slice(0, 200));
    if (now() < until - 6000) out.pool = await fillPool(secret, c.suffix, until).catch(() => null);
    return out;
  }

  /// the agent's health for the site (agent/state.json: paused while it can't pay for a drop) and the owner's alerts
  /// (a DM to TG_OWNER_CHAT: empty → every A.ALERT_MS, low → once a day; never to the public chats)
  async function health(st, c) {
    const t = now(), was = (await store.get("agent/state.json").catch(() => null)) || {};
    const doc = { paused: !!st.paused, why: st.why || "", sol: st.sol != null ? Math.round(st.sol * 1e4) / 1e4 : was.sol, at: t, alertAt: was.alertAt || 0, lowAt: was.lowAt || 0 };
    const owner = env("TG_OWNER_CHAT");
    if (tg && owner && tg.send) {
      if (doc.paused && t - doc.alertAt > A.ALERT_MS) { doc.alertAt = t; await tg.send(owner, { text: `🚨 <b>Hourly drops are paused.</b>\nThe agent's wallet has <b>${(doc.sol || 0).toFixed(4)} SOL</b>; a drop needs ${A.NEED_SOL}.\nTop up <code>${c.agent}</code> and the next hour drops again.` }).catch(() => null); }
      else if (!doc.paused && doc.sol != null && doc.sol < A.LOW_SOL && t - doc.lowAt > 864e5) { doc.lowAt = t; await tg.send(owner, { text: `⚠️ The agent's wallet is running low: <b>${doc.sol.toFixed(4)} SOL</b> (about ${Math.floor(doc.sol / A.NEED_SOL)} drops left).\nTop up <code>${c.agent}</code>.` }).catch(() => null); }
      else if (!doc.paused && was.paused) await tg.send(owner, { text: `✅ Drops are back — the agent's wallet has ${(doc.sol || 0).toFixed(4)} SOL.` }).catch(() => null);
    }
    if (pad.setHealth) pad.setHealth(doc);
    if (was.paused !== doc.paused || Math.abs((was.sol || 0) - (doc.sol || 0)) > 1e-4 || doc.alertAt !== was.alertAt || doc.lowAt !== was.lowAt) await store.put("agent/state.json", doc, {}).catch(() => {});
    return doc;
  }
  async function drop(hour, n, secret, c, until) {
    const runKey = `agent/run/${hour}/${String(n).padStart(2, "0")}.json`;
    const claimed = await store.put(runKey, { state: "running", at: now(), n }, { create: true }).then(() => true).catch(() => false);
    if (!claimed) return { state: "dropping", hour };
    // a failure keeps the transaction's logs and, once the coin exists, its address (the next try finishes that coin)
    const logsOf = (e) => ((e && (e.logs || e.transactionLogs)) || []).slice(-40);
    const fail = async (why, more = {}) => { const w = String((why && why.message) || why).slice(0, 300), L0 = logsOf(why); await store.put(runKey, { state: "failed", at: now(), n, why: w, logs: L0, ...more }, {}); await log("fail", { hour, why: w, logs: L0, ...more }); return { state: "failed", hour, why: w, ...more }; };
    try {
      const K = await kit(), conn = new K.Connection(rpcUrl(), "confirmed"), me = K.keypairOf(secret);
      // an earlier try this hour made the coin but its split didn't land: finish that one instead of making another
      const stuck = await stuckCoin(hour);
      if (stuck) return finish(K, conn, me, c, stuck, hour, runKey, n, fail);
      const bal = (await conn.getBalance(me.publicKey)) / 1e9;
      if (bal < A.NEED_SOL) return fail(`the agent's wallet has ${bal.toFixed(4)} SOL — it needs ${A.NEED_SOL} to drop`);
      // 1. the idea
      const L = await pad.list().catch(() => ({ items: [] })), taken = new Set(L.items.map((x) => String(x.symbol || "").toUpperCase()));
      const recent = L.items.filter((x) => x.kind === "drop").map((x) => x.name);
      // the community's pick for this hour first (the vote during the hour before), then the model, then the city
      const nx = nextDrop(taken);
      let idea = nx ? nx.idea : extra ? await extra.winner(hour).catch(() => null) : null;
      if (idea && (taken.has(idea.symbol) || !cleanIdea(idea))) idea = null;
      if (!idea) idea = await modelIdea(hour, recent, taken, fetchImpl).catch(() => null);
      if (!idea) idea = cityIdea(hour, taken);
      // 2. the logo, hosted
      let lg = nx ? nx.logo : await modelLogo(idea, fetchImpl).catch(() => null);
      if (!lg) lg = libraryLogo(idea, hour);
      if (!lg) lg = { bytes: badge(idea.symbol, hour), type: "png", ext: "png" };
      const lid = createHash("sha256").update(lg.bytes).digest("hex");
      const lp = await store.put(`logos/${lid}.${lg.ext}`, new Uint8Array(lg.bytes), { create: true, public: true, type: "image/" + lg.type }).catch((e) => (e && e.exists ? null : Promise.reject(e)));
      const image = (lp && lp.url) || (await store.url(`logos/${lid}.${lg.ext}`));
      const md = await pad.meta({ name: idea.name, symbol: idea.symbol, description: idea.description, image });
      if (md.status !== 200) return fail(md.body.error || "couldn't host the details");
      // 3. the address
      let mk = await pool(secret, c.suffix), mint;
      if (mk) { mint = K.Keypair.fromSecretKey(mk.secret); await store.put(mk.key, { pub: mk.pub, suffix: c.suffix, used: hour, at: now() }, {}); }
      else { const g = await grind(c.suffix, Math.max(5000, Math.min(A.GRIND_MS, until - now() - 20000)), now); if (!g.pub) return fail("couldn't find an address ending in " + c.suffix + " in time — the next call tries again"); mint = K.Keypair.fromSecretKey(g.secret); }
      // 4. the launch: create_v2 + the split, locked
      const sdk = new K.OnlinePumpSdk(conn);
      const [global, feeConfig, bh] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null), conn.getLatestBlockhash("confirmed")]);
      if (global.createV2Enabled === false) return fail("pump.fun has paused new coins");
      const dev = Math.max(0, Math.min(1, Number(env("PAD_AGENT_BUY") || 0))) || 0;
      const shares = [{ address: me.publicKey, shareBps: c.split.creator }, { address: new K.PublicKey(c.vault), shareBps: c.split.vault }, { address: new K.PublicKey(c.buyer), shareBps: c.split.buyer }];
      await sweep(K, conn, me).catch(() => null); // pump.fun moves a curve's creator only when none of the creator's fee vaults holds anything
      const lut = await ensureLut(K, conn, me, c, global, feeConfig).catch(() => null);
      if (lut) {
        // one transaction: create → split → (first buy) — nothing can trade in between
        const v = await K.launchV0({ lut, global, feeConfig, creator: me.publicKey, mint: mint.publicKey, name: idea.name, symbol: idea.symbol, uri: md.body.uri, devBuyLamports: Math.round(dev * 1e9), treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, slipBps: 300 });
        const tx = v.txs[0]; tx.sign([me, mint]);
        let sig;
        try {
          sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
          const cf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
          if (cf.value && cf.value.err) throw new Error("the launch failed on chain: " + JSON.stringify(cf.value.err).slice(0, 120));
        } catch (e) { return fail(e, { step: "launch-v0" }); }
        return listed(mint.publicKey.toBase58(), [sig], idea, image, hour, runKey, n);
      }
      const b = await K.launchTxs({ global, feeConfig, creator: me.publicKey, mint: mint.publicKey, name: idea.name, symbol: idea.symbol, uri: md.body.uri, devBuyLamports: Math.round(dev * 1e9), treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, slipBps: 300 });
      b.txs[0].partialSign(mint);
      const sigs = [], coin = mint.publicKey.toBase58();
      for (let i = 0; i < b.txs.length; i++) {
        const tx = b.txs[i]; tx.partialSign(me);
        try {
          const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
          const cf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
          if (cf.value && cf.value.err) throw new Error("the launch failed on chain: " + JSON.stringify(cf.value.err).slice(0, 120));
          sigs.push(sig);
        } catch (e) {
          if (i === 0) return fail(e, { step: "create" });
          // the coin exists; its split (or first buy) didn't land — try the split once more right away, else the next try finishes it
          return finish(K, conn, me, c, { mint: coin, idea, image, sig: sigs[0] }, hour, runKey, n, fail, e);
        }
      }
      return listed(coin, sigs, idea, image, hour, runKey, n);
    } catch (e) { return fail((e && e.message) || e); }
  }

  /// a launched coin: listed with its hour (the chain can lag a moment), logged, announced
  async function listed(coin, sigs, idea, image, hour, runKey, n) {
    let reg = null; for (let i = 0; i < 6; i++) { reg = await pad.addDrop({ mint: coin, sig: sigs[0], hour }); if (reg.status === 200) break; await new Promise((r) => setTimeout(r, 1500 + i * 800)); }
    await store.put(runKey, { state: "launched", at: now(), n, mint: coin, symbol: idea.symbol, name: idea.name, by: idea.by, sigs, listed: reg && reg.status === 200 }, {});
    await log("drop", { hour, mint: coin, symbol: idea.symbol, by: idea.by });
    if (tg) await tg.announceDrop({ coin: { mint: coin, symbol: idea.symbol, name: idea.name, description: idea.description, image }, hour }).catch(() => null);
    if (extra) await extra.announce({ coin: { mint: coin, symbol: idea.symbol, name: idea.name, description: idea.description, image }, hour, site: site() }).catch(() => null);
    return { state: "dropped", hour, mint: coin, symbol: idea.symbol, by: idea.by, listed: reg && reg.status === 200 };
  }
  /// the lookup table every launch shares (made once by the agent, kept in agent/lut.json; anyone's launch may use it)
  async function ensureLut(K, conn, me, c, global, feeConfig) {
    const doc = await store.get("agent/lut.json").catch(() => null);
    if (doc && doc.address) { const l = await K.lutOf(conn, doc.address).catch(() => null); if (l && l.state.addresses.length) return (await lutQuotes(K, conn, me, c, l, doc).catch(() => null)) || l; if (now() - doc.at < 120e3) return null; }
    const addrs = (await K.sharedAddresses({ treasury: new K.PublicKey(c.vault), buyer: new K.PublicKey(c.buyer), global, feeConfig })).slice(0, 30);
    const slot = await conn.getSlot("finalized"), bh = await conn.getLatestBlockhash("confirmed");
    const { tx, address } = K.lutCreateTx({ authority: me.publicKey, recentSlot: slot, addresses: addrs, blockhash: bh.blockhash });
    tx.sign(me);
    const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
    await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
    await store.put("agent/lut.json", { address: address.toBase58(), at: now(), n: addrs.length, sig }, {});
    await log("lut", { sig, sol: 0 });
    // usable from the next slot
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1200)); const l = await K.lutOf(conn, address).catch(() => null); if (l && l.state.addresses.length) return l; }
    return null;
  }
  /// the token pairs' shared accounts (each quote token, its program, pump.fun's quote list) in the table too, so a
  /// token-pair launch (create + split as one transaction) fits with a long name — added once, by the agent
  async function lutQuotes(K, conn, me, c, l, doc) {
    const have = new Set(l.state.addresses.map(String)), want = [...new Set([...(c.quotes || []).flatMap((q) => [q.mint, q.program]), String(K.QUOTE_CONTROL_PDA)])].filter((a) => a && !have.has(a));
    if (!want.length || (doc.extAt && now() - doc.extAt < 120e3)) return null;
    await store.put("agent/lut.json", { ...doc, extAt: now() }, {});
    const bh = await conn.getLatestBlockhash("confirmed"), tx = K.lutExtendTx({ authority: me.publicKey, lookupTable: l.key, addresses: want.map((a) => new K.PublicKey(a)), blockhash: bh.blockhash });
    tx.sign(me);
    let sig;
    try { sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 }); await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed"); }
    catch (e) { await log("fail", { step: "lut-extend", why: String((e && e.message) || e).slice(0, 300), logs: ((e && (e.logs || e.transactionLogs)) || []).slice(-10) }); throw e; }
    await log("lut", { sig, sol: 0, added: want.length });
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1200)); const n = await K.lutOf(conn, l.key).catch(() => null); if (n && n.state.addresses.length > l.state.addresses.length) return n; }
    return null;
  }
  /// collect every waiting creator fee of the agent (all quotes, the AMM too) — a separate transaction, skipped when there's none
  async function sweep(K, conn, me) {
    const bh = await conn.getLatestBlockhash("confirmed");
    const tx = await K.sweepTx(conn, me.publicKey, bh.blockhash);
    if (!tx) return null;
    tx.sign(me);
    const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
    await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
    return sig;
  }
  /// this hour's coin that was made but not finished (a failed run that recorded its mint)
  async function stuckCoin(hour) {
    const keys = (await store.list(`agent/run/${hour}/`)).sort();
    for (const k of keys.reverse()) { const r = await store.get(k).catch(() => null); if (r && r.state === "failed" && r.mint && r.step === "list") return { mint: r.mint, idea: r.idea, image: r.image, sig: r.sig || "" }; }
    return null;
    return null;
  }
  /// lock a made coin's split (the creator's waiting fees swept first), then list it and announce it
  async function finish(K, conn, me, c, coin, hour, runKey, n, fail, first = null) {
    const shares = [{ address: me.publicKey, shareBps: c.split.creator }, { address: new K.PublicKey(c.vault), shareBps: c.split.vault }, { address: new K.PublicKey(c.buyer), shareBps: c.split.buyer }];
    const keep = { mint: coin.mint, idea: coin.idea, image: coin.image, sig: coin.sig, step: "split" };
    try {
      const sc = await K.sharingOf(conn, coin.mint);
      if (!(sc && sc.adminRevoked)) {
        await sweep(K, conn, me);
        const bh = await conn.getLatestBlockhash("confirmed");
        const tx = await K.splitTx({ creator: me.publicKey, mint: new K.PublicKey(coin.mint), treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, sharingConfig: sc && !sc.adminRevoked ? sc : null });
        tx.sign(me);
        const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
        const cf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
        if (cf.value && cf.value.err) throw new Error("the split failed on chain: " + JSON.stringify(cf.value.err).slice(0, 120));
      }
    } catch (e) { return fail(first && !e.logs ? first : e, keep); }
    let reg = null; for (let i = 0; i < 6; i++) { reg = await pad.addDrop({ mint: coin.mint, sig: coin.sig || "", hour }); if (reg.status === 200) break; await new Promise((r) => setTimeout(r, 1500 + i * 800)); }
    const idea = coin.idea || {};
    await store.put(runKey, { state: "launched", at: now(), n, mint: coin.mint, symbol: idea.symbol, name: idea.name, by: idea.by, finished: true, listed: reg && reg.status === 200 }, {});
    await log("drop", { hour, mint: coin.mint, symbol: idea.symbol, by: idea.by, finished: true });
    if (tg) await tg.announceDrop({ coin: { mint: coin.mint, symbol: idea.symbol, name: idea.name, description: idea.description, image: coin.image }, hour }).catch(() => null);
    if (extra) await extra.announce({ coin: { mint: coin.mint, symbol: idea.symbol, name: idea.name, description: idea.description, image: coin.image }, hour, site: site() }).catch(() => null);
    return { state: "dropped", hour, mint: coin.mint, symbol: idea.symbol, finished: true };
  }

  /// pay out the agent's coins' waiting fees, then send what's over the reserve to THE VAULT
  async function tidy(K, secret, c) {
    const conn = new K.Connection(rpcUrl(), "confirmed"), me = K.keypairOf(secret), out = { paid: [], sent: 0 };
    const L = await pad.list();
    const due = L.items.filter((x) => x.kind === "drop" && (x.feesWaitingSol || 0) >= A.PAYOUT_MIN_SOL).sort((a, b) => b.feesWaitingSol - a.feesWaitingSol).slice(0, 3);
    for (const x of due) {
      const sc = await K.sharingOf(conn, x.mint); if (!sc) continue;
      const bh = await conn.getLatestBlockhash("confirmed");
      const tx = await K.distributeTx({ payer: me.publicKey, mint: new K.PublicKey(x.mint), sharingConfig: sc, graduated: !!x.graduated, blockhash: bh.blockhash });
      tx.sign(me);
      const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
      await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
      out.paid.push({ mint: x.mint, sol: x.feesWaitingSol, sig });
    }
    const bal = await conn.getBalance(me.publicKey), keep = Math.round(A.RESERVE_SOL * 1e9), extra = bal - keep - 10000;
    if (extra >= A.FORWARD_MIN_SOL * 1e9) {
      const bh = await conn.getLatestBlockhash("confirmed");
      const tx = K.sendSolTx({ from: me.publicKey, to: new K.PublicKey(c.vault), lamports: extra, blockhash: bh.blockhash });
      tx.sign(me);
      const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
      await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
      out.sent = extra / 1e9; out.sentSig = sig;
      await log("vault", { sol: extra / 1e9, sig });
    }
    if (out.paid.length) await log("payout", { coins: out.paid.map((p) => p.mint) });
    return out;
  }

  /// what the page shows about the agent: its wallet, this hour, the last drops and transfers
  async function status() {
    const c = cfg(), s = await pad.slot();
    const day = new Date(now()).toISOString().slice(0, 10), keys = (await store.list(`agent/log/${day}/`)).sort().slice(-20);
    const logs = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).map((l) => ({ at: l.at, k: l.k, symbol: l.symbol, mint: l.mint, sol: l.sol, sig: l.sig, step: l.step, why: l.why && l.k === "fail" ? l.why : undefined, logs: l.k === "fail" && l.logs && l.logs.length ? l.logs : undefined }));
    return { agent: c.agent || null, vault: c.vault || null, reserveSol: A.RESERVE_SOL, slot: s, logs };
  }
  return { tick, status, drop, tidy };
}
