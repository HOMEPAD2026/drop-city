// api/pad.mjs — the launchpad's one function.
//   GET  ?cfg           the public config (name, ticker, suffix, split, wallets, open)
//   GET  ?list          every coin launched here, live (price, market cap, curve %)
//   GET  ?slot          this hour's drop: dropped / dropping / waiting, and when the next hour opens
//   GET  ?tick          wakes the agent: drops this hour's coin if it hasn't yet (safe to call any number of times)
//   GET  ?agent         the agent: its wallet, this hour, today's drops and transfers to THE VAULT
//   POST ?solrpc        the browser's Solana RPC relay (only the calls a launch makes)
//   POST {action}       register · meta · logo
import { makePad, publicCfg } from "../lib/_pad.mjs";
import { proxy } from "../lib/_chain.mjs";
import { blobStore, blobEnabled } from "../lib/_blob.mjs";
import { makeAgent } from "../lib/_agent.mjs";

const json = (status, body, cache = "no-store") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "access-control-allow-origin": "*" } });
let PAD = null;
const pad = () => (PAD = PAD || makePad({ store: blobStore() }));
let AG = null;
const agent = () => (AG = AG || makeAgent({ pad: pad() }));
const hits = new Map();
function limited(key, n, ms) { const t = Date.now(), a = (hits.get(key) || []).filter((x) => t - x < ms); a.push(t); hits.set(key, a); if (hits.size > 5000) hits.clear(); return a.length > n; }
const ipOf = (req) => String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (q.has("cfg")) return json(200, publicCfg(), "public, max-age=30");
  if (!blobEnabled()) return json(503, { error: "the store isn't connected yet" });
  try {
    if (q.has("list")) return json(200, await pad().list(), "public, max-age=10, s-maxage=20");
    if (q.has("slot")) return json(200, { ...(await pad().slot()), cfg: publicCfg() }, "no-store");
    if (q.has("agent")) return json(200, await agent().status(), "public, max-age=10");
    if (q.has("tick")) {
      if (limited("tick:" + ipOf(req), 6, 60e3)) return json(429, { error: "slow down" });
      return json(200, await agent().tick(), "no-store");
    }
  } catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); }
  return json(400, { error: "use ?cfg, ?list, ?slot, ?agent or ?tick" });
}
export async function POST(req) {
  const ip = ipOf(req);
  if (new URL(req.url).searchParams.has("solrpc")) {
    if (limited("rpc:" + ip, 240, 60e3)) return json(429, { jsonrpc: "2.0", id: null, error: { code: 429, message: "slow down" } });
    let q; try { q = await req.json(); } catch { return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "bad JSON" } }); }
    return json(200, await proxy(q));
  }
  if (!blobEnabled()) return json(503, { error: "the store isn't connected yet" });
  let b; try { b = (await req.json()) || {}; } catch { return json(400, { error: "bad JSON" }); }
  const lim = { register: 30, meta: 20, logo: 20 }[b.action];
  if (!lim) return json(400, { error: "unknown action" });
  if (limited(b.action + ":" + ip, lim, 60e3)) return json(429, { error: "slow down" });
  try { const r = await pad()[b.action](b); return json(r.status, r.body); }
  catch (e) { return json(502, { error: String((e && e.message) || e).slice(0, 160) }); }
}
