// The Telegram bot: commands, the webhook's parsing, the news feed, the countdown, and the poll's posts (no network).
import { ed25519 } from "@noble/curves/ed25519.js";
import * as C from "../lib/_chain.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kp = () => C.b58enc(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
process.env.PAD_VAULT = kp(); process.env.PAD_BUYER = kp(); process.env.PAD_SUFFIX = ""; process.env.TG_BOT_TOKEN = "123:abc"; process.env.TG_CHAT_ID = "-100777"; process.env.PAD_SITE = "https://site.test";
const { makeTg, parseRss, gtaCountdown, secret } = await import("../lib/_tg.mjs");

// ---------------- the countdown and the news feed
process.env.GTA6_DATE = "2026-11-19";
ok(/1 day 0 h|1 day 1 h|0 h|day/.test(gtaCountdown(Date.UTC(2026, 10, 18, 0)).text) && gtaCountdown(Date.UTC(2026, 10, 18, 0)).days === 1, "a day to go the day before");
ok(gtaCountdown(Date.UTC(2026, 10, 19, 9)).live, "launch day says it's out today");
ok(!gtaCountdown(Date.UTC(2026, 10, 25)).live && /launched/.test(gtaCountdown(Date.UTC(2026, 10, 25)).text), "after launch day it says it launched");
const rss = `<rss><channel><item><title>GTA 6 preload is live - IGN</title><link>https://news.google.com/a1</link><pubDate>Wed, 18 Nov 2026 08:00:00 GMT</pubDate><source url="https://ign.com">IGN</source></item><item><title><![CDATA[Rockstar &amp; GTA VI: what's new]]></title><link>https://news.google.com/a2</link><pubDate>Wed, 18 Nov 2026 06:00:00 GMT</pubDate><source>Polygon</source></item><item><title>bad</title><link>javascript:x</link></item></channel></rss>`;
const n = parseRss(rss);
ok(n.length === 2 && n[0].title === "GTA 6 preload is live" && n[0].source === "IGN" && n[1].title === "Rockstar & GTA VI: what's new", "the feed's items: title without its source, decoded, https only");

// ---------------- a fake city
const docs = new Map(); const store = { get: async (k) => (docs.has(k) ? JSON.parse(JSON.stringify(docs.get(k))) : null), put: async (k, v) => { docs.set(k, JSON.parse(JSON.stringify(v))); return {}; }, list: async (p) => [...docs.keys()].filter((k) => k.startsWith(p)), url: async () => "" };
let clock = Date.UTC(2026, 10, 18, 9, 30);
const coin = (sym, extra = {}) => ({ mint: kp(), symbol: sym, name: sym + " Name", kind: "user", creator: kp(), launchedAt: clock / 1000 - 600, mcapUsd: 5000, progress: 10, image: "https://img.test/" + sym + ".webp", ...extra });
let items = [coin("OWL", { kind: "drop", hour: "2026-11-18T09", mcapUsd: 9000 }), coin("FOX", { mcapUsd: 20000 })];
const pad = { store, list: async () => ({ items }), slot: async () => ({ hour: "2026-11-18T09", next: Date.UTC(2026, 10, 18, 10), state: "dropped", drop: { mint: items[0].mint, symbol: "OWL" } }) };
const sent = [];
const fetchImpl = async (url, o) => {
  if (url.includes("news.google.com")) return { text: async () => rss };
  const body = JSON.parse(o.body); sent.push({ method: url.split("/").pop(), body });
  return { json: async () => ({ ok: true, result: { username: "citybot", message_id: 1 } }) };
};
const T = makeTg({ pad, now: () => clock, fetchImpl });

// ---------------- commands
{ const off = await T.reply("help"), od = await T.reply("drop"); ok(/supported coins/.test(off.text) && !/Every hour/.test(off.text) && /drops are off/.test(od.text), "drops off: /help speaks of the supported coins, /drop says the drops are off"); }
process.env.PAD_DROPS = "1"; // the rest: the hourly drops on
const h = await T.reply("help"); ok(/Every hour/.test(h.text) && h.buttons.flat().some((b) => b && b[1] === "https://site.test/#launch"), "/help explains and links");
const d = await T.reply("drop"); ok(/THIS HOUR'S DROP/.test(d.text) && d.photo === items[0].image && /Next drop in <b>30 min/.test(d.text), "/drop shows the hour's coin and the next one's time");
const top = await T.reply("top"); ok(top.text.indexOf("$FOX") < top.text.indexOf("$OWL"), "/top sorts by market cap");
ok(/\$FOX/.test((await T.reply("coin", "$fox")).text) && /\$OWL/.test((await T.reply("coin", items[0].mint)).text), "/coin finds by ticker or CA");
ok(/Not found/.test((await T.reply("coin", "$NOPE")).text), "/coin says when it isn't found");
const g = await T.reply("gta6"); ok(/GTA VI/.test(g.text) && /preload is live/.test(g.text), "/gta6: countdown + headlines");
ok((await T.reply("unknown")) === null, "unknown commands stay quiet");

// ---------------- the webhook
sent.length = 0;
await T.update({ message: { chat: { id: 42 }, text: "/coin@citybot $OWL" } });
ok(sent.length === 1 && sent[0].method === "sendPhoto" && sent[0].body.chat_id === 42 && /\$OWL/.test(sent[0].body.caption) && sent[0].body.parse_mode === "HTML", "a group command with the bot's name answers with the coin's photo");
sent.length = 0; await T.update({ message: { chat: { id: 42 }, text: "gm everyone" } }); ok(sent.length === 0, "ordinary chat is ignored");
await T.update({ message: { chat: { id: 42 }, new_chat_members: [{ is_bot: false }] } }); ok(sent.length === 1 && /Welcome/.test(sent[0].body.text), "new members get a welcome");
ok(secret().length === 32, "the webhook secret is derived from the token");

// ---------------- the poll: the first run only learns, later runs post what's new
sent.length = 0;
const p1 = await T.poll(); ok(p1.launches === 0 && sent.length === 0, "the first poll posts nothing (it learns what exists)");
items = [...items, coin("CAT"), { ...items[1], graduated: true }].filter((x, i, a) => a.findIndex((y) => y.mint === x.mint) === i || x.graduated);
items = items.filter((x) => !(x.symbol === "FOX" && !x.graduated));
clock = Date.UTC(2026, 10, 18, 12, 5);
const p2 = await T.poll();
ok(p2.launches === 1 && sent.some((s) => /NEW LAUNCH/.test(s.body.caption || s.body.text || "") && /\$CAT/.test(s.body.caption || "")), "a new launch is posted to the chat");
ok(p2.grads === 1 && sent.some((s) => /GRADUATED/.test(s.body.caption || "")), "a graduation is posted");
ok(sent.every((s) => s.body.chat_id === "-100777"), "posts go to TG_CHAT_ID");
ok(p2.countdown, "the daily countdown posts once after 12:00 UTC");
sent.length = 0; clock += 31 * 60e3; const p3 = await T.poll(); ok(p3.launches === 0 && !p3.countdown && sent.length === 0, "nothing twice");
const a = await T.announceDrop({ coin: { mint: items[0].mint, symbol: "OWL", name: "Neon Owl", description: "hoot", image: "https://img.test/o.webp" }, hour: "2026-11-18T10" });
ok(a.length === 1 && sent.some((s) => /THE 10:00 DROP/.test(s.body.caption || "")), "the agent's drop is announced with its photo");
// /watch, /watching, /unwatch, and the poll's alert after a 20 % move
{ const CH = "555"; const c0 = items.find((x) => x.symbol === "CAT") || items[0];
  const w1 = await T.reply("watch", "$" + c0.symbol, CH); ok(/Watching/.test(w1.text) && docs.get("tg/watch.json")[CH][c0.mint] === c0.mcapUsd, "/watch remembers the coin and its market cap for this chat");
  ok(/Watching/.test((await T.reply("watching", "", CH)).text), "/watching lists it");
  ok(/Send \/watch/.test((await T.reply("watch", "", CH)).text) && /chat with the bot/.test((await T.reply("watch", "$X")).text), "/watch needs a coin and a chat");
  sent.length = 0; c0.mcapUsd = Math.round(c0.mcapUsd * 1.25); clock += 60e3; const pw = await T.poll();
  ok(pw.watch === 1 && sent.some((x) => x.body.chat_id === CH && /▲ 25%/.test(x.body.text || "")), "a 25 % move alerts that chat");
  sent.length = 0; clock += 60e3; const pw2 = await T.poll(); ok(pw2.watch === 0, "and only once until it moves again");
  ok(/Stopped/.test((await T.reply("unwatch", "$" + c0.symbol, CH)).text) && !docs.get("tg/watch.json")[CH][c0.mint], "/unwatch stops it"); }
// /cashback and /invite
{ const W = kp(), cb = { view: async () => ({ bps: 30, refBps: 1000, earners: 9, me: { earned: 1500, today: 200, rank: 2, invited: 3, refEarned: 90 } }) };
  const T2 = makeTg({ pad, now: () => clock, fetchImpl, cashback: cb });
  const r = await T2.reply("cashback", W); ok(/1\.5K/.test(r.text) && /#2 of 9/.test(r.text) && /Invited: 3/.test(r.text), "/cashback shows the wallet's cashback, rank and invites");
  ok(/Send \/cashback/.test((await T2.reply("cashback", "nope")).text), "/cashback needs a wallet");
  const i = await T2.reply("invite", W); ok(i.text.includes("/?ref=" + W) && /10%/.test(i.text), "/invite gives the wallet's link"); }
console.log(`tg: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
