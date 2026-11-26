// lib/_creator.mjs — the creator's own coin page (round L, the owner 2026-11-26): the wallet that launched a coin can set
// its links (X / Telegram / website), pin a note of up to 140 characters and give it a big link-card picture (the poster,
// drawn in their browser from the logo), all with ONE signed message — nothing on chain. Kept in creator/<mint>.json and
// shown labelled "set by the creator on GTAFUN"; only the city's listing changes, never the coin's metadata.
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHash } from "node:crypto";
import * as C from "./_chain.mjs";

export const CREATOR = { NOTE: 140, POSTER: 450_000, AGE: 10 * 60e3 };
export const pageMessage = (b) => `GTAFUN coin page\nWallet: ${b.wallet}\nCoin: ${b.mint}\nX: ${b.twitter || ""}\nTelegram: ${b.telegram || ""}\nWebsite: ${b.website || ""}\nNote: ${b.note || ""}\nPoster: ${b.posterSha || "none"}\nIssued: ${b.issued}`;
const httpsOk = (v) => !v || /^https:\/\/[^\s"'<>]{3,280}$/i.test(v);

export function makeCreator({ store, list, now = () => Date.now() }) {
  async function save(b) {
    const wallet = String(b.wallet || ""), mint = String(b.mint || "");
    if (!C.isPubkey(wallet) || !C.isPubkey(mint)) return { status: 400, body: { error: "bad request" } };
    const f = { twitter: String(b.twitter || "").trim(), telegram: String(b.telegram || "").trim(), website: String(b.website || "").trim(), note: String(b.note || "").replace(/[\u0000-\u001f]/g, " ").trim() };
    if (![f.twitter, f.telegram, f.website].every(httpsOk)) return { status: 400, body: { error: "links must start with https://" } };
    if (f.note.length > CREATOR.NOTE) return { status: 400, body: { error: `the note is ${CREATOR.NOTE} characters at most` } };
    const it = Date.parse(String(b.issued || "")); if (!(it > 0) || Math.abs(now() - it) > CREATOR.AGE) return { status: 400, body: { error: "the signature is too old — sign again" } };
    // the poster: a WebP / PNG / JPEG data URL, its hash inside the signed message
    let poster = null, posterSha = "";
    if (b.poster) {
      const m = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.poster)); if (!m) return { status: 400, body: { error: "the picture must be WebP, PNG or JPEG" } };
      poster = { bytes: Buffer.from(m[2], "base64"), type: m[1] }; if (poster.bytes.length > CREATOR.POSTER) return { status: 413, body: { error: "the picture is too large" } };
      posterSha = createHash("sha256").update(poster.bytes).digest("hex");
    }
    let ok = false; try { ok = ed25519.verify(C.b58dec(String(b.sig || "")), new TextEncoder().encode(pageMessage({ ...f, wallet, mint, issued: b.issued, posterSha })), C.b58dec(wallet)); } catch {}
    if (!ok) return { status: 403, body: { error: "the signature doesn't match the wallet" } };
    const L = await list().catch(() => ({ items: [] })), c = (L.items || []).find((x) => x.mint === mint);
    if (!c) return { status: 404, body: { error: "that coin isn't in the city" } };
    const lead = c.crew && c.crew[0] && c.crew[0].address;
    if (c.kind === "partner" || (wallet !== c.creator && wallet !== lead)) return { status: 403, body: { error: "only the wallet that launched this coin can change its page" } };
    const was = (await store.get(`creator/${mint}.json`).catch(() => null)) || {};
    let posterUrl = was.poster || "";
    if (poster) { const ext = poster.type === "jpeg" ? "jpg" : poster.type, key = `posters/${posterSha}.${ext}`;
      const r = await store.put(key, poster.bytes, { create: true, public: true, type: "image/" + poster.type }).catch((e) => (e && e.exists ? null : Promise.reject(e)));
      posterUrl = (r && r.url) || (store.url ? await store.url(key) : ""); }
    const doc = { ...f, poster: posterUrl, by: wallet, at: now() };
    await store.put(`creator/${mint}.json`, doc, {});
    const all = (await store.get("creator.json").catch(() => null)) || {}; all[mint] = doc; await store.put("creator.json", all, {});
    return { status: 200, body: { ok: true, page: doc } };
  }
  return { save };
}
