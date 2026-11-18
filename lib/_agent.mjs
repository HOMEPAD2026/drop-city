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

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
export const A = {
  MAX_TRIES: 3, // launches an hour may try
  RUN_STALE_MS: 5 * 60e3, // a run that said "running" this long ago is over
  LATE_MIN: 55, // no new drop after :55 — the next hour gets it
  RESERVE_SOL: 0.5, // kept in the agent's wallet for launches; the rest goes to THE VAULT
  FORWARD_MIN_SOL: 0.05, // smaller amounts wait
  PAYOUT_MIN_SOL: 0.02, // a coin's waiting fees are paid out from this much
  NEED_SOL: 0.04, // a launch needs this much (rent + fees)
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
export function cityIdea(hour, taken = new Set()) {
  for (let k = 0; k < 50; k++) {
    const h = hash(hour + ":" + k), a = ADJ[h % ADJ.length], n = NOUN[(h >>> 8) % NOUN.length];
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
  const prompt = `A bold round meme-coin logo for "${idea.name}". ${idea.image || idea.description} Stylised cartoon character or emblem centred on a black circle, hot pink and white neon rim light, glossy, premium, high contrast, no text, no letters, no real brands or characters.`;
  const r = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST", signal: AbortSignal.timeout(45000),
    headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({ model: env("PAD_AGENT_IMAGE_MODEL") || "gpt-image-1", prompt, size: "1024x1024", n: 1, output_format: "webp", output_compression: 80, quality: "medium" }),
  });
  if (!r.ok) throw new Error("logo model " + r.status);
  const j = await r.json(), b64 = j.data && j.data[0] && j.data[0].b64_json;
  return b64 ? { bytes: Buffer.from(b64, "base64"), type: "webp", ext: "webp" } : null;
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
export function makeAgent({ pad, now = () => Date.now(), fetchImpl = fetch, kit = () => import("./_agentkit.mjs"), rpcUrl = () => env("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com" }) {
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
    const s = await pad.slot(t0);
    let out;
    if (s.state === "dropped") out = { state: "dropped", hour, mint: s.drop.mint };
    else if (s.state === "dropping") out = { state: "dropping", hour };
    else if (s.tries >= A.MAX_TRIES) out = { state: "gave-up", hour };
    else if (new Date(t0).getUTCMinutes() >= A.LATE_MIN) out = { state: "late", hour };
    else {
      // no SOL: wait without using up the hour's tries (said once an hour in the log)
      const K0 = await kit(), bal = await new K0.Connection(rpcUrl(), "confirmed").getBalance(K0.keypairOf(secret).publicKey).catch(() => null);
      if (bal != null && bal / 1e9 < A.NEED_SOL) {
        await store.put(`agent/log/${new Date(t0).toISOString().slice(0, 10)}/${hour}-nosol.json`, { at: t0, k: "fail", why: `the agent's wallet has ${(bal / 1e9).toFixed(4)} SOL — it needs ${A.NEED_SOL} to drop` }, { create: true }).catch(() => {});
        out = { state: "no-sol", hour, sol: bal / 1e9 };
      } else out = await drop(hour, s.tries + 1, secret, c, until);
    }
    // the rest of the call: the agent's housekeeping
    const K = await kit().catch(() => null);
    if (K && now() < until - 8000) out.tidy = await tidy(K, secret, c).catch((e) => ({ error: String((e && e.message) || e).slice(0, 120) }));
    if (now() < until - 6000) out.pool = await fillPool(secret, c.suffix, until).catch(() => null);
    return out;
  }

  async function drop(hour, n, secret, c, until) {
    const runKey = `agent/run/${hour}/${String(n).padStart(2, "0")}.json`;
    const claimed = await store.put(runKey, { state: "running", at: now(), n }, { create: true }).then(() => true).catch(() => false);
    if (!claimed) return { state: "dropping", hour };
    const fail = async (why) => { await store.put(runKey, { state: "failed", at: now(), n, why: String(why).slice(0, 200) }, {}); await log("fail", { hour, why: String(why).slice(0, 200) }); return { state: "failed", hour, why: String(why).slice(0, 200) }; };
    try {
      const K = await kit(), conn = new K.Connection(rpcUrl(), "confirmed"), me = K.keypairOf(secret);
      const bal = (await conn.getBalance(me.publicKey)) / 1e9;
      if (bal < A.NEED_SOL) return fail(`the agent's wallet has ${bal.toFixed(4)} SOL — it needs ${A.NEED_SOL} to drop`);
      // 1. the idea
      const L = await pad.list().catch(() => ({ items: [] })), taken = new Set(L.items.map((x) => String(x.symbol || "").toUpperCase()));
      const recent = L.items.filter((x) => x.kind === "drop").map((x) => x.name);
      let idea = await modelIdea(hour, recent, taken, fetchImpl).catch(() => null);
      if (!idea) idea = cityIdea(hour, taken);
      // 2. the logo, hosted
      let lg = await modelLogo(idea, fetchImpl).catch(() => null);
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
      const b = await K.launchTxs({ global, feeConfig, creator: me.publicKey, mint: mint.publicKey, name: idea.name, symbol: idea.symbol, uri: md.body.uri, devBuyLamports: Math.round(dev * 1e9), treasury: new K.PublicKey(c.vault), shares, blockhash: bh.blockhash, slipBps: 300 });
      b.txs[0].partialSign(mint);
      const sigs = [];
      for (const tx of b.txs) {
        tx.partialSign(me);
        const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
        const cf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
        if (cf.value && cf.value.err) return fail("the launch failed on chain: " + JSON.stringify(cf.value.err).slice(0, 120));
        sigs.push(sig);
      }
      const coin = mint.publicKey.toBase58();
      // 5. listed with its hour (the chain can lag a moment)
      let reg = null; for (let i = 0; i < 6; i++) { reg = await pad.addDrop({ mint: coin, sig: sigs[0], hour }); if (reg.status === 200) break; await new Promise((r) => setTimeout(r, 1500 + i * 800)); }
      await store.put(runKey, { state: "launched", at: now(), n, mint: coin, symbol: idea.symbol, name: idea.name, by: idea.by, sigs, listed: reg && reg.status === 200 }, {});
      await log("drop", { hour, mint: coin, symbol: idea.symbol, by: idea.by });
      return { state: "dropped", hour, mint: coin, symbol: idea.symbol, by: idea.by, listed: reg && reg.status === 200 };
    } catch (e) { return fail((e && e.message) || e); }
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
    const logs = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).map((l) => ({ at: l.at, k: l.k, symbol: l.symbol, mint: l.mint, sol: l.sol, sig: l.sig, why: l.why && l.k === "fail" ? l.why : undefined }));
    return { agent: c.agent || null, vault: c.vault || null, reserveSol: A.RESERVE_SOL, slot: s, logs };
  }
  return { tick, status, drop, tidy };
}
