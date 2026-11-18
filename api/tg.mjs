// api/tg.mjs — the Telegram bot's function.
//   POST          Telegram's webhook (checked by its secret-token header)
//   GET ?setup=1  points the bot's webhook here and sets its command list (run once after setting TG_BOT_TOKEN)
//   GET ?poll=1   posts what's new: launches, graduations, big buys, GTA VI news, the daily countdown (the scheduler calls it)
import { makePad } from "../lib/_pad.mjs";
import { makeExtra } from "../lib/_extra.mjs";
import { makeTg, on, secret } from "../lib/_tg.mjs";
import { blobStore, blobEnabled } from "../lib/_blob.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
let T = null;
const tg = () => { if (T) return T; const pad = makePad({ store: blobStore() }); T = makeTg({ pad, extra: makeExtra({ pad }) }); return T; };
let lastPoll = 0;

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (q.has("poll") && blobEnabled()) await blobStore().put("beat/poll.json", { at: Date.now(), ua: String(req.headers.get("user-agent") || "").slice(0, 60), bot: on() }, {}).catch(() => {});
  if (!on()) return json(503, { error: "TG_BOT_TOKEN isn't set" });
  if (!blobEnabled()) return json(503, { error: "the store isn't connected" });
  try {
    if (q.has("setup")) return json(200, await tg().setup(req.headers.get("host")));
    if (q.has("poll")) { if (Date.now() - lastPoll < 20e3) return json(429, { error: "slow down" }); lastPoll = Date.now(); return json(200, await tg().poll()); }
  } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); }
  return json(400, { error: "use ?setup=1 or ?poll=1" });
}
export async function POST(req) {
  if (!on()) return json(503, { error: "off" });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret()) return json(403, { error: "bad secret" });
  let u; try { u = await req.json(); } catch { return json(400, { error: "bad JSON" }); }
  try { await tg().update(u); } catch {}
  return json(200, { ok: true }); // always 200, so Telegram doesn't retry a message forever
}
