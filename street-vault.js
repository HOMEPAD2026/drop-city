// street-vault.js — the hour's vault. When the hour's coin drops, a vault falls out of the sky into CLOCK PLAZA (with
// the coin's logo on its door). The first player in the world to open it gets it: FIRST ON THE SCENE, +$500 street cash
// (a toy: kept on the device). Everyone else finds it open, with the winner's name on it, until the hour ends.
// The server decides who was first (POST {action: "vault"}, GET ?vault=<hour>). On the map it's the gold star.
import { getJ, post } from "/common.js";

export const spotOf = (hour, ring) => { let h = 2166136261; for (const c of hour) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; const a = (h % 3600) / 3600 * Math.PI * 2, r = 16 + ((h >>> 12) % 1000) / 1000 * (ring - 26); return [Math.cos(a) * r, Math.sin(a) * r]; };
export function streetVault(A, { slot = () => null, pid = () => "" } = {}) {
  const { THREE, S, city, hooks, root } = A;
  const g = new THREE.Group(); g.visible = false; root.add(g);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.6, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2730, metalness: 0.7, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6).translate(0, 1.3, 0), steel); g.add(body);
  for (const y of [0.1, 2.5]) { const band = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.18, 2.75), gold); band.position.y = y; g.add(band); }
  const door = new THREE.Group(); door.position.set(-1.0, 1.3, 1.32); g.add(door);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 0.12).translate(1.0, 0, 0.06), gold); door.add(plate);
  const logoM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false });
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), logoM); logo.position.set(1.0, 0, 0.14); door.add(logo);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 60, 16, 1, true).translate(0, 32, 0), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); g.add(glow);
  const TL = new THREE.TextureLoader();
  let V = { hour: "", mint: "", by: null, falling: 0, y: 0, opening: false, checkAt: 0 };
  const tagEl = () => { if (V.tag) g.remove(V.tag); V.tag = A.tagOf(V.by ? `OPENED BY ${V.by}` : "THE HOUR'S VAULT", V.by ? "#9a9498" : "#ffd36b"); V.tag.position.y = 4; V.tag.scale.set(4.2, 0.79, 1); g.add(V.tag); };
  async function check(force) {
    const s = slot(); if (!s || s.state !== "dropped" || !s.drop) { g.visible = false; V.hour = ""; return; }
    if (s.hour !== V.hour) { // a new hour's vault: falls if we're watching, else just stands there
      const watching = S.active && V.hour !== "" && !document.hidden;
      V = { hour: s.hour, mint: s.drop.mint, by: null, falling: watching ? 1 : 0, y: watching ? 90 : 0, opening: false, checkAt: 0 };
      const [x, z] = spotOf(s.hour, city.world.RING); g.position.set(x, V.y, z); g.visible = true; door.rotation.y = 0;
      const t = city.towers.get(V.mint); if (t && t.coin.image) TL.load(t.coin.image, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; logoM.map = tx; logoM.needsUpdate = true; }, undefined, () => {});
      tagEl(); if (watching) { A.bigText("A VAULT JUST DROPPED", "#ffd36b"); A.sound("drop"); }
    }
    if (V.by && !force) return;
    try { const j = await getJ("?vault=" + encodeURIComponent(V.hour)); if (j && j.by && j.by !== V.by) { V.by = j.by; door.rotation.y = -1.9; tagEl(); } } catch { /* */ }
  }
  async function open() {
    if (V.opening || V.by) return; V.opening = true;
    const r = await post({ action: "vault", id: pid(), name: A.me.name, hour: V.hour }).catch(() => null);
    V.opening = false;
    if (!r || !r.ok) { A.toast(r && r.j && r.j.error ? r.j.error : "The vault didn't open — try again."); return; }
    V.by = r.j.by; tagEl();
    door.rotation.y = -1.9; city.burst(g.position.x, 2.5, g.position.z, 0.8, [[1, 0.83, 0.42], [1, 1, 1], [0.24, 1, 0.71]]);
    if (r.j.won) { A.me.cash += 500; A.saveMe(A.me); A.paintHud(); A.bigText("FIRST ON THE SCENE!", "#ffd36b"); A.pop("+$500", g.position, "#3dffb5", 3.4); A.sound("win"); A.shake(0.3);
      try { const t = JSON.parse(localStorage.getItem("dc.titles") || "[]"); if (!t.includes("FIRST ON THE SCENE")) { t.push("FIRST ON THE SCENE"); localStorage.setItem("dc.titles", JSON.stringify(t)); } } catch { /* */ } }
    else A.toast(`Too late — ${r.j.by} opened it first.`);
  }
  hooks.act.unshift(() => (g.visible && !V.by && !V.falling && !S.inCar && Math.hypot(S.pos.x - g.position.x, S.pos.z - g.position.z) < 3.6 ? { label: V.opening ? "OPENING…" : "OPEN THE VAULT", id: "vault", run: open } : null));
  // it's a solid box; and while nobody has it, it's the target on the map
  hooks.step.push((dt) => {
    if (!g.visible) return;
    if (V.falling) { V.y = Math.max(0, V.y - dt * (20 + (90 - V.y) * 1.2)); g.position.y = V.y; g.rotation.y += dt * 3; if (V.y <= 0) { V.falling = 0; A.shake(0.5); city.burst(g.position.x, 0.5, g.position.z, 0.6); A.sound("sell"); } }
    glow.visible = !V.by; glow.material.opacity = 0.07 + 0.04 * Math.sin(performance.now() / 260);
    const dx = S.pos.x - g.position.x, dz = S.pos.z - g.position.z, m = 1.9 + 0.45;
    if (!S.inCar && Math.abs(dx) < m && Math.abs(dz) < m) { if (Math.abs(dx) > Math.abs(dz)) S.pos.x = g.position.x + Math.sign(dx) * m; else S.pos.z = g.position.z + Math.sign(dz) * m; }
    if (!V.by && !V.falling) A.target = { x: g.position.x, z: g.position.z, label: "VAULT" };
    if ((V.checkAt -= dt) <= 0) { V.checkAt = V.by ? 60 : 6; check(); }
  });
  setTimeout(() => check(true), 1500);
  return { check, open, get state() { return V; } };
}
