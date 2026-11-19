// intro.js — the way into the city, like a game connecting: boot lines, the site's name slamming in, the city's own
// mascots (WANTED posters) and launched coins flying out of a neon skyline, a loading bar that waits for the real
// pictures, PRESS START, a flash, and the page behind. The name and the CA suffix come from config (never in code).
// Once a browser tab (sessionStorage dc.intro) it's skipped; a returning visitor gets a short version without START.
// ?intro=1 always plays the full one. prefers-reduced-motion: a plain fade.
import { loadCfg, loadCoins } from "/common.js";

const root = document.getElementById("intro");
const html = document.documentElement;
const FORCE = /[?&]intro=1\b/.test(location.search);
const MASCOTS = ["bandit-1", "boss-1", "cat-1", "croc-1", "croc-2", "cruiser-1", "driver-1", "flamingo-1", "fox-1", "gull-1", "owl-1", "pigeon-1", "raccoon-1", "racer-1", "rat-1", "shadow-1", "shark-1"];
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

if (root && !html.classList.contains("nointro")) start();
else if (root) root.remove();

async function start() {
  root.dataset.on = "1";
  const phone = matchMedia("(max-width: 600px)").matches;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const short = !FORCE && ls("dc.intro.seen") === "1";
  ss("dc.intro", "1"); ls("dc.intro.seen", "1");
  html.style.overflow = "hidden";

  root.innerHTML = `<canvas></canvas><div class="ix-stage"></div>
    <div class="ix-boot"></div>
    <div class="ix-logo"><div class="ix-k">NOW ENTERING</div><div class="ix-name"></div><div class="ix-tl"></div><div class="ix-sfx"></div></div>
    <button class="ix-start" type="button">PRESS START</button>
    <button class="ix-skip" type="button">SKIP ›</button>
    <div class="ix-bot"><div class="ix-tip"><i>TIP</i><span></span></div><div class="ix-bar"><i></i></div><div class="ix-pct"><span>LOADING CITY</span><span class="ix-n">0%</span></div></div>
    <div class="ix-flash"></div>`;
  const $ = (s) => root.querySelector(s);
  const T0 = performance.now();

  // the config and the coins, but never wait on them for long
  const [cfg, coins] = await Promise.all([
    Promise.race([loadCfg(), sleep(short ? 600 : 1200).then(() => ({ name: "", suffix: "" }))]),
    Promise.race([loadCoins(), sleep(short ? 600 : 1200).then(() => [])]),
  ]);
  const name = String(cfg.name || "DROP CITY").toUpperCase();
  const suf = String(cfg.suffix || "");
  const withImg = (coins || []).filter((c) => c && c.image && c.symbol).slice(0, 24);

  $(".ix-name").textContent = name;
  $(".ix-tl").innerHTML = suf ? `EVERY CA ENDS IN <span>${esc(suf)}</span>` : "THE CITY THAT LAUNCHES COINS";
  const tips = [
    suf ? `Every coin's address ends in “${suf}” — look at the last letters.` : "Every coin here is launched on pump.fun.",
    "A new coin drops on the hour — be there when it lands.",
    "Launch your own coin from the city — it gets a lot of its own.",
    "Coins launched here split creator fees 60 / 30 / 10: creator · THE VAULT · buyers.",
    (cfg.quotes || []).some((q) => q.live) ? `Pick the pair at launch: SOL or ${(cfg.quotes.find((q) => q.live) || {}).id}.` : "Tap a building to open its coin.",
  ];
  let tipI = 0;
  const showTip = () => { const s = $(".ix-tip span"); s.style.opacity = 0; setTimeout(() => { s.textContent = tips[tipI++ % tips.length]; s.style.transition = "opacity .3s"; s.style.opacity = 1; }, 160); };
  showTip();
  const tipT = setInterval(showTip, 2200);

  // the next drop's countdown (top of the hour)
  const sfx = $(".ix-sfx");
  const tick = () => { const d = new Date(); const m = 59 - d.getMinutes(), s = 59 - d.getSeconds(); sfx.innerHTML = `NEXT DROP IN <b>${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}</b>`; };
  tick(); const sfxT = setInterval(tick, 1000);

  // pictures: the loading bar follows them for real
  const urls = [...MASCOTS.map((m) => `/images/agent/${m}.webp`), ...withImg.map((c) => c.image)];
  let loaded = 0;
  const imgs = {};
  urls.forEach((u) => { const i = new Image(); i.decoding = "async"; i.onload = i.onerror = () => { loaded++; }; i.src = u; imgs[u] = i; });

  // ---- the city behind: a skyline, a grid road, speed streaks ----
  const cv = $("canvas"), cx = cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1.25 : 1.75);
  let W = 0, H = 0, sky = [], streaks = [];
  const size = () => {
    W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky = [];
    for (const [layer, n, hMax, col] of [[0, phone ? 16 : 30, 0.26, "#1a0b16"], [1, phone ? 11 : 20, 0.18, "#0d0710"]]) {
      let x = -20;
      while (x < W + 20) {
        const w = rnd(W / n * 0.6, W / n * 1.4), h = rnd(0.06, hMax) * H;
        const win = []; for (let i = 0; i < 6; i++) win.push([rnd(0.15, 0.85), rnd(0.1, 0.9), Math.random() < 0.5 ? "#ff2e88" : "#ffd36b"]);
        sky.push({ layer, x, w, h, col, win, neon: Math.random() < 0.3 });
        x += w + rnd(0, 6);
      }
    }
    streaks = Array.from({ length: phone ? 70 : 140 }, () => ({ a: rnd(0, Math.PI * 2), r: rnd(20, Math.max(W, H)), v: rnd(0.6, 1.4), c: Math.random() < 0.75 ? "255,46,136" : "0,229,255" }));
  };
  size(); addEventListener("resize", size);
  let speed = still ? 0 : 1, gridOff = 0, alive = true, lastT = T0;
  const draw = (t) => {
    if (!alive) return;
    const dt = Math.min(50, t - lastT); lastT = t;
    const vx = W / 2, vy = H * 0.46, hz = H * 0.62;
    cx.clearRect(0, 0, W, H);
    // streaks out of the vanishing point
    cx.lineCap = "round";
    for (const s of streaks) {
      s.r += s.v * speed * dt * 0.55 * (1 + s.r / 400);
      if (s.r > Math.max(W, H) * 0.9) { s.r = rnd(10, 60); s.a = rnd(0, Math.PI * 2); }
      const len = 6 + s.r * 0.08 * speed * s.v;
      const x0 = vx + Math.cos(s.a) * s.r, y0 = vy + Math.sin(s.a) * s.r * 0.7;
      const x1 = vx + Math.cos(s.a) * (s.r + len), y1 = vy + Math.sin(s.a) * (s.r + len) * 0.7;
      cx.strokeStyle = `rgba(${s.c},${Math.min(0.75, s.r / 500)})`; cx.lineWidth = 1 + s.r / 600;
      cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
    }
    // the skyline: far layer, glow line, near layer
    const glow = cx.createLinearGradient(0, hz - H * 0.3, 0, hz);
    glow.addColorStop(0, "rgba(255,46,136,0)"); glow.addColorStop(1, "rgba(255,46,136,0.22)");
    cx.fillStyle = glow; cx.fillRect(0, hz - H * 0.3, W, H * 0.3);
    for (const b of sky) {
      const top = hz - b.h * (b.layer ? 0.8 : 1);
      cx.fillStyle = b.col; cx.fillRect(b.x, top, b.w, hz - top);
      if (b.neon) { cx.fillStyle = "rgba(255,46,136,0.85)"; cx.fillRect(b.x, top, b.w, 2); }
      for (const [wx, wy, c] of b.win) if ((Math.sin(t / 700 + wx * 40) > -0.6)) { cx.fillStyle = c; cx.globalAlpha = 0.55; cx.fillRect(b.x + wx * b.w, top + wy * (hz - top), 3, 4); cx.globalAlpha = 1; }
    }
    // the road: a grid racing toward you
    const fl = cx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, "#14060f"); fl.addColorStop(1, "#000");
    cx.fillStyle = fl; cx.fillRect(0, hz, W, H - hz);
    cx.strokeStyle = "rgba(255,46,136,0.9)"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(0, hz); cx.lineTo(W, hz); cx.stroke();
    cx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) { cx.strokeStyle = `rgba(255,46,136,${0.32 - Math.abs(i) * 0.018})`; cx.beginPath(); cx.moveTo(vx + i * 14, hz); cx.lineTo(vx + i * W * 0.22, H); cx.stroke(); }
    gridOff = (gridOff + dt * 0.0011 * speed * 3) % 1;
    for (let k = 0; k < 9; k++) { const p = Math.pow((k + gridOff) / 9, 2.2); const y = hz + p * (H - hz); cx.strokeStyle = `rgba(255,46,136,${0.12 + p * 0.5})`; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    stepCards(t, dt);
    requestAnimationFrame(draw);
  };

  // ---- the cards flying at you ----
  const stage = $(".ix-stage");
  const cap = phone ? 14 : 26;
  const cards = [];
  let spawnAt = 0, cardsOn = false;
  const posterOf = () => { const m = pick(MASCOTS); return `<div class="ix-card ix-poster"><em>WANTED</em><img src="/images/agent/${m}.webp" alt=""><b>${"★".repeat(1 + Math.floor(Math.random() * 5))}</b></div>`; };
  const coinOf = () => { const c = pick(withImg); return `<div class="ix-card ix-coin"><img src="${esc(c.image)}" alt="" referrerpolicy="no-referrer"></div>`; };
  const tagOf = () => {
    const c = withImg.length ? pick(withImg) : null;
    const opts = [`NEW DROP <b>$${esc(c ? c.symbol : "????")}</b>`, suf ? `CA …<b>${esc(suf)}</b>` : `<b>+</b> NEW COIN`, `60 / 30 / <b>10</b>`, `LAUNCH <b>▲</b>`];
    return `<div class="ix-card ix-tag">${pick(opts)}</div>`;
  };
  const spawn = () => {
    if (cards.length >= cap) return;
    const r = Math.random();
    const htmlS = r < 0.45 ? posterOf() : r < 0.8 && withImg.length ? coinOf() : r < 0.8 ? posterOf() : tagOf();
    stage.insertAdjacentHTML("beforeend", htmlS);
    const el = stage.lastElementChild;
    // never straight down the middle where the name stands
    let x = rnd(-1, 1), y = rnd(-0.9, 0.9);
    if (Math.abs(x) < 0.3) x = Math.sign(x || 1) * rnd(0.3, 1);
    cards.push({ el, x: x * W * (phone ? 0.75 : 0.62), y: y * H * 0.5, z: -2400, rx: rnd(-25, 25), ry: rnd(-45, 45), rz: rnd(-18, 18), sp: rnd(0.75, 1.25), spin: rnd(-0.04, 0.04) });
  };
  const stepCards = (t, dt) => {
    if (!cardsOn) return;
    if (t > spawnAt) { spawn(); spawnAt = t + (phone ? 260 : 170) / Math.max(1, speed * 0.7); }
    for (let i = cards.length - 1; i >= 0; i--) {
      const c = cards[i];
      c.z += dt * 0.9 * c.sp * speed;
      c.rz += c.spin * dt;
      const o = c.z < -2000 ? (c.z + 2400) / 400 : c.z > 350 ? Math.max(0, 1 - (c.z - 350) / 250) : 1;
      c.el.style.opacity = o.toFixed(3);
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,${c.z.toFixed(1)}px) rotateX(${c.rx}deg) rotateY(${(c.ry * (1 - (c.z + 2400) / 3200)).toFixed(1)}deg) rotateZ(${c.rz.toFixed(1)}deg)`;
      if (c.z > 600) { c.el.remove(); cards.splice(i, 1); }
    }
  };

  // ---- sound: one synth "drop" on START, unless the city's sound is off ----
  const boom = () => {
    if (ls("dc.snd") === "0") return;
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)(), n = A.currentTime;
      const g = A.createGain(); g.connect(A.destination); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.5, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + 1.1);
      const o = A.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(880, n); o.frequency.exponentialRampToValueAtTime(42, n + 0.9);
      const f = A.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2400, n); f.frequency.exponentialRampToValueAtTime(200, n + 0.9);
      o.connect(f); f.connect(g); o.start(n); o.stop(n + 1.1);
      const k = A.createOscillator(), kg = A.createGain(); k.frequency.setValueAtTime(120, n); k.frequency.exponentialRampToValueAtTime(38, n + 0.4);
      kg.gain.setValueAtTime(0.9, n); kg.gain.exponentialRampToValueAtTime(0.0001, n + 0.5); k.connect(kg); kg.connect(A.destination); k.start(n); k.stop(n + 0.5);
      setTimeout(() => A.close(), 1500);
    } catch { /* no audio */ }
  };

  // ---- the way out ----
  let leaving = false;
  const leave = (withFx) => {
    if (leaving) return; leaving = true;
    clearInterval(tipT); clearInterval(sfxT);
    if (withFx) { boom(); root.classList.add("flash"); }
    const t0 = performance.now();
    const warp = () => { const k = (performance.now() - t0) / 700; speed = 1 + Math.min(1, k) * 9; if (k < 1.2 && alive) requestAnimationFrame(warp); };
    if (!still) warp();
    setTimeout(() => {
      root.classList.add("out");
      html.classList.add("ix-arrive");
      setTimeout(() => {
        alive = false; root.remove(); html.style.overflow = "";
        removeEventListener("resize", size);
        setTimeout(() => html.classList.remove("ix-arrive"), 950);
        dispatchEvent(new CustomEvent("intro:done"));
      }, 850);
    }, withFx ? 260 : 0);
  };
  $(".ix-skip").onclick = () => leave(false);
  $(".ix-start").onclick = () => leave(true);
  addEventListener("keydown", function k(e) { if (leaving) return removeEventListener("keydown", k); if (e.key === "Escape") leave(false); else if ((e.key === "Enter" || e.key === " ") && root.classList.contains("ready")) { e.preventDefault(); leave(true); } });

  // ---- the timeline ----
  if (still) {
    $(".ix-boot").remove(); root.classList.add("slam");
    $(".ix-bar i").style.width = "100%"; $(".ix-n").textContent = "100%";
    draw(T0); await sleep(1200); return leave(false);
  }
  requestAnimationFrame(draw);
  const boot = $(".ix-boot");
  const lines = [["> connecting to solana mainnet", 1], ["> loading city map", 1], [`> ${withImg.length || "—"} coins on the streets`, 1], ["> syncing next drop", 1]];
  const bootRun = (async () => { for (const [l] of lines) { boot.insertAdjacentHTML("beforeend", `${esc(l)} … <span class="ok">OK</span>\n`); await sleep(short ? 90 : 260); } })();
  await sleep(short ? 200 : 650);
  cardsOn = true;
  await sleep(short ? 150 : 650);
  root.classList.add("slam");
  if (navigator.vibrate && phone) try { navigator.vibrate(18); } catch { /* */ }
  await bootRun;

  // the bar: time and pictures together, never past what's really loaded until the time is up
  const need = short ? 1100 : 2600, t1 = performance.now();
  await new Promise((res) => {
    const bar = $(".ix-bar i"), num = $(".ix-n");
    const step = () => {
      const tk = Math.min(1, (performance.now() - t1) / need);
      const ik = urls.length ? loaded / urls.length : 1;
      const p = short ? tk : Math.min(tk, 0.35 + ik * 0.65, 1);
      const done = tk >= 1 && (short || ik >= 0.8 || performance.now() - t1 > need + 2500);
      const show = done ? 1 : p;
      bar.style.width = (show * 100).toFixed(1) + "%"; num.textContent = Math.round(show * 100) + "%";
      if (done) return res();
      requestAnimationFrame(step);
    };
    step();
  });
  $(".ix-pct span").textContent = "CITY READY";
  if (short) return leave(false);
  root.classList.add("ready");
  setTimeout(() => { if (!leaving) leave(true); }, 9000);
}
