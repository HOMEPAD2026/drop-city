// coast.js — the city's coast at dusk, drawn on a 2D canvas: the sky, a big low sun, clouds, gulls, three layers of skyline
// (the clock tower and the cranes among them), windows and neon that come on in waves, the water with the sun's glints and
// the city's reflection, cars along the shore, palms framing the edges. Original art, all of it drawn here; no text.
// Used by the entry intro (the sun goes under and the city switches on) and by the website's hero (the sun is the hour's clock).
//
//   const coast = makeCoast(canvas, { layout: "intro" | "hero", horizon, sunX, palms, stars, birds, boards, seed, fps, quality });
//   coast.set({ sun, night, lift })   // 0..1 each: sun 0 = up, 1 = under; night 0 = golden hour, 1 = every light on; lift = camera crane
//   coast.to(state, ms, ease) → Promise · coast.drop(state, ms) (a new sun comes down from the top) · start / stop / setSpeed / resize / destroy
//
// Everything still is built once per size (paths and a few small sprites); a frame fills those with the colours of the moment.
const GOLD_SKY = ["#1c0f45", "#3a1466", "#6a1b7e", "#a3227f", "#d62f78", "#ff4f6e", "#ff8a4c", "#ffc56b"];
const NIGHT_SKY = ["#07051a", "#110a2e", "#1e0f46", "#34125c", "#53166c", "#841c76", "#c4237b", "#ff3d8f"];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const EASE = { linear: (t) => t, out: (t) => 1 - Math.pow(1 - t, 3), inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), back: (t) => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PALM_SLOTS = {
  intro: { desk: [[0.05, 0.82, 1], [0.955, 0.76, -1], [0.13, 0.52, 1], [0.885, 0.5, -1]], phone: [[-0.04, 0.52, 1], [1.04, 0.48, -1]] },
  hero: { desk: [[0.975, 1.05, -1], [0.905, 0.72, -1]], phone: [[1.02, 0.95, -1]] },
};

export function makeCoast(canvas, opts = {}) {
  const o = { layout: "intro", quality: "auto", horizon: 0.6, sunX: 0.6, palms: 4, stars: true, birds: true, boards: null, seed: 7, fps: 60, sun: 0, night: 0, lift: 0, onSlow: null, ...opts };
  const ctx = canvas.getContext("2d", { alpha: false });
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = typeof navigator !== "undefined" ? navigator : {};
  let quality = o.quality !== "auto" ? o.quality : (nav.deviceMemory && nav.deviceMemory <= 3) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.connection && nav.connection.saveData) ? "low" : "high";
  const st = { sun: o.sun, night: o.night, lift: o.lift };
  let W = 0, H = 0, dpr = 1, phone = false, G = null; // G: everything built for this size
  let running = false, raf = 0, last = 0, lastDraw = 0, clock = 0, speed = 1, slowN = 0, slowSum = 0, dead = false;
  const tweens = [];

  // ---------------- build (once per size)
  function build() {
    W = Math.max(1, canvas.clientWidth || canvas.width); H = Math.max(1, canvas.clientHeight || canvas.height);
    phone = Math.min(W, H) < 600 || W < 700;
    dpr = quality === "low" ? 1 : Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const R = rng(o.seed), hz = o.horizon * H, r = H > W ? 0.24 * W : 0.2 * Math.min(W, H), sx = o.sunX * W;
    const g = { hz, r, sx, R };
    // the sky: two smooth gradients (golden hour and after sunset), crossfaded by night
    const sky = (cols) => { const gr = ctx.createLinearGradient(0, 0, 0, hz); cols.forEach((c, i) => gr.addColorStop(Math.pow(i / (cols.length - 1), 1.15), c)); return gr; };
    g.skyGold = sky(GOLD_SKY); g.skyNight = sky(NIGHT_SKY);
    // the water: the same two moments
    const water = (a, b, c) => { const gr = ctx.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, a); gr.addColorStop(0.4, b); gr.addColorStop(1, c); return gr; };
    g.waterGold = water("#8a2f6f", "#3a1450", "#0c0714"); g.waterNight = water("#4a145c", "#170a2c", "#050308");
    // the sky's afterglow lying on the water near the shore, and the sun's glow reflected under it
    g.afterglow = (() => { const gr = ctx.createLinearGradient(0, hz, 0, hz + (H - hz) * 0.35); gr.addColorStop(0, "rgba(255,61,143,0.42)"); gr.addColorStop(1, "rgba(255,61,143,0)"); return gr; })();
    // the horizon's haze: a soft warm band the far skyline sinks into
    g.haze = (() => { const gr = ctx.createLinearGradient(0, hz - r * 1.2, 0, hz); gr.addColorStop(0, "rgba(255,120,110,0)"); gr.addColorStop(1, "rgba(255,120,110,0.35)"); return gr; })();
    // the sun: its glow and its disc as small sprites (only their position changes)
    g.glow = sprite(r * 6, r * 6, (c, w) => { const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,190,110,0.62)"); gr.addColorStop(0.22, "rgba(255,140,100,0.32)"); gr.addColorStop(0.5, "rgba(255,46,136,0.12)"); gr.addColorStop(1, "rgba(255,46,136,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
    g.disc = sprite(r * 2, r * 2, (c, w) => { const gr = c.createLinearGradient(0, 0, 0, w); gr.addColorStop(0, "#fff6d2"); gr.addColorStop(0.35, "#ffd36b"); gr.addColorStop(0.7, "#ff9a4a"); gr.addColorStop(1, "#ff4f6e"); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 1, 0, Math.PI * 2); c.fill(); });
    // stars
    if (o.stars) g.stars = sprite(W, hz * 0.62, (c, w, h) => { const n = phone ? 36 : 70; for (let i = 0; i < n; i++) { const s = 0.6 + R() * 0.9; c.fillStyle = `rgba(255,255,255,${0.45 + R() * 0.55})`; c.fillRect(R() * w, R() * h, s, s); } });
    // clouds: long thin bars, lit from below
    g.clouds = sprite(W * 1.3, hz, (c, w) => { for (let i = 0; i < 8; i++) { const len = (0.16 + R() * 0.4) * W, th = (0.007 + R() * 0.013) * H + 1.5, x = R() * (w - len), y = hz * (0.18 + R() * 0.62);
      c.fillStyle = "rgba(120,50,150,0.42)"; pill(c, x, y, len, th); c.fillStyle = "rgba(255,160,120,0.36)"; pill(c, x + len * 0.08, y + th * 0.6, len * 0.84, Math.max(1, th * 0.45)); } });
    // the three skylines (paths, filled each frame with the colour of the moment) and the windows they hold
    g.far = new Path2D(); g.mid = new Path2D(); g.near = new Path2D(); g.cranes = new Path2D();
    const winA = [], winB = [], winC = [], neon = [], tops = [];
    // far: hazy blocks all along the shore
    for (let x = -10; x < W + 10;) { const w = (0.025 + R() * 0.035) * W, h = (Math.abs(x + w / 2 - sx) < 1.1 * r ? 0.15 + R() * 0.25 : 0.35 + R() * 0.75) * r; g.far.rect(x, hz - h, w + 1, h); if (R() < 0.3) g.far.rect(x + w * 0.3, hz - h - r * 0.12, w * 0.4, r * 0.12 + 1); x += w + R() * 6; }
    // the clock tower: its shaft cuts the sun's left side
    const tw = Math.max(12, 0.2 * r), th = Math.min(2.1 * r, 0.3 * H), tx = sx - 0.35 * r - tw / 2;
    g.tower = { x: tx + tw / 2, top: hz - th, tw, face: hz - th + tw * 1.15, fr: Math.max(7, 0.62 * tw * 0.75) };
    g.mid.rect(tx, hz - th, tw, th);
    g.mid.rect(tx - tw * 0.25, hz - th - tw * 0.1, tw * 1.5, tw * 2.2);
    g.mid.moveTo(tx - tw * 0.3, hz - th - tw * 0.1); g.mid.lineTo(tx + tw / 2, hz - th - tw * 1.3); g.mid.lineTo(tx + tw * 1.3, hz - th - tw * 0.1); g.mid.closePath();
    g.mid.rect(tx + tw / 2 - 1, hz - th - tw * 2.1, 2, tw * 0.9);
    // mid: blocks with setbacks
    for (let x = -10; x < W + 10;) { const w = (0.03 + R() * 0.045) * W, h = (Math.abs(x + w / 2 - sx) < 1.15 * r ? 0.12 + R() * 0.2 : 0.3 + R() * 0.6) * r; if (Math.abs(x + w / 2 - g.tower.x) < tw * 1.6) { x += tw * 1.4; continue; }
      g.mid.rect(x, hz - h, w + 1, h); if (R() < 0.45) g.mid.rect(x + w * 0.18, hz - h - h * 0.22, w * 0.64, h * 0.22 + 1); if (R() < 0.2) g.mid.rect(x + w * 0.45, hz - h - h * 0.5, 1.5, h * 0.3);
      windows(x, hz - h, w, h, 0.62, winA, winB, winC); x += w + 2 + R() * 10; }
    // cranes on the mid skyline (the towers here grow as their curves fill)
    for (let i = 0; i < (phone ? 1 : 2); i++) { const cx = W * (i ? 0.78 : 0.22) + (R() - 0.5) * W * 0.06, mh = r * (0.9 + R() * 0.3), jib = r * 0.7;
      g.cranes.moveTo(cx, hz); g.cranes.lineTo(cx, hz - mh); g.cranes.moveTo(cx - jib * 0.3, hz - mh); g.cranes.lineTo(cx + jib, hz - mh);
      g.cranes.moveTo(cx, hz - mh - r * 0.1); g.cranes.lineTo(cx + jib * 0.7, hz - mh); g.cranes.moveTo(cx, hz - mh - r * 0.1); g.cranes.lineTo(cx - jib * 0.3, hz - mh);
      g.cranes.moveTo(cx + jib * 0.6, hz - mh); g.cranes.lineTo(cx + jib * 0.6, hz - mh + r * 0.25); }
    // near: stepped roofs, antennas, water tanks; kept low in front of the sun
    for (let x = -10; x < W + 10;) { const w = (0.035 + R() * 0.05) * W, cx = x + w / 2, nearSun = Math.abs(cx - sx) < 1.3 * r || Math.abs(cx - g.tower.x) < tw * 2.4;
      const h = nearSun ? (0.08 + R() * 0.17) * r : (0.2 + R() * 0.45) * r;
      g.near.rect(x, hz - h, w + 1, h + 1);
      if (R() < 0.4) g.near.rect(x + w * 0.12, hz - h - h * 0.18, w * 0.5, h * 0.18 + 1);
      if (R() < 0.3) { const ax = x + w * (0.2 + R() * 0.6); g.near.rect(ax, hz - h - r * 0.22, 1.2, r * 0.22); }
      if (R() < 0.18) { const kx = x + w * 0.6, kw = Math.max(5, w * 0.16); g.near.rect(kx, hz - h - kw * 0.9, kw, kw * 0.8); g.near.rect(kx + 1, hz - h - kw * 0.1, 1, kw * 0.1 + 1); g.near.rect(kx + kw - 2, hz - h - kw * 0.1, 1, kw * 0.1 + 1); }
      windows(x, hz - h, w, h, 1, winA, winB, winC);
      if (!nearSun && R() < 0.32) neon.push([x + 2, hz - h, w - 4, R() < 0.2 ? "#ffd36b" : "#ff2e88"]);
      if (!nearSun) tops.push([cx, hz - h, h]);
      x += w + 1 + R() * 5; }
    // the lights as three sprites over the skyline band: tier A fades in first, B and C sweep in from the left
    const top = Math.max(0, hz - Math.min(2.4 * r, 0.42 * H)), bh = hz - top;
    g.lightTop = top; g.lightH = bh;
    const paintWin = (list, withNeon) => sprite(W, bh, (c) => {
      for (const [x, y, w, h, col, a] of list) { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x, y - top, w, h); }
      c.globalAlpha = 1;
      if (withNeon) for (const [x, y, w, col] of neon) { // a neon line on the roof, its glow baked as soft rects
        c.fillStyle = col; c.globalAlpha = 0.12; c.fillRect(x - 2, y - top - 3, w + 4, 6); c.globalAlpha = 0.28; c.fillRect(x - 1, y - top - 2, w + 2, 4); c.globalAlpha = 1; c.fillRect(x, y - top - 0.75, w, 1.6); }
    });
    g.winA = paintWin(winA, false); g.winB = paintWin(winB, false); g.winC = paintWin(winC, true);
    g.neon = neon;
    // rooftop signs (pictures only): on the tallest near roofs away from the sun
    g.signs = [];
    if (o.boards && o.boards.length) { const sp = tops.filter((t) => Math.abs(t[0] - sx) > 1.5 * r && (o.layout !== "intro" || Math.abs(t[0] - W / 2) > 0.25 * W)).sort((a, b) => b[2] - a[2]), d = clamp(0.11 * Math.min(W, H), 40, 72), n = Math.min(o.boards.length, phone ? 2 : 3);
      const picked = []; for (const t of sp) { if (picked.length >= n) break; if (picked.every((p) => Math.abs(p[0] - t[0]) > d * 2.2) && t[0] > d && t[0] < W - d) picked.push(t); }
      picked.forEach((t, i) => g.signs.push({ x: t[0], y: t[1] - d * 0.62 - 4, d, img: o.boards[i], spr: null })); }
    // the cars on the shore road
    g.cars = Array.from({ length: phone ? 4 : 6 }, (_, i) => ({ x: R() * W, v: (10 + R() * 12) * (i % 2 ? -1 : 1) }));
    // the gulls
    g.birds = Array.from({ length: 5 }, (_, i) => ({ dx: i * 16 + R() * 10, dy: (R() - 0.5) * 18 + (i % 2) * 8, s: 7 + R() * 3, ph: R() * 6 }));
    g.birdY = hz * (0.22 + R() * 0.12);
    // the palms (a path each, drawn rotated a little each frame)
    const slots = (PALM_SLOTS[o.layout] || PALM_SLOTS.intro)[phone ? "phone" : "desk"].slice(0, o.palms);
    g.palms = slots.map(([fx, fh, side]) => palm(fx * W, fh * H, side, R));
    // the glints under the sun
    g.glints = Array.from({ length: phone ? 10 : 14 }, (_, i) => ({ k: i / ((phone ? 10 : 14) - 1), w: (0.25 + R() * 0.25) * r, ph: R() * 6 }));
    // twinkling windows (a few, repainted dark / lit)
    g.twinkle = quality === "low" ? [] : Array.from({ length: Math.min(10, winC.length) }, () => winC[Math.floor(R() * winC.length)]);
    G = g;
    for (const s of g.signs) loadSign(s);

    function windows(x, y, w, h, a, A, B, C) {
      const cap = quality === "low" ? 500 : phone ? 1400 : 3200; if (A.length + B.length + C.length > cap) return;
      const cw = phone ? 5 : 6, ch = 7, ww = phone ? 2 : 2, wh = phone ? 2 : 3;
      for (let yy = y + 5; yy < hz - 4; yy += ch) for (let xx = x + 3; xx < x + w - 4; xx += cw) {
        if (R() > 0.38) continue; const p = R(), col = p < 0.7 ? "#ffd36b" : p < 0.9 ? "#ff6fae" : "#bfe6ff", t = R(), win = [xx, yy, ww, wh, col, a * (0.55 + R() * 0.45)];
        (t < 0.3 ? A : t < 0.65 ? B : C).push(win); }
    }
  }
  function sprite(w, h, paint) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const x = c.getContext("2d"); x.scale(dpr, dpr); paint(x, w, h); return c; }
  function pill(c, x, y, w, h) { c.beginPath(); c.moveTo(x + h / 2, y); c.lineTo(x + w - h / 2, y); c.arc(x + w - h / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2); c.lineTo(x + h / 2, y + h); c.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, -Math.PI / 2); c.fill(); }
  // a palm: a leaning tapered trunk with rings, a crown of arching fronds (filled, swept leaflets on both sides), coconuts
  function palm(bx, h, side, R) {
    const lean = (8 + R() * 6) * (Math.PI / 180) * side, by = H + 4, tx = bx + Math.sin(lean) * h * 0.92, ty = by - Math.cos(lean) * h * 0.92;
    const cx = bx + Math.sin(lean) * h * 0.25 - side * h * 0.06, cy = by - h * 0.5;
    const trunk = new Path2D(), w0 = 0.045 * h, w1 = 0.02 * h, N = 26, L = [], Rt = [];
    for (let i = 0; i <= N; i++) { const t = i / N, x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx, y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ty, w = (w0 + (w1 - w0) * t) / 2;
      const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx), dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy), m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
      L.push([x + nx * w, y + ny * w]); Rt.push([x - nx * w, y - ny * w]); }
    trunk.moveTo(...L[0]); for (const p of L) trunk.lineTo(...p); for (const p of Rt.slice().reverse()) trunk.lineTo(...p); trunk.closePath();
    const rings = new Path2D(); for (let i = 2; i < N - 1; i += 2) { const p = L[i], q = Rt[i]; rings.moveTo(p[0], p[1]); rings.lineTo(q[0], q[1]); }
    const reach = phone && o.layout === "intro" ? 0.3 * W : Infinity; // on a phone the fronds keep the middle of the screen clear
    const leaf = new Path2D(), stem = new Path2D(), nuts = new Path2D(), n = 12, gap = Math.max(3.2, Math.min(h * 0.016, reach * 0.04));
    const tri = (ax, ay, bx2, by2, cx2, cy2) => { if ((bx2 - ax) * (cy2 - ay) - (by2 - ay) * (cx2 - ax) < 0) [bx2, by2, cx2, cy2] = [cx2, cy2, bx2, by2]; leaf.moveTo(ax, ay); leaf.lineTo(bx2, by2); leaf.lineTo(cx2, cy2); leaf.closePath(); };
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), a = -Math.PI - 0.32 + u * (Math.PI + 0.64) + (R() - 0.5) * 0.16, out = Math.abs(Math.cos(a));
      const len0 = (0.3 + R() * 0.13) * h * (0.85 + out * 0.25), len = Math.min(len0, reach * (0.75 + out * 0.25)), lk = len / len0, droop = len * (0.18 + out * 0.42 + R() * 0.12);
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.62 + droop, qx = tx + Math.cos(a) * len * 0.5, qy = ty + Math.sin(a) * len * 0.5 - len * (0.16 + (1 - out) * 0.1);
      const P = (t) => [(1 - t) * (1 - t) * tx + 2 * (1 - t) * t * qx + t * t * ex, (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * qy + t * t * ey];
      // the rachis: a sliver that thins to the tip
      const rw = Math.max(1.2, h * 0.006);
      stem.moveTo(tx, ty - rw); stem.quadraticCurveTo(qx, qy - rw * 0.6, ex, ey); stem.quadraticCurveTo(qx, qy + rw * 0.6, tx, ty + rw); stem.closePath();
      const steps = Math.max(8, Math.round(len / gap));
      for (let k = 2; k < steps; k++) {
        const t = k / steps, [px, py] = P(t), [qx2, qy2] = P(Math.min(1, t + 0.02)); let tdx = qx2 - px, tdy = qy2 - py; const tm = Math.hypot(tdx, tdy) || 1; tdx /= tm; tdy /= tm;
        let nx = -tdy, ny = tdx; if (ny < 0) { nx = -nx; ny = -ny; } // the normal that hangs down
        const ll = h * lk * (0.045 + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * (1 - t * 0.3), bw = gap * 0.42;
        for (const [k1, k2] of [[1, 0.55], [-0.45, 0.65]]) { // one long leaflet hanging down, one short one up, both swept toward the tip
          const lx = px + nx * ll * k1 + tdx * ll * k2, ly = py + ny * ll * k1 + tdy * ll * k2;
          tri(px - tdx * bw, py - tdy * bw, lx, ly, px + tdx * bw, py + tdy * bw); }
      }
    }
    for (let i = 0; i < 4; i++) { const ca = (i / 4) * Math.PI * 2 + R(); nuts.moveTo(tx + Math.cos(ca) * h * 0.016 + h * 0.012, ty + h * 0.022); nuts.arc(tx + Math.cos(ca) * h * 0.016, ty + h * 0.022 + Math.sin(ca) * h * 0.008, h * 0.012, 0, Math.PI * 2); }
    return { bx, by, trunk, rings, leaf, stem, nuts, side, per: 5.5 + R() * 1.5, ph: R() * 6 };
  }
  function loadSign(s) { const img = s.img; const go = () => { s.spr = sprite(s.d, s.d, (c, w) => { c.save(); c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2); c.clip(); try { c.drawImage(img, 0, 0, w, w); } catch {} c.restore(); c.lineWidth = 3; c.strokeStyle = "#ff2e88"; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 1.5, 0, Math.PI * 2); c.stroke(); c.lineWidth = 2; c.strokeStyle = "#fff"; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); c.stroke(); }); if (!running) draw(); };
    if (img && img.complete && img.naturalWidth) go(); else if (img && img.addEventListener) img.addEventListener("load", go, { once: true }); }

  // ---------------- one frame
  let signT0 = 0;
  function draw(t = clock) {
    if (!G || dead) return; const g = G, { hz, r, sx } = g, N = clamp(st.night), S = st.sun, lift = st.lift * H;
    const low = quality === "low";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // sky
    ctx.fillStyle = g.skyGold; ctx.fillRect(0, 0, W, hz + 2);
    if (N > 0) { ctx.globalAlpha = N; ctx.fillStyle = g.skyNight; ctx.fillRect(0, 0, W, hz + 2); ctx.globalAlpha = 1; }
    if (g.stars && N > 0.05) { ctx.globalAlpha = N * N; ctx.drawImage(g.stars, 0, 0, W, hz * 0.62); ctx.globalAlpha = 1; }
    // the sun, cut at the horizon
    const sy = hz - r * (1.25 - 2.35 * S) + lift * 0.15;
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.9 * (1 - 0.6 * N) * clamp(1.15 - S * 0.5); ctx.drawImage(g.glow, sx - 3 * r, sy - 3 * r, 6 * r, 6 * r); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    if (sy - r < hz) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip(); ctx.drawImage(g.disc, sx - r, sy - r, 2 * r, 2 * r); ctx.restore(); }
    // clouds drift across, some over the sun
    const cw = W * 1.3, cx = -((low ? 0 : t * 3) % cw);
    ctx.globalAlpha = 1 - 0.55 * N; ctx.drawImage(g.clouds, cx, 0, cw, hz); if (cx + cw < W) ctx.drawImage(g.clouds, cx + cw, 0, cw, hz); ctx.globalAlpha = 1;
    // gulls
    if (o.birds && !low && N < 0.7) { const per = 14, k = (t % per) / per, bx = -80 + k * (W + 160); ctx.strokeStyle = "#1a0b24"; ctx.lineWidth = 1.2; ctx.globalAlpha = 1 - N / 0.7; ctx.beginPath();
      for (const b of g.birds) { const x = bx + b.dx, y = g.birdY + b.dy, f = Math.sin(t * 10 + b.ph) > 0 ? 1 : -0.4; ctx.moveTo(x - b.s, y - f * 2); ctx.quadraticCurveTo(x - b.s / 2, y - f * 3.5, x, y); ctx.quadraticCurveTo(x + b.s / 2, y - f * 3.5, x + b.s, y - f * 2); }
      ctx.stroke(); ctx.globalAlpha = 1; }
    // the skylines
    ctx.save(); ctx.translate(0, lift * 0.3); ctx.fillStyle = mix("#a33a86", "#2a1147", N); ctx.fill(g.far); ctx.fillStyle = g.haze; ctx.globalAlpha = 1 - N * 0.6; ctx.fillRect(0, hz - r * 1.2, W, r * 1.2); ctx.globalAlpha = 1; ctx.restore();
    ctx.save(); ctx.translate(0, lift * 0.6); const midC = mix("#4a1660", "#150a26", N); ctx.fillStyle = midC; ctx.fill(g.mid); ctx.strokeStyle = midC; ctx.lineWidth = 1.5; ctx.stroke(g.cranes);
    // the clock's face, on the real minute
    const T = g.tower; ctx.fillStyle = N >= 0.6 ? "#ffd9ec" : "#5a2a6a"; ctx.beginPath(); ctx.arc(T.x, T.face, T.fr, 0, Math.PI * 2); ctx.fill();
    if (N >= 0.6) { ctx.strokeStyle = "rgba(255,46,136,0.55)"; ctx.lineWidth = 2; ctx.stroke(); }
    const mins = new Date().getUTCMinutes() + new Date().getUTCSeconds() / 60, ang = (mins / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = "#1a0b24"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T.x, T.face); ctx.lineTo(T.x + Math.cos(ang) * T.fr * 0.8, T.face + Math.sin(ang) * T.fr * 0.8); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(0, lift); ctx.fillStyle = mix("#1e0c2a", "#0b0612", N); ctx.fill(g.near);
    // the lights: A fades in, B and C sweep in from the left (all reversible)
    lights(N, 1);
    // rooftop signs pop in at night
    if (g.signs.length) { if (N >= 0.8 && !signT0) signT0 = performance.now(); if (N < 0.8) signT0 = 0;
      g.signs.forEach((s, i) => { if (!s.spr || !signT0) return; const k = clamp((performance.now() - signT0 - i * 90) / 180); if (k <= 0) return; const d = s.d * (0.6 + 0.4 * EASE.out(k)); ctx.globalAlpha = k; ctx.drawImage(s.spr, s.x - d / 2, s.y - d / 2, d, d); ctx.globalAlpha = 1; }); }
    ctx.restore();
    // the water: the gradient, the city upside down in it, the sun's glints
    ctx.save(); ctx.translate(0, lift);
    ctx.fillStyle = g.waterGold; ctx.fillRect(0, hz, W, H - hz + 2); if (N > 0) { ctx.globalAlpha = N; ctx.fillStyle = g.waterNight; ctx.fillRect(0, hz, W, H - hz + 2); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.35 + 0.65 * N; ctx.fillStyle = g.afterglow; ctx.fillRect(0, hz, W, (H - hz) * 0.35); ctx.globalAlpha = 1;
    { const ga = 0.55 * (1 - 0.7 * N) * clamp(1.2 - S); if (ga > 0.02) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = ga; ctx.drawImage(g.glow, sx - 2.4 * r, hz - 0.6 * r, 4.8 * r, 2.4 * r); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; } }
    ctx.save(); ctx.translate(0, hz); ctx.scale(1, -0.55); ctx.translate(0, -hz); ctx.globalAlpha = 0.34; ctx.fillStyle = mix("#1e0c2a", "#0b0612", N); ctx.fill(g.near); ctx.globalAlpha = 1;
    if (!low) lights(N, 0.4); ctx.restore();
    // the sun's glints: a column of bars under it, shrinking as it sets
    const gl = Math.pow(clamp(1 - S), 0.7); if (gl > 0.01) { ctx.fillStyle = "rgba(255,211,107,0.55)"; const depth = 0.34 * (H - hz);
      for (const b of g.glints) { const y = hz + 4 + b.k * depth, w = (0.25 * r + b.k * 0.85 * r) * (0.75 + 0.25 * Math.sin(1.6 * t + b.ph * 3)) * (0.6 + 0.4 * gl); ctx.globalAlpha = gl * (1 - b.k * 0.5); ctx.fillRect(sx - w / 2, y, w, 2); }
      ctx.globalAlpha = 1; }
    // neon's pink streaks on the water at night
    if (N >= 0.7) { ctx.fillStyle = "rgba(255,46,136,0.35)"; ctx.globalAlpha = (N - 0.7) / 0.3; for (const [x, , w] of g.neon.slice(0, 6)) for (let k = 0; k < 4; k++) ctx.fillRect(x + w * 0.2 + Math.sin(t * 2 + k) * 2, hz + 6 + k * 7, w * 0.6, 1); ctx.globalAlpha = 1; }
    // the shoreline and the cars along it
    ctx.fillStyle = "#ff2e88"; ctx.globalAlpha = 0.35 + 0.55 * N; ctx.fillRect(0, hz - 0.75, W, 1.5); ctx.globalAlpha = 1;
    if (!low) for (const c of g.cars) { const x = (((c.x + c.v * t) % (W + 40)) + W + 40) % (W + 40) - 20; ctx.fillStyle = c.v > 0 ? "#fff6d8" : "#ff4d6d"; ctx.fillRect(x, hz - 2.5, 2, 2); }
    ctx.restore();
    // the palms, swaying a touch
    for (const p of g.palms) { const a = calm ? 0 : Math.sin((t / p.per) * Math.PI * 2 + p.ph) * 0.8 * (Math.PI / 180);
      ctx.save(); ctx.translate(p.bx, p.by + lift * 1.6); ctx.rotate(a); ctx.translate(-p.bx, -p.by);
      ctx.fillStyle = "#07040c"; ctx.fill(p.trunk); ctx.fill(p.leaf); ctx.fill(p.stem); ctx.fill(p.nuts);
      ctx.strokeStyle = `rgba(255,120,150,${0.3 * (1 - N * 0.6)})`; ctx.lineWidth = 1; ctx.stroke(p.rings);
      ctx.restore(); }
  }
  // the three tiers of lights over the skyline band
  function lights(N, a) {
    const g = G, top = g.lightTop, h = g.lightH, kA = clamp((N - 0.1) / 0.25), kB = clamp((N - 0.4) / 0.25), kC = clamp((N - 0.7) / 0.25);
    if (kA > 0) { ctx.globalAlpha = a * kA; ctx.drawImage(g.winA, 0, top, W, h); }
    ctx.globalAlpha = a;
    for (const [k, s] of [[kB, g.winB], [kC, g.winC]]) if (k > 0) { const w = W * k; ctx.drawImage(s, 0, 0, s.width * k, s.height, 0, top, w, h); }
    if (kC > 0.9 && G.twinkle.length) { const on = Math.floor(clock * 1000 / 420); ctx.fillStyle = "#0b0612"; G.twinkle.forEach((w, i) => { if ((on + i * 7) % 5 === 0) ctx.fillRect(w[0], w[1], w[2], w[3]); }); }
    ctx.globalAlpha = 1;
  }

  // ---------------- the loop
  function frame(now) {
    raf = 0; if (dead) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    clock += dt * speed;
    let moving = false;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i], k = clamp((now - tw.t0) / tw.ms), e = tw.ease(k); for (const key in tw.to) st[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e; moving = true; if (k >= 1) { tweens.splice(i, 1); tw.done(); } }
    const minGap = moving ? 0 : 1000 / (quality === "low" ? Math.min(o.fps, 30) : o.fps);
    if (!(typeof document !== "undefined" && document.hidden) && now - lastDraw >= minGap - 2) { const gap = now - lastDraw; draw(clock); if (minGap < 20 && gap < 200) watch(gap); lastDraw = now; }
    if (running || tweens.length) raf = requestAnimationFrame(frame);
  }
  // the safety valve: when the frames come slower than ~30 a second (the drawing itself is cheap; it's the device's
  // painting that can lag), drop to the light version once: 1× pixels, no gulls, drift, cars or reflected lights
  function watch(gap) { if (quality === "low") return; slowSum += gap; if (++slowN >= 30) { if (slowSum / slowN > 34) { quality = "low"; build(); draw(); o.onSlow && o.onSlow(); } slowN = 0; slowSum = 0; } }
  const kick = () => { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } };

  const api = {
    get quality() { return quality; },
    start() { if (dead) return; if (calm) { draw(); return; } running = true; kick(); },
    stop() { running = false; },
    setSpeed(k) { speed = Math.max(0, +k || 0); },
    resize() { if (dead) return; build(); draw(); },
    destroy() { dead = true; running = false; if (raf) cancelAnimationFrame(raf); raf = 0; tweens.length = 0; if (G) for (const k of ["glow", "disc", "stars", "clouds", "winA", "winB", "winC"]) if (G[k]) G[k].width = 0; G = null; },
    set(s) { Object.assign(st, pick(s)); if (!running || calm) draw(); },
    to(s, ms = 600, ease = "inout") {
      const target = pick(s);
      if (calm || !(ms > 0)) { Object.assign(st, target); draw(); return Promise.resolve(); }
      return new Promise((done) => { for (const tw of tweens) for (const k in target) delete tw.to[k]; tweens.push({ from: { ...st }, to: target, ms, ease: EASE[ease] || EASE.inout, t0: performance.now(), done }); kick(); });
    },
    drop(s, ms = 2200) {
      // a new sun comes down from above the canvas and lands at s.sun
      const target = pick(s); if (!G) return Promise.resolve();
      st.sun = (1.25 - (G.hz + G.r * 1.05) / G.r) / 2.35;
      if (calm) { Object.assign(st, target); draw(); return Promise.resolve(); }
      const p = new Promise((done) => tweens.push({ from: { ...st }, to: { sun: target.sun != null ? target.sun : 0.1 }, ms, ease: EASE.back, t0: performance.now(), done }));
      if (target.night != null) tweens.push({ from: { night: st.night }, to: { night: target.night }, ms, ease: EASE.linear, t0: performance.now(), done: () => {} });
      kick(); return p;
    },
  };
  function pick(s) { const out = {}; for (const k of ["sun", "night", "lift"]) if (s && typeof s[k] === "number" && isFinite(s[k])) out[k] = s[k]; return out; }
  build(); draw();
  return api;
}
