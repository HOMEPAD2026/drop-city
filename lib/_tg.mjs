// lib/_tg.mjs — the Telegram bot: commands in DMs and groups, and posts to the announcement chats.
//
//   Commands  /follow /unfollow /following (+ deep links ?start=w_<mint> · cb_<wallet> · f_<wallet>) /start /help /drop /new /top /main /coin <CA|$TICKER> /check <CA> /vote /fees /launch /gta6 /news /links
//             /watch <CA|$TICKER> /unwatch <…> /watching /cashback <wallet> /invite <wallet> (2026-11-26)
//   Posts     the agent's hourly drop (photo + buttons), anyone's new launch, a coin that graduates, a big buy,
//             GTA VI news (Google News search, new items only), a daily countdown to GTA VI's launch, and launch day itself.
//
// Env: TG_BOT_TOKEN (BotFather), TG_CHAT_ID (one or more chats, comma-separated: the channel / group the bot posts to),
//      TG_WEBHOOK_SECRET (optional; else derived from the token), PAD_SITE (the site's address), GTA6_DATE (YYYY-MM-DD,
//      default 2026-11-19 — Rockstar's announced date), TG_WHALE_SOL (big-buy threshold, default 2), TG_NEWS (0 turns news off).
import { createHash } from "node:crypto";
import * as C from "./_chain.mjs";
import { cfg, hourOf } from "./_pad.mjs";

const env = (k) => String((typeof process !== "undefined" && process.env && process.env[k]) || "").trim();
export const TG = {
  NEWS_EVERY_MS: 30 * 60e3, // read the news at most every 30 min
  NEWS_PER_POLL: 2, // post at most this many news items a poll
  NEWS_MAX_AGE_MS: 36 * 3600e3, // older news isn't posted
  COUNTDOWN_HOUR: 12, // the daily countdown post (UTC hour)
  LAUNCHES_PER_POLL: 5,
  WATCH_STEP: 0.2, // a watched coin speaks up after a 20 % move from its last alert
  WATCH_MAX: 10, // coins a chat can watch
  FOLLOW_MAX: 200, // chats that can follow one creator
};
export const on = () => !!env("TG_BOT_TOKEN");
export const chats = () => env("TG_CHAT_ID").split(",").map((s) => s.trim()).filter(Boolean);
export const secret = () => env("TG_WEBHOOK_SECRET") || createHash("sha256").update("dc-tg\n" + env("TG_BOT_TOKEN")).digest("hex").slice(0, 32);
export const gta6Date = () => { const d = env("GTA6_DATE") || "2026-11-19"; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "2026-11-19"; };
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const usd = (v) => (v == null ? "–" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + v.toFixed(0));
const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");

/// days / hours until GTA VI (launch at local midnight; counted to 00:00 UTC of the day) → text
export function gtaCountdown(now = Date.now()) {
  const d = gta6Date(), at = Date.parse(d + "T00:00:00Z"), left = at - now;
  if (left <= 0 && left > -86400e3) return { live: true, text: `🎮 <b>GTA VI is OUT TODAY</b> (${d}) — PS5 · Xbox Series X|S.` };
  if (left <= 0) return { live: false, text: `🎮 GTA VI launched on ${d}.` };
  const days = Math.floor(left / 86400e3), hrs = Math.floor((left % 86400e3) / 3600e3);
  return { live: false, days, text: `⏳ <b>GTA VI</b> launches <b>${d}</b> — ${days ? `${days} day${days === 1 ? "" : "s"} ` : ""}${hrs} h to go.` };
}

/// Google News RSS → [{ id, title, link, source, at }]
export function parseRss(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const g = (t) => { const r = new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(m[1]); return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };
    const dec = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const title = dec(g("title")), link = dec(g("link")), source = dec(g("source")), at = Date.parse(g("pubDate")) || 0;
    if (title && /^https:\/\//.test(link)) out.push({ id: createHash("sha1").update(link).digest("hex").slice(0, 16), title: title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), ""), link, source, at });
  }
  return out;
}

export function makeTg({ pad, extra = null, cashback = null, now = () => Date.now(), fetchImpl = fetch, site = () => env("PAD_SITE") || (env("VERCEL_PROJECT_PRODUCTION_URL") ? "https://" + env("VERCEL_PROJECT_PRODUCTION_URL") : "") }) {
  const store = pad.store;
  async function api(method, body) {
    const r = await fetchImpl(`https://api.telegram.org/bot${env("TG_BOT_TOKEN")}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    return j && j.ok ? j.result : null;
  }
  const kb = (rows) => ({ inline_keyboard: rows.map((r) => r.filter(Boolean).map(([text, url]) => ({ text, url }))).filter((r) => r.length) });
  /// one message to a chat: text, or a photo with the text as its caption
  async function send(chat, { text, photo, buttons }) {
    const extraP = { parse_mode: "HTML", ...(buttons ? { reply_markup: kb(buttons) } : {}) };
    if (photo) { const r = await api("sendPhoto", { chat_id: chat, photo, caption: text.slice(0, 1020), ...extraP }); if (r) return r; }
    return api("sendMessage", { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true, ...extraP });
  }
  const post = async (m) => { const out = []; for (const c of chats()) out.push(!!(await send(c, m))); return out; };
  const coinButtons = (mint) => [[["Trade on pump.fun", `https://pump.fun/coin/${mint}`], ["Chart", `https://dexscreener.com/solana/${mint}`]], [site() ? ["See it in the city", `${site()}/coin/${mint}`] : null]];

  // ---------------- what's said
  async function coinText(c, head) {
    const k = cfg();
    return `${head ? head + "\n\n" : ""}<b>$${esc(c.symbol)}</b> — ${esc(c.name)}\n${c.description ? esc(c.description.slice(0, 220)) + "\n" : ""}${c.clean === true ? "\n🛡️ <b>Clean launch</b> — only the creator bought in its first block" : ""}\n💰 Market cap <b>${usd(c.mcapUsd)}</b> · ${c.graduated ? "🎓 graduated" : `curve ${(c.progress || 0).toFixed(0)}%`}${c.grade ? ` · safety <b>${esc(c.grade)}</b>` : ""}\n${c.mint === k.main ? "👑 The main coin — its creator fees go 100% to its dev" : `${c.kind === "drop" ? `⏰ The ${esc((c.hour || "").slice(11, 13))}:00 hourly drop (UTC)` : `👤 Creator <code>${esc(short(c.creator))}</code>`}${c.noSplit ? " · no fee split" : ` · fees ${k.split.creator / 100}/${k.split.vault / 100}/${k.split.buyer / 100} locked`}`}\n\nCA: <code>${esc(c.mint)}</code>`;
  }
  const findCoin = (items, q) => { q = String(q || "").trim(); if (!q) return null; const s = q.replace(/^\$/, "").toUpperCase(); return items.find((x) => x.mint === q) || items.filter((x) => String(x.symbol).toUpperCase() === s).sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0))[0] || null; };
  async function reply(cmd, arg, chat = null) {
    const k = cfg(), L = await pad.list().catch(() => ({ items: [] })), items = L.items || [], url = site();
    const links = [[url ? ["🌐 Website", url] : null, url ? ["🏙️ The city", url + "/city"] : null], [url ? ["🚀 Launch a coin", url + "/#launch"] : null, url ? (k.drops ? ["🗳️ Vote the next drop", url + "/#vote"] : ["🔎 Explore coins", url + "/#explore"]) : null]];
    switch (cmd) {
      case "start": case "help":
        return { text: `🌃 <b>${esc(k.name)}</b> — a launchpad on pump.fun · Solana\n\n${k.drops ? "⏰ <b>Every hour</b> the city's agent drops a new coin.\n" : "🤝 The city backs a set of <b>supported coins</b>.\n"}🚀 <b>Any time</b>, anyone launches their own — no limit.\n${k.suffix ? `🔑 Every coin's CA ends in <b>${esc(k.suffix)}</b>.\n` : ""}💸 Every coin launched on the platform: fees locked on chain — ${k.split.creator / 100}% creator · ${k.split.vault / 100}% the vault · ${k.split.buyer / 100}% buys $${esc(k.ticker)}.\n👑 $${esc(k.ticker)}, the main coin, is the dev's own: its creator fees go 100% to the dev.\n\n<b>Commands</b>\n/drop — this hour's drop\n/new — the latest coins\n/top — most wanted\n/main — the main coin\n/coin &lt;CA or $TICKER&gt; — a coin\n/check &lt;CA&gt; — is it from the city?\n/vote — vote the next drop\n/fees — where the fees go\n/launch — launch yours\n/gta6 — GTA VI countdown\n/news — GTA VI news\n/links — official links\n\n/watch &lt;CA or $TICKER&gt; — tell me when it moves 20%\n/watching — what this chat watches\n/cashback &lt;wallet&gt; — your trader cashback\n/invite &lt;wallet&gt; — your invite link`, buttons: links };
      case "drop": {
        if (!k.drops) return { text: "⏰ The hourly drops are off — the city backs its supported coins now. /new shows the latest launches.", buttons: links };
        const s = await pad.slot(), c = s.drop && items.find((x) => x.mint === s.drop.mint), left = Math.max(0, s.next - now());
        const nx = `Next drop in <b>${Math.floor(left / 60e3)} min</b> (${new Date(s.next).toISOString().slice(11, 16)} UTC).`;
        if (c) return { text: await coinText(c, `⏰ <b>THIS HOUR'S DROP</b>`) + `\n\n${nx}`, photo: c.image || undefined, buttons: coinButtons(c.mint) };
        return { text: `⏰ This hour's drop isn't out yet — ${s.state === "dropping" ? "the agent is launching it now." : "any minute."}\n${nx}`, buttons: links };
      }
      case "new": {
        const l = items.slice().sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0)).slice(0, 6);
        return { text: `🆕 <b>Latest coins</b>\n\n${l.map((c) => `${c.kind === "drop" ? "⏰" : "🚀"} <b>$${esc(c.symbol)}</b> — ${usd(c.mcapUsd)} · ${c.graduated ? "🎓" : (c.progress || 0).toFixed(0) + "%"}\n<code>${esc(c.mint)}</code>`).join("\n\n") || "No coins yet."}`, buttons: links };
      }
      case "top": {
        const l = items.slice().sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).slice(0, 7);
        return { text: `🏆 <b>MOST WANTED</b>\n\n${l.map((c, i) => `${i + 1}. <b>$${esc(c.symbol)}</b> — ${usd(c.mcapUsd)}${c.graduated ? " 🎓" : ""}`).join("\n") || "No coins yet."}`, buttons: links };
      }
      case "main": {
        const c = k.main && items.find((x) => x.mint === k.main);
        if (!c) return { text: "The main coin isn't listed yet.", buttons: links };
        return { text: await coinText(c, `👑 <b>THE MAIN COIN</b>`) + `\n\n${k.split.buyer / 100}% of the creator fees of every coin launched on the platform buys it.`, photo: c.image || undefined, buttons: coinButtons(c.mint) };
      }
      case "coin": {
        const c = findCoin(items, arg);
        if (!c) return { text: arg ? "Not found in the city. Try /check &lt;CA&gt;." : "Send /coin followed by a CA or $TICKER." };
        return { text: await coinText(c), photo: c.image || undefined, buttons: coinButtons(c.mint) };
      }
      case "check": {
        if (!arg) return { text: "Send /check followed by a contract address." };
        if (!extra) return { text: "The check isn't available right now." };
        const v = (await extra.verify(arg)).body; if (v.error) return { text: esc(v.error) };
        const y = (b) => (b ? "✅" : "❌");
        return { text: `🔎 <b>CA check</b>\n<code>${esc(v.mint)}</code>\n\n${y(v.suffix)} ${v.suffixWant ? `Ends in ${esc(v.suffixWant)}` : "Address"}\n${y(v.listed)} ${v.listed ? (v.kind === "drop" ? "An hourly drop from the agent" : "Launched in the city") : "Not on the city's list"}${v.symbol ? ` — $${esc(v.symbol)}` : ""}\n${y(v.split)} ${v.split ? "Fee split locked on chain" : v.noSplit ? "Listed without a fee split" : "No locked fee split"}\n${y(v.curve)} ${v.graduated ? "Graduated" : v.curve ? "On its pump.fun curve" : "No pump.fun curve"}\n\n<i>A check reads the chain; it isn't advice.</i>`, buttons: v.listed ? coinButtons(v.mint) : links };
      }
      case "vote": {
        if (!extra) return { text: "Voting isn't available right now." };
        const v = await extra.voteView("");
        return { text: `🗳️ <b>Vote the ${v.hour.slice(11, 13)}:00 drop</b> (UTC)\n\n${v.ideas.map((x, i) => `${i + 1}. <b>${esc(x.name)}</b> ($${esc(x.symbol)}) — ${v.votes[i]} vote${v.votes[i] === 1 ? "" : "s"}`).join("\n")}\n\nOne vote a wallet, signed on the site — no fee.`, buttons: [[url ? ["🗳️ Vote now", url + "/#vote"] : null]] };
      }
      case "fees": return { text: `💸 <b>Where the fees go</b>\n\npump.fun pays every coin's creator a share of its trading fees. For every coin <b>launched on the platform</b> that share is split at launch and <b>locked on chain forever</b>:\n\n• ${k.split.creator / 100}% — the creator\n• ${k.split.vault / 100}% — THE VAULT, the city fund${k.vault ? ` (<code>${esc(short(k.vault))}</code>)` : ""}\n• ${k.split.buyer / 100}% — buys $${esc(k.ticker)}, the main coin\n\nOn the agent's hourly drops the creator share goes on to THE VAULT.\n\n👑 $${esc(k.ticker)} itself is the dev's own coin: no split — its creator fees go 100% to the dev.`, buttons: links };
      case "launch": return { text: `🚀 <b>Launch your coin</b>\n\n1. Open the site and press <b>Launch a coin</b>\n2. Logo, name, ticker, story, links\n3. Your browser finds an address${k.suffix ? ` ending in <b>${esc(k.suffix)}</b>` : ""}\n4. Sign once in your wallet — it's on pump.fun, the fee split locked\n\nAny time · no limit · ~0.03 SOL of network costs.`, buttons: [[url ? ["🚀 Launch now", url + "/#launch"] : null]] };
      case "gta6": case "gta": {
        const cd = gtaCountdown(now()), n = await news(false).catch(() => []);
        return { text: `${cd.text}\n\n${n.slice(0, 3).map((x) => `📰 <a href="${esc(x.link)}">${esc(x.title)}</a> — <i>${esc(x.source)}</i>`).join("\n\n") || ""}`.trim(), buttons: [[["Official newswire", "https://www.rockstargames.com/newswire"]]] };
      }
      case "news": {
        const n = await news(false).catch(() => []);
        return { text: n.length ? `📰 <b>GTA VI — latest</b>\n\n${n.slice(0, 6).map((x) => `• <a href="${esc(x.link)}">${esc(x.title)}</a> — <i>${esc(x.source)}</i>`).join("\n")}` : "No news right now." };
      }
      case "links": return { text: `🔗 <b>Official links</b>${k.main ? `\n\nMain coin CA:\n<code>${esc(k.main)}</code>` : ""}\n\nOnly trust links from this bot and the website.`, buttons: links };
      case "watch": case "unwatch": case "watching": {
        if (chat == null) return { text: "Watching works in a chat with the bot." };
        const W = (await store.get("tg/watch.json").catch(() => null)) || {}, mine = W[chat] || {};
        if (cmd === "watching") { const l = Object.keys(mine).map((m) => items.find((x) => x.mint === m)).filter(Boolean); return { text: l.length ? `★ <b>Watching</b>\n\n${l.map((c) => `<b>$${esc(c.symbol)}</b> — ${usd(c.mcapUsd)} (alert at ±${TG.WATCH_STEP * 100}% from ${usd(mine[c.mint])})`).join("\n")}\n\n/unwatch $TICKER to stop.` : "Nothing watched yet. Send /watch $TICKER or /watch &lt;CA&gt;." }; }
        const c = findCoin(items, arg);
        if (!c) return { text: arg ? "Not found in the city. Send /watch $TICKER or a CA." : `Send /${cmd} followed by a $TICKER or a CA.` };
        if (cmd === "unwatch") { delete mine[c.mint]; W[chat] = mine; await store.put("tg/watch.json", W, {}); return { text: `Stopped watching <b>$${esc(c.symbol)}</b>.` }; }
        if (!mine[c.mint] && Object.keys(mine).length >= TG.WATCH_MAX) return { text: `A chat can watch ${TG.WATCH_MAX} coins — /unwatch one first.` };
        mine[c.mint] = c.mcapUsd || 0; W[chat] = mine; await store.put("tg/watch.json", W, {});
        return { text: `★ Watching <b>$${esc(c.symbol)}</b> at ${usd(c.mcapUsd)} — I'll post here when it moves ${TG.WATCH_STEP * 100}%.`, buttons: coinButtons(c.mint) };
      }
      case "follow": case "unfollow": case "following": {
        if (chat == null) return { text: "Following works in a chat with the bot." };
        const F = (await store.get("tg/follow.json").catch(() => null)) || {}, key = String(chat);
        if (cmd === "following") { const l = Object.keys(F).filter((w) => (F[w] || []).includes(key)); return { text: l.length ? `👤 <b>Following</b>\n\n${l.map((w) => `<code>${esc(w)}</code>`).join("\n")}\n\n/unfollow &lt;wallet&gt; to stop.` : "You don't follow any creator yet." }; }
        const w = String(arg || "").trim(); if (!C.isPubkey(w)) return { text: `Send /${cmd} followed by the creator's Solana wallet.` };
        const list = F[w] || [];
        if (cmd === "unfollow") { F[w] = list.filter((x) => x !== key); if (!F[w].length) delete F[w]; await store.put("tg/follow.json", F, {}); return { text: `Stopped following <code>${esc(short(w))}</code>.` }; }
        if (!list.includes(key)) { if (list.length >= TG.FOLLOW_MAX) return { text: "That creator has too many followers here to add one more." }; list.push(key); F[w] = list; await store.put("tg/follow.json", F, {}); }
        const made = items.filter((x) => x.creator === w).length;
        return { text: `👤 Following <code>${esc(short(w))}</code>${made ? ` (${made} coin${made === 1 ? "" : "s"} launched so far)` : ""} — their next launch is posted here.\n\n/unfollow ${esc(w)} to stop.`, buttons: url ? [[["Their profile", `${url}/w/${w}`]]] : undefined };
      }
      case "cashback": {
        if (!cashback) return { text: "The cashback isn't available right now." };
        const w = String(arg || "").trim(); if (!C.isPubkey(w)) return { text: "Send /cashback followed by your Solana wallet address." };
        const v = await cashback.view(w), S = "$" + esc(k.ticker), f = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : String(Math.round(x || 0)));
        return { text: `💸 <b>Trader cashback</b> — <code>${esc(short(w))}</code>\n\nEarned: <b>${f(v.me.earned)} ${S}</b>\nToday: ${f(v.me.today)} ${S}\nRank: ${v.me.rank ? "#" + v.me.rank + " of " + v.earners : "–"}\nInvited: ${v.me.invited} · bonus ${f(v.me.refEarned)} ${S}\n\n${v.bps / 100}% back on every trade of a coin launched on the platform (and ${S}), paid with the LP rewards.`, buttons: [[site() ? ["Open the dashboard", site() + "/lp"] : null]] };
      }
      case "invite": {
        const w = String(arg || "").trim(); if (!C.isPubkey(w)) return { text: "Send /invite followed by your Solana wallet address — you get your link." };
        const v = cashback ? await cashback.view(w).catch(() => null) : null, link = `${site()}/?ref=${w}`;
        return { text: `🤝 <b>Your invite link</b>\n\n${esc(link)}\n\nEvery trader who links you as their inviter earns you ${v ? v.refBps / 100 : 10}% of their cashback on top — never out of theirs.${v && v.me ? `\n\nInvited so far: <b>${v.me.invited}</b>` : ""}`, buttons: [[["Share on X", `https://x.com/intent/post?text=${encodeURIComponent(`Trade on ${k.name} and get cashback on every trade.\n`)}&url=${encodeURIComponent(link)}`]]] };
      }
      default: return null;
    }
  }

  // ---------------- the webhook
  async function update(u) {
    const m = u && (u.message || u.channel_post);
    if (!m) return { ok: true };
    if (m.new_chat_members && m.new_chat_members.some((x) => !x.is_bot)) { const r = await reply("start"); if (r) await send(m.chat.id, { ...r, text: `👋 Welcome!\n\n${r.text}` }); return { ok: true }; }
    const t = String(m.text || "").trim(); if (!t.startsWith("/")) return { ok: true };
    const [head, ...rest] = t.split(/\s+/), cmd = head.slice(1).split("@")[0].toLowerCase();
    if (cmd === "id") { await send(m.chat.id, { text: `This chat's id: <code>${esc(m.chat.id)}</code>\nPut it in TG_CHAT_ID to post the city's news here.` }); return { ok: true }; }
    const deep = cmd === "start" && /^(w|cb|f)_([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(rest[0] || "");
    const r = deep ? await reply(deep[1] === "w" ? "watch" : deep[1] === "cb" ? "cashback" : "follow", deep[2], m.chat.id) : await reply(cmd, rest.join(" ").slice(0, 100), m.chat.id);
    if (r) await send(m.chat.id, r);
    return { ok: true };
  }
  async function setup(host) {
    const url = `https://${host}/api/tg`;
    const hook = await api("setWebhook", { url, secret_token: secret(), allowed_updates: ["message", "channel_post"] });
    const cmds = await api("setMyCommands", { commands: [["drop", "This hour's drop"], ["new", "The latest coins"], ["top", "Most wanted"], ["main", "The main coin"], ["coin", "A coin by CA or $TICKER"], ["check", "Is a CA from the city?"], ["vote", "Vote the next drop"], ["fees", "Where the fees go"], ["launch", "Launch your coin"], ["gta6", "GTA VI countdown + news"], ["news", "GTA VI news"], ["links", "Official links"], ["watch", "Alert me when a coin moves 20%"], ["unwatch", "Stop watching a coin"], ["watching", "What this chat watches"], ["cashback", "Your trader cashback"], ["invite", "Your invite link"], ["follow", "Follow a creator's next launches"], ["following", "Creators you follow"], ["help", "What this bot does"]].map(([command, description]) => ({ command, description })) });
    const me = await api("getMe", {});
    return { webhook: !!hook, commands: !!cmds, bot: me ? "@" + me.username : null, url, chats: chats().length };
  }

  // ---------------- news (Google News search; seen ids kept)
  let NEWS = { at: 0, items: [] };
  async function news(fresh) {
    if (!fresh && NEWS.items.length && now() - NEWS.at < 10 * 60e3) return NEWS.items;
    const q = encodeURIComponent('"GTA 6" OR "GTA VI" OR "Grand Theft Auto VI"');
    const r = await fetchImpl(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (news reader)" } });
    const items = parseRss(await r.text()).sort((a, b) => b.at - a.at).slice(0, 30);
    NEWS = { at: now(), items }; return items;
  }

  // ---------------- the poll (the scheduler): new launches, graduations, big buys, news, the countdown
  async function poll() {
    if (!on() || !chats().length) return { off: true };
    const st = (await store.get("tg/state.json").catch(() => null)) || { launched: {}, made: {}, sigs: [], news: [], newsAt: 0, countdown: "", first: true };
    const out = { launches: 0, grads: 0, whales: 0, news: 0, countdown: false };
    const L = await pad.list().catch(() => ({ items: [] })), items = L.items || [];
    // launches by anyone (the agent's own drop is posted when it drops) — the first poll only learns what exists
    for (const c of items) {
      if (st.launched[c.mint]) continue; st.launched[c.mint] = 1;
      if (st.first || c.kind === "drop" || out.launches >= TG.LAUNCHES_PER_POLL || now() / 1000 - (c.launchedAt || 0) > 3 * 3600) continue;
      await post({ text: await coinText(c, `🚀 <b>NEW LAUNCH IN THE CITY</b>`), photo: c.image || undefined, buttons: coinButtons(c.mint) }); out.launches++;
      if (extra && extra.announce) await extra.announce({ coin: c, hour: "", site: site() }).catch(() => null);
      const fol = c.creator ? ((await store.get("tg/follow.json").catch(() => null)) || {})[c.creator] || [] : [];
      for (const ch of fol.slice(0, TG.FOLLOW_MAX)) if (!chats().map(String).includes(String(ch))) await send(ch, { text: await coinText(c, `👤 <b>A CREATOR YOU FOLLOW JUST LAUNCHED</b>`), photo: c.image || undefined, buttons: coinButtons(c.mint) }).catch(() => null);
    }
    // yesterday's coin of the day, once a day (the first poll only learns the day)
    const yday = new Date(now() - 86400e3).toISOString().slice(0, 10);
    if (extra && extra.cotdWinner && st.cotd !== yday) { const was = st.cotd; st.cotd = yday;
      const w = was ? await extra.cotdWinner(yday).catch(() => null) : null, c = w && items.find((x) => x.mint === w.mint);
      if (c && !st.first) { await post({ text: await coinText(c, `👑 <b>COIN OF THE DAY</b> — picked by ${w.votes} vote${w.votes === 1 ? "" : "s"}`), photo: c.image || undefined, buttons: coinButtons(c.mint) }); out.cotd = true; } }
    for (const c of items) {
      if (!c.graduated || st.made[c.mint]) continue; st.made[c.mint] = 1;
      if (st.first) continue;
      await post({ text: await coinText(c, `🎓 <b>$${esc(c.symbol)} GRADUATED</b> — it made it off the curve!`), photo: c.image || undefined, buttons: coinButtons(c.mint) }); out.grads++;
    }
    // watched coins (/watch): a 20 % move from the last alert speaks up in that chat
    const W = (await store.get("tg/watch.json").catch(() => null)) || {}; let wDirty = false; out.watch = 0;
    for (const [chat, list] of Object.entries(W)) for (const [m, ref] of Object.entries(list || {})) {
      const c = items.find((x) => x.mint === m); if (!c || !c.mcapUsd) continue;
      if (!ref) { list[m] = c.mcapUsd; wDirty = true; continue; }
      const ch = c.mcapUsd / ref - 1; if (Math.abs(ch) < TG.WATCH_STEP) continue;
      await send(chat, { text: `★ <b>$${esc(c.symbol)}</b> ${ch > 0 ? "▲" : "▼"} ${Math.abs(ch * 100).toFixed(0)}% — now ${usd(c.mcapUsd)}`, buttons: coinButtons(c.mint) }).catch(() => null);
      list[m] = c.mcapUsd; wDirty = true; out.watch++;
    }
    if (wDirty) await store.put("tg/watch.json", W, {});
    // big buys
    if (extra) {
      const T = await extra.trades().catch(() => null), whale = Number(env("TG_WHALE_SOL") || 2);
      for (const x of ((T && T.items) || []).slice(0, 20)) {
        if (st.sigs.includes(x.sig)) continue; st.sigs.unshift(x.sig);
        if (st.first || x.side !== "buy" || x.sol < whale || now() - x.at > 30 * 60e3) continue;
        await post({ text: `🐋 <b>BIG BUY</b> — ${x.sol.toFixed(2)} SOL${x.usd ? ` (~$${x.usd.toFixed(0)})` : ""} into <b>$${esc(x.symbol)}</b>\n<code>${esc(x.mint)}</code>`, buttons: coinButtons(x.mint) }); out.whales++;
      }
      st.sigs = st.sigs.slice(0, 200);
    }
    // GTA VI news
    if (env("TG_NEWS") !== "0" && now() - (st.newsAt || 0) > TG.NEWS_EVERY_MS) {
      st.newsAt = now();
      const n = await news(true).catch(() => []);
      for (const x of n) {
        if (st.news.includes(x.id)) continue; st.news.unshift(x.id);
        if (st.first || out.news >= TG.NEWS_PER_POLL || now() - x.at > TG.NEWS_MAX_AGE_MS) continue;
        await post({ text: `📰 <b>GTA VI NEWS</b>\n\n<a href="${esc(x.link)}">${esc(x.title)}</a>\n<i>${esc(x.source)}</i>\n\n${gtaCountdown(now()).text}` }); out.news++;
      }
      st.news = st.news.slice(0, 300);
    }
    // the daily countdown (and launch day)
    const day = new Date(now()).toISOString().slice(0, 10), cd = gtaCountdown(now());
    if (st.countdown !== day && new Date(now()).getUTCHours() >= TG.COUNTDOWN_HOUR && (cd.live || cd.days != null)) {
      st.countdown = day;
      if (!st.first) { const k = cfg(); await post({ text: `${cd.text}\n\nMeanwhile in the city: ${k.drops ? "a new coin drops every hour" : "launch your own any time, 0.3% cashback on every trade"}${k.suffix ? `, every CA ends in <b>${esc(k.suffix)}</b>` : ""}.`, buttons: [[site() ? ["🏙️ Enter the city", site()] : null], ["follow", "Follow a creator's next launches"], ["following", "Creators you follow"]] }); out.countdown = true; }
    }
    st.first = false;
    await store.put("tg/state.json", st, {});
    return out;
  }

  /// the agent's hourly drop
  async function announceDrop({ coin, hour }) {
    if (!on() || !chats().length) return null;
    const k = cfg();
    return post({ text: `⏰ <b>THE ${hour.slice(11, 13)}:00 DROP</b> (UTC)\n\n<b>$${esc(coin.symbol)}</b> — ${esc(coin.name)}\n${coin.description ? esc(coin.description.slice(0, 200)) + "\n" : ""}\n🔒 Fees ${k.split.creator / 100}/${k.split.vault / 100}/${k.split.buyer / 100} locked · the agent's share goes to THE VAULT\n\nCA: <code>${esc(coin.mint)}</code>`, photo: coin.image || undefined, buttons: coinButtons(coin.mint) });
  }
  return { update, setup, poll, announceDrop, reply, news, send };
}
