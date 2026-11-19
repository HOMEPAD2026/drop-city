// roam.js — on foot in the city. Everyone who walks in gets a street name (a random crew handle, kept on the device)
// and a crew member (KayKit's CC0 rogues, the same rig and moves ARCIRCLE WORLD uses), then walks, runs, jumps and
// throws punches round CLOCK PLAZA: rival crews wander the streets (punch one and it fights back), ATMs can be cracked
// for street cash (a toy score, nothing on chain), every crime raises your WANTED level and three stars bring the
// helicopter. Walk up to a coin's tower to open its card. Nothing here touches a wallet.
// makeRoam(city, { onOpen(mint), toast(text) }) → { enter(), leave(), active, goTo(mint), me, ready }
import * as THREE from "/vendor/three/three-0.186.1.module.min.js";
import { GLTFLoader } from "/vendor/three/addons/GLTFLoader.js";
import { MeshoptDecoder } from "/vendor/three/addons/meshopt_decoder.module.js";
import * as SkeletonUtils from "/vendor/three/addons/SkeletonUtils.js";

export const LOOKS = { hood: { file: "rogue-hooded", name: "HOOD" }, thief: { file: "rogue", name: "THIEF" }, muscle: { file: "barbarian", name: "MUSCLE" }, runner: { file: "ranger", name: "RUNNER" } };
const ADJ = ["Neon", "Slick", "Midnight", "Chrome", "Shady", "Lucky", "Velvet", "Dirty", "Golden", "Smooth", "Rusty", "Silent", "Crooked", "Turbo", "Hustle", "Backstreet", "Nightshift", "Lowrider", "Burnout", "Redline", "Cashflow", "Wildcard", "Downtown", "Sunset", "Dockside", "Jackpot", "Rogue", "Stickup", "Getaway", "Overdrive"];
const NOUN = ["Wheelman", "Hustler", "Bandit", "Racketeer", "Kingpin", "Smuggler", "Fixer", "Lookout", "Grifter", "Outlaw", "Heister", "Boss", "Runner", "Shark", "Ace", "Mobster", "Muscle", "Safecracker", "Driver", "Dealer", "Capo", "Enforcer", "Wiseguy", "Hotshot", "Drifter", "Crook", "Snitch", "Bruiser", "Joyrider", "Bagman"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const randomHandle = () => { let n = ""; do n = pick(ADJ) + pick(NOUN) + (10 + Math.floor(Math.random() * 90)); while (n.length > 20); return n; };
export const cleanHandle = (s) => String(s || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
export function loadMe() {
  let me = null; try { me = JSON.parse(localStorage.getItem("dc.me") || "null"); } catch { /* */ }
  if (!me || !cleanHandle(me.name) || !LOOKS[me.look]) { me = { name: randomHandle(), look: pick(Object.keys(LOOKS)), cash: 0, fresh: true }; saveMe(me); }
  me.cash = Math.max(0, Number(me.cash) || 0); return me;
}
export function saveMe(me) { try { localStorage.setItem("dc.me", JSON.stringify({ name: me.name, look: me.look, cash: Math.round(me.cash) })); } catch { /* */ } }

// ---------------- bodies: one rig file each, one shared moves file
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const gl = (u) => new Promise((res, rej) => loader.load(u, res, undefined, rej));
let movesP = null; const srcP = {};
const moves = () => movesP || (movesP = gl("/models/crew/moves.glb").then((g) => new Map(g.animations.map((c) => [c.name, c]))).catch((e) => { movesP = null; throw e; }));
const src = (f) => srcP[f] || (srcP[f] = gl(`/models/crew/${f}.glb`).catch((e) => { delete srcP[f]; throw e; }));
// the game's names → the KayKit clips (there is no "run": moving is walk or sprint)
const AS = { idle: "Idle_A", walk: "Walking_A", sprint: "Running_A", jump: "Jump_Full_Short", hit: "Hit_A", die: "Death_A", punch: "Melee_Unarmed_Attack_Punch_A", wave: "Waving", cheer: "Cheering", spawn: "Spawn_Ground", dodge: "Dodge_Forward", drive: "Sit_Chair_Idle" };
const HOLD = new Set(["Death_A"]);
const NAME_OF = Object.fromEntries(Object.entries(AS).map(([k, v]) => [v, k]));
export const clipName = (c) => NAME_OF[c] || "idle";
async function makeBody(look, { tint = null, glow = 0.1 } = {}) {
  const [g, clips] = await Promise.all([src(LOOKS[look].file), moves()]);
  const inner = SkeletonUtils.clone(g.scene);
  const box = new THREE.Box3().setFromObject(inner), h = box.max.y - box.min.y || 1, k = 2.1 / h;
  inner.scale.setScalar(k); inner.position.y = -box.min.y * k;
  inner.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false;
    const m = o.material.clone(); if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = glow; } if (tint) m.color.multiply(new THREE.Color(tint)); o.material = m; });
  const obj = new THREE.Group(); obj.add(inner);
  const mixer = new THREE.AnimationMixer(inner), acts = {};
  const act = (n) => { const cn = AS[n] || n; if (!acts[cn]) { const c = clips.get(cn); if (!c) return null; acts[cn] = mixer.clipAction(c); } return acts[cn]; };
  let cur = null, one = null;
  const SOFT = new Set(["Waving", "Cheering", "Spawn_Ground"]); // a wave or a spawn gives way to walking; a punch, a hit or a jump plays out
  const play = (n, { once = false, speed = 1, fade = 0.16 } = {}) => {
    const a = act(n); if (!a) return null;
    if (!once && one && SOFT.has(one.getClip().name)) one = null;
    if (!once && cur === a && !one) { a.timeScale = speed; return a; }
    a.reset(); a.timeScale = speed; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once && HOLD.has(a.getClip().name);
    if (cur && cur !== a) cur.crossFadeTo(a, fade, false);
    a.play(); cur = a;
    if (once) { one = a; const done = (e) => { if (e.action !== a) return; mixer.removeEventListener("finished", done); if (one === a) one = null; if (!a.clampWhenFinished && cur === a) { const i = act("idle"); i.reset().play(); a.crossFadeTo(i, 0.18, false); cur = i; } }; mixer.addEventListener("finished", done); }
    return a;
  };
  play("idle");
  return { obj, mixer, play, busy: () => !!one && !SOFT.has(one.getClip().name), clip: () => cur && cur.getClip().name, update: (dt) => mixer.update(dt) };
}
const tagTex = (text, color) => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96; const x = c.getContext("2d");
  x.font = "800 46px Inter, system-ui, sans-serif"; const w = Math.min(500, x.measureText(text).width + 40);
  x.fillStyle = "rgba(7,7,8,0.72)"; x.beginPath(); x.roundRect((512 - w) / 2, 14, w, 68, 34); x.fill();
  x.strokeStyle = color; x.lineWidth = 4; x.stroke(); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const tagOf = (text, color = "#ff2e88") => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(text, color), color: 0xb8b8b8, transparent: true, depthWrite: false, toneMapped: false })); /* a little grey: the bloom left white text a blur */ s.scale.set(2.6, 0.49, 1); s.position.y = 2.75; s.renderOrder = 5; return s; };

const PHONE = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const WALK = 4.2, SPRINT = 8.6, JUMP_V = 9, GRAV = 24, R = 0.45;

export { makeBody, tagOf, tagTex };
export function makeRoam(city, { onOpen = () => {}, toast = () => {}, sound = () => {} } = {}) {
  const { scene, cam, canvas, world } = city;
  const me = loadMe();
  const $ = (id) => document.getElementById(id);
  const S = { active: false, ready: false, hero: null, tag: null, pos: new THREE.Vector3(0, 0, 18), vy: 0, ground: true, yaw: 0, hp: 100, down: 0, hurtT: 0,
    camYaw: 0, camPitch: 0.34, camDist: PHONE ? 9.5 : 8.5, blend: 1, from: new THREE.Vector3(), wanted: 0, wantT: 0, atkLock: 0, near: null };
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  // the street's add-ons (street-*.js) hang off these: punch(fx, fz) -> hit?, step(dt), act() -> { label, key, run } | null
  // (the first one wins the action button), key(k, down) -> used?, drive(dt, input) -> true while it moves you (a car)
  const hooks = { punch: [], step: [], act: [], key: [], drive: null };

  // ---------------- what's solid: the city's blocks, the coins' towers, the plaza's hub, the edges
  function collide(p, r = R) {
    for (const [x, z, , w] of city.solids) { const hw = w / 2 + r; const dx = p.x - x, dz = p.z - z; if (Math.abs(dx) > hw || Math.abs(dz) > hw) continue;
      const ox = hw - Math.abs(dx), oz = hw - Math.abs(dz); if (ox < oz) p.x = x + Math.sign(dx || 1) * hw; else p.z = z + Math.sign(dz || 1) * hw; }
    for (const t of city.towers.values()) { const hw = t.body.scale.x / 2 + r, x = t.group.position.x, z = t.group.position.z, dx = p.x - x, dz = p.z - z; if (Math.abs(dx) > hw || Math.abs(dz) > hw) continue;
      const ox = hw - Math.abs(dx), oz = hw - Math.abs(dz); if (ox < oz) p.x = x + Math.sign(dx || 1) * hw; else p.z = z + Math.sign(dz || 1) * hw; }
    for (const a of atms) { const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), m = 1 + r; if (d < m && d > 1e-4) { p.x = a.x + dx / d * m; p.z = a.z + dz / d * m; } }
    { const d = Math.hypot(p.x, p.z), m = world.hub + r; if (d < m) { const k = d > 1e-4 ? m / d : 0; p.x = d > 1e-4 ? p.x * k : m; p.z *= k; } }
    const E = world.HALF + 22; p.x = clamp(p.x, world.SEA_X + 8, E); p.z = clamp(p.z, -E, E);
  }

  // ---------------- ATMs round the plaza: three punches crack one
  const atms = [];
  { const box = new THREE.BoxGeometry(1.3, 2.1, 0.9); box.translate(0, 1.05, 0);
    const scr = new THREE.PlaneGeometry(0.9, 0.55);
    const signC = document.createElement("canvas"); signC.width = 256; signC.height = 96; const sx = signC.getContext("2d");
    sx.font = "italic 900 70px Anton, Impact, sans-serif"; sx.textAlign = "center"; sx.textBaseline = "middle"; sx.shadowColor = "#3dffb5"; sx.shadowBlur = 16; sx.fillStyle = "#3dffb5"; sx.fillText("ATM", 128, 52); sx.fillText("ATM", 128, 52);
    const signT = new THREE.CanvasTexture(signC); signT.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * Math.PI * 2 + 0.13, r = world.RING + 13, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z);
      g.add(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x1c1a1e, metalness: 0.7, roughness: 0.3 })));
      const s = new THREE.Mesh(scr, new THREE.MeshBasicMaterial({ color: 0x3dffb5, toneMapped: false })); s.position.set(0, 1.45, 0.46); g.add(s);
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signT, transparent: true, toneMapped: false })); sign.scale.set(2.2, 0.82, 1); sign.position.y = 2.9; g.add(sign);
      root.add(g); atms.push({ x, z, g, s, sign, hp: 3, cd: 0 });
    }
  }

  // ---------------- rival crews: they wander; punch one and it fights back
  const rivals = [];
  const RIVALS = PHONE ? 4 : 7;
  const spot = () => { for (let k = 0; k < 30; k++) { const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 90, p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); const q = p.clone(); collide(q, 0.6); if (q.distanceTo(p) < 0.01) return p; } return new THREE.Vector3(0, 0, 30); };
  async function spawnRivals() {
    const looks = ["muscle", "hood", "thief", "runner"];
    for (let i = 0; i < RIVALS; i++) {
      try {
        const b = await makeBody(looks[i % looks.length], { tint: [0xff9a9a, 0xb8a4ff, 0xffd08a, 0x9affd2][i % 4], glow: 0.22 });
        const n = { b, pos: spot(), yaw: Math.random() * 6.28, hp: 3, st: "wander", tgt: null, wait: Math.random() * 2, atk: 0, chaseT: 0, downT: 0, name: randomHandle() };
        b.obj.position.copy(n.pos); const t = tagOf(n.name, "#ff4d6d"); t.scale.set(2.3, 0.43, 1); b.obj.add(t); n.tag = t;
        root.add(b.obj); rivals.push(n);
      } catch (e) { console.warn("rival", e); }
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  function stepRival(n, dt) {
    n.b.update(dt);
    if (n.st === "down") { n.downT -= dt; if (n.downT <= 0) { n.pos.copy(spot()); n.hp = 3; n.st = "wander"; n.tag.visible = true; n.b.play("spawn", { once: true }); } n.b.obj.position.copy(n.pos); return; }
    const toMe = new THREE.Vector3().subVectors(S.pos, n.pos); toMe.y = 0; const dMe = toMe.length();
    let speed = 0, face = null;
    if (n.st === "chase" && (dMe > 45 || (n.chaseT -= dt) <= 0 || S.down > 0)) { n.st = "wander"; n.tgt = null; }
    if (n.st === "chase") {
      face = Math.atan2(toMe.x, toMe.z);
      if (dMe > 1.5) speed = 6.2;
      else if ((n.atk -= dt) <= 0 && !n.b.busy()) { n.atk = 1.1 + Math.random() * 0.6; n.b.play("punch", { once: true, speed: 1.5 });
        setTimeout(() => { if (n.st === "chase" && n.pos.distanceTo(S.pos) < 2 && S.down <= 0) hurtMe(9, n.pos); }, 330); }
    } else {
      if (!n.tgt || n.pos.distanceTo(n.tgt) < 1.2) { if ((n.wait -= dt) <= 0) { n.tgt = n.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)); collide(n.tgt, 0.6); n.wait = 1 + Math.random() * 3; } }
      else { face = Math.atan2(n.tgt.x - n.pos.x, n.tgt.z - n.pos.z); speed = 2.1; }
    }
    if (face != null) n.yaw += angDiff(n.yaw, face) * Math.min(1, dt * 8);
    if (n.knock) { n.pos.addScaledVector(n.knock, dt * 6); n.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); if (n.knock.lengthSq() < 0.01) n.knock = null; }
    if (speed && !n.b.busy()) { n.pos.x += Math.sin(n.yaw) * speed * dt; n.pos.z += Math.cos(n.yaw) * speed * dt; n.b.play(speed > 4 ? "sprint" : "walk", { speed: speed > 4 ? 1.1 : 0.95 }); }
    else if (!n.b.busy()) n.b.play("idle");
    if (dMe < 1.1) n.pos.addScaledVector(toMe.normalize(), -(1.1 - dMe));
    collide(n.pos, 0.5); n.b.obj.position.copy(n.pos); n.b.obj.rotation.y = n.yaw;
  }

  // ---------------- you
  async function build() {
    if (S.hero) { root.remove(S.hero.obj); S.hero = null; }
    const b = await makeBody(me.look); S.hero = b;
    S.tag = tagOf(me.name, "#ff2e88"); b.obj.add(S.tag);
    b.obj.position.copy(S.pos); root.add(b.obj);
  }
  function setName(n) { me.name = cleanHandle(n) || me.name; saveMe(me); if (S.tag) { S.tag.material.map.dispose(); S.tag.material.map = tagTex(me.name, "#ff2e88"); } paintHud(); }
  async function setLook(l) { if (!LOOKS[l]) return; me.look = l; saveMe(me); if (S.hero) { const yaw = S.yaw; await build(); S.yaw = yaw; } paintHud(); }
  function hurtMe(dmg, from) {
    if (S.down > 0 || S.hurtT > 0) return; S.hurtT = 0.4; S.hp = Math.max(0, S.hp - dmg);
    const k = new THREE.Vector3().subVectors(S.pos, from).setY(0).normalize(); S.knock = k.multiplyScalar(1.2);
    flash("hurt"); sound("sell"); if (navigator.vibrate) try { navigator.vibrate(30); } catch { /* */ }
    if (S.hp <= 0) { S.down = 3.2; S.hero.play("die", { once: true }); me.cash = Math.floor(me.cash * 0.5); saveMe(me); bigText("KNOCKED OUT", "#ff4d6d"); toast("Knocked out — you dropped half your street cash. Back on your feet at the plaza."); }
    else S.hero.play("hit", { once: true, speed: 1.3 });
    paintHud();
  }
  function crime(n = 1) { S.wanted = Math.min(5, S.wanted + n); S.wantT = 22; sound("siren"); paintHud(); }
  function punch() {
    if (!S.active || !S.hero || S.down > 0 || S.atkLock > 0 || S.inCar) return;
    S.atkLock = 0.5; S.hero.play("punch", { once: true, speed: 1.7, fade: 0.06 });
    setTimeout(() => {
      const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw); let hit = false;
      for (const n of rivals) { if (n.st === "down") continue; const dx = n.pos.x - S.pos.x, dz = n.pos.z - S.pos.z, d = Math.hypot(dx, dz);
        if (d < 2.3 && (dx * fx + dz * fz) / (d || 1) > 0.2) { hit = true; n.hp--; n.knock = new THREE.Vector3(dx / (d || 1), 0, dz / (d || 1)).multiplyScalar(1.4); pop("POW!", n.pos, "#ffd36b");
          if (n.hp <= 0) { n.st = "down"; n.downT = 10; n.tag.visible = false; n.b.play("die", { once: true }); const loot = 40 + Math.floor(Math.random() * 80); me.cash += loot; saveMe(me); pop(`+$${loot}`, n.pos, "#3dffb5", 2.6); crime(1); city.burst(n.pos.x, 2, n.pos.z, 0.25); }
          else { n.b.play("hit", { once: true, speed: 1.3 }); n.st = "chase"; n.chaseT = 18; n.atk = 0.7; } } }
      for (const a of atms) { if (a.cd > 0) continue; const dx = a.x - S.pos.x, dz = a.z - S.pos.z, d = Math.hypot(dx, dz);
        if (d < 2.6 && (dx * fx + dz * fz) / (d || 1) > 0.1) { hit = true; a.hp--; pop(a.hp > 0 ? "CRACK!" : "JACKPOT!", { x: a.x, z: a.z }, "#3dffb5");
          if (a.hp <= 0) { a.cd = 45; a.hp = 3; a.s.material.color.setHex(0x3a0d1c); a.sign.material.opacity = 0.25; const loot = 300 + Math.floor(Math.random() * 400); me.cash += loot; saveMe(me); pop(`+$${loot}`, { x: a.x, z: a.z }, "#ffd36b", 2.8); city.burst(a.x, 2.4, a.z, 0.45); crime(1); sound("win"); } } }
      for (const f of hooks.punch) if (f(fx, fz)) hit = true;
      if (hit) { sound("tick"); shake = 0.18; if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* */ } }
      paintHud();
    }, 230);
  }
  function jump() { if (!S.active || !S.ground || S.down > 0 || S.inCar) return; S.vy = JUMP_V; S.ground = false; S.hero.play("jump", { once: true, speed: 1.55, fade: 0.08 }); }

  // ---------------- input: keys; a thumb stick + buttons on phones; drag anywhere else to look round
  const keys = new Set(), stick = { x: 0, y: 0, on: false };
  const onKey = (e, down) => {
    if (!S.active || (e.target && e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"))) return;
    const k = e.key.toLowerCase();
    if (down && (k === " " || k === "spacebar")) { e.preventDefault(); jump(); return; }
    if (down && (k === "f" || k === "j")) { punch(); return; }
    for (const f of hooks.key) if (f(k, down, e)) return;
    if (down && k === "e" && S.act) { S.act.run(); return; }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) { e.preventDefault(); down ? keys.add(k) : keys.delete(k); }
  };
  addEventListener("keydown", (e) => onKey(e, true)); addEventListener("keyup", (e) => onKey(e, false)); addEventListener("blur", () => keys.clear());
  // looking: drag on the city
  const look = new Map(); let lookMoved = 0, pinch = 0, shake = 0;
  canvas.addEventListener("pointerdown", (e) => { if (!S.active) return; look.set(e.pointerId, [e.clientX, e.clientY]); lookMoved = 0; pinch = 0; });
  addEventListener("pointermove", (e) => {
    if (!S.active || !look.has(e.pointerId)) return; const [px, py] = look.get(e.pointerId); look.set(e.pointerId, [e.clientX, e.clientY]);
    if (look.size === 2) { const [a, b] = [...look.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) S.camDist = clamp(S.camDist * pinch / d, 4, 22); pinch = d; return; }
    const dx = e.clientX - px, dy = e.clientY - py; lookMoved += Math.abs(dx) + Math.abs(dy);
    S.camYaw -= dx * 0.006; S.camPitch = clamp(S.camPitch + dy * 0.004, 0.05, 1.1); S.lookT = 2.5;
  });
  addEventListener("pointerup", (e) => { if (!S.active || !look.has(e.pointerId)) return; look.delete(e.pointerId);
    if (lookMoved < 6 && !look.size) tapPick(e.clientX, e.clientY); });
  canvas.addEventListener("wheel", (e) => { if (!S.active) return; e.preventDefault(); S.camDist = clamp(S.camDist * (1 + Math.sign(e.deltaY) * 0.1), 4, 22); }, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tapPick(x, y) { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects([...city.towers.values()].flatMap((t) => [t.body, t.sign]), false)[0]; if (hit) onOpen(hit.object.userData.mint); }
  // the thumb stick
  const stickEl = $("stick"), knob = stickEl && stickEl.querySelector("i");
  if (stickEl) {
    let id = null, c0 = null;
    const at = (e) => { const r = stickEl.getBoundingClientRect(), R0 = r.width / 2; let dx = (e.clientX - (r.left + R0)) / R0, dy = (e.clientY - (r.top + R0)) / R0; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * R0 * 0.55}px, ${dy * R0 * 0.55}px)`; };
    stickEl.addEventListener("pointerdown", (e) => { id = e.pointerId; c0 = 1; stick.on = true; stickEl.setPointerCapture(id); at(e); e.preventDefault(); });
    stickEl.addEventListener("pointermove", (e) => { if (e.pointerId === id) at(e); });
    const up = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ""; void c0; };
    stickEl.addEventListener("pointerup", up); stickEl.addEventListener("pointercancel", up);
  }
  const holdBtn = (el, f) => el && el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); f(); el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 140); });
  holdBtn($("b-jump"), jump); holdBtn($("b-hit"), punch);
  const actEl = $("act"); if (actEl) actEl.onclick = () => S.act && S.act.run();

  // ---------------- screen bits: the HUD, hit words, big words, flashes
  const fxL = $("fx");
  const proj = new THREE.Vector3();
  function pop(text, p, color = "#fff", y = 2.4) {
    if (!fxL) return; proj.set(p.x, y, p.z).project(cam); if (proj.z > 1) return;
    const r = canvas.getBoundingClientRect(), d = document.createElement("b"); d.className = "pop"; d.textContent = text; d.style.color = color;
    d.style.left = ((proj.x + 1) / 2 * r.width) + "px"; d.style.top = ((1 - proj.y) / 2 * r.height) + "px"; fxL.appendChild(d); setTimeout(() => d.remove(), 900);
  }
  function bigText(text, color) { if (!fxL) return; const d = document.createElement("div"); d.className = "big"; d.textContent = text; d.style.color = color; fxL.appendChild(d); setTimeout(() => d.remove(), 2200); }
  function flash(kind) { document.body.classList.remove("hurt"); void document.body.offsetWidth; document.body.classList.add(kind); setTimeout(() => document.body.classList.remove(kind), 300); }
  function paintHud() {
    const n = $("me-name"); if (n) n.textContent = me.name;
    const l = $("me-look"); if (l) l.textContent = LOOKS[me.look].name;
    const c = $("cash"); if (c) c.textContent = "$" + Math.round(me.cash).toLocaleString("en-US");
    const w = $("wl"); if (w) { w.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < S.wanted ? "on" : ""}">★</i>`).join(""); w.classList.toggle("hot", S.wanted >= 3); }
    const h = $("hp"); if (h) { h.style.width = S.hp + "%"; h.parentElement.classList.toggle("low", S.hp < 35); }
  }

  // ---------------- the loop (the city calls it while you're on foot)
  const camAt = new THREE.Vector3(), camWant = new THREE.Vector3(), head = new THREE.Vector3(), dir = new THREE.Vector3();
  let towerBodies = [], tbT = 0, lastNear = null;
  function step(dt) {
    const hero = S.hero; if (!hero) return;
    // moving
    let fwd = 0, side = 0;
    if (keys.has("w") || keys.has("arrowup")) fwd += 1; if (keys.has("s") || keys.has("arrowdown")) fwd -= 1;
    if (keys.has("d") || keys.has("arrowright")) side += 1; if (keys.has("a") || keys.has("arrowleft")) side -= 1;
    let amt = Math.min(1, Math.hypot(fwd, side)), run = keys.has("shift");
    if (stick.on) { fwd = -stick.y; side = stick.x; amt = Math.min(1, Math.hypot(fwd, side)); run = amt > 0.82; }
    const fx = -Math.sin(S.camYaw), fz = -Math.cos(S.camYaw);
    let mx = fx * fwd + -fz * side, mz = fz * fwd + fx * side; const ml = Math.hypot(mx, mz);
    if (S.down > 0) { S.down -= dt; if (S.down <= 0) { S.hp = 100; S.pos.set(0, 0, 18); S.vy = 0; S.wanted = 0; hero.play("spawn", { once: true }); paintHud(); } mx = mz = 0; }
    const driving = !!(hooks.drive && S.inCar && hooks.drive(dt, { fwd, side, run, amt, stick: stick.on }));
    const moving = !driving && ml > 0.08 && S.down <= 0 && !(hero.clip() === "Melee_Unarmed_Attack_Punch_A" && S.ground);
    if (moving) {
      mx /= ml; mz /= ml; const sp = (run ? SPRINT : WALK) * (stick.on ? Math.max(0.45, amt) : 1);
      S.pos.x += mx * sp * dt; S.pos.z += mz * sp * dt;
      S.yaw += angDiff(S.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
      if (S.ground && !hero.busy()) hero.play(run ? "sprint" : "walk", { speed: run ? 1.15 : Math.max(0.8, sp / 4.6) });
      if (!S.lookT) S.camYaw += angDiff(S.camYaw, S.yaw + Math.PI) * Math.min(1, dt * 0.9) * (fwd > 0.3 ? 1 : 0.25);
    } else if (!driving && S.ground && !hero.busy() && S.down <= 0) hero.play("idle");
    if (S.knock) { S.pos.addScaledVector(S.knock, dt * 6); S.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); if (S.knock.lengthSq() < 0.01) S.knock = null; }
    // jumping
    if (!S.ground) { S.vy -= GRAV * dt; S.pos.y += S.vy * dt; if (S.pos.y <= 0) { S.pos.y = 0; S.vy = 0; S.ground = true; city.burst(S.pos.x, 0.2, S.pos.z, 0.06); } }
    if (!driving) { collide(S.pos); hero.obj.position.copy(S.pos); hero.obj.rotation.y = S.yaw; }
    hero.update(dt);
    S.atkLock = Math.max(0, S.atkLock - dt); S.hurtT = Math.max(0, S.hurtT - dt); if (S.lookT) S.lookT = Math.max(0, S.lookT - dt);
    // the others
    for (const n of rivals) stepRival(n, dt);
    for (const a of atms) if (a.cd > 0) { a.cd -= dt; if (a.cd <= 0) { a.s.material.color.setHex(0x3dffb5); a.sign.material.opacity = 1; } }
    // wanted: cools off; three stars bring the helicopter
    if (S.wanted > 0 && (S.wantT -= dt) <= 0) { S.wanted--; S.wantT = 14; paintHud(); }
    city.setHeliTarget(S.wanted >= 3 ? S.pos : null);
    for (const f of hooks.step) f(dt);
    // the action button: the first add-on with something to do here, else the nearest tower's card
    let act = null; for (const f of hooks.act) { act = f(); if (act) break; }
    S.near = null;
    if (!act && !S.inCar) {
      let near = null, nd = 1e9;
      for (const t of city.towers.values()) { const hw = t.body.scale.x / 2, dx = Math.max(0, Math.abs(S.pos.x - t.group.position.x) - hw), dz = Math.max(0, Math.abs(S.pos.z - t.group.position.z) - hw), d = Math.hypot(dx, dz); if (d < 3.2 && d < nd) { nd = d; near = t; } }
      if (near) { const m = near.coin.mint; S.near = m; act = { label: `OPEN $${near.coin.symbol || ""}`, id: "t:" + m, run: () => onOpen(m) }; }
    }
    S.act = act;
    const aid = act ? act.id || act.label : null;
    if (aid !== lastNear) { lastNear = aid; if (actEl) { actEl.hidden = !act; if (act) actEl.innerHTML = `<b>${String(act.label).replace(/[<>&"]/g, "")}</b><small>${PHONE ? "TAP" : act.key || "E"}</small>`; } }
    if (driving && !S.lookT) S.camYaw += angDiff(S.camYaw, S.yaw + Math.PI) * Math.min(1, dt * 3);
    // the camera: behind you, above, pulled in when a building is in the way
    head.set(S.pos.x, S.pos.y + 1.7, S.pos.z);
    const c = Math.cos(S.camPitch);
    camWant.set(head.x + Math.sin(S.camYaw) * c * S.camDist, head.y + Math.sin(S.camPitch) * S.camDist, head.z + Math.cos(S.camYaw) * c * S.camDist);
    if ((tbT -= dt) <= 0) { tbT = 1; towerBodies = [city.bodies, ...[...city.towers.values()].map((t) => t.body)]; }
    dir.subVectors(camWant, head); const full = dir.length(); dir.normalize(); ray.set(head, dir); ray.far = full;
    const hit = ray.intersectObjects(towerBodies, false)[0]; if (hit) camWant.copy(head).addScaledVector(dir, Math.max(1.5, hit.distance - 0.6));
    if (S.inCar) { camWant.y += 1.4; }
    if (S.blend < 1) { S.blend = Math.min(1, S.blend + dt / 1.3); const k = 1 - Math.pow(1 - S.blend, 3); camAt.lerpVectors(S.from, camWant, k); }
    else camAt.lerp(camWant, Math.min(1, dt * 10));
    cam.position.copy(camAt); if (shake > 0) { shake -= dt; cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake; }
    cam.lookAt(head);
  }

  // ---------------- in and out
  async function enter() {
    document.body.classList.add("street");
    if (!S.ready) {
      document.body.classList.add("street-loading");
      try { await build(); S.ready = true; spawnRivals(); }
      catch (e) { document.body.classList.remove("street", "street-loading"); toast("Couldn't load your character — check the connection and try again."); console.warn(e); return false; }
      document.body.classList.remove("street-loading");
    }
    S.active = true; root.visible = true; S.from.copy(cam.position); S.blend = 0; S.yaw = S.yaw || 0; S.camYaw = S.yaw + Math.PI; camAt.copy(cam.position);
    city.setControl(step); paintHud();
    if (me.fresh) { me.fresh = false; setTimeout(() => { bigText(`WELCOME, ${me.name.toUpperCase()}`, "#fff"); S.hero && S.hero.play("wave", { once: true }); }, 900); }
    return true;
  }
  function leave() { S.active = false; root.visible = false; keys.clear(); city.setControl(null); city.setHeliTarget(null); document.body.classList.remove("street"); if (actEl) actEl.hidden = true; lastNear = null; }
  function goTo(mint) {
    const t = city.towers.get(mint); if (!t) return;
    const p = t.group.position, d = Math.hypot(p.x, p.z) || 1, hw = t.body.scale.x / 2 + 2.2;
    S.pos.set(p.x - (p.x / d) * hw, 0, p.z - (p.z / d) * hw); collide(S.pos); S.yaw = Math.atan2(p.x - S.pos.x, p.z - S.pos.z); S.camYaw = S.yaw + Math.PI; S.from.copy(cam.position); S.blend = 0.35; flash("warp");
  }
  // what the add-ons get to work with
  const api = { THREE, S, me, root, city, cam, hooks, makeBody, tagOf, tagTex, pop, bigText, flash, hurtMe, crime, collide, paintHud, sound, toast, saveMe, onOpen, PHONE, rivals, atms, keys, stick, clipName,
    shake: (k) => { shake = Math.max(shake, k); } };
  return { enter, leave, goTo, me, setName, setLook, get active() { return S.active; }, get ready() { return S.ready; }, randomHandle, state: S, rivals, api, hooks };
}
