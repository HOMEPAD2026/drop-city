// street-fx.js — how the streets feel and sound. Sounds are made in the browser (Web Audio, no files): footsteps, the
// punch's swoosh and thud, jump and landing, coins, the ATM alarm, the car's engine by its speed, crashes, a siren while
// you're hot, a stamp when a star lands, a little fanfare for a job. On by default; ♪ in the HUD turns them off (dc.snd).
// The look: a hit-stop and stars on every punch that lands, a combo counter, the hero squashing on landing and
// stretching on a jump, coins flying into the cash counter, a star stamped onto the HUD, a red / blue siren edge at three
// stars and up, JOB DONE stamped across the screen.
export function streetFx(A) {
  const { S, city, hooks } = A;
  let on = true; try { on = localStorage.getItem("dc.snd") !== "0"; } catch { /* */ }
  let ac = null, master = null;
  const ctx = () => { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination); } if (ac.state === "suspended") ac.resume().catch(() => {}); return ac; };
  addEventListener("pointerdown", () => on && ctx(), { once: true, capture: true }); addEventListener("keydown", () => on && ctx(), { once: true, capture: true });
  const noiseBuf = () => { const a = ctx(); if (!a) return null; if (!noiseBuf.b) { const b = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseBuf.b = b; } return noiseBuf.b; };
  function tone(f0, f1, dur, type = "sine", vol = 0.2, at = 0) { const a = ctx(); if (!a || !on) return; const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.08); }
  function noise(dur, f, q = 1, vol = 0.25, type = "bandpass", at = 0, f1 = null) { const a = ctx(); if (!a || !on) return; const t = a.currentTime + at, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02); }
  const SFX = {
    step: () => noise(0.06, 260 + Math.random() * 120, 1.2, 0.12, "lowpass"),
    swing: () => noise(0.14, 1800, 0.8, 0.12, "bandpass", 0, 600),
    hit: () => { tone(160, 45, 0.16, "sine", 0.45); noise(0.08, 2400, 0.7, 0.22); },
    jump: () => tone(300, 620, 0.14, "triangle", 0.12),
    land: () => { tone(110, 50, 0.12, "sine", 0.3); noise(0.08, 400, 1, 0.12, "lowpass"); },
    coin: () => { tone(1320, 1320, 0.07, "triangle", 0.14); tone(1760, 1760, 0.12, "triangle", 0.14, 0.07); },
    alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 900 : 1200, i % 2 ? 900 : 1200, 0.12, "square", 0.06, i * 0.14); },
    star: () => { tone(220, 110, 0.18, "square", 0.08); noise(0.1, 1200, 1, 0.15); },
    siren: () => { tone(650, 950, 0.45, "sawtooth", 0.035); tone(950, 650, 0.45, "sawtooth", 0.035, 0.45); },
    job: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, "triangle", 0.13, i * 0.09)),
    door: () => { tone(90, 60, 0.1, "square", 0.12); noise(0.06, 700, 1, 0.15); },
    crash: () => { noise(0.35, 900, 0.5, 0.35, "lowpass", 0, 200); tone(80, 40, 0.3, "sine", 0.4); },
    hurt: () => tone(200, 90, 0.2, "sawtooth", 0.12),
    // the site's old names (tone in site-x.js) → ours
    tick: () => SFX.coin(), sell: () => SFX.hurt(), win: () => SFX.job(), drop: () => { tone(220, 880, 0.5, "square", 0.06); }, buy: () => SFX.coin(),
  };
  const play = (k) => { if (on && SFX[k]) SFX[k](); };
  // the HUD's ♪: these sounds on / off (on unless turned off)
  const btn = document.getElementById("snd");
  const paint = () => { if (btn) { btn.classList.toggle("on", on); btn.title = on ? "Sounds on" : "Sounds off"; } };
  if (btn) btn.onclick = (e) => { e.stopPropagation(); on = !on; try { localStorage.setItem("dc.snd", on ? "1" : "0"); } catch { /* */ } paint(); if (on) { ctx(); SFX.coin(); } };
  paint();

  // ---- the car's engine: one oscillator pair while you drive, its pitch from the speed
  let eng = null;
  function engine(v) {
    const a = on && S.inCar ? ctx() : null;
    if (!a) { if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); const e = eng; setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch { /* */ } }, 300); eng = null; } return; }
    if (!eng) { const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = "sawtooth"; o2.type = "square"; f.type = "lowpass"; f.frequency.value = 600; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); eng = { o, o2, f, g }; }
    const k = Math.min(1, Math.abs(v) / 36), t = a.currentTime;
    eng.o.frequency.setTargetAtTime(48 + k * 110, t, 0.08); eng.o2.frequency.setTargetAtTime(24 + k * 55, t, 0.08); eng.f.frequency.setTargetAtTime(400 + k * 1400, t, 0.1); eng.g.gain.setTargetAtTime(0.05 + k * 0.05, t, 0.1);
  }

  // ---- the look
  const fxL = document.getElementById("fx"), cashEl = document.getElementById("cash");
  let combo = 0, comboT = 0, stepT = 0, sirenT = 0, last = { cash: A.me.cash, wanted: S.wanted, hp: S.hp }, squash = 0;
  A.on("swing", () => play("swing"));
  A.on("hit", (p) => {
    play("hit"); S.freeze = 0.07;
    combo = comboT > 0 ? combo + 1 : 1; comboT = 1.3;
    city.burst(p.x, 1.6, p.z, 0.12, [[1, 0.83, 0.42], [1, 1, 1]]);
    if (combo >= 2) A.pop(`×${combo}`, { x: p.x, z: p.z }, combo >= 4 ? "#ff2e88" : "#ffd36b", 3.6);
    if (navigator.vibrate) try { navigator.vibrate(combo >= 3 ? 25 : 12); } catch { /* */ }
  });
  A.on("jump", () => { play("jump"); squash = -0.18; });
  A.on("land", () => { play("land"); squash = 0.22; });
  A.on("job", () => { play("job"); stamp("JOB DONE", "#3dffb5"); });
  A.on("car-in", () => play("door")); A.on("car-out", () => { play("door"); engine(0); });
  A.on("crash", () => play("crash"));
  function stamp(text, color) { if (!fxL) return; const d = document.createElement("div"); d.className = "stamp"; d.textContent = text; d.style.color = color; d.style.borderColor = color; fxL.appendChild(d); setTimeout(() => d.remove(), 1900); }
  // coins fly from the hero into the cash counter
  const v3 = new A.THREE.Vector3();
  function coinsFly(n) {
    if (!fxL || !cashEl || !S.hero) return;
    v3.set(S.pos.x, S.pos.y + 1.6, S.pos.z).project(A.cam); if (v3.z > 1) return;
    const r = cashEl.getBoundingClientRect(), sx = ((v3.x + 1) / 2) * innerWidth, sy = ((1 - v3.y) / 2) * innerHeight, tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    for (let i = 0; i < Math.min(8, 2 + n); i++) {
      const c = document.createElement("i"); c.className = "flycoin"; c.style.left = sx + (Math.random() - 0.5) * 40 + "px"; c.style.top = sy + (Math.random() - 0.5) * 30 + "px";
      fxL.appendChild(c);
      requestAnimationFrame(() => { c.style.transition = `transform ${0.55 + i * 0.05}s cubic-bezier(0.5, -0.4, 0.7, 1), opacity 0.2s ${0.5 + i * 0.05}s`; c.style.transform = `translate(${tx - parseFloat(c.style.left)}px, ${ty - parseFloat(c.style.top)}px) scale(0.6)`; c.style.opacity = "0"; });
      setTimeout(() => c.remove(), 1200);
    }
    setTimeout(() => { cashEl.classList.remove("bump"); void cashEl.offsetWidth; cashEl.classList.add("bump"); play("coin"); }, 520);
  }
  hooks.step.push((dt) => {
    const hero = S.hero; if (!hero) return;
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    // landing squash / jump stretch, springing back
    squash += (0 - squash) * Math.min(1, dt * 10);
    hero.obj.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    // footsteps
    const c = hero.clip();
    if (!S.inCar && S.ground && (c === "Walking_A" || c === "Running_A")) { stepT -= dt; if (stepT <= 0) { stepT = c === "Running_A" ? 0.24 : 0.36; play("step"); } } else stepT = 0;
    // money, stars, hurts
    if (A.me.cash > last.cash + 0.5) coinsFly(Math.round((A.me.cash - last.cash) / 60));
    if (S.wanted > last.wanted) { play("star"); const w = document.getElementById("wl"), st = w && w.children[S.wanted - 1]; if (st) { st.classList.remove("stamp"); void st.offsetWidth; st.classList.add("stamp"); } }
    if (S.hp < last.hp) play("hurt");
    last = { cash: A.me.cash, wanted: S.wanted, hp: S.hp };
    // the heat: a siren edge and its sound at three stars and up
    document.body.classList.toggle("heat", S.wanted >= 3);
    if (S.wanted >= 3) { sirenT -= dt; if (sirenT <= 0) { sirenT = 2.4; play("siren"); } } else sirenT = 0;
    // the engine
    engine(S.inCar && A.car ? A.car.car.v : 0);
  });
  // ATM alarm: an ATM's cooldown starting = it was just cracked
  const cd = new Map();
  hooks.step.push(() => { for (const a of A.atms) { const was = cd.get(a) || 0; if (a.cd > 0 && was <= 0) play("alarm"); cd.set(a, a.cd); } });
  return { play, get on() { return on; }, stamp };
}
