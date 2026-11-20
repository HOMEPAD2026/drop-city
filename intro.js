// intro.js — the way in (the owner, 2026-11-20: the GTA VI intro as the model). A star on a dark field bursts into light,
// the camera flies forward without stopping through a run of hand-painted mural tableaux — each one seen through the
// doorway in the middle of the last, foreground pieces rushing past and blurring —, then rushes out into a pink zoom-blur
// that collapses into a star, and the star becomes the badge with the name. Original art: images/intro (README there).
// One canvas, 2D; every tableau is pre-masked once (a soft-edged copy for when it sits inside the one before). The name
// comes from config. Once a browser tab (sessionStorage dc.intro); a returning visitor or a deep link gets the short end
// (star → badge); ?intro=1 always plays the whole thing; a tap / any key skips; prefers-reduced-motion: the badge only.
// Every way out sets window.__introDone and fires "intro:done" with detail.played.
import { loadCfg } from "/common.js";
import { t } from "/i18n.js";

const root = document.getElementById("intro");
const html = document.documentElement;
const FORCE = /[?&]intro=1\b/.test(location.search);
const BG = "#1d1930";
// the tableaux: back painting + the piece that rushes past in front of it ([x, y] = its middle as a share of the painting
// from the centre, w = its width as a share of the painting's, side: which way it leaves)
const SCENES = [
  { b: "s1", f: "f1", fx: [0, 0.28], fw: 0.9 },
  { b: "s2", f: "f2", fx: [-0.3, 0.18], fw: 0.75 },
  { b: "s3", f: "f3", fx: [0, 0], fw: 1.3 },
  { b: "s4", f: "f4", fx: [0.36, -0.05], fw: 0.7 },
  { b: "s5", f: "f5", fx: [0, 0.05], fw: 1.25 },
  { b: "s6", f: "f6", fx: [0, -0.1], fw: 1.1 },
];
const K = 3.4; // how much the camera closes in from one tableau to the next
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (played) => { window.__introDone = true; dispatchEvent(new CustomEvent("intro:done", { detail: { played } })); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const img = (src) => new Promise((res) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

if (root && !html.classList.contains("nointro")) start().catch((e) => { console.warn("intro", e); try { root.remove(); } catch {} html.style.overflow = ""; if (!window.__introDone) done(false); });
else { if (root) root.remove(); done(false); }

async function start() {
  root.dataset.on = "1";
  const phone = matchMedia("(max-width: 700px)").matches;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const deep = location.hash.length > 1 || /[?&]coin=/.test(location.search) || location.pathname.startsWith("/coin/");
  const short = !FORCE && (ls("dc.intro.seen") === "1" || deep);
  ss("dc.intro", "1"); ls("dc.intro.seen", "1");
  html.style.overflow = "hidden";
  root.className = "zi" + (short ? " short" : "");
  root.innerHTML = `<canvas class="zi-cv"></canvas><div class="zi-end"><img class="zi-badge" alt="" src="/images/intro/badge.webp"><div class="zi-name"></div><div class="zi-tag"></div></div><button class="zi-skip" type="button"></button>`;
  const $ = (s) => root.querySelector(s);
  $(".zi-skip").textContent = t("ixSkip", "SKIP ›");
  $(".zi-badge").onerror = function () { this.src = "/images/icon.svg"; };
  const cv = $(".zi-cv"), ctx = cv.getContext("2d", { alpha: false });
  let W = 0, H = 0, dpr = 1;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 1.75); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);
  let leaving = false, raf = 0;

  // the name
  loadCfg().then((cfg) => { const n = String((cfg && cfg.name) || "DROP CITY").toUpperCase(); $(".zi-name").textContent = n; }).catch(() => { $(".zi-name").textContent = "DROP CITY"; });
  $(".zi-tag").textContent = t("ixTag", "THE LAUNCHPAD YOU CAN PLAY");

  // ---- the way out
  const finish = () => {
    cancelAnimationFrame(raf); removeEventListener("resize", size); removeEventListener("keydown", onKey);
    root.remove(); html.style.overflow = "";
    html.classList.add("ix-arrive"); setTimeout(() => html.classList.remove("ix-arrive"), 600);
    done(true);
  };
  const leave = () => { if (leaving) return; leaving = true; root.classList.add("out"); setTimeout(finish, 450); };
  const onKey = (e) => { if (e.key === "Tab") return; leave(); };
  addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", leave);

  // ---- the star and the badge (also the whole of the short and the still versions)
  // the star: a soft pink-orange bloom, four light streaks, a glowing five-pointed core (white at the heart)
  const star = (x, y, r, a, glow) => {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
    if (glow > 0) { const R = r * glow, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, "rgba(255,200,235,0.85)"); g.addColorStop(0.18, "rgba(255,90,180,0.55)"); g.addColorStop(0.45, "rgba(255,130,60,0.22)"); g.addColorStop(1, "rgba(120,60,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
    for (const [an, L, wd] of [[0, 7, 0.07], [Math.PI / 2, 5, 0.06], [Math.PI / 4, 3.2, 0.035], [-Math.PI / 4, 3.2, 0.035]]) {
      ctx.save(); ctx.rotate(an); const len = r * L, g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, "rgba(255,80,170,0)"); g.addColorStop(0.5, "rgba(255,235,245,0.9)"); g.addColorStop(1, "rgba(255,140,60,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, len, Math.max(1, r * wd), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    const path = () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, an = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); };
    const f = ctx.createRadialGradient(0, 0, 0, 0, 0, r); f.addColorStop(0, "#fff"); f.addColorStop(0.35, "#ffe0f0"); f.addColorStop(0.8, "#ff5fb4"); f.addColorStop(1, "#ff8a3d");
    path(); ctx.shadowColor = "#ff4fae"; ctx.shadowBlur = Math.min(60, r * 0.9); ctx.fillStyle = f; ctx.fill(); ctx.restore();
  };
  const endCard = async () => { root.classList.add("end"); await sleep(still ? 1600 : 2300); leave(); };
  if (still) { ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); return endCard(); }

  if (short) {
    const T0 = performance.now();
    const f = () => { if (leaving) return; const k = (performance.now() - T0) / 700; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); star(W / 2, H / 2, 10 + 30 * Math.sin(Math.PI * clamp(k)), 1 - clamp(k - 0.7, 0, 0.3) / 0.3, 4); if (k < 1) raf = requestAnimationFrame(f); };
    f(); await sleep(650); return endCard();
  }

  // ---- the paintings: load while the little star twinkles (the video opens like that too)
  const sz = phone ? 960 : 1600;
  const loads = Promise.all(SCENES.map(async (s) => ({ ...s, back: await img(`/images/intro/${s.b}-${sz}.webp`), front: await img(`/images/intro/${s.f}.webp`) })));
  let T0 = performance.now(), ready = null;
  loads.then((r) => { ready = r; });
  await new Promise((res) => {
    const f = () => { if (leaving) return res(); const el = performance.now() - T0; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); star(W / 2, H / 2, 5 + Math.sin(el / 160) * 1.2, clamp(el / 300), 3); if ((ready && el > 600) || el > 6000) return res(); raf = requestAnimationFrame(f); };
    f();
  });
  if (leaving) return;
  const scenes = (ready || []).filter((s) => s.back);
  if (scenes.length < 2) return endCard(); // no paintings: the badge alone
  // a soft-edged copy of each painting for when it sits inside the one before it
  for (const s of scenes) {
    const c = document.createElement("canvas"), w = 640, h = Math.round((640 * s.back.height) / s.back.width); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.drawImage(s.back, 0, 0, w, h); x.globalCompositeOperation = "destination-in";
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, "#000"); g.addColorStop(0.5, "#000"); g.addColorStop(0.92, "rgba(0,0,0,0)");
    x.setTransform(1, 0, 0, h / w, 0, 0); x.fillStyle = g; x.fillRect(0, 0, w, w); s.soft = c; // an ellipse the painting's shape
  }
  const blurOk = "filter" in ctx;

  // ---- the flight. p runs 0 → n-1: at p = i the i-th painting fills the screen. It never stops: each painting's own
  // stretch eases in and out around a steady crawl.
  const n = scenes.length, BURST = 900, PER = phone ? 1350 : 1450, OUT = 1300, TAIL = 0.4;
  T0 = performance.now();
  const cover = (iw, ih) => { const k = Math.max(W / iw, H / ih); return [iw * k, ih * k]; };
  const drawAt = (s, scale, soft, a, ox, oy) => {
    const [cw, ch] = cover(s.back.width, s.back.height), w = cw * scale, h = ch * scale;
    if (w < 6) return;
    ctx.globalAlpha = a; ctx.drawImage(soft ? s.soft : s.back, W / 2 - w / 2 + ox, H / 2 - h / 2 + oy, w, h); ctx.globalAlpha = 1;
  };
  const front = (s, scale, ox, oy) => {
    if (!s.front) return;
    const fs = scale * 1.7; // it stands in front of its painting
    if (fs < 0.35 || fs > 4.5) return;
    const [cw] = cover(s.back.width, s.back.height), w = cw * s.fw * fs, h = (w * s.front.height) / s.front.width;
    const x = W / 2 + s.fx[0] * cw * fs + ox * 1.6, y = H / 2 + s.fx[1] * cw * 0.66 * fs + oy * 1.6;
    const a = clamp((fs - 0.35) / 0.35) * (1 - clamp((fs - 2.6) / 1.9));
    if (blurOk) ctx.filter = `blur(${Math.round(clamp((fs - 1.4) / 2) * 14)}px)`;
    ctx.globalAlpha = a; ctx.drawImage(s.front, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1;
    if (blurOk) ctx.filter = "none";
  };
  const frame = () => {
    if (leaving) return;
    const el = performance.now() - T0;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (el < BURST) { // the star swells and floods the screen in pink and orange, the first painting behind it
      const k = el / BURST, r = 6 + Math.pow(k, 3) * Math.hypot(W, H) * 0.9;
      if (k > 0.55) drawAt(scenes[0], 0.6 + 0.4 * ease((k - 0.55) / 0.45), false, clamp((k - 0.55) / 0.3), 0, 0);
      star(W / 2, H / 2, r, 1 - clamp((k - 0.75) / 0.25), 2.6);
      raf = requestAnimationFrame(frame); return;
    }
    const tf = el - BURST, flyEnd = PER * (n - 1 + TAIL);
    if (tf < flyEnd) {
      const raw = tf / PER, i = Math.floor(raw), fr = raw - i;
      const p = i + fr - (0.55 * Math.sin(2 * Math.PI * fr)) / (2 * Math.PI); // slow while a painting fills the screen, a rush through each doorway
      const ox = Math.sin(el / 900) * W * 0.008, oy = Math.cos(el / 1100) * H * 0.008; // a hand on the camera
      const cur = Math.floor(p);
      for (let j = Math.max(0, cur - 1); j < Math.min(n, cur + 3); j++) {
        const sc = Math.pow(K, p - j);
        if (sc > K * 1.4) continue;
        const soft = j > cur, a = j < cur ? 1 - clamp((sc - K) / (K * 0.4)) : 1;
        drawAt(scenes[j], sc, soft, a, ox * sc, oy * sc);
      }
      for (let j = Math.min(n - 1, cur + 1); j >= Math.max(0, cur - 1); j--) front(scenes[j], Math.pow(K, p - j), ox, oy);
      raf = requestAnimationFrame(frame); return;
    }
    const to = tf - flyEnd;
    if (to < OUT) { // the rush out: zoom-blur copies of the last painting going pink, collapsing to a star
      const k = to / OUT, last = scenes[n - 1], sc = Math.pow(K, TAIL) * (1 + 2.5 * ease(k));
      for (let c = 0; c < 6; c++) drawAt(last, sc * (1 + c * 0.06 * (1 - k)), false, (1 - k) * (c ? 0.25 : 0.9), 0, 0);
      ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = `rgba(255,70,170,${0.25 + 0.6 * k})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(29,25,48,${clamp((k - 0.45) / 0.4)})`; ctx.fillRect(0, 0, W, H);
      star(W / 2, H / 2, Math.max(6, (1 - ease(k)) * Math.hypot(W, H) * 0.5), clamp(k * 3), 2.4);
      raf = requestAnimationFrame(frame); return;
    }
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    endCard();
  };
  frame();
}
