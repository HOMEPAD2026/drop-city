// intro.js — "Last light": the way into the city. The coast at dusk (coast.js): the camera cranes down past the palms, the
// sun sinks behind the clock tower, the horizon flares as it goes under, the windows and the neon come on in a wave, and the
// site's name lights up letter by letter over the city. A loading line that follows the real loads, PRESS START, the city.
// The name and the CA suffix come from config (never in code). Once a browser tab (sessionStorage dc.intro); a returning
// visitor, or anyone arriving on a deep link (#vote, ?coin=, /coin/…), gets a short version that a tap ends. ?intro=1 always
// plays the full one. prefers-reduced-motion: one still frame and a fade. Every way out sets window.__introDone and fires
// "intro:done" with detail.played (true when an intro was shown).
import { loadCfg } from "/common.js";
import { t, tf } from "/i18n.js";

const root = document.getElementById("intro");
const html = document.documentElement;
const FORCE = /[?&]intro=1\b/.test(location.search);
// rooftop signs: the city's own mascots, faces only (never scenes, never coin logos)
const SIGNS = ["bandit-1", "boss-1", "cat-1", "croc-1", "croc-2", "driver-1", "flamingo-1", "fox-1", "gull-1", "owl-1", "pigeon-1", "raccoon-1", "racer-1", "rat-1", "shark-1"];
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (played) => { window.__introDone = true; dispatchEvent(new CustomEvent("intro:done", { detail: { played } })); };

if (root && !html.classList.contains("nointro")) start().catch((e) => { console.warn("intro", e); try { root.remove(); } catch {} html.style.overflow = ""; if (!window.__introDone) done(false); });
else { if (root) root.remove(); done(false); }

async function start() {
  root.dataset.on = "1";
  const phone = matchMedia("(max-width: 600px)").matches;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const deep = location.hash.length > 1 || /[?&]coin=/.test(location.search) || location.pathname.startsWith("/coin/");
  const short = !FORCE && (ls("dc.intro.seen") === "1" || deep);
  ss("dc.intro", "1"); ls("dc.intro.seen", "1");
  html.style.overflow = "hidden";

  root.innerHTML = `<canvas class="ix-cv"></canvas><div class="ix-vig"></div><div class="ix-lb t"></div><div class="ix-lb b"></div><div class="ix-hz"></div><div class="ix-smear"></div>
    <div class="ix-cap"></div>
    <div class="ix-logo"><div class="ix-k"></div><div class="ix-name"></div><div class="ix-tl"></div><div class="ix-sfx"></div></div>
    <button class="ix-start" type="button"></button>
    <button class="ix-skip" type="button"></button>
    <div class="ix-bot"><div class="ix-tip"><i></i><span></span></div><div class="ix-bar"><i></i></div><div class="ix-pct"><span></span><span class="ix-n">0%</span></div></div>
    <div class="ix-flash"></div>`;
  const $ = (s) => root.querySelector(s);
  $(".ix-k").textContent = t("ixEntering", "NOW ENTERING");
  $(".ix-start").textContent = t("ixStart", "PRESS START");
  $(".ix-skip").textContent = t("ixSkip", "SKIP ›");
  $(".ix-tip i").textContent = t("ixTip", "TIP");
  $(".ix-pct span").textContent = t("ixLoading", "LOADING CITY");
  $(".ix-cap").textContent = `${t("ixHour", "HOUR")} ${String(new Date().getUTCHours()).padStart(2, "0")}:00 UTC`;
  if (short) root.classList.add("short");
  const T0 = performance.now();
  let leaving = false, autoT = 0;

  // ---- the scene starts on the first frame; the config fills the words in when it comes
  const coastMod = import("/coast.js").catch(() => null);
  const cfgP = Promise.race([loadCfg(), sleep(short ? 600 : 1200).then(() => null)]).catch(() => null);
  const boards = [];
  if (!short && !still) { const pool = SIGNS.slice(); for (let i = 0; i < (phone ? 2 : 3); i++) { const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], im = new Image(); im.decoding = "async"; im.src = `/images/agent/${m}.webp`; boards.push(im); } }
  const opts = phone ? { layout: "intro", horizon: 0.64, sunX: 0.56, palms: 2 } : { layout: "intro", horizon: 0.6, sunX: 0.6, palms: 4 };
  const mod = await coastMod;
  let coast = null;
  try { if (mod) coast = mod.makeCoast($(".ix-cv"), { ...opts, boards, sun: short ? 0.55 : 0.05, night: short ? 0.4 : 0, lift: short ? 0 : 0.07 }); } catch (e) { console.warn("coast", e); }
  const C = { set: (s) => { try { coast && coast.set(s); } catch {} }, to: (s, ms, e) => { try { return coast ? coast.to(s, ms, e) : sleep(ms); } catch { return sleep(ms); } }, start: () => { try { coast && coast.start(); } catch {} }, speed: (k) => { try { coast && coast.setSpeed(k); } catch {} } };
  let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { try { coast && coast.resize(); } catch {} }, 150); };
  addEventListener("resize", onResize);

  // ---- the words (they wait for the config, never for long)
  const cfgReady = cfgP.then((cfg) => {
    cfg = cfg || {};
    const name = String(cfg.name || "DROP CITY").toUpperCase(), suf = String(cfg.suffix || "");
    const nm = $(".ix-name"); nm.setAttribute("aria-label", name); nm.style.setProperty("--n", String(Math.max(4, [...name].length)));
    const step = Math.min(35, 450 / Math.max(1, name.length));
    nm.innerHTML = ""; [...name].forEach((ch, i) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = ch === " " ? " " : ch; s.style.setProperty("--d", `${Math.round(i * (short ? 20 : step))}ms`); nm.appendChild(s); });
    const tl = $(".ix-tl"); if (suf) { tl.textContent = t("ixEnds", "EVERY CA ENDS IN") + " "; const b = document.createElement("span"); b.textContent = suf; tl.appendChild(b); } else tl.textContent = t("ixFallback", "THE CITY THAT LAUNCHES COINS");
    const sp = cfg.split || { creator: 6000, vault: 3000, buyer: 1000 }, live = (cfg.quotes || []).find((q) => q.live);
    tips = [suf ? tf("tip1a", "Every coin's address ends in “{s}” — look at the last letters.", { s: suf }) : t("tip1b", "Every coin here is launched on pump.fun."),
      t("tip2", "A new coin drops on the hour — be there when it lands."), t("tip3", "Launch your own coin from the city — it gets a lot of its own."),
      tf("tip4", "Coins launched here split creator fees {a} / {b} / {c}: creator · THE VAULT · the main-coin buyer.", { a: sp.creator / 100, b: sp.vault / 100, c: sp.buyer / 100 }),
      live ? tf("tip5a", "Pick the pair at launch: SOL or {q}.", { q: live.id }) : t("tip5b", "Tap a building to open its coin.")];
  });
  let tips = [t("tip2", "A new coin drops on the hour — be there when it lands.")], tipI = 0;
  const showTip = () => { const s = $(".ix-tip span"); s.style.opacity = 0; setTimeout(() => { s.textContent = tips[tipI++ % tips.length]; s.style.opacity = 1; }, 160); };
  showTip(); const tipT = setInterval(showTip, 2400);
  const sfx = $(".ix-sfx");
  const tick = () => { const d = new Date(), m = 59 - d.getMinutes(), s = 59 - d.getSeconds(); sfx.textContent = `${t("ixNext", "NEXT DROP IN")} `; const b = document.createElement("b"); b.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; sfx.appendChild(b); };
  tick(); const sfxT = setInterval(tick, 1000);

  // ---- the loading line: time and the real steps (config, fonts, the sign pictures) together
  let stepsDone = 0; const steps = [cfgReady, document.fonts ? document.fonts.ready : Promise.resolve(), ...boards.map((im) => new Promise((r) => { if (im.complete) r(); else { im.onload = im.onerror = r; } }))];
  steps.forEach((p) => Promise.resolve(p).catch(() => {}).then(() => stepsDone++));
  const need = short ? 1200 : 3700;
  const loaded = new Promise((res) => {
    const bar = $(".ix-bar i"), num = $(".ix-n");
    const step = () => {
      if (leaving) return res();
      const el = performance.now() - T0, tk = Math.min(1, el / need), sk = stepsDone / steps.length;
      const fin = tk >= 1 && (short || sk >= 1 || el > need + 2500);
      const show = fin ? 1 : short ? tk : Math.min(tk, 0.25 + 0.75 * sk);
      bar.style.transform = `scaleX(${show.toFixed(3)})`; num.textContent = Math.round(show * 100) + "%";
      if (fin) return res();
      requestAnimationFrame(step);
    };
    step();
  });

  // ---- sound: one synth "drop" on START, unless the city's sound is off
  const boom = () => {
    if (ls("dc.snd") === "0") return;
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)(), n = A.currentTime;
      const g = A.createGain(); g.connect(A.destination); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.45, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + 1.1);
      const o = A.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(880, n); o.frequency.exponentialRampToValueAtTime(42, n + 0.9);
      const f = A.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2400, n); f.frequency.exponentialRampToValueAtTime(200, n + 0.9);
      o.connect(f); f.connect(g); o.start(n); o.stop(n + 1.1);
      const k = A.createOscillator(), kg = A.createGain(); k.frequency.setValueAtTime(120, n); k.frequency.exponentialRampToValueAtTime(38, n + 0.4);
      kg.gain.setValueAtTime(0.9, n); kg.gain.exponentialRampToValueAtTime(0.0001, n + 0.5); k.connect(kg); kg.connect(A.destination); k.start(n); k.stop(n + 0.5);
      setTimeout(() => A.close(), 1500);
    } catch { /* no audio */ }
  };

  // ---- the way out: START (the push-in), SKIP / Escape / a tap in the short version (a crossfade)
  const finish = () => {
    clearInterval(tipT); clearInterval(sfxT); clearTimeout(autoT); removeEventListener("resize", onResize); removeEventListener("keydown", onKey);
    try { coast && coast.destroy(); } catch {}
    root.remove(); html.style.overflow = "";
    html.classList.add("ix-arrive"); setTimeout(() => html.classList.remove("ix-arrive"), 600);
    done(true);
  };
  const leave = (start) => {
    if (leaving) return; leaving = true;
    if (start && !still) {
      boom(); C.speed(3); root.classList.add("go");
      setTimeout(() => root.classList.add("flash"), 380);
      setTimeout(() => root.classList.add("out"), 420);
      setTimeout(finish, 800);
    } else { root.classList.add("out"); setTimeout(finish, 360); }
  };
  const onKey = (e) => { if (leaving) return; if (e.key === "Escape") leave(false); else if (short) leave(false); else if ((e.key === "Enter" || e.key === " ") && root.classList.contains("ready")) { e.preventDefault(); leave(true); } };
  addEventListener("keydown", onKey);
  $(".ix-skip").onclick = (e) => { e.stopPropagation(); leave(false); };
  $(".ix-start").onclick = (e) => { e.stopPropagation(); leave(true); };
  if (short) root.addEventListener("pointerdown", () => leave(false));

  // ---- reduced motion: one still frame, the words shown, a fade
  if (still) {
    C.set({ sun: 1, night: 1, lift: 0 }); await cfgReady; root.classList.add("lit", "named", "tagged");
    $(".ix-bar i").style.transform = "scaleX(1)"; $(".ix-n").textContent = "100%";
    await sleep(1200); return leave(false);
  }

  // ---- the short version (1.6 s)
  if (short) {
    C.start(); root.classList.add("in");
    C.to({ sun: 1 }, 800, "inout"); C.to({ night: 1 }, 1000, "linear");
    setTimeout(() => root.classList.add("flare"), 700);
    await sleep(800); await cfgReady; root.classList.add("named", "tagged");
    await loaded; if (leaving) return; $(".ix-pct span").textContent = t("ixReady", "CITY READY");
    await sleep(Math.max(0, 1250 - (performance.now() - T0))); return leave(false);
  }

  // ---- the full timeline
  C.start(); root.classList.add("in"); // bars in, the horizon line draws out, the caption types
  await sleep(250);
  root.classList.add("scene"); // the canvas fades up
  C.to({ lift: 0 }, 850, "out");
  await sleep(850);
  C.to({ sun: 1 }, 1200, "inout"); C.to({ night: 0.45 }, 1200, "linear"); // the sun drops
  await sleep(1200);
  root.classList.add("flare"); C.to({ night: 1 }, 500, "linear"); // the last sliver goes under: the horizon flares, the city switches on
  if (navigator.vibrate && phone && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(12); } catch {}
  await sleep(300);
  await cfgReady; root.classList.add("named"); // NOW ENTERING, then the name letter by letter
  await sleep(600);
  root.classList.add("tagged");
  await loaded; if (leaving) return;
  $(".ix-pct span").textContent = t("ixReady", "CITY READY");
  await sleep(Math.max(0, 3900 - (performance.now() - T0)));
  root.classList.add("ready");
  autoT = setTimeout(() => leave(true), 9000);
}
