// lib/_extra.mjs — what the site shows beyond the list: a CA's check, a coin's safety grade, the live trades, the
// vote on the next hourly drop, the coin page's link card, and the drop's announcement on Telegram / X.
import { createHmac, randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "./_chain.mjs";
import { cfg, splitCheck, hourOf } from "./_pad.mjs";
import { cityIdea, cleanIdea, BLOCK } from "./_agent.mjs";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();

// ---------------- the safety grade (what the chain shows — not a promise)
/// parts: { split: bool|null (null = listed without one), creatorPct, top10Pct, ageH, progress, graduated } → { score, grade, parts }
export function gradeOf(p) {
  const parts = [];
  const add = (k, got, max, note) => parts.push({ k, got, max, note });
  add("split", p.split ? 20 : 0, 20, p.split ? "fee split locked on chain" : "no fee split");
  const cp = p.creatorPct;
  add("creator", cp == null ? 8 : cp <= 5 ? 20 : cp <= 10 ? 12 : cp <= 20 ? 5 : 0, 20, cp == null ? "creator's share not read" : `creator holds ${cp.toFixed(1)}%`);
  const t = p.top10Pct;
  add("holders", t == null ? 8 : t < 20 ? 25 : t < 35 ? 15 : t < 50 ? 6 : 0, 25, t == null ? "holders not read" : `top 10 hold ${t.toFixed(1)}%`);
  add("age", p.ageH >= 24 ? 10 : p.ageH >= 6 ? 5 : 0, 10, p.ageH >= 24 ? "a day old or more" : `${Math.max(0, p.ageH).toFixed(1)} h old`);
  add("curve", p.graduated ? 15 : p.progress >= 50 ? 8 : p.progress >= 15 ? 4 : 0, 15, p.graduated ? "graduated" : `curve ${Math.round(p.progress || 0)}%`);
  add("address", 10, 10, "launched here (address suffix)");
  let score = parts.reduce((a, x) => a + x.got, 0);
  if (p.ageH < 6) score = Math.min(score, 64); // too young for an A or a B
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  return { score, grade, parts };
}

export function makeExtra({ pad, now = () => Date.now(), fetchImpl = fetch }) {
  const store = pad.store;
  const mem = { detail: new Map(), trades: null, tradesAt: 0, seen: new Set(), cursor: {} };

  // ---------------- a CA's check (read only)
  async function verify(mint) {
    mint = String(mint || "").trim();
    if (!C.isPubkey(mint)) return { status: 400, body: { error: "That isn't a Solana address." } };
    const c = cfg(), suffix = !c.suffix || mint.endsWith(c.suffix);
    const listed = await store.get(`coins/${mint}.json`).catch(() => null);
    const ch = await C.chainOf(mint).catch(() => null);
    const chk = ch && ch.sharing ? splitCheck(ch.sharing, mint, c) : { ok: false, why: "no fee split" };
    return { status: 200, body: { mint, suffix, suffixWant: c.suffix, listed: !!listed, kind: listed ? listed.kind : null, name: listed ? listed.name : null, symbol: listed ? listed.symbol : null,
      curve: !!(ch && ch.curve), graduated: !!(ch && ch.curve && ch.curve.complete), split: chk.ok, splitWhy: chk.ok ? null : chk.why, noSplit: !!(listed && listed.noSplit) } };
  }

  // ---------------- a coin's detail: safety grade (cached 10 min) + its last trades
  async function detail(mint) {
    mint = String(mint || "").trim();
    if (!C.isPubkey(mint)) return { status: 400, body: { error: "bad address" } };
    const hit = mem.detail.get(mint);
    if (hit && now() - hit.at < 10 * 60e3) return { status: 200, body: { ...hit.body, trades: tradesOf(mint) } };
    const coin = await store.get(`coins/${mint}.json`).catch(() => null);
    if (!coin) return { status: 404, body: { error: "not listed here" } };
    const L = await pad.list().catch(() => ({ items: [] })), row = L.items.find((x) => x.mint === mint) || coin;
    let creatorPct = null, top10Pct = null, holders = [];
    try {
      const big = await C.rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
      const accs = (big && big.value) || [];
      const infos = await C.rpc("getMultipleAccounts", [accs.map((a) => a.address), { encoding: "jsonParsed", commitment: "confirmed" }]);
      const supply = 1e9;
      const skip = new Set([C.bondingCurvePda(mint)]);
      accs.forEach((a, i) => {
        const v = infos && infos.value && infos.value[i], owner = v && v.data && v.data.parsed && v.data.parsed.info ? v.data.parsed.info.owner : null;
        const amt = Number(a.uiAmountString || a.uiAmount || 0);
        holders.push({ owner, pct: (amt / supply) * 100, curve: skip.has(owner) });
      });
      const people = holders.filter((h) => !h.curve).slice(0, row.graduated ? 11 : 10);
      if (row.graduated && people.length && people[0].pct > 10) people.shift(); // a graduated coin's biggest holder is its pool
      top10Pct = people.slice(0, 10).reduce((a, h) => a + h.pct, 0);
      const me = holders.find((h) => h.owner === coin.creator);
      creatorPct = me ? me.pct : 0;
    } catch {}
    const g = gradeOf({ split: !coin.noSplit, creatorPct, top10Pct, ageH: (now() / 1000 - (coin.launchedAt || 0)) / 3600, progress: row.progress || 0, graduated: !!row.graduated });
    // without the holders (the RPC refused the read) the grade is partial: shown as such, kept off the list, read again in 2 min
    const partial = top10Pct == null;
    const body = { mint, ...g, partial, creatorPct, top10Pct, holders: holders.slice(0, 10) };
    mem.detail.set(mint, { at: partial ? now() - 8 * 60e3 : now(), body });
    // the list carries every coin's last full grade (one document)
    if (!partial) try { const gs = (await store.get("grades.json")) || {}; gs[mint] = { g: g.grade, s: g.score, at: now(), v: 2 }; await store.put("grades.json", gs, {}); } catch {}
    return { status: 200, body: { ...body, trades: tradesOf(mint) } };
  }

  // ---------------- live trades on the curves (newest first)
  const tradesOf = (mint) => ((mem.trades && mem.trades.items) || []).filter((t) => t.mint === mint).slice(0, 12);
  async function trades() {
    if (mem.trades && now() - mem.tradesAt < 8000) return mem.trades;
    if (!mem.trades) { const saved = await store.get("trades.json").catch(() => null); mem.trades = saved && Array.isArray(saved.items) ? saved : { items: [] }; for (const t of mem.trades.items) mem.seen.add(t.sig); }
    mem.tradesAt = now();
    const L = await pad.list().catch(() => ({ items: [] }));
    const live = L.items.filter((x) => !x.graduated && x.curve).sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0) || (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 14);
    const sol = await C.solUsd().catch(() => null);
    const fresh = [];
    await Promise.all(live.map(async (x) => {
      const sigs = await C.rpc("getSignaturesForAddress", [x.curve, { limit: 8, commitment: "confirmed" }]).catch(() => []);
      const first = !(x.mint in mem.cursor); mem.cursor[x.mint] = 1;
      for (const s of sigs || []) if (!s.err && !mem.seen.has(s.signature)) { mem.seen.add(s.signature); if (!first || mem.trades.items.length < 30) fresh.push({ sig: s.signature, at: (s.blockTime || 0) * 1000, x }); }
    }));
    fresh.sort((a, b) => b.at - a.at);
    const got = [];
    for (const f of fresh.slice(0, 14)) {
      const tx = await C.rpc("getTransaction", [f.sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]).catch(() => null);
      if (!tx || !tx.meta) continue;
      const keys = [...(tx.transaction.message.accountKeys || []), ...((tx.meta.loadedAddresses && tx.meta.loadedAddresses.writable) || []), ...((tx.meta.loadedAddresses && tx.meta.loadedAddresses.readonly) || [])];
      const i = keys.indexOf(f.x.curve); if (i < 0) continue;
      const d = (tx.meta.postBalances[i] - tx.meta.preBalances[i]) / 1e9;
      if (Math.abs(d) < 1e-6) continue;
      got.push({ sig: f.sig, at: f.at || now(), mint: f.x.mint, symbol: f.x.symbol, side: d > 0 ? "buy" : "sell", sol: Math.abs(d), usd: sol ? Math.abs(d) * sol : null, who: keys[0] });
    }
    if (got.length) {
      mem.trades = { at: now(), items: [...got, ...mem.trades.items].sort((a, b) => b.at - a.at).slice(0, 80) };
      store.put("trades.json", mem.trades, {}).catch(() => {});
    } else mem.trades = { ...mem.trades, at: now() };
    if (mem.seen.size > 5000) mem.seen = new Set(mem.trades.items.map((t) => t.sig));
    return mem.trades;
  }

  // ---------------- the vote on the next hour's drop (one vote a wallet, signed)
  const nextHour = (t) => hourOf(Math.floor(t / 3600e3) * 3600e3 + 3600e3);
  const voteMessage = (wallet, hour, pick, issued) => `Vote for the next drop\nWallet: ${wallet}\nHour (UTC): ${hour}\nPick: ${pick}\nIssued: ${issued}`;
  /// the three ideas for an hour, made once (the model's when it's set, else the city's own)
  async function candidates(hour) {
    const key = `vote/${hour}/cands.json`, got = await store.get(key).catch(() => null);
    if (got && Array.isArray(got.ideas)) return got.ideas;
    const L = await pad.list().catch(() => ({ items: [] })), taken = new Set(L.items.map((x) => String(x.symbol || "").toUpperCase()));
    const ideas = [];
    for (let k = 0; ideas.length < 3 && k < 30; k++) { const x = cityIdea(hour + "#" + k, new Set([...taken, ...ideas.map((i) => i.symbol)])); if (!BLOCK.test(x.name)) ideas.push({ name: x.name, symbol: x.symbol, description: x.description }); }
    await store.put(key, { at: now(), ideas }, { create: true }).catch(() => {});
    const again = await store.get(key).catch(() => null);
    return again && Array.isArray(again.ideas) ? again.ideas : ideas;
  }
  async function tally(hour) {
    const n = [0, 0, 0];
    for (let i = 0; i < 3; i++) n[i] = (await store.list(`vote/${hour}/p${i}/`)).length;
    return n;
  }
  async function voteView(wallet) {
    const t = now(), hour = nextHour(t), ideas = await candidates(hour), n = await tally(hour);
    let mine = null;
    if (C.isPubkey(wallet)) for (let i = 0; i < 3 && mine == null; i++) if ((await store.list(`vote/${hour}/p${i}/${wallet}`)).length) mine = i;
    return { hour, closes: Math.floor(t / 3600e3) * 3600e3 + 3600e3, ideas, votes: n, mine };
  }
  async function vote(b) {
    const t = now(), hour = nextHour(t), wallet = String(b.wallet || ""), pick = Number(b.pick);
    if (!C.isPubkey(wallet) || ![0, 1, 2].includes(pick)) return { status: 400, body: { error: "bad vote" } };
    if (String(b.hour || "") !== hour) return { status: 409, body: { error: "that vote closed — vote for the next hour" } };
    const it = Date.parse(String(b.issued || ""));
    if (!(it > 0) || Math.abs(t - it) > 10 * 60e3) return { status: 400, body: { error: "the signature is too old — sign again" } };
    let ok = false; try { ok = ed25519.verify(C.b58dec(String(b.sig || "")), new TextEncoder().encode(voteMessage(wallet, hour, pick, b.issued)), C.b58dec(wallet)); } catch {}
    if (!ok) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    for (let i = 0; i < 3; i++) if ((await store.list(`vote/${hour}/p${i}/${wallet}`)).length) return { status: 409, body: { error: "this wallet already voted for this hour", mine: i } };
    await candidates(hour);
    const r = await store.put(`vote/${hour}/p${pick}/${wallet}.json`, { at: t }, { create: true }).then(() => true).catch(() => false);
    if (!r) return { status: 409, body: { error: "already voted" } };
    return { status: 200, body: { ok: true, hour, votes: await tally(hour), mine: pick } };
  }
  /// the hour's winning idea for the agent (null if nobody voted)
  async function winner(hour) {
    const got = await store.get(`vote/${hour}/cands.json`).catch(() => null);
    if (!got || !Array.isArray(got.ideas)) return null;
    const n = await tally(hour), best = n.indexOf(Math.max(...n));
    return n[best] > 0 ? { ...got.ideas[best], votes: n[best], by: "vote" } : null;
  }

  // ---------------- the coin page: the site with the coin's own link card
  function page(html, coin, origin) {
    if (!coin) return html;
    const c = cfg(), e = (s) => String(s || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    const title = `$${coin.symbol} — ${coin.name} · ${c.name}`, desc = `${coin.description ? coin.description.slice(0, 140) + " · " : ""}CA ends in ${c.suffix || "…"} · ${coin.mint}`;
    const url = `${origin}/coin/${coin.mint}`;
    const head = `<title>${e(title)}</title><meta name="description" content="${e(desc)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(url)}">${coin.image ? `<meta property="og:image" content="${e(coin.image)}"><meta name="twitter:image" content="${e(coin.image)}">` : ""}<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(desc)}"><script>window.__COIN=${JSON.stringify(coin.mint)}</script>`;
    return html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta (name="description"|property="og:[a-z]+"|name="twitter:[a-z]+")[^>]*>/g, "").replace("</head>", head + "</head>");
  }

  // ---------------- the drop's announcement (Telegram and X, each only when its keys are set)
  async function announce({ coin, hour, site }) {
    const c = cfg(), link = `${site}/coin/${coin.mint}`, out = {};
    const text = `🌃 THE ${hour.slice(11, 13)}:00 DROP (UTC)\n\n$${coin.symbol} — ${coin.name}\n${coin.description ? coin.description.slice(0, 160) + "\n" : ""}\nCA: ${coin.mint}\n\n${link}`;
    if (env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET")) {
      const u = "https://api.x.com/2/tweets", body = JSON.stringify({ text: text.slice(0, 280) });
      const r = await fetchImpl(u, { method: "POST", headers: { authorization: oauth1("POST", u, {}), "content-type": "application/json" }, body, signal: AbortSignal.timeout(10000) }).catch(() => null);
      out.x = !!(r && r.ok);
    }
    return out;
  }
  return { verify, detail, trades, voteView, vote, winner, candidates, page, announce, voteMessage, nextHour };
}

/// OAuth 1.0a header for X's API (HMAC-SHA1)
export function oauth1(method, url, params, keys = { ck: env("X_API_KEY"), cs: env("X_API_SECRET"), tk: env("X_ACCESS_TOKEN"), ts: env("X_ACCESS_SECRET") }, nonce = randomBytes(16).toString("hex"), time = Math.floor(Date.now() / 1000)) {
  const pe = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const o = { oauth_consumer_key: keys.ck, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: String(time), oauth_token: keys.tk, oauth_version: "1.0" };
  const all = { ...params, ...o }, base = [method.toUpperCase(), pe(url), pe(Object.keys(all).sort().map((k) => `${pe(k)}=${pe(all[k])}`).join("&"))].join("&");
  o.oauth_signature = createHmac("sha1", `${pe(keys.cs)}&${pe(keys.ts)}`).update(base).digest("base64");
  return "OAuth " + Object.keys(o).sort().map((k) => `${pe(k)}="${pe(o[k])}"`).join(", ");
}
