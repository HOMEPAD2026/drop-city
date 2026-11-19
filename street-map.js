// street-map.js — where things are. A round minimap on foot (it turns with your view: up is where you look): the
// roads, CLOCK PLAZA, the coins' towers (yellow when raided), the turf colours, rivals in red, other players in blue,
// police in flashing red / blue (A.police, street-police.js), the job's target as a gold star, you in the middle.
// The job's target (A.target, set by street-jobs.js) also gets a beam of light in the city and, when it's off screen,
// an arrow at the edge with its distance.
export function streetMap(A) {
  const { THREE, S, city, hooks, root, cam, PHONE } = A;
  const W = city.world, cv = document.getElementById("mmap"), x = cv && cv.getContext("2d");
  const arrow = document.getElementById("wp");
  const RANGE = 110; // metres from the middle to the rim
  let size = 0, t = 0;
  const fit = () => { if (!cv) return; const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); size = r.width; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); x.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener("resize", fit); setTimeout(fit, 50);
  // the beam over the target
  const beamG = new THREE.CylinderGeometry(1.6, 2.4, 140, 16, 1, true); beamG.translate(0, 70, 0);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const ringM = new THREE.Mesh(new THREE.RingGeometry(3, 4, 40), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide }));
  ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.12;
  const mark = new THREE.Group(); mark.add(beam, ringM); mark.visible = false; root.add(mark);
  const v = new THREE.Vector3();
  function draw() {
    if (!x) return; if (!size || Math.abs(cv.clientWidth - size) > 1) fit(); if (!size) return;
    const c = size / 2, k = (c - 4) / RANGE, yaw = S.camYaw + Math.PI; // up = the way the camera looks
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    // a world point → the map (relative to you, turned so you face up)
    const P = (wx, wz) => { const dx = wx - S.pos.x, dz = wz - S.pos.z; const rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; return [c - rx * k, c - rz * k]; };
    x.clearRect(0, 0, size, size);
    x.save(); x.beginPath(); x.arc(c, c, c - 1, 0, Math.PI * 2); x.clip();
    x.fillStyle = "rgba(14,10,18,0.88)"; x.fillRect(0, 0, size, size);
    // turf colours
    for (const tf of city.turf || []) { if (!tf.coin || !tf.at) continue; const [px, py] = P(tf.at[0], tf.at[1]); const g = x.createRadialGradient(px, py, 0, px, py, 80 * k * 1.6); const col = "#" + tf.color.toString(16).padStart(6, "0"); g.addColorStop(0, col + "55"); g.addColorStop(1, col + "00"); x.fillStyle = g; x.fillRect(0, 0, size, size); }
    // roads
    x.strokeStyle = "rgba(255,255,255,0.16)"; x.lineWidth = Math.max(2, W.R * k);
    for (let i = 0; i <= 9; i++) { const q = -W.HALF + i * W.P; let [a1, b1] = P(q, -W.HALF), [a2, b2] = P(q, W.HALF); x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke(); [a1, b1] = P(-W.HALF, q); [a2, b2] = P(W.HALF, q); x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke(); }
    // the plaza
    { const [px, py] = P(0, 0); x.strokeStyle = "rgba(255,46,136,0.7)"; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, W.RING * k, 0, Math.PI * 2); x.stroke(); }
    // towers
    for (const tw of city.towers.values()) { const [px, py] = P(tw.group.position.x, tw.group.position.z), s = Math.max(3, tw.body.scale.x * k); x.fillStyle = tw.coin.raid ? "#ffd21f" : "#ff6fae"; x.fillRect(px - s / 2, py - s / 2, s, s); }
    // people
    const dot = (wx, wz, col, r = 2.6) => { const [px, py] = P(wx, wz); x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); };
    for (const n of A.rivals) if (n.st !== "down") dot(n.pos.x, n.pos.z, "#ff4d6d");
    if (A.net) for (const o of A.net.others.values()) dot(o.pos.x, o.pos.z, "#5ce1ff", 3);
    if (A.police) for (const p of A.police()) dot(p.x, p.z, (performance.now() / 250) % 2 < 1 ? "#ff2340" : "#2f6bff", 3.4);
    // the target: a star, or a pointer on the rim when it's further than the map shows
    if (A.target) { let [px, py] = P(A.target.x, A.target.z); const dx = px - c, dy = py - c, d = Math.hypot(dx, dy), lim = c - 9;
      if (d > lim) { px = c + (dx / d) * lim; py = c + (dy / d) * lim; }
      const pul = 1 + 0.25 * Math.sin(performance.now() / 180); x.fillStyle = "#ffd36b"; x.font = `${Math.round(13 * pul)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("★", px, py); }
    x.restore();
    // you
    x.fillStyle = "#fff"; x.beginPath(); x.moveTo(c, c - 7); x.lineTo(c + 5, c + 5); x.lineTo(c, c + 2); x.lineTo(c - 5, c + 5); x.closePath(); x.fill();
    x.strokeStyle = "rgba(255,255,255,0.25)"; x.lineWidth = 2; x.beginPath(); x.arc(c, c, c - 1, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "rgba(255,255,255,0.7)"; x.font = "700 9px monospace"; x.textAlign = "center"; x.fillText("N", ...(() => { const [nx, ny] = P(S.pos.x, S.pos.z - RANGE); const dx = nx - c, dy = ny - c, d = Math.hypot(dx, dy) || 1; return [c + (dx / d) * (c - 8), c + (dy / d) * (c - 8)]; })());
  }
  hooks.step.push((dt) => {
    // the target's beam and the edge arrow
    const tg = A.target;
    mark.visible = !!tg;
    if (tg) {
      mark.position.set(tg.x, 0, tg.z); beam.material.opacity = 0.16 + 0.08 * Math.sin(performance.now() / 300); ringM.scale.setScalar(1 + ((performance.now() / 900) % 1) * 0.6);
      if (arrow) {
        v.set(tg.x, 4, tg.z).project(cam);
        const behind = v.z > 1, off = behind || Math.abs(v.x) > 0.88 || Math.abs(v.y) > 0.82, dist = Math.round(Math.hypot(tg.x - S.pos.x, tg.z - S.pos.z));
        arrow.hidden = !off || dist < 6;
        if (off) { let ax = behind ? -v.x : v.x, ay = behind ? -v.y : v.y; const m = Math.max(Math.abs(ax) / 0.86, Math.abs(ay) / 0.78, 1e-3); ax /= m; ay /= m;
          // kept inside the part of the screen the controls and the HUD leave free
          const th = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--th")) || 52, mx = 70, top = PHONE ? th + 150 : 150, bot = PHONE ? 190 : 80;
          arrow.style.left = Math.max(mx, Math.min(innerWidth - mx, ((ax + 1) / 2) * innerWidth)) + "px"; arrow.style.top = Math.max(top, Math.min(innerHeight - bot, ((1 - ay) / 2) * innerHeight)) + "px"; arrow.style.setProperty("--r", Math.atan2(-ay, ax) + "rad");
          arrow.querySelector("b").textContent = `${tg.label || ""} ${dist} m`; }
      }
    } else if (arrow) arrow.hidden = true;
    if ((t += dt) > (PHONE ? 0.15 : 0.1)) { t = 0; draw(); }
  });
  return { draw, fit };
}
