// lib/_blob.mjs — the store on Vercel Blob (env BLOB_READ_WRITE_TOKEN, set when a Blob store is connected to the project).
// JSON documents and images by path; `create: true` refuses to overwrite (that's how one sponsor gets an hour).
import { put, list as blobList, head } from "@vercel/blob";

export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export function blobStore() {
  const urlOf = async (key) => { try { return (await head(key)).url; } catch { return null; } };
  return {
    async get(key) {
      const u = await urlOf(key); if (!u) return null;
      const r = await fetch(u + (u.includes("?") ? "&" : "?") + "v=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return null;
      return r.json().catch(() => null);
    },
    async put(key, value, o = {}) {
      const isBytes = value instanceof Uint8Array;
      try {
        const r = await put(key, isBytes ? Buffer.from(value) : JSON.stringify(value), {
          access: "public", addRandomSuffix: false, allowOverwrite: !o.create,
          contentType: o.type || (isBytes ? "application/octet-stream" : "application/json"),
          cacheControlMaxAge: o.create ? 31536000 : 60,
        });
        return { url: r.url };
      } catch (e) {
        if (o.create && /exist/i.test(String((e && e.message) || e))) { const err = new Error("exists"); err.exists = true; err.conflict = true; throw err; }
        throw e;
      }
    },
    async list(prefix) {
      const out = []; let cursor;
      do { const r = await blobList({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map((b) => b.pathname)); cursor = r.hasMore ? r.cursor : null; } while (cursor);
      return out;
    },
    url: urlOf,
  };
}
