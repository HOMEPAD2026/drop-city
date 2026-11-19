// models.js — one GLTF loader for the street's packed models (meshopt geometry, KTX2 textures — the same packing as
// ARCIRCLE WORLD's models), each file loaded once. instanced(): a model's meshes as InstancedMeshes, scaled to a height.
import * as THREE from "/vendor/three/three-0.186.1.module.min.js";
import { GLTFLoader } from "/vendor/three/addons/GLTFLoader.js";
import { KTX2Loader } from "/vendor/three/addons/KTX2Loader.js";
import { MeshoptDecoder } from "/vendor/three/addons/meshopt_decoder.module.js";
let L = null; const cache = new Map();
export function loader(renderer) {
  if (L) return L;
  L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  try { const k = new KTX2Loader().setTranscoderPath("/vendor/three/basis/").detectSupport(renderer); L.setKTX2Loader(k); } catch (e) { console.warn("ktx2", e); }
  return L;
}
export const load = (renderer, url) => cache.get(url) || (cache.set(url, new Promise((ok, no) => loader(renderer).load(url, ok, undefined, no)).catch((e) => { cache.delete(url); throw e; })), cache.get(url));
/// a model's meshes, baked to its own transforms and scaled so it stands `height` tall on y = 0 → [{ geometry, material }]
export function parts(gltf, height) {
  const sc = gltf.scene; sc.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sc), k = height / Math.max(1e-3, box.max.y - box.min.y), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)), out = [];
  // quantized attributes (KHR_mesh_quantization: normalized ints) would clamp to ±1 once moved and scaled: floats first
  const toFloat = (g) => { for (const k of ["position", "normal"]) { const at = g.getAttribute(k); if (!at || at.array instanceof Float32Array) continue; const f = new Float32Array(at.count * at.itemSize); for (let i = 0; i < at.count; i++) for (let j = 0; j < at.itemSize; j++) f[i * at.itemSize + j] = at.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, at.itemSize)); } return g; };
  sc.traverse((o) => { if (o.isMesh) { const g = toFloat(o.geometry.clone()); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, o.matrixWorld)); out.push({ geometry: g, material: o.material }); } });
  return out;
}
/// put a model at many spots: [{ x, z, r (turn), s (scale) }] → a Group of InstancedMeshes (one per mesh in the file)
export function instanced(gltf, height, spots) {
  const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  for (const p of parts(gltf, height)) {
    const im = new THREE.InstancedMesh(p.geometry, p.material, spots.length);
    spots.forEach((sp, i) => { m4.compose(v.set(sp.x, 0, sp.z), q.setFromAxisAngle(up, sp.r || 0), s3.setScalar(sp.s || 1)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); g.add(im);
  }
  return g;
}
