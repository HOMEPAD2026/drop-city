// street-props.js — the streets dressed with ARCIRCLE WORLD's town pieces (packed Meshy models, models/street): street
// lamps along the roads near the plaza, benches and planters round CLOCK PLAZA, neon trees on its corners. Each kind is
// one InstancedMesh per part; they're solid (city.solids). Fewer on phones, none on light graphics.
import { load, instanced } from "/models.js";
export function streetProps(A) {
  const { city, root, PHONE } = A, W = city.world, scene = city.scene;
  const g = new A.THREE.Group(); scene.add(g);
  const lamps = [], benches = [], planters = [], trees = [];
  // lamps: both sides of the roads, every half block, within reach of the plaza, off the crossings and the plaza floor
  const REACH = PHONE ? 105 : 150, EDGE = W.R / 2 - 0.7; // (on the road's shoulder: the buildings fill the blocks to their edge)
  for (let i = 0; i <= 9; i++) {
    const c = -W.HALF + i * W.P;
    for (let s = -W.HALF + W.P / 4; s < W.HALF; s += W.P / 2) {
      const nearCross = Math.abs(((s + W.HALF) % W.P) - 0) < EDGE + 2 || Math.abs(((s + W.HALF) % W.P) - W.P) < EDGE + 2; if (nearCross) continue;
      for (const [x, z, r] of [[c + EDGE, s, -Math.PI / 2], [s, c - EDGE, 0]]) { const d = Math.hypot(x, z); if (d < W.RING + 26 || d > REACH || x < W.SEA_X + 10) continue; lamps.push({ x, z, r }); }
    }
  }
  lamps.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)); lamps.length = Math.min(lamps.length, PHONE ? 20 : 48);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + Math.PI / 12, r = 31; (k % 2 ? planters : benches).push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI }); }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) trees.push({ x: sx * 52, z: sz * 52, r: Math.random() * 6 });
  if (PHONE) { benches.length = 4; planters.length = 4; }
  const KINDS = [["street-lamp", 6.2, lamps, 0.6], ["park-bench", 1.1, benches, 1.6], ["flower-planter", 1.2, planters, 1.5], ["neon-tree", 7.5, trees, 1.2]];
  let built = false;
  async function build() {
    if (built || city.low) return; built = true;
    for (const [f, h, spots, w] of KINDS) {
      if (!spots.length) continue;
      try { const gl = await load(city.renderer, `/models/street/${f}.glb`); g.add(instanced(gl, h, spots)); for (const sp of spots) city.solids.push([sp.x, sp.z, h, w]); }
      catch (e) { console.warn("props", f, e); }
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  // built after the city has settled; hidden on light graphics
  setTimeout(build, 2500);
  A.hooks.step.push(() => { g.visible = !city.low; if (!built && !city.low) build(); });
  return { group: g, counts: () => ({ lamps: lamps.length, benches: benches.length, planters: planters.length, trees: trees.length }) };
}
