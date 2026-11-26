// intro.js — the way in (the owner, 2026-11-20: the GTA VI intro as the model; 2026-11-26: "6 s, readable, a real end").
// A star on black bursts into light, the camera flies without stopping through four hand-painted tableaux (each seen
// through a doorway in the one before, a piece rushing past in front), a caption over each, then the lights stretch
// into a warp that collapses into a star, and the star becomes the GTAFUN logo — with the city's live numbers, two ways
// in (Launch · Play) and a loading line that fills as the coins really arrive. Original art: images/intro (README).
// One canvas, 2D. The paintings are graded once as they load (black & white with pink in the light).
// Who sees what: a shared link (/coin, /nft, /lp, /w/…, a #hash, ?coin=) skips it; a returning visitor gets the short
// end (star → logo); ?intro=1 always plays it; a tap, any key or the Skip button ends it; swiping up fast-forwards;
// prefers-reduced-motion: the logo only; a slow device drops straight to the warp. Every way out sets
// window.__introDone and fires "intro:done" with detail.played.
import { loadCfg } from "/common.js";
import { t } from "/i18n.js";

const root = document.getElementById("intro");
const html = document.documentElement;
const FORCE = /[?&]intro=1\b/.test(location.search);
const BG = "#000";
// four tableaux (2026-11-26: six made the flight ~12 s on a phone): back painting + the piece rushing past in front
const SCENES = [
  { b: "s1", f: "f4", fx: [-0.4, 0.04], fw: 0.62, cap: ["ixCap1", "Every coin is a tower."] },      // Miami Beach hotel, a palm sweeping past
  { b: "s2", f: "f2", fx: [0.3, 0.16], fw: 0.6, cap: ["ixCap2", "Every trade pays you back."] },    // the pergola with oranges
  { b: "s5", f: "f5", fx: [-0.3, 0.06], fw: 0.55, cap: ["ixCap3", "Launch it. Play it. Own it."] }, // the flamingo lagoon
  { b: "s6", f: "f6", fx: [0, -0.2], fw: 0.75, add: 1, cap: ["ixCap4", "Welcome to the city."] },   // the sunset, fireworks
];
const K = 3.4; // how much the camera closes in from one tableau to the next
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (played) => { window.__introDone = true; dispatchEvent(new CustomEvent("intro:done", { detail: { played } })); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const img = (src) => new Promise((res) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
// a shared link goes straight to what it points at (the owner, 2026-11-26)
const DEEP = location.hash.length > 1 || /[?&]coin=/.test(location.search) || /^\/(coin|w)\//.test(location.pathname) || /^\/(nft|lp)\/?$/.test(location.pathname);


// ---- sound: off unless the visitor turns it on here (or did before on this site: dc.snd = "1")
let AC = null, SND = ls("dc.snd") === "1";
const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; } catch { return null; } };
function sfx(kind) {
  if (!SND) return; const a = ac(); if (!a) return; const t0 = a.currentTime, g = a.createGain(); g.connect(a.destination);
  if (kind === "burst") { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(880, t0 + 0.5); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7); o.connect(g); o.start(t0); o.stop(t0 + 0.75); }
  if (kind === "warp") { const len = a.sampleRate * 0.8, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const s = a.createBufferSource(), f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3000, t0 + 0.7); s.buffer = b; s.connect(f); f.connect(g); g.gain.value = 0.18; s.start(t0); }
  if (kind === "logo") for (const [i, fq] of [[0, 659], [1, 988], [2, 1319]]) { const o = a.createOscillator(), gg = a.createGain(); o.type = "triangle"; o.frequency.value = fq; gg.gain.setValueAtTime(0.0001, t0 + i * 0.08); gg.gain.exponentialRampToValueAtTime(0.08, t0 + i * 0.08 + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 0.6); o.connect(gg); gg.connect(a.destination); o.start(t0 + i * 0.08); o.stop(t0 + i * 0.08 + 0.65); }
}

async function start() {
  root.dataset.on = "1";
  const phone = matchMedia("(max-width: 700px)").matches;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const short = !FORCE && ls("dc.intro.seen") === "1";
  ss("dc.intro", "1"); ls("dc.intro.seen", "1");
  html.style.overflow = "hidden";
  root.className = "zi" + (short ? " short" : "");
  root.innerHTML = `<canvas class="zi-cv"></canvas><i class="zi-lb t"></i><i class="zi-lb b"></i><i class="zi-grain"></i><p class="zi-cap"></p>
    <div class="zi-end"><img class="zi-badge" alt="GTAFUN" src="/images/logo-500.webp"><div class="zi-name"></div><div class="zi-tag"></div><div class="zi-live"></div>
      <div class="zi-cta"><button type="button" class="zi-b hot" data-zi="launch"></button><button type="button" class="zi-b" data-zi="play"></button><button type="button" class="zi-b ghost" data-zi="enter"></button></div><div class="zi-bar"><i></i></div></div>
    <button class="zi-skip" type="button"></button><button class="zi-snd" type="button" aria-label="Sound"></button><p class="zi-fan"></p>`;
  const $ = (s) => root.querySelector(s);
  $(".zi-skip").textContent = t("ixSkip2", "Tap to skip ›");
  $(".zi-fan").textContent = t("ixFan", "Fan-made · not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.");
  $('[data-zi="launch"]').textContent = t("launch", "Launch a coin"); $('[data-zi="play"]').textContent = t("enterG", "Play the game ▸"); $('[data-zi="enter"]').textContent = t("ixEnter", "Enter");
  const sndB = $(".zi-snd"), paintSnd = () => { sndB.textContent = SND ? "🔊" : "🔇"; sndB.classList.toggle("on", SND); }; paintSnd();
  $(".zi-badge").onerror = function () { this.src = "/images/icon.svg"; };
  const cv = $(".zi-cv"), ctx = cv.getContext("2d", { alpha: false });
  let W = 0, H = 0, dpr = 1;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 1.75); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);
  let leaving = false, raf = 0;
  loadCfg().then((cfg) => { $(".zi-name").textContent = String((cfg && cfg.name) || "GTAFUN").toUpperCase(); }).catch(() => {});
  $(".zi-tag").textContent = t("ixTag", "THE LAUNCHPAD YOU CAN PLAY");

  // ---- the city's live numbers on the end card, and a loading line that fills as the coins really arrive
  const bar = $(".zi-bar i");
  const live = () => { const cs = window.__dcCoins; if (!Array.isArray(cs) || !cs.length) return false; const mc = cs.reduce((a, c) => a + (c.mcapUsd || 0), 0), u = (v) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "K" : "$" + Math.round(v));
    $(".zi-live").innerHTML = `<span><b>${cs.length}</b> ${t("ixCoins", "coins")}</span><span><b>${u(mc)}</b> ${t("ixMcap", "total market cap")}</span><span><b>0.3%</b> ${t("ixCash", "cashback")}</span>`; root.classList.add("has-live"); bar.style.transform = "scaleX(1)"; return true; };
  bar.style.transform = "scaleX(0.12)";
  if (!live()) addEventListener("dc:coins", live, { once: true });

  // ---- the way out
  const finish = (then) => {
    cancelAnimationFrame(raf); removeEventListener("resize", size); removeEventListener("keydown", onKey);
    root.remove(); html.style.overflow = "";
    html.classList.add("ix-arrive"); setTimeout(() => html.classList.remove("ix-arrive"), 600);
    done(true);
    if (then === "launch") { const b = document.querySelector(".hero [data-drop], [data-drop]"); if (b) b.click(); }
    if (then === "play") location.href = "/city";
  };
  const leave = (then) => { if (leaving) return; leaving = true; root.classList.add("out"); setTimeout(() => finish(then), 420); };
  const onKey = (e) => { if (e.key === "Tab") return; leave(); };
  addEventListener("keydown", onKey);
  // a tap ends it (buttons do their own thing); a swipe up fast-forwards the flight
  let speed = 1, y0 = null;
  root.addEventListener("pointerdown", (e) => { y0 = e.clientY; });
  root.addEventListener("pointerup", (e) => {
    const zi = e.target.closest("[data-zi]"); if (zi) { e.stopPropagation(); return leave(zi.dataset.zi === "enter" ? null : zi.dataset.zi); }
    if (e.target.closest(".zi-snd")) { SND = !SND; ls("dc.snd", SND ? "1" : "0"); if (SND) ac(); paintSnd(); return; }
    if (y0 != null && y0 - e.clientY > 60 && !root.classList.contains("end")) { speed = 3.2; root.classList.add("ff"); y0 = null; return; }
    y0 = null; if (root.classList.contains("end") && !e.target.closest(".zi-skip")) return; leave();
  });

  // ---- the star (also the whole of the short and the still versions)
  const star = (x, y, r, a, glow) => {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
    if (glow > 0) { const R = r * glow, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, "rgba(255,200,235,0.85)"); g.addColorStop(0.18, "rgba(255,90,180,0.55)"); g.addColorStop(0.45, "rgba(255,46,136,0.18)"); g.addColorStop(1, "rgba(255,46,136,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
    for (const [an, L, wd] of [[0, 7, 0.07], [Math.PI / 2, 5, 0.06], [Math.PI / 4, 3.2, 0.035], [-Math.PI / 4, 3.2, 0.035]]) {
      ctx.save(); ctx.rotate(an); const len = r * L, g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, "rgba(255,80,170,0)"); g.addColorStop(0.5, "rgba(255,235,245,0.9)"); g.addColorStop(1, "rgba(255,80,170,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, len, Math.max(1, r * wd), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  };
  // a lens flare: rings along the line through the centre, for the burst
  const flare = (x, y, a) => { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = "lighter"; for (const [k, r, al] of [[0.35, 22, 0.25], [0.7, 48, 0.12], [1.25, 14, 0.3], [1.6, 70, 0.07]]) { const px = W / 2 + (x - W / 2) * -k, py = H / 2 + (y - H / 2) * -k; ctx.globalAlpha = a * al; ctx.fillStyle = "#ff7ab8"; ctx.beginPath(); ctx.arc(px + W * 0.08 * k, py - H * 0.05 * k, r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); };
  const endCard = async () => { root.classList.add("end"); sfx("logo"); await sleep(still ? 1800 : 2600); if (!leaving) leave(); };
  if (still) { ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); return endCard(); }
  if (short) {
    const T0 = performance.now();
    const f = () => { if (leaving) return; const k = (performance.now() - T0) / 600; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); star(W / 2, H / 2, 10 + 30 * Math.sin(Math.PI * clamp(k)), 1 - clamp(k - 0.7, 0, 0.3) / 0.3, 4); if (k < 1) raf = requestAnimationFrame(f); };
    f(); await sleep(550); return endCard();
  }

  // ---- the paintings: the first two before anything else, the rest behind them; graded black & white with pink in the
  // light (2026-11-26: the all-pink grade made every scene look the same)
  const sz = phone ? 960 : 1600;
  const duo = (im) => { try { const c = document.createElement("canvas"); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height; const x = c.getContext("2d");
    if ("filter" in x) { x.filter = "grayscale(1) contrast(1.18) brightness(0.96)"; x.drawImage(im, 0, 0); x.filter = "none"; }
    else { x.drawImage(im, 0, 0); x.globalCompositeOperation = "saturation"; x.fillStyle = "#808080"; x.fillRect(0, 0, c.width, c.height); } // no canvas filter (Safari): grey by blend mode
    x.globalCompositeOperation = "soft-light"; x.fillStyle = "rgb(255, 46, 136)"; x.globalAlpha = 0.55; x.fillRect(0, 0, c.width, c.height); // pink lives in the light
    x.globalAlpha = 1; x.globalCompositeOperation = "destination-in"; x.drawImage(im, 0, 0); return c; } catch { return im; } };
  const g = (im) => (im ? duo(im) : im);
  const one = async (s) => ({ ...s, back: g(await img(`/images/intro/${s.b}-${sz}.webp`)), front: g(await img(`/images/intro/${s.f}.webp`)) });
  const firstTwo = Promise.all(SCENES.slice(0, 2).map(one)), rest = firstTwo.then(() => Promise.all(SCENES.slice(2).map(one)));
  let T0 = performance.now(), ready = null;
  firstTwo.then((a) => { ready = a; rest.then((b) => { ready = a.concat(b); }); });
  await new Promise((res) => { // the little star twinkles while the first two load (≤ 1.2 s, then on with what there is)
    const f = () => { if (leaving) return res(); const el = performance.now() - T0; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); star(W / 2, H / 2, 5 + Math.sin(el / 160) * 1.2, clamp(el / 300), 3); if ((ready && el > 350) || el > 1200) return res(); raf = requestAnimationFrame(f); };
    f();
  });
  if (leaving) return;
  if (!ready || ready.filter((s) => s.back).length < 1) return endCard();
  // a soft-edged copy of each painting for when it sits inside the one before it
  const soften = (s) => { if (s.soft || !s.back) return; const c = document.createElement("canvas"), w = 640, h = Math.round((640 * s.back.height) / s.back.width); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.drawImage(s.back, 0, 0, w, h); x.globalCompositeOperation = "destination-in";
    const gr = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "#000"); gr.addColorStop(0.5, "#000"); gr.addColorStop(0.92, "rgba(0,0,0,0)");
    x.setTransform(1, 0, 0, h / w, 0, 0); x.fillStyle = gr; x.fillRect(0, 0, w, w); s.soft = c; };
  const scenesNow = () => (ready || []).filter((s) => s.back).map((s) => (soften(s), s));
  const blurOk = "filter" in ctx;

  // ---- timing (2026-11-26: the whole flight ≈ 4.5 s; the logo by ~5.5 s)
  const BURST = 700, PER = phone ? 780 : 820, OUT = 750, TAIL = 0.35;
  const cover = (iw, ih) => { const k = Math.max(W / iw, H / ih); return [iw * k, ih * k]; };
  const drawAt = (s, scale, soft, a, ox, oy) => { const [cw, ch] = cover(s.back.width, s.back.height), w = cw * scale, h = ch * scale; if (w < 6) return; ctx.globalAlpha = a; ctx.drawImage(soft ? s.soft : s.back, W / 2 - w / 2 + ox, H / 2 - h / 2 + oy, w, h); ctx.globalAlpha = 1; };
  const front = (s, scale, ox, oy) => {
    if (!s.front) return; const fs = scale * 1.7; if (fs < 0.6 || fs > 4.5) return;
    const [cw] = cover(s.back.width, s.back.height), w = cw * s.fw * fs, h = (w * s.front.height) / s.front.width;
    const x = W / 2 + s.fx[0] * cw * fs + ox * 1.6, y = H / 2 + s.fx[1] * cw * 0.66 * fs + oy * 1.6, a = clamp((fs - 0.6) / 0.45) * (1 - clamp((fs - 2.6) / 1.9));
    if (blurOk) ctx.filter = `blur(${Math.round(clamp((fs - 1.4) / 2) * 14)}px)`; if (s.add) ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a; ctx.drawImage(s.front, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1;
    if (s.add) ctx.globalCompositeOperation = "source-over"; if (blurOk) ctx.filter = "none";
  };
  // a pink light leak sweeping across as the camera goes through a doorway
  const leak = (k) => { if (k <= 0 || k >= 1) return; const x = -W * 0.4 + k * W * 1.8, gr = ctx.createLinearGradient(x - W * 0.35, 0, x + W * 0.35, H * 0.4); gr.addColorStop(0, "rgba(255,46,136,0)"); gr.addColorStop(0.5, `rgba(255,122,184,${0.32 * Math.sin(Math.PI * k)})`); gr.addColorStop(1, "rgba(255,46,136,0)"); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore(); };
  // the warp: the city's lights stretch into streaks rushing past, then gather into the star
  const STREAKS = Array.from({ length: phone ? 90 : 150 }, (_, i) => ({ a: (i * 2.39996) % (Math.PI * 2), d: 0.05 + ((i * 0.618) % 1) * 0.95, w: 0.6 + (i % 3) * 0.7, c: i % 4 ? "255,122,184" : "255,255,255" }));
  const warp = (k) => { const R = Math.hypot(W, H) * 0.6, inK = k < 0.7 ? k / 0.7 : 1, outK = k < 0.7 ? 0 : (k - 0.7) / 0.3; ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (const s of STREAKS) { const r0 = ((s.d + inK * 1.4) % 1.2) * R * (1 - outK), len = (20 + inK * 160) * (1 - outK) * s.d; if (len < 1) continue; ctx.strokeStyle = `rgba(${s.c},${0.55 * (1 - outK)})`; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(s.a) * r0, H / 2 + Math.sin(s.a) * r0); ctx.lineTo(W / 2 + Math.cos(s.a) * (r0 + len), H / 2 + Math.sin(s.a) * (r0 + len)); ctx.stroke(); }
    ctx.restore(); };
  // captions: one a scene, fading in as its painting fills the screen
  const capEl = $(".zi-cap"); let capI = -1;
  const caption = (i) => { if (i === capI) return; capI = i; const s = scenesNow()[i]; if (!s || !s.cap) { capEl.classList.remove("on"); return; } capEl.classList.remove("on"); void capEl.offsetWidth; capEl.textContent = t(s.cap[0], s.cap[1]); capEl.classList.add("on"); };

  // ---- the flight on a clock that a swipe can speed up, and a slow device can cut short
  let vt = 0, last = performance.now(), slowN = 0, slowT = 0, warped = false;
  root.classList.add("fly"); sfx("burst");
  const frame = () => {
    if (leaving) return;
    const now = performance.now(), dt = Math.min(80, now - last); last = now; vt += dt * speed;
    if (vt > 300 && vt < 2000) { slowN++; slowT += dt; if (slowN > 24 && slowT / slowN > 48 && !warped) { warped = true; vt = Math.max(vt, BURST + PER * (scenesNow().length - 1 + TAIL)); } } // a slow device: straight to the warp
    const scenes = scenesNow(), n = scenes.length, el = vt;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (el < BURST) { // the star swells into light over the first painting, already filling the screen
      const k = el / BURST, r = 6 + Math.pow(k, 3) * Math.hypot(W, H) * 0.45, shake = (1 - k) * 2.5;
      drawAt(scenes[0], 1.18 - 0.18 * ease(k), false, clamp((k - 0.25) / 0.5), (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      star(W / 2, H / 2, r, (1 - clamp((k - 0.6) / 0.35)) * 0.85, 2.2); flare(W / 2, H / 2, (1 - k) * 0.9);
      caption(0); raf = requestAnimationFrame(frame); return;
    }
    const tf = el - BURST, flyEnd = PER * (n - 1 + TAIL);
    if (tf < flyEnd) {
      const raw = tf / PER, i = Math.floor(raw), fr = raw - i;
      const p = i + fr - (0.55 * Math.sin(2 * Math.PI * fr)) / (2 * Math.PI);
      const ox = Math.sin(el / 900) * W * 0.008, oy = Math.cos(el / 1100) * H * 0.008, cur = Math.floor(p);
      for (let j = Math.max(0, cur - 1); j < Math.min(n, cur + 3); j++) { const sc = Math.pow(K, p - j); if (sc > K * 1.4) continue; const soft = j > cur, a = j < cur ? 1 - clamp((sc - K) / (K * 0.4)) : 1; drawAt(scenes[j], sc, soft, a, ox * sc, oy * sc); }
      for (let j = Math.min(n - 1, cur + 1); j >= Math.max(0, cur - 1); j--) front(scenes[j], Math.pow(K, p - j), ox, oy);
      leak((fr - 0.35) / 0.45);
      caption(Math.min(n - 1, Math.round(p)));
      raf = requestAnimationFrame(frame); return;
    }
    const to = tf - flyEnd;
    if (to < OUT) { // the warp: the last painting falls away, its lights stretch past, and gather into a star
      if (capI !== -2) { capI = -2; capEl.classList.remove("on"); sfx("warp"); }
      const k = to / OUT, lastS = scenes[n - 1], sc = Math.pow(K, TAIL) * (1 + 2.2 * ease(k));
      drawAt(lastS, sc, false, (1 - k) * 0.85, 0, 0);
      warp(k);
      star(W / 2, H / 2, Math.max(6, (1 - ease(k)) * Math.min(W, H) * 0.16 + 6), clamp(k * 1.6) * 0.7, 1.8);
      raf = requestAnimationFrame(frame); return;
    }
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); root.classList.remove("fly"); endCard();
  };
  frame();
}

// started last, once everything above (the sound's state included) is defined
if (root && !html.classList.contains("nointro") && (FORCE || !DEEP)) start().catch((e) => { console.warn("intro", e); try { root.remove(); } catch {} html.style.overflow = ""; if (!window.__introDone) done(false); });
else { if (root) root.remove(); html.style.overflow = ""; done(false); }
