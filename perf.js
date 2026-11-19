// perf.js — keeps the city smooth and tells us how it runs. It counts frames in two-second windows; graphics on Auto
// switch to light (city.setLow: no bloom, fewer pixels and cars) when a device stays slow, once, with a note. Every
// minute or so it sends the frame rate, the device kind and any script errors to the server (?diag) — nothing about you.
import { post } from "/common.js";
const PHONE = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
export const SLOW = PHONE ? 28 : 24; // fps under this for a few windows → light graphics (Auto)
export function gpuName() {
  try { const c = document.createElement("canvas"), g = c.getContext("webgl"); const x = g && g.getExtension("WEBGL_debug_renderer_info");
    return cleanGpu((x && g.getParameter(x.UNMASKED_RENDERER_WEBGL)) || ""); } catch { return ""; }
}
/// "ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)" → "Adreno (TM) 650"; "Mali-G57 MC2" stays
export function cleanGpu(s) {
  s = String(s || ""); const m = /^ANGLE \((.*)\)$/.exec(s);
  if (m) { const parts = m[1].split(/,\s*(?![^()]*\))/); s = parts.length > 1 ? parts[1] : parts[0]; }
  return s.replace(/\s*\(0x[0-9a-f]+\)/gi, "").replace(/\s*Direct3D.*$/i, "").trim().slice(0, 60);
}
/// the median of the window rates
export const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export function makePerf(city, { mode = () => "map", toast = () => {} } = {}) {
  let pref = "auto"; try { pref = localStorage.getItem("dc.gfx") || "auto"; } catch { /* */ }
  const sid = Math.random().toString(36).slice(2, 12), gpu = gpuName(), errs = [];
  let frames = 0, t0 = performance.now(), wins = [], minute = [], autoDone = false, switchedAuto = false, lastSend = 0, since = performance.now();
  addEventListener("error", (e) => { if (errs.length < 5) errs.push(`${e.message || "error"} @ ${String(e.filename || "").split("/").pop()}:${e.lineno || 0}`); });
  addEventListener("unhandledrejection", (e) => { if (errs.length < 5) errs.push("promise: " + String((e.reason && e.reason.message) || e.reason || "").slice(0, 160)); });
  const apply = () => city.setLow(pref === "low");
  if (pref !== "auto") apply();
  const tick = (t) => {
    frames++;
    if (t - t0 >= 2000) {
      const fps = (frames * 1000) / (t - t0); frames = 0; t0 = t;
      if (!document.hidden) { wins.push(fps); minute.push(fps); if (wins.length > 4) wins.shift(); }
      // Auto: a slow device after the first few seconds goes light, once
      if (pref === "auto" && !autoDone && !city.low && wins.length >= 4 && performance.now() - since > 8000 && median(wins) < SLOW) {
        autoDone = switchedAuto = true; city.setLow(true); toast("Switched to light graphics for a smoother city — change it in your street name window.");
      }
      if (minute.length && (t - lastSend > 60e3 || (!lastSend && t - since > 20e3))) send(t);
    }
    requestAnimationFrame(tick);
  };
  document.addEventListener("visibilitychange", () => { frames = 0; t0 = performance.now(); });
  requestAnimationFrame(tick);
  function send(t) {
    lastSend = t; const a = minute.slice(); minute = [];
    const avg = a.reduce((x, y) => x + y, 0) / a.length;
    post({ action: "diag", sid, fps: avg, min: Math.min(...a), low: !!city.low, auto: switchedAuto, phone: PHONE, gpu, scr: `${screen.width}x${screen.height}@${devicePixelRatio}`, mode: mode(), errs: errs.splice(0) }).catch(() => {});
  }
  return {
    get pref() { return pref; },
    set(p) { pref = ["auto", "high", "low"].includes(p) ? p : "auto"; try { localStorage.setItem("dc.gfx", pref); } catch { /* */ } if (pref === "auto") { autoDone = false; city.setLow(false); wins = []; since = performance.now(); } else apply(); },
    stats: () => ({ wins: wins.slice(), low: city.low, gpu }),
  };
}
