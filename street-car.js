// street-car.js — take a car off the road and drive it. Walk up to a passing car and press E (or tap STEAL CAR): the car
// stops, you're behind the wheel (it's a crime: one wanted star). WASD / the stick drive it (Shift = boost), E / GET OUT
// leaves it parked where it stands; the road gets its car back a little later. Rivals in the way are knocked flat;
// walls stop you. Other players see your car (street-net.js draws it with carOf). Traffic doesn't stop for people on foot.
const PALETTE = [0xff2e88, 0x111111, 0xf4f4f4, 0x1a1a1a, 0x2b2b2b, 0xd91a6b, 0xffd36b, 0x3dffb5, 0x5ce1ff, 0x9b6bff, 0xff7a3d, 0xc0c0c0];
import { load } from "/models.js";
export function streetCar(A) {
  const { THREE, S, root, city, hooks, PHONE } = A;
  // one convertible, drawn from boxes: the paint's material per colour, the rest shared
  const G = {
    body: new THREE.BoxGeometry(2.1, 0.62, 4.5).translate(0, 0.62, 0),
    nose: new THREE.BoxGeometry(2.0, 0.34, 1.4).translate(0, 1.0, 1.45),
    tail: new THREE.BoxGeometry(2.0, 0.34, 1.1).translate(0, 1.0, -1.65),
    glass: new THREE.BoxGeometry(1.9, 0.5, 0.12).translate(0, 1.32, 0.72),
    wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14).rotateZ(Math.PI / 2),
    lamp: new THREE.PlaneGeometry(0.55, 0.2),
  };
  const M = { tyre: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }), glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false, side: THREE.DoubleSide }), tailL: new THREE.MeshBasicMaterial({ color: 0xff2350, toneMapped: false, side: THREE.DoubleSide }) };
  const paints = new Map();
  const paint = (hex) => { if (!paints.has(hex)) paints.set(hex, new THREE.MeshStandardMaterial({ color: hex, metalness: 0.35, roughness: 0.3, emissive: hex, emissiveIntensity: 0.1 })); return paints.get(hex); };
  // the real car: ARCIRCLE KART's ROCKET ROADSTER (models/street/car.glb, packed by ARCIRCLE WORLD; its nose at −X like
  // the karts', turned to face +Z here), fitted to 4.6 m; the drawn convertible until it's in (and for the police)
  let real = null;
  load(city.renderer, "/models/street/car.glb").then((g) => { const o = g.scene; o.rotation.y = Math.PI / 2; o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), k = 4.6 / Math.max(sz.x, sz.z); o.scale.multiplyScalar(k); o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y; real = o; }).catch((e) => console.warn("car", e));
  const GOLD = new THREE.Color(0xffd36b);
  function carOf(ci = 1, hex = null, box = false) {
    if (real && !box) { const c = new THREE.Group(), o = real.clone(true); c.add(o); c.userData.real = true;
      if (ci === 7) o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = GOLD; m.material.emissiveIntensity = 0.35; } }); // a holder's car glows gold
      return c; }
    const c = new THREE.Group(), pm = paint(hex != null ? hex : PALETTE[(ci - 1 + PALETTE.length) % PALETTE.length]);
    for (const g of [G.body, G.nose, G.tail]) c.add(new THREE.Mesh(g, pm));
    c.add(new THREE.Mesh(G.glass, M.glass));
    for (const [x, z] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) { const w = new THREE.Mesh(G.wheel, M.tyre); w.position.set(x, 0.42, z); c.add(w); }
    for (const x of [-0.65, 0.65]) { const h = new THREE.Mesh(G.lamp, M.head); h.position.set(x, 0.85, 2.26); c.add(h); const t = new THREE.Mesh(G.lamp, M.tailL); t.position.set(x, 0.85, -2.26); t.rotation.y = Math.PI; c.add(t); }
    return c;
  }
  A.carOf = carOf;
  const car = { mesh: null, v: 0, yaw: 0, pos: new THREE.Vector3(), slot: -1, ci: 1 };
  const parked = []; // { mesh, pos, yaw, ci }
  let savedDist = null;

  // a passing traffic car or a parked one within reach
  function carNear() {
    let best = null, bd = 4.2;
    for (const [i, c] of city.traffic.entries()) { if (c.hold || c.x == null) continue; const d = Math.hypot(c.x - S.pos.x, c.z - S.pos.z); if (d < bd) { bd = d; best = { kind: "road", i, c }; } }
    for (const p of parked) { const d = Math.hypot(p.pos.x - S.pos.x, p.pos.z - S.pos.z); if (d < bd) { bd = d; best = { kind: "park", p }; } }
    return best;
  }
  function getIn(n) {
    if (n.kind === "road") { const c = n.c; c.hold = 1e9; car.slot = n.i; car.ci = S.perk === "boss" || S.perk === "made" ? 7 : (n.i % 6) + 1; car.pos.set(c.x, 0, c.z); car.yaw = c.yaw; car.mesh = carOf(car.ci); /* a holder's car comes out gold */ A.crime(1); A.pop("CAR STOLEN", car.pos, "#ffd36b", 2.4); }
    else { const p = n.p; parked.splice(parked.indexOf(p), 1); car.mesh = p.mesh; car.pos.copy(p.pos); car.yaw = p.yaw; car.ci = p.ci; car.slot = p.slot; }
    root.add(car.mesh); car.v = 0; S.inCar = true; S.carColor = car.ci; S.yaw = car.yaw; S.camYaw = car.yaw + Math.PI;
    savedDist = S.camDist; S.camDist = Math.max(S.camDist, PHONE ? 13 : 12);
    S.hero.play("drive"); if (A.emit) A.emit("car-in"); document.body.classList.add("in-car");
  }
  function getOut() {
    if (!S.inCar) return;
    S.inCar = false; document.body.classList.remove("in-car"); if (A.emit) A.emit("car-out"); const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw)).multiplyScalar(2.2);
    S.pos.copy(car.pos).add(side); S.pos.y = 0; A.collide(S.pos);
    parked.push({ mesh: car.mesh, pos: car.pos.clone(), yaw: car.yaw, ci: car.ci, slot: car.slot, at: performance.now() });
    while (parked.length > 3) { const o = parked.shift(); root.remove(o.mesh); }
    if (car.slot >= 0 && city.traffic[car.slot]) city.traffic[car.slot].hold = 25; // the road gets one back in a while
    car.mesh = null; car.v = 0; if (savedDist != null) S.camDist = savedDist;
    S.hero.obj.position.copy(S.pos); S.hero.play("idle");
  }
  hooks.act.unshift(() => {
    if (S.inCar) return { label: "GET OUT", id: "car:out", run: getOut };
    if (S.down > 0) return null;
    const n = carNear(); return n ? { label: n.kind === "road" ? "STEAL CAR" : "GET IN", id: "car:" + (n.i ?? "p"), run: () => getIn(n) } : null;
  });

  // driving: arcade grip, a boost on Shift / a full push, walls stop you, rivals in the way go flying
  const ACC = 16, TOP = 26, BOOST = 36, REV = 9, DRAG = 0.6, BRAKE = 30;
  hooks.drive = (dt, inp) => {
    if (!car.mesh) { S.inCar = false; return false; }
    const top = inp.run ? BOOST : TOP;
    if (inp.fwd > 0.1) car.v = Math.min(top, car.v + ACC * inp.fwd * dt * (car.v < 0 ? 2.2 : 1));
    else if (inp.fwd < -0.1) car.v = car.v > 0 ? Math.max(0, car.v - BRAKE * dt) : Math.max(-REV, car.v - ACC * 0.6 * dt);
    else car.v -= car.v * DRAG * dt + Math.sign(car.v) * Math.min(Math.abs(car.v), 2 * dt);
    if (car.v > top) car.v -= (car.v - top) * dt * 2;
    const steer = inp.side * Math.min(1, Math.abs(car.v) / 6) * (car.v >= 0 ? 1 : -1);
    car.yaw -= steer * 1.9 * dt;
    const before = car.pos.clone();
    car.pos.x += Math.sin(car.yaw) * car.v * dt; car.pos.z += Math.cos(car.yaw) * car.v * dt;
    const want = car.pos.clone(); A.collide(car.pos, 1.6);
    const bumped = want.distanceTo(car.pos);
    if (bumped > 0.05 && Math.abs(car.v) > 4) { A.shake(Math.min(0.6, Math.abs(car.v) / 40)); if (A.emit) A.emit("crash", { v: Math.abs(car.v) }); car.v *= -0.25; if (navigator.vibrate) try { navigator.vibrate(25); } catch { /* */ } }
    else if (bumped > 0.05) car.v *= 0.5;
    // rivals on the road
    for (const n of A.rivals) { if (n.st === "down") continue; const d = Math.hypot(n.pos.x - car.pos.x, n.pos.z - car.pos.z);
      if (d < 2.4 && Math.abs(car.v) > 7) { n.hp = 0; n.st = "down"; n.downT = 12; n.tag.visible = false; n.b.play("die", { once: true }); A.pop("SPLAT!", n.pos, "#ff4d6d"); A.crime(1); A.me.cash += 30; A.saveMe(A.me); A.paintHud(); A.shake(0.3); } }
    // other traffic: a crash slows you down
    for (const c of city.traffic) { if (c.hold || c.x == null) continue; const d = Math.hypot(c.x - car.pos.x, c.z - car.pos.z); if (d < 3.2) { car.v *= 0.4; car.pos.addScaledVector(before.clone().sub(car.pos).normalize(), 0.6); A.shake(0.35); c.slow = 0; setTimeout(() => (c.slow = 1), 1500); break; } }
    car.mesh.position.copy(car.pos); car.mesh.rotation.y = car.yaw;
    car.mesh.rotation.z = -steer * Math.min(1, Math.abs(car.v) / TOP) * 0.06;
    if (!car.mesh.userData.real) for (const [k, w] of car.mesh.children.entries()) if (k >= 4 && k < 8) w.rotation.x += car.v * dt / 0.42;
    S.pos.copy(car.pos); S.yaw = car.yaw;
    const seat = new THREE.Vector3(0.45, 0.35, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw).add(car.pos);
    S.hero.obj.position.copy(seat); S.hero.obj.rotation.y = car.yaw; S.hero.play("drive");
    return true;
  };
  // on foot, the traffic doesn't stop for you
  let hitT = 0;
  hooks.step.push((dt) => {
    hitT = Math.max(0, hitT - dt);
    if (S.inCar || S.down > 0 || hitT > 0) return;
    for (const c of city.traffic) { if (c.hold || c.x == null) continue; const d = Math.hypot(c.x - S.pos.x, c.z - S.pos.z);
      if (d < 1.9 && S.pos.y < 1) { hitT = 1.2; A.hurtMe(14, new THREE.Vector3(c.x, 0, c.z)); A.pop("HONK!", S.pos, "#fff1c9", 2.8); break; } }
  });
  return { carOf, getOut, get driving() { return S.inCar; }, car };
}
