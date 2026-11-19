// street-police.js — the heat. From three wanted stars police cruisers come for you (one per star past two, up to three):
// they spawn on the roads out of sight, drive at you, ram your car and knock you down on foot. While one is within
// SEEN m the stars don't cool off — get away to lose them. Caught on foot (a cruiser on top of you for a couple of
// seconds) costs a third of your street cash and the stars. Lights flash red / blue; the minimap shows them.
export const SEEN = 38;
export function streetPolice(A) {
  const { THREE, S, city, hooks, root } = A;
  const cops = [];
  const lightM = [new THREE.MeshBasicMaterial({ color: 0xff2340, toneMapped: false }), new THREE.MeshBasicMaterial({ color: 0x2f6bff, toneMapped: false })];
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, metalness: 0.2 });
  function cruiser() {
    const c = A.carOf ? A.carOf(0, 0x111114, true) : new THREE.Group();
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.4, 1.8), white); door.position.y = 0.72; c.add(door);
    const bar = new THREE.Group(); bar.position.y = 1.55;
    const l = [new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), lightM[0]), new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), lightM[1])]; l[0].position.x = -0.35; l[1].position.x = 0.35; bar.add(...l); c.add(bar);
    c.userData.lights = l; return c;
  }
  // a spot on a road, out of sight behind you, SPAWN m away
  function spawnSpot() {
    const W = city.world, back = new THREE.Vector3(Math.sin(S.camYaw), 0, Math.cos(S.camYaw));
    for (let k = 0; k < 20; k++) {
      const d = 55 + Math.random() * 25, a = Math.atan2(back.x, back.z) + (Math.random() - 0.5) * 1.6;
      let x = S.pos.x + Math.sin(a) * d, z = S.pos.z + Math.cos(a) * d;
      const snap = (v) => -W.HALF + Math.round((v + W.HALF) / W.P) * W.P; // the nearest road line
      if (Math.random() < 0.5) x = snap(x); else z = snap(z);
      if (Math.abs(x) > W.HALF || Math.abs(z) > W.HALF || x < W.SEA_X + 10) continue;
      const p = new THREE.Vector3(x, 0, z), q = p.clone(); A.collide(q, 1.6); if (q.distanceTo(p) < 0.1) return p;
    }
    return null;
  }
  let caughtT = 0, hitT = 0, lightT = 0, spawnT = 0.5;
  hooks.step.push((dt) => {
    const want = S.down > 0 ? 0 : Math.max(0, Math.min(3, S.wanted - 2));
    // too few: one comes; too many: the extras drive off
    spawnT -= dt;
    if (cops.filter((c) => !c.leaving).length < want && spawnT <= 0) { spawnT = 1.5; const p = spawnSpot(); if (p) { const m = cruiser(); m.position.copy(p); root.add(m); cops.push({ m, pos: p, yaw: Math.atan2(S.pos.x - p.x, S.pos.z - p.z), v: 0, leaving: false, life: 0 }); A.pop("POLICE", p, "#2f6bff", 3); } }
    let active = 0; for (const c of cops) if (!c.leaving) { if (++active > want) c.leaving = true; }
    lightT += dt; const on = (lightT * 4) % 2 < 1;
    let near = false;
    for (let i = cops.length - 1; i >= 0; i--) {
      const c = cops[i]; c.life += dt;
      const dx = S.pos.x - c.pos.x, dz = S.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (!c.leaving && d < SEEN) near = true;
      // drive: at you, or away when leaving
      const goal = c.leaving ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
      let da = goal - c.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      c.yaw += Math.max(-1, Math.min(1, da)) * dt * 2.2;
      const top = c.leaving ? 24 : S.wanted >= 4 ? 25 : 20, slow = !c.leaving && d < 6 ? 0.45 : 1;
      c.v += ((top * slow) - c.v) * Math.min(1, dt * 1.5);
      const before = c.pos.clone();
      c.pos.x += Math.sin(c.yaw) * c.v * dt; c.pos.z += Math.cos(c.yaw) * c.v * dt;
      A.collide(c.pos, 1.6); if (c.pos.distanceTo(before) < c.v * dt * 0.3) c.yaw += dt * 2.5; // stuck on a wall: turn
      c.m.position.copy(c.pos); c.m.rotation.y = c.yaw; c.m.userData.lights[0].visible = on; c.m.userData.lights[1].visible = !on;
      // contact
      if (!c.leaving && d < (S.inCar ? 3.4 : 2.3) && c.v > 5 && hitT <= 0) {
        hitT = 1.1; A.shake(0.45); if (A.emit) A.emit("crash", { v: c.v });
        if (S.inCar && A.car) { A.car.car.v *= 0.35; } else A.hurtMe(12, c.pos);
      }
      if (c.leaving && (d > 90 || c.life > 40)) { root.remove(c.m); cops.splice(i, 1); }
    }
    hitT = Math.max(0, hitT - dt);
    // seen: the stars don't cool; caught on foot: a third of the cash and the stars
    if (near && S.wanted > 0) S.wantT = Math.max(S.wantT, 4);
    const close = cops.some((c) => !c.leaving && Math.hypot(S.pos.x - c.pos.x, S.pos.z - c.pos.z) < 4);
    if (close && !S.inCar && S.down <= 0) { caughtT += dt; if (caughtT > 2.2) { caughtT = 0; const lost = Math.floor(A.me.cash / 3); A.me.cash -= lost; A.saveMe(A.me); S.wanted = 0; A.paintHud(); A.bigText("CAUGHT", "#2f6bff"); A.toast(`Caught — the police took $${lost.toLocaleString("en-US")} of your street cash.`); for (const c of cops) c.leaving = true; } }
    else caughtT = Math.max(0, caughtT - dt);
  });
  A.police = () => cops.filter((c) => !c.leaving).map((c) => ({ x: c.pos.x, z: c.pos.z }));
  return { cops };
}
