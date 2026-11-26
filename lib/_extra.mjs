// lib/_extra.mjs — what the site shows beyond the list: a CA's check, a coin's safety grade, the live trades, the
// vote on the next hourly drop, the coin page's link card, and the drop's announcement on Telegram / X.
import { createHmac, randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "./_chain.mjs";
import { cfg, splitCheck, hourOf } from "./_pad.mjs";
import { cityIdea, cleanIdea, BLOCK } from "./_agent.mjs";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();

/// how long a tower stays raided after its creator sold
export const RAID_MS = 24 * 3600e3;
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
    if (mem.trades && now() - mem.tradesAt < 8000) return { ...mem.trades, scan: mem.scan };
    if (!mem.trades) { const saved = await store.get("trades.json").catch(() => null); mem.trades = saved && Array.isArray(saved.items) ? saved : { items: [] }; for (const t of mem.trades.items) mem.seen.add(t.sig); }
    mem.tradesAt = now();
    const L = await pad.list().catch(() => ({ items: [] }));
    const live = L.items.filter((x) => !x.graduated && x.curve).sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0) || (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 14);
    const sol = await C.solUsd().catch(() => null);
    const fresh = [], scan = { coins: live.length, ok: 0, err: 0, why: "" };
    // the newest trade already kept for each coin: a fresh instance (no cursor yet) keeps what came after it, instead of
    // dropping everything since the last save (that froze the feed whenever the function went cold)
    const lastAt = {}; for (const t of mem.trades.items) lastAt[t.mint] = Math.max(lastAt[t.mint] || 0, t.at || 0);
    for (let i = 0; i < live.length; i += 4) await Promise.all(live.slice(i, i + 4).map(async (x) => { // four at a time: public RPCs throttle bursts
      let sigs = null; try { sigs = await C.rpc("getSignaturesForAddress", [x.curve, { limit: 8, commitment: "confirmed" }]); scan.ok++; } catch (e) { scan.err++; scan.why = String((e && e.message) || e).slice(0, 80); return; }
      const first = !(x.mint in mem.cursor); mem.cursor[x.mint] = 1;
      const since = lastAt[x.mint] || now() - 6 * 3600e3;
      for (const s of sigs || []) if (!s.err && !mem.seen.has(s.signature)) { mem.seen.add(s.signature); const at = (s.blockTime || 0) * 1000; if (!first || at > since) fresh.push({ sig: s.signature, at, x }); }
    }));
    mem.scan = { ...scan, at: now() };
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
    // a creator selling their own coin: the police raid its tower (raids.json, kept a day; the list carries it)
    const raids = got.filter((t) => t.side === "sell" && t.who && L.items.some((x) => x.mint === t.mint && x.creator === t.who));
    if (raids.length) try {
      const doc = (await store.get("raids.json").catch(() => null)) || {};
      for (const t of raids) { const r = doc[t.mint] || { sol: 0, n: 0 }; doc[t.mint] = { at: Math.max(r.at || 0, t.at), sol: Math.round((r.sol + t.sol) * 1e4) / 1e4, n: r.n + 1, sig: t.sig }; }
      for (const k of Object.keys(doc)) if (now() - doc[k].at > RAID_MS) delete doc[k];
      await store.put("raids.json", doc, {});
    } catch {}
    mem.scan.got = got.length;
    if (got.length) {
      mem.trades = { at: now(), items: [...got, ...mem.trades.items].sort((a, b) => b.at - a.at).slice(0, 80) };
      store.put("trades.json", mem.trades, {}).catch(() => {});
    } else mem.trades = { ...mem.trades, at: now() };
    if (mem.seen.size > 5000) mem.seen = new Set(mem.trades.items.map((t) => t.sig));
    return { ...mem.trades, scan: mem.scan };
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

  // ---------------- COIN OF THE DAY (round K, the owner 2026-11-26): the one-vote-a-wallet system, reused once the hourly
  // drops went off. Each UTC day the five busiest coins launched here (SOL traded in the city's trades of the last day,
  // then market cap) are the candidates, fixed at the day's first look; a wallet signs one vote a day; yesterday's winner
  // is the coin of the day on the site and in the bot.
  const cotdMessage = (wallet, day, mint, issued) => `GTAFUN coin of the day\nWallet: ${wallet}\nDay (UTC): ${day}\nCoin: ${mint}\nIssued: ${issued}`;
  const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
  async function cotdCands(day) {
    const key = `cotd/${day}/cands.json`, got = await store.get(key).catch(() => null);
    if (got && Array.isArray(got.mints)) return got.mints;
    const L = await pad.list().catch(() => ({ items: [] })), k = cfg();
    const pool = (L.items || []).filter((x) => (x.kind === "drop" || x.kind === "user") && x.mint !== k.main);
    const T = await trades().catch(() => ({ items: [] })), vol = new Map(), since = now() - 86400e3;
    for (const x of T.items || []) if ((x.at || 0) >= since) vol.set(x.mint, (vol.get(x.mint) || 0) + (Number(x.sol) || 0));
    const mints = pool.sort((a, b) => (vol.get(b.mint) || 0) - (vol.get(a.mint) || 0) || (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 5).map((x) => x.mint);
    if (mints.length < 2) return mints; // too few coins for a vote: nothing is fixed yet
    await store.put(key, { at: now(), mints }, { create: true }).catch(() => {});
    const again = await store.get(key).catch(() => null);
    return again && Array.isArray(again.mints) ? again.mints : mints;
  }
  async function cotdTally(day, mints) { const n = []; for (let i = 0; i < mints.length; i++) n.push((await store.list(`cotd/${day}/p${i}/`)).length); return n; }
  /// the winner of a day that has ended (kept once worked out)
  async function cotdWinner(day) {
    const key = `cotd/${day}/win.json`, got = await store.get(key).catch(() => null); if (got) return got.mint ? got : null;
    const c = await store.get(`cotd/${day}/cands.json`).catch(() => null), mints = (c && c.mints) || [];
    const n = mints.length ? await cotdTally(day, mints) : [], best = n.length ? n.indexOf(Math.max(...n)) : -1;
    const win = best >= 0 && n[best] > 0 ? { day, mint: mints[best], votes: n[best], of: n.reduce((a, b) => a + b, 0) } : { day, mint: null };
    if (dayOf(now()) > day) await store.put(key, win, { create: true }).catch(() => {});
    return win.mint ? win : null;
  }
  async function cotdView(wallet) {
    const t = now(), day = dayOf(t), mints = await cotdCands(day), votes = await cotdTally(day, mints);
    let mine = null; if (C.isPubkey(wallet)) for (let i = 0; i < mints.length && mine == null; i++) if ((await store.list(`cotd/${day}/p${i}/${wallet}`)).length) mine = i;
    const winner = await cotdWinner(dayOf(t - 86400e3)).catch(() => null);
    return { day, closes: Date.parse(day + "T00:00:00Z") + 86400e3, mints, votes, mine, winner };
  }
  async function cotdVote(b) {
    const t = now(), day = dayOf(t), wallet = String(b.wallet || ""), mint = String(b.mint || "");
    if (!C.isPubkey(wallet) || !C.isPubkey(mint)) return { status: 400, body: { error: "bad vote" } };
    if (String(b.day || "") !== day) return { status: 409, body: { error: "that day's vote closed — vote for today" } };
    const it = Date.parse(String(b.issued || ""));
    if (!(it > 0) || Math.abs(t - it) > 10 * 60e3) return { status: 400, body: { error: "the signature is too old — sign again" } };
    let ok = false; try { ok = ed25519.verify(C.b58dec(String(b.sig || "")), new TextEncoder().encode(cotdMessage(wallet, day, mint, b.issued)), C.b58dec(wallet)); } catch {}
    if (!ok) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    const mints = await cotdCands(day), pick = mints.indexOf(mint);
    if (pick < 0) return { status: 400, body: { error: "that coin isn't one of today's candidates" } };
    for (let i = 0; i < mints.length; i++) if ((await store.list(`cotd/${day}/p${i}/${wallet}`)).length) return { status: 409, body: { error: "this wallet already voted today", mine: i } };
    const r = await store.put(`cotd/${day}/p${pick}/${wallet}.json`, { at: t }, { create: true }).then(() => true).catch(() => false);
    if (!r) return { status: 409, body: { error: "already voted" } };
    return { status: 200, body: { ok: true, day, votes: await cotdTally(day, mints), mine: pick } };
  }

  // ---------------- the coin page: the site with the coin's own link card
  const SECTIONS = {
    nft: { title: "GTAFUN CARDS — open a pack, pull a legend", desc: "The 10 top meme characters as NFT cards. Packs of 3 for 0.1 SOL, every card picked at random on chain.", img: "/images/og-nft.jpg" },
    lp: { title: "GTAFUN LP REWARDS — earn every hour", desc: "Add liquidity to the supported coins' Raydium pools and earn $GTAFUN every hour you stay in. Plus 0.3% cashback on every trade.", img: "/images/og-lp.jpg" },
  };
  function page(html, coin, origin, sec) {
    const S = sec && (SECTIONS[sec] || (sec.startsWith("w:") ? { title: `${sec.slice(2, 6)}…${sec.slice(-4)} on GTAFUN — coins, cashback, cards`, desc: "A wallet's coins, trader cashback, LP rewards, GTAFUN cards and badges on GTAFUN.", img: "/images/hero-1600.webp", path: "w/" + sec.slice(2) } : null));
    if (S) { const e = (s) => String(s || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
      const head = `<title>${e(S.title)}</title><meta name="description" content="${e(S.desc)}"><meta property="og:title" content="${e(S.title)}"><meta property="og:description" content="${e(S.desc)}"><meta property="og:url" content="${e(origin + "/" + (S.path || sec))}"><meta property="og:image" content="${e(origin + S.img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${e(origin + S.img)}">`;
      return html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta (name="description"|property="og:[a-z]+"|name="twitter:[a-z]+")[^>]*>/g, "").replace("</head>", head + "</head>"); }
    if (!coin) return html;
    const c = cfg(), e = (s) => String(s || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    const title = `$${coin.symbol} — ${coin.name} · ${c.name}`, desc = `${coin.description ? coin.description.slice(0, 140) + " · " : ""}CA ends in ${c.suffix || "…"} · ${coin.mint}`;
    const url = `${origin}/coin/${coin.mint}`;
    const head = `<title>${e(title)}</title><meta name="description" content="${e(desc)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(url)}">${coin.poster || coin.image ? `<meta property="og:image" content="${e(coin.poster || coin.image)}"><meta name="twitter:image" content="${e(coin.poster || coin.image)}">` : ""}<meta name="twitter:card" content="${coin.poster ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(desc)}"><script>window.__COIN=${JSON.stringify(coin.mint)}</script>`;
    return html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta (name="description"|property="og:[a-z]+"|name="twitter:[a-z]+")[^>]*>/g, "").replace("</head>", head + "</head>");
  }

  // ---------------- the drop's announcement (Telegram and X, each only when its keys are set)
  async function announce({ coin, hour, site }) {
    const c = cfg(), link = `${site}/coin/${coin.mint}`, out = {};
    const text = `${hour ? `🌃 THE ${hour.slice(11, 13)}:00 DROP (UTC)` : `🚀 NEW LAUNCH ON ${c.name || "GTAFUN"}`}\n\n$${coin.symbol} — ${coin.name}\n${coin.description ? coin.description.slice(0, 160) + "\n" : ""}\nCA: ${coin.mint}\n\n${link}`;
    if (env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET")) {
      const u = "https://api.x.com/2/tweets", body = JSON.stringify({ text: text.slice(0, 280) });
      const r = await fetchImpl(u, { method: "POST", headers: { authorization: oauth1("POST", u, {}), "content-type": "application/json" }, body, signal: AbortSignal.timeout(10000) }).catch(() => null);
      out.x = !!(r && r.ok);
    }
    return out;
  }
  return { verify, detail, trades, voteView, vote, winner, candidates, page, announce, voteMessage, nextHour, cotdView, cotdVote, cotdWinner, cotdMessage };
}

/// OAuth 1.0a header for X's API (HMAC-SHA1)
export function oauth1(method, url, params, keys = { ck: env("X_API_KEY"), cs: env("X_API_SECRET"), tk: env("X_ACCESS_TOKEN"), ts: env("X_ACCESS_SECRET") }, nonce = randomBytes(16).toString("hex"), time = Math.floor(Date.now() / 1000)) {
  const pe = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const o = { oauth_consumer_key: keys.ck, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: String(time), oauth_token: keys.tk, oauth_version: "1.0" };
  const all = { ...params, ...o }, base = [method.toUpperCase(), pe(url), pe(Object.keys(all).sort().map((k) => `${pe(k)}=${pe(all[k])}`).join("&"))].join("&");
  o.oauth_signature = createHmac("sha1", `${pe(keys.cs)}&${pe(keys.ts)}`).update(base).digest("base64");
  return "OAuth " + Object.keys(o).sort().map((k) => `${pe(k)}="${pe(o[k])}"`).join(", ");
}
