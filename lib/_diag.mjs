// lib/_diag.mjs — how the city runs on real devices: each browser sends, about once a minute, its frame rates (the
// last minute's average and worst), whether it switched to light graphics, its kind of device (phone / computer, the GPU
// as WebGL names it, the screen) and any script errors. Kept per UTC day in diag/<day>.json — no IPs, no wallets.
// GET ?diag shows today (and yesterday): reports, devices by frame rate, the slowest GPUs, the latest errors.
export const DIAG = { FLUSH_MS: 30e3, ERRS: 60, DEVS: 80, BUCKETS: [15, 24, 30, 45] };
const day = (t) => new Date(t).toISOString().slice(0, 10);
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").slice(0, n);
/// a browser's report → a clean one (or null)
export function reportOf(b) {
  const fps = Number(b.fps), min = Number(b.min);
  if (!Number.isFinite(fps) || fps < 0 || fps > 300) return null;
  return { sid: clean(b.sid, 16).replace(/[^A-Za-z0-9]/g, ""), fps: Math.round(fps * 10) / 10, min: Number.isFinite(min) ? Math.max(0, Math.min(300, Math.round(min))) : null,
    low: !!b.low, auto: !!b.auto, phone: !!b.phone, gpu: clean(b.gpu, 60), scr: clean(b.scr, 20), mode: b.mode === "street" ? "street" : "map",
    errs: (Array.isArray(b.errs) ? b.errs : []).slice(0, 5).map((e) => clean(e, 200)).filter(Boolean) };
}
export const bucketOf = (fps) => DIAG.BUCKETS.findIndex((x) => fps < x) === -1 ? DIAG.BUCKETS.length : DIAG.BUCKETS.findIndex((x) => fps < x);
export function makeDiag({ store, now = () => Date.now() }) {
  let pend = null, flushAt = 0;
  const empty = (d) => ({ day: d, n: 0, sids: [], phone: 0, low: 0, autoLow: 0, buckets: [0, 0, 0, 0, 0], dev: {}, errs: [] });
  function add(doc, r, ua) {
    doc.n++; if (r.sid && !doc.sids.includes(r.sid) && doc.sids.length < 5000) doc.sids.push(r.sid);
    if (r.phone) doc.phone++; if (r.low) doc.low++; if (r.auto) doc.autoLow++;
    doc.buckets[bucketOf(r.fps)]++;
    const k = `${r.phone ? "phone" : "computer"} · ${r.gpu || "unknown GPU"}`, d = doc.dev[k] || (doc.dev[k] = { n: 0, fps: 0, min: 999, low: 0 });
    d.n++; d.fps += r.fps; if (r.min != null) d.min = Math.min(d.min, r.min); if (r.low) d.low++;
    const keys = Object.keys(doc.dev); if (keys.length > DIAG.DEVS) { keys.sort((a, b) => doc.dev[a].n - doc.dev[b].n); delete doc.dev[keys[0]]; }
    for (const m of r.errs) doc.errs.unshift({ m, at: now(), ua: clean(ua, 80), mode: r.mode });
    doc.errs = doc.errs.slice(0, DIAG.ERRS);
  }
  function merge(a, b) { // b (this instance's pending) into a (the stored day)
    a.n += b.n; for (const s of b.sids) if (!a.sids.includes(s) && a.sids.length < 5000) a.sids.push(s);
    a.phone += b.phone; a.low += b.low; a.autoLow += b.autoLow; b.buckets.forEach((x, i) => (a.buckets[i] += x));
    for (const [k, d] of Object.entries(b.dev)) { const t = a.dev[k] || (a.dev[k] = { n: 0, fps: 0, min: 999, low: 0 }); t.n += d.n; t.fps += d.fps; t.min = Math.min(t.min, d.min); t.low += d.low; }
    a.errs = [...b.errs, ...a.errs].slice(0, DIAG.ERRS); return a;
  }
  async function flush(force) {
    if (!pend || (!force && now() - flushAt < DIAG.FLUSH_MS)) return;
    const p = pend; pend = null; flushAt = now();
    const key = `diag/${p.day}.json`, doc = (await store.get(key).catch(() => null)) || empty(p.day);
    await store.put(key, merge(doc, p)).catch(() => {});
  }
  return {
    async report(b, ua = "") {
      const r = reportOf(b); if (!r) return { status: 400, body: { error: "bad report" } };
      const d = day(now()); if (pend && pend.day !== d) await flush(true);
      if (!pend) pend = empty(d);
      add(pend, r, ua); await flush(false);
      return { status: 200, body: { ok: true } };
    },
    async view() {
      const out = {};
      for (const d of [day(now()), day(now() - 864e5)]) {
        const doc = (await store.get(`diag/${d}.json`).catch(() => null)) || empty(d);
        if (pend && pend.day === d) merge(doc, JSON.parse(JSON.stringify(pend)));
        const devs = Object.entries(doc.dev).map(([k, x]) => ({ device: k, reports: x.n, fps: Math.round((x.fps / x.n) * 10) / 10, worst: x.min === 999 ? null : x.min, lowShare: Math.round((x.low / x.n) * 100) }));
        out[d] = { reports: doc.n, sessions: doc.sids.length, phoneShare: doc.n ? Math.round((doc.phone / doc.n) * 100) : 0, lightGraphics: doc.low, switchedAuto: doc.autoLow,
          fps: Object.fromEntries(["<15", "15-24", "24-30", "30-45", "45+"].map((k, i) => [k, doc.buckets[i]])),
          slowest: devs.filter((x) => x.reports >= 2).sort((a, b) => a.fps - b.fps).slice(0, 10), busiest: devs.sort((a, b) => b.reports - a.reports).slice(0, 10), errors: doc.errs.slice(0, 20) };
      }
      return out;
    },
    flush,
  };
}
