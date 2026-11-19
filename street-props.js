// street-props.js — the streets dressed with real things (models/real, CC0 / CC-BY — CREDITS.md there): street lamps
// along the roads near the plaza, benches, bins and bushes round CLOCK PLAZA, fire hydrants on the corners, real palms on
// the beach and the avenues (in place of the drawn ones), and real cars in the traffic. Each kind is one InstancedMesh per
// part; they're solid (city.solids). Fewer on phones; on light graphics the lamps, benches and bushes stay home.
import { load, instanced, parts } from "/models.js";
export function streetProps(A) {
  const { city, PHONE } = A, W = city.world, scene = city.scene, THREE = A.THREE;
  const g = new THREE.Group(), pg = new THREE.Group(); scene.add(g, pg); // pg: the palms (always shown)
  const lamps = [], benches = [], bins = [], bushes = [], hydrants = [];
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
  // hydrants: a little way along from the lamps
  lamps.filter((_, i) => i % 3 === 1).forEach((l) => hydrants.push({ x: l.x + (l.r === 0 ? 3 : 0), z: l.z + (l.r === 0 ? 0 : 3), r: l.r }));
  // round the plaza: benches facing the middle, a bin beside each, bushes between them
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + Math.PI / 12, r = 31, x = Math.cos(a) * r, z = Math.sin(a) * r, face = Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI;
    if (k % 2) bushes.push({ x, z, r: k }); else { benches.push({ x, z, r: face }); bins.push({ x: Math.cos(a + 0.09) * r, z: Math.sin(a + 0.09) * r, r: face }); } }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (const o of [-3, 3]) bushes.push({ x: sx * 52 + o, z: sz * 52 - o, r: o });
  if (PHONE) { benches.length = 4; bins.length = 4; bushes.length = 8; hydrants.length = Math.min(hydrants.length, 6); }
  // [file, height (m), spots, collision width, light graphics too?]
  const KINDS = [["street-lamp", 5.2, lamps, 0.5, false], ["bench", 0.87, benches, 1.6, false], ["trash-bin", 0.95, bins, 0.7, false], ["bush-large", 1.6, bushes, 1.3, false], ["hydrant", 0.8, hydrants, 0.4, false]];
  let built = false;
  async function build() {
    if (built) return; built = true;
    palms(); cars();
    if (city.low) return;
    for (const [f, h, spots, w] of KINDS) {
      if (!spots.length) continue;
      try { const gl = await load(city.renderer, `/models/real/props/${f}.glb`); g.add(instanced(gl, h, spots)); for (const sp of spots) city.solids.push([sp.x, sp.z, h, w]); }
      catch (e) { console.warn("props", f, e); }
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  // the real palms on the drawn ones' spots (two shapes, tall ones on the beach); the drawn ones go when they're in
  async function palms() {
    const P = city.palms; if (!P) return;
    try {
      const [a, b] = await Promise.all([load(city.renderer, "/models/real/props/palm-straight.glb"), load(city.renderer, "/models/real/props/palm-bend.glb")]);
      const sa = [], sb = [];
      P.spots.forEach(([x, z], i) => { const beach = x < W.SEA_X + 30; (i % 3 === 1 ? sb : sa).push({ x, z, r: (i * 2.3) % (Math.PI * 2), s: (beach ? 1.5 : 1.25) + ((i * 37) % 10) / 40 }); });
      pg.add(instanced(a, 7, sa), instanced(b, 5.9, sb));
      P.trunks.visible = P.leaves.visible = false;
    } catch (e) { console.warn("palms", e); }
  }
  // the traffic: a sedan, a pickup and the coupe, one after another along the roads
  async function cars() {
    try {
      const L = [["sedan", 1.18], ["pickup", 1.42], ["coupe", 1.15]];
      const gls = await Promise.all(L.map(([f]) => load(city.renderer, `/models/real/cars/${f}.glb`)));
      city.useCarModels(gls.map((gl, k) => parts(gl, L[k][1])));
    } catch (e) { console.warn("traffic cars", e); }
  }
  // built after the city has settled; lamps / benches / bushes hidden on light graphics (palms and cars stay: they replace the drawn ones)
  setTimeout(build, 2500);
  A.hooks.step.push(() => { g.visible = !city.low; if (!built) build(); });
  return { group: g, counts: () => ({ lamps: lamps.length, benches: benches.length, bins: bins.length, bushes: bushes.length, hydrants: hydrants.length }) };
}
