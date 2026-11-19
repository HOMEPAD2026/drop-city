// city.js — the neon coast city at dusk. In its middle, CLOCK PLAZA: a ring of 24 lots, one for each hour of the
// day (UTC). Each hour's drop rises as a tower on its lot; the tower grows with its bonding curve and wears its logo on
// top; a graduated coin gets a gold crown and a beam. Older drops stand in the districts around the plaza.
// makeCity(canvas, { onPick }) → { setCoins(coins, hourNow), flyTo(mint), lowGfx }
import * as THREE from "/vendor/three/three-0.186.1.module.min.js";
import { EffectComposer } from "/vendor/three/addons/EffectComposer.js";
import { RenderPass } from "/vendor/three/addons/RenderPass.js";
import { UnrealBloomPass } from "/vendor/three/addons/UnrealBloomPass.js";
import { OutputPass } from "/vendor/three/addons/OutputPass.js";

const PHONE = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
const NEON = [0xff2e88, 0xffffff, 0xff6fae, 0xff2e88, 0xffc2dc, 0xd91a6b];
const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

export function makeCity(canvas, { onPick = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !PHONE, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a1020, 0.0036);
  const cam = new THREE.PerspectiveCamera(PHONE ? 58 : 46, 1, 1, 3000);

  // ---------------- sky: a dusk gradient, a low sun over the sea
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: new THREE.Vector3(-1, 0.06, -0.25).normalize() } },
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `varying vec3 v; uniform vec3 sun;
      void main(){ float h = v.y; vec3 c = mix(vec3(1.0,0.3,0.55), vec3(0.62,0.05,0.28), smoothstep(-0.02,0.12,h));
        c = mix(c, vec3(0.12,0.02,0.07), smoothstep(0.1,0.35,h)); c = mix(c, vec3(0.012,0.01,0.014), smoothstep(0.35,0.9,h));
        float d = max(dot(v, sun), 0.0); c += vec3(1.0,0.75,0.85) * pow(d, 380.0) * 2.2 + vec3(1.0,0.2,0.5) * pow(d, 9.0) * 0.4;
        if (h < 0.0) c = mix(c, vec3(0.02,0.01,0.02), smoothstep(0.0,-0.08,h));
        gl_FragColor = vec4(c,1.); }` }));
  scene.add(sky);
  // stars
  { const n = 600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, y = 0.35 + rnd() * 0.65, r = Math.sqrt(1 - y * y); p.set([Math.cos(a) * r * 1300, y * 1300, Math.sin(a) * r * 1300], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }))); }

  scene.add(new THREE.HemisphereLight(0xffc2dc, 0x3a2030, 1.6));
  { const fill = new THREE.DirectionalLight(0x9fb8ff, 0.7); fill.position.set(260, 160, 200); scene.add(fill); } // a cool fill from the land side: the streets read at dusk
  const sun = new THREE.DirectionalLight(0xff9cc6, 2.0); sun.position.set(-300, 120, -80); scene.add(sun);

  // ---------------- the sea to the west, the beach, the land
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShaderMaterial({ fog: false, uniforms: { t: { value: 0 } },
    vertexShader: "varying vec3 w; void main(){ vec4 p = modelMatrix * vec4(position,1.); w = p.xyz; gl_Position = projectionMatrix * viewMatrix * p; }",
    fragmentShader: `varying vec3 w; uniform float t;
      void main(){ float g = sin(w.x*0.06 + t*0.8)*sin(w.z*0.05 - t*0.6); vec3 c = mix(vec3(0.02,0.012,0.02), vec3(0.16,0.03,0.09), 0.5+0.5*g);
        float lane = exp(-pow((w.z + 60.0) / (40.0 + abs(w.x)*0.15), 2.0)); float glit = step(0.86, fract(sin(dot(floor(w.xz*0.5), vec2(12.9,78.2))+t*0.4)*43758.));
        c += vec3(1.0,0.35,0.62) * lane * (0.35 + 0.65*glit) * smoothstep(-200.0,-1400.0,w.x);
        float fogd = clamp(length(w.xz) / 1500.0, 0., 1.); c = mix(c, vec3(0.3,0.05,0.16), fogd*0.6); gl_FragColor = vec4(c,1.); }` }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-1600, -0.6, 0); scene.add(sea);
  const SEA_X = -175;
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(40, 560), new THREE.MeshLambertMaterial({ color: 0x4a3038 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(SEA_X + 4, -0.3, 0); scene.add(beach);

  // the street grid: blocks of B, roads of R
  const B = 30, R = 12, N = 9, P = B + R, HALF = (N * P) / 2;
  // floors from ARCIRCLE WORLD (images/city): KART's neon-city asphalt on the roads (our lines drawn over it), a
  // paint-splashed asphalt on the blocks, RAID QUEENS' gold-ringed marble on CLOCK PLAZA. Canvas stand-ins until they load.
  const TL = new THREE.TextureLoader(), ANI = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const roadTexs = [];
  const roadTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
    const paint = (img) => {
      if (img) x.drawImage(img, 0, 0, 512, 512); else { x.fillStyle = "#2c2830"; x.fillRect(0, 0, 512, 512); }
      x.fillStyle = "rgba(255,255,255,0.75)"; x.fillRect(14, 0, 7, 512); x.fillRect(491, 0, 7, 512); // the road's edge lines
      x.fillStyle = "#ff2e88"; x.fillRect(250, 40, 12, 200); x.fillRect(250, 296, 12, 200); // the middle dashes
      for (const t of roadTexs) t.needsUpdate = true; };
    paint(null);
    const im = new Image(); im.onload = () => paint(im); im.src = "/images/city/road.webp";
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANI; return t; })();
  const tex = (u, rep, srgb = true) => { const t = TL.load(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANI; return t; };
  const land = new THREE.Mesh(new THREE.PlaneGeometry(N * P + 60, N * P + 60), new THREE.MeshStandardMaterial({ color: 0x9a94b8, map: tex("/images/city/street.webp", (N * P + 60) / 16), roughness: 0.7, metalness: 0.05 }));
  land.rotation.x = -Math.PI / 2; land.position.set(0, -0.05, 0); scene.add(land);
  for (let i = 0; i <= N; i++) for (const rot of [0, 1]) {
    const t = roadTex.clone(); t.needsUpdate = true; t.repeat.set(1, (N * P) / R); roadTexs.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R, N * P), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.1 }));
    m.rotation.x = -Math.PI / 2; if (rot) m.rotation.z = Math.PI / 2;
    const c = -HALF + i * P; if (rot) m.position.set(0, 0.01, c); else m.position.set(c, 0.01, 0); scene.add(m);
  }

  // ---------------- buildings: one instanced mesh, lit windows from one texture, the plaza left open
  const winTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, 64, 256);
    for (let r = 0; r < 32; r++) for (let q = 0; q < 6; q++) { const on = Math.random() < 0.2; const k = Math.random(); x.fillStyle = on ? (k < 0.14 ? "#ff2e88" : k < 0.3 ? "#b86d8f" : k < 0.65 ? "#8a8086" : "#c9bfc4") : "#070607"; x.fillRect(4 + q * 10, 4 + r * 8, 6, 5); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 0.55, metalness: 0.15 });
  bodyMat.onBeforeCompile = (sh) => { // windows tile with the building's size (world-space UVs on the sides)
    sh.vertexShader = sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_EMISSIVEMAP\nvec4 wp0 = instanceMatrix * vec4(position,1.0); vEmissiveMapUv = vec2((wp0.x + wp0.z) / 18.0, wp0.y / 96.0);\n#endif");
  };
  const lots = []; // generic lots (x, z) outside the plaza
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cx = -HALF + R / 2 + i * P + B / 2, cz = -HALF + R / 2 + j * P + B / 2;
    if (Math.abs(cx) < P * 1.6 && Math.abs(cz) < P * 1.6) continue; // CLOCK PLAZA
    for (const [dx, dz] of [[-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5]]) lots.push([cx + dx, cz + dz]);
  }
  const keep = PHONE ? 0.6 : 1;
  const gen = lots.filter(() => rnd() < keep);
  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
  const bodies = new THREE.InstancedMesh(boxG, bodyMat, gen.length);
  const PAL = [0x5a4f57, 0x463f48, 0x6a5560, 0x50474f, 0x735563, 0x3f383f];
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color();
  const solids = [];
  gen.forEach(([x, z], i) => { const d = Math.hypot(x, z) / HALF, h = 7 + rnd() * (18 + 34 * d) + (rnd() < 0.07 ? 40 : 0), w = 10 + rnd() * 4;
    m4.compose(v3.set(x, 0, z), q4.identity(), s3.set(w, h, w)); bodies.setMatrixAt(i, m4); bodies.setColorAt(i, col.setHex(PAL[(rnd() * PAL.length) | 0])); solids.push([x, z, h, w]); });
  scene.add(bodies);
  // rooftop neon signs (generic words)
  const SIGNS = ["MOTEL", "24/7", "PAWN", "LIQUOR", "PUMP FM", "DINER", "CASINO", "TATTOO", "AUTO", "BAIL BONDS"];
  const signTex = (w, c) => { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64; const x = cv.getContext("2d");
    x.font = "italic 900 40px 'Anton', Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.shadowColor = c; x.shadowBlur = 14; x.fillStyle = c; x.fillText(w, 128, 34); x.fillText(w, 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  solids.slice().sort((a, b) => b[2] - a[2]).slice(0, PHONE ? 8 : 16).forEach(([x, z, h], i) => {
    const c = "#" + NEON[i % NEON.length].toString(16).padStart(6, "0");
    const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTex(SIGNS[i % SIGNS.length], c), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    s.position.set(x, h + 2.4, z); s.rotation.y = Math.atan2(x, z) + Math.PI; scene.add(s);
  });
  // palms along the beach and the avenues
  { const spots = []; for (let z = -260; z <= 260; z += 16) spots.push([SEA_X + 14, z]); for (let i = -4; i <= 4; i++) { spots.push([-P / 2 - 1, i * P]); spots.push([P / 2 + 1, i * P + P / 2]); }
    const trunkG = new THREE.CylinderGeometry(0.35, 0.6, 1, 6); trunkG.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x1a1216 }), spots.length);
    const leafG = new THREE.ConeGeometry(4.2, 1.6, 7); leafG.translate(0, -0.6, 0);
    const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshLambertMaterial({ color: 0x2a1420, emissive: 0x3a0a20 }), spots.length);
    spots.forEach(([x, z], i) => { const h = 11 + rnd() * 6; m4.compose(v3.set(x, 0, z), q4.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - 0.5) * 0.18), s3.set(1, h, 1)); trunks.setMatrixAt(i, m4);
      m4.compose(v3.set(x, h, z), q4.identity(), s3.set(1, 1, 1)); leaves.setMatrixAt(i, m4); });
    scene.add(trunks, leaves); }

  // ---------------- traffic: head- and tail-lights moving along the roads
  const CARS = PHONE ? 40 : 90, carG = new THREE.BoxGeometry(2.2, 1.2, 4.4); carG.translate(0, 0.6, 0);
  const cars = new THREE.InstancedMesh(carG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 }), CARS);
  const lightG = new THREE.PlaneGeometry(1.8, 0.5);
  const heads = new THREE.InstancedMesh(lightG, new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false, side: THREE.DoubleSide }), CARS);
  const tails = new THREE.InstancedMesh(lightG, new THREE.MeshBasicMaterial({ color: 0xff2350, toneMapped: false, side: THREE.DoubleSide }), CARS);
  const traffic = Array.from({ length: CARS }, (_, i) => ({ road: (rnd() * (N + 1)) | 0, ax: rnd() < 0.5, dir: rnd() < 0.5 ? 1 : -1, s: rnd() * N * P, v: 10 + rnd() * 14 }));
  traffic.forEach((c, i) => cars.setColorAt(i, col.setHex([0xff2e88, 0x111111, 0xffffff, 0x1a1a1a, 0x2b2b2b, 0xd91a6b][i % 6])));
  scene.add(cars, heads, tails);
  const Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  const placeCars = (dt) => traffic.forEach((c, i) => {
    if (c.hold) { cars.setMatrixAt(i, Z0); heads.setMatrixAt(i, Z0); tails.setMatrixAt(i, Z0); if ((c.hold -= dt) <= 0) c.hold = 0; return; } // taken off the road (stolen), back later
    c.s = (c.s + c.v * dt * c.dir * (c.slow || 1) + N * P) % (N * P);
    const along = -HALF + c.s, line = -HALF + c.road * P + (c.dir > 0 ? -2.6 : 2.6);
    const x = c.ax ? along : line, z = c.ax ? line : along, yaw = c.ax ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    c.x = x; c.z = z; c.yaw = yaw;
    q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); m4.compose(v3.set(x, 0.05, z), q4, s3.set(1, 1, 1)); cars.setMatrixAt(i, m4);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    m4.compose(v3.set(x + fx * 2.25, 0.8, z + fz * 2.25), q4, s3.set(1, 1, 1)); heads.setMatrixAt(i, m4);
    m4.compose(v3.set(x - fx * 2.25, 0.8, z - fz * 2.25), q4, s3.set(1, 1, 1)); tails.setMatrixAt(i, m4);
  });
  placeCars(0);

  // ---------------- the helicopter and its searchlight over the plaza
  const heli = new THREE.Group();
  { const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 3.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0x15131c, metalness: 0.5, roughness: 0.4 })); body.rotation.z = Math.PI / 2; heli.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.6), new THREE.MeshBasicMaterial({ color: 0x0c0a12 })); rotor.position.y = 2; heli.add(rotor); heli.userData.rotor = rotor;
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xff2350, toneMapped: false })); blink.position.set(-2.4, 0.4, 0); heli.add(blink); heli.userData.blink = blink;
    const beamG = new THREE.ConeGeometry(9, 70, 24, 1, true); beamG.translate(0, -35, 0);
    const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffd6e8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    heli.add(beam); heli.userData.beam = beam; }
  scene.add(heli);

  // ---------------- CLOCK PLAZA: 24 hour lots on a ring, the hour numbers painted on the ground
  const RING = 46, plaza = new THREE.Group(); scene.add(plaza);
  const plazaFloor = new THREE.Mesh(new THREE.CircleGeometry(RING + 22, 72), new THREE.MeshStandardMaterial({ color: 0xe6dce8, map: tex("/images/city/plaza.webp", 1), emissive: 0xffc861, emissiveMap: tex("/images/city/plaza-e.webp", 1), emissiveIntensity: 0.9, roughness: 0.45, metalness: 0.1 }));
  plazaFloor.rotation.x = -Math.PI / 2; plazaFloor.position.y = 0.03; plaza.add(plazaFloor);
  const ringLine = new THREE.Mesh(new THREE.RingGeometry(RING - 0.4, RING + 0.4, 96), new THREE.MeshBasicMaterial({ color: 0xff2e88, toneMapped: false }));
  ringLine.rotation.x = -Math.PI / 2; ringLine.position.y = 0.06; plaza.add(ringLine);
  const lotPos = (h) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return [Math.cos(a) * RING, Math.sin(a) * RING]; };
  const ghosts = [];
  for (let h = 0; h < 24; h++) {
    const [x, z] = lotPos(h);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(9, 3), new THREE.MeshBasicMaterial({ map: signTex(String(h).padStart(2, "0") + ":00", "#ffd6e8"), transparent: true, opacity: 0.32, toneMapped: false }));
    lab.rotation.x = -Math.PI / 2; lab.rotation.z = -Math.atan2(z, x) - Math.PI / 2; lab.position.set(x * 1.27, 0.08, z * 1.27); plaza.add(lab);
    const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9, 14, 9)), new THREE.LineBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.35, toneMapped: false }));
    g.position.set(x, 7, z); plaza.add(g); ghosts.push(g);
  }
  // the clock's hand: points at the current hour
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, RING - 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  hand.geometry.translate(0, 0, (RING - 8) / 2); hand.position.y = 0.2; plaza.add(hand);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 3, 24), new THREE.MeshStandardMaterial({ color: 0x141214, emissive: 0xff2e88, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.2 })); hub.position.y = 1.5; plaza.add(hub);

  // ---------------- the coins' towers
  const towers = new Map(); // mint → { group, body, coin }
  const logoCache = new Map();
  const logoTex = (coin) => {
    if (logoCache.has(coin.mint)) return logoCache.get(coin.mint);
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
    const draw = (img) => { x.clearRect(0, 0, 256, 256); x.fillStyle = "#0b0a0c"; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
      if (img) { x.save(); x.beginPath(); x.arc(128, 128, 112, 0, 7); x.clip(); x.drawImage(img, 16, 16, 224, 224); x.restore(); }
      else { x.fillStyle = "#ff2e88"; x.font = "900 96px 'Anton', Impact"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText((coin.symbol || "?").slice(0, 3), 128, 136); }
      x.lineWidth = 10; x.strokeStyle = "#ff2e88"; x.beginPath(); x.arc(128, 128, 118, 0, 7); x.stroke(); t.needsUpdate = true; };
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; draw(null);
    if (coin.image) { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => draw(im); im.src = coin.image; }
    logoCache.set(coin.mint, t); return t;
  };
  const tapeMat = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 32; const x = c.getContext("2d");
    x.fillStyle = "#ffd21f"; x.fillRect(0, 0, 512, 32); x.fillStyle = "#111"; x.font = "900 20px Inter, Arial, sans-serif"; x.textBaseline = "middle";
    x.textAlign = "center"; x.fillText("POLICE LINE · DO NOT CROSS", 256, 17);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1.5, 1);
    return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false }); })();
  const noMat = new THREE.MeshBasicMaterial({ visible: false }), postG = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6), postM = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd6e8, emissive: 0xff2e88, emissiveIntensity: 0.9, metalness: 0.95, roughness: 0.15 });
  const towerOf = (coin, x, z, scale) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const h = (14 + (coin.graduated ? 100 : coin.progress || 0) * 0.62) * scale;
    const body = new THREE.Mesh(boxG, bodyMat.clone()); body.material.color.setHex(0x5a4f57); body.scale.set(9 * scale, h, 9 * scale); g.add(body);
    const trim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9 * scale, h, 9 * scale)), new THREE.LineBasicMaterial({ color: NEON[hash(coin.mint) % NEON.length], toneMapped: false }));
    trim.position.y = h / 2; g.add(trim);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(coin), toneMapped: false })); sign.scale.setScalar(9 * scale); sign.position.y = h + 6 * scale; g.add(sign);
    if (coin.graduated) { const cr = new THREE.Mesh(new THREE.TorusGeometry(4 * scale, 0.7 * scale, 8, 24), crownMat); cr.rotation.x = Math.PI / 2; cr.position.y = h + 0.8; g.add(cr);
      const beamG = new THREE.CylinderGeometry(1.2, 3, 220, 16, 1, true); beamG.translate(0, 110, 0);
      g.add(new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))); }
    body.userData.mint = coin.mint; sign.userData.mint = coin.mint;
    // the police raided it (its creator sold in the last day): tape round the foot, red and blue lights on the roof
    let lights = null;
    if (coin.raid) {
      const w = 9 * scale + 4, tape = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, w), [tapeMat, tapeMat, noMat, noMat, tapeMat, tapeMat]); tape.position.y = 1.1; g.add(tape);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(postG, postM); p.position.set((x * w) / 2, 0.75, (z * w) / 2); g.add(p); }
      lights = [0xff2340, 0x2f6bff].map((c, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(1.1 * scale, 12, 8), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); l.position.set((k ? 2.2 : -2.2) * scale, h + 1.2, 0); g.add(l); return l; });
    }
    return { group: g, body, sign, coin, h, lights };
  };
  // ---------------- motion: towers rise when they're new, graduations fire off, the helicopter follows the newest
  const born = new Map(), wasMade = new Set(); let firstSet = true, newest = null;
  const bursts = [];
  function burst(x, y, z, big = 1) {
    const n = Math.round((PHONE ? 90 : 160) * big), pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3), cc = [[1, 0.18, 0.53], [1, 1, 1], [1, 0.44, 0.68]];
    for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), sp = (12 + Math.random() * 18) * big; vel.push([Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp * 0.8 + 6, Math.sin(b) * Math.sin(a) * sp]); col.set(cc[i % 3], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    scene.add(p); bursts.push({ p, vel, life: 0 });
  }
  function stepBursts(dt) {
    for (let k = bursts.length - 1; k >= 0; k--) { const b = bursts[k]; b.life += dt; const a = b.p.geometry.attributes.position;
      for (let i = 0; i < b.vel.length; i++) { const v = b.vel[i]; v[1] -= 18 * dt; v[0] *= 0.985; v[2] *= 0.985; a.array[i * 3] += v[0] * dt; a.array[i * 3 + 1] += v[1] * dt; a.array[i * 3 + 2] += v[2] * dt; }
      a.needsUpdate = true; b.p.material.opacity = Math.max(0, 1 - b.life / 2.4);
      if (b.life > 2.4) { scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(k, 1); } }
  }
  // ---------------- turf: the four sides of the city, each held by one of the four biggest coins (by market cap)
  const TURF_NAMES = ["NORTH SIDE", "EAST DOCKS", "SOUTH STRIP", "WEST BEACH"], TURF_COL = [0xff2e88, 0x5ce1ff, 0xffd36b, 0x3dffb5];
  const turfG = new THREE.Group(); scene.add(turfG); let turf = [];
  const turfTag = (text, col) => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const x = c.getContext("2d"); x.font = "italic 900 64px Anton, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; x.fillText(text, 256, 52); x.fillStyle = "#fff"; x.shadowBlur = 0; x.fillText(text, 256, 52); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  function setTurf(coins) {
    for (const o of [...turfG.children]) { turfG.remove(o); o.traverse((m) => { if (m.material) { if (m.material.map && !logoCache.has(m.userData.mint || "")) m.material.map.dispose(); m.material.dispose(); } if (m.geometry) m.geometry.dispose(); }); }
    const top = coins.filter((c) => c.mcapUsd > 0).sort((a, b) => b.mcapUsd - a.mcapUsd).slice(0, 4);
    turf = TURF_NAMES.map((name, i) => ({ name, coin: top[i] || null, color: TURF_COL[i] }));
    turf.forEach((t, i) => {
      if (!t.coin) return;
      const a0 = (i / 4) * Math.PI * 2 - Math.PI / 4 - Math.PI / 2; // north = −z, then clockwise
      const ring = new THREE.Mesh(new THREE.RingGeometry(RING + 26, HALF + 20, 24, 1, -a0 - Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; turfG.add(ring);
      const mid = a0 + Math.PI / 4, bx = Math.cos(mid) * 125, bz = Math.sin(mid) * 125;
      const logo = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(t.coin), toneMapped: false })); logo.userData.mint = t.coin.mint; logo.scale.setScalar(20); logo.position.set(bx, 92, bz); turfG.add(logo);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: turfTag(`$${t.coin.symbol} TURF`, "#" + t.color.toString(16).padStart(6, "0")), transparent: true, toneMapped: false })); tag.scale.set(40, 7.5, 1); tag.position.set(bx, 76, bz); turfG.add(tag);
      t.at = [bx, bz];
    });
  }
  /// which side of the city a spot is on (outside the plaza): { name, coin, color } or null
  function turfAt(x, z) {
    if (Math.hypot(x, z) < RING + 26) return null;
    const a = Math.atan2(z, x) + Math.PI / 2 + Math.PI / 4, i = ((Math.floor(a / (Math.PI / 2)) % 4) + 4) % 4;
    return turf[i] || null;
  }
  function setCoins(coins, hourNow) {
    for (const t of towers.values()) scene.remove(t.group); towers.clear();
    setTurf(coins);
    hand.rotation.y = -((hourNow / 24) * Math.PI * 2 - Math.PI / 2) - Math.PI / 2;
    // today's drops on their hour lots; the rest outside the plaza by market cap
    const today = new Date().toISOString().slice(0, 10), used = new Set();
    const older = [];
    for (const c of coins) {
      const h = c.hour && c.hour.slice(0, 10) === today ? Number(c.hour.slice(11, 13)) : -1;
      if (h >= 0 && !used.has(h)) { used.add(h); const [x, z] = lotPos(h); const t = towerOf(c, x, z, 1); scene.add(t.group); towers.set(c.mint, t); }
      else older.push(c);
    }
    older.sort((a, b) => (b.mcapUsd || 0) - (a.mcapUsd || 0)).forEach((c, i) => {
      const a = i * 2.39996, r = RING + 34 + Math.sqrt(i) * 16; const t = towerOf(c, Math.cos(a) * r, Math.sin(a) * r, 0.85); scene.add(t.group); towers.set(c.mint, t);
    });
    // new towers rise (all of them, one after another, the first time); a coin that just graduated fires off
    let i0 = 0;
    for (const [m, t] of towers) {
      if (!born.has(m)) born.set(m, firstSet ? T + 0.2 + (i0++) * 0.05 : T);
      if (!firstSet && !born.get(m + ":seen")) { born.set(m + ":seen", 1); if (Date.now() / 1000 - (t.coin.launchedAt || 0) < 3600) setTimeout(() => burst(t.group.position.x, t.h + 10, t.group.position.z, 1.2), 900); }
      if (firstSet) born.set(m + ":seen", 1);
      if (t.coin.graduated && !wasMade.has(m)) { wasMade.add(m); if (!firstSet) for (let k = 0; k < 4; k++) setTimeout(() => burst(t.group.position.x + (Math.random() - 0.5) * 20, t.h + 20 + k * 8, t.group.position.z + (Math.random() - 0.5) * 20, 1.4), k * 450); }
    }
    newest = coins.slice().sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0))[0] || null;
    firstSet = false;
    ghosts.forEach((g, h) => { g.visible = !used.has(h); g.material.color.setHex(h === hourNow ? 0xffffff : 0xff2e88); g.material.opacity = h === hourNow ? 0.95 : 0.25; });
  }

  // ---------------- camera: drag to orbit, wheel / pinch to zoom, a slow drift when idle; fly to a tower
  const orbit = { yaw: 0.9, pitch: 0.78, dist: PHONE ? 300 : 250, tx: 0, tz: 0, ty: 0 };
  let goal = null, idle = 0;
  const applyCam = () => { const c = Math.cos(orbit.pitch); cam.position.set(orbit.tx + Math.sin(orbit.yaw) * c * orbit.dist, orbit.ty + Math.sin(orbit.pitch) * orbit.dist, orbit.tz + Math.cos(orbit.yaw) * c * orbit.dist); cam.lookAt(orbit.tx, orbit.ty + 8, orbit.tz); };
  let drag = null; const pts = new Map();
  let ctl = null; // someone else drives the camera (roam.js: on foot in the streets)
  canvas.addEventListener("pointerdown", (e) => { if (ctl) return; pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, moved: 0 }; idle = 0; goal = null; });
  addEventListener("pointermove", (e) => {
    if (ctl || !pts.has(e.pointerId)) return; const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (drag.pinch) orbit.dist = clamp(orbit.dist * drag.pinch / d, 60, 520); drag.pinch = d; return; }
    if (!drag) return; const dx = e.clientX - px, dy = e.clientY - py; drag.moved += Math.abs(dx) + Math.abs(dy);
    orbit.yaw -= dx * 0.005; orbit.pitch = clamp(orbit.pitch + dy * 0.004, 0.18, 1.35);
  });
  addEventListener("pointerup", (e) => { if (ctl) return; pts.delete(e.pointerId); if (drag && drag.moved < 6 && pts.size === 0) pick(e.clientX, e.clientY); if (!pts.size) drag = null; });
  canvas.addEventListener("wheel", (e) => { if (ctl) return; e.preventDefault(); orbit.dist = clamp(orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 60, 520); idle = 0; }, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects([...towers.values()].flatMap((t) => [t.body, t.sign]), false)[0]; if (hit) { flyTo(hit.object.userData.mint); onPick(hit.object.userData.mint); } }
  function flyTo(mint) { const t = towers.get(mint); if (!t) return; goal = { tx: t.group.position.x, tz: t.group.position.z, ty: t.h * 0.4, dist: 70 + t.h * 0.8 }; idle = 0; }

  // ---------------- render
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), PHONE ? 0.55 : 0.8, 0.5, 0.72); composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  // light graphics (perf.js turns it on for a slow device, or the player picks it): no bloom, one pixel a CSS pixel, a
  // third of the traffic, fewer stars
  let low = false; const DPR = Math.min(devicePixelRatio, PHONE ? 1.5 : 2), LOW_CARS = Math.round(CARS / 3);
  const draw = () => (low ? renderer.render(scene, cam) : composer.render());
  function setLow(v) {
    v = !!v; if (v === low) return; low = v;
    renderer.setPixelRatio(low ? Math.min(DPR, 1) : DPR); resize();
    traffic.forEach((c, i) => { if (i >= LOW_CARS) c.hold = low ? 1e12 : c.hold > 1e11 ? 0 : c.hold; });
  }
  addEventListener("resize", resize); resize();
  let last = performance.now(), T = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt; idle += dt;
    if (document.hidden) { requestAnimationFrame(frame); return; }
    sea.material.uniforms.t.value = T;
    placeCars(dt); cars.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
    // the helicopter circles the newest tower (the plaza when there's none)
    const nt = heliAt ? { group: { position: heliAt }, h: 0 } : newest && towers.get(newest.mint), hc = heli.userData.c || (heli.userData.c = { x: 0, z: 0 });
    hc.x += ((nt ? nt.group.position.x : 0) - hc.x) * Math.min(1, dt * 0.5); hc.z += ((nt ? nt.group.position.z : 0) - hc.z) * Math.min(1, dt * 0.5);
    const a = T * (heliAt ? 0.5 : 0.18), hr = heliAt ? 22 : nt ? 34 : 70; heli.position.set(hc.x + Math.cos(a) * hr, Math.max(62, (nt ? nt.h : 0) + 40) + Math.sin(T * 0.7) * 2, hc.z + Math.sin(a) * hr); heli.rotation.y = -a; heli.userData.rotor.rotation.y = T * 30;
    stepBursts(dt);
    for (const [m, t] of towers) { const k = Math.max(0, Math.min(1, (T - (born.get(m) || 0)) / 1.4)); t.group.scale.y = k < 1 ? Math.max(0.001, 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.08) : 1; }
    heli.userData.blink.visible = (T % 1) < 0.15; heli.userData.beam.rotation.z = Math.sin(T * 0.6) * 0.35; heli.userData.beam.rotation.x = Math.cos(T * 0.45) * 0.3;
    for (const t of towers.values()) { t.sign.position.y = t.h + 6 + Math.sin(T * 2 + t.h) * 0.6; if (t.lights) { const on = (T * 3) % 1 < 0.5; t.lights[0].visible = on; t.lights[1].visible = !on; } }
    if (ctl) { ctl(dt, T); draw(); requestAnimationFrame(frame); return; }
    if (goal) { for (const k of ["tx", "tz", "ty", "dist"]) orbit[k] += (goal[k] - orbit[k]) * Math.min(1, dt * 2.5); }
    else if (idle > 6) { orbit.yaw += dt * 0.04; for (const k of ["tx", "tz", "ty"]) orbit[k] += (0 - orbit[k]) * dt * 0.3; }
    applyCam(); draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  let heliAt = null; // the helicopter hunts a spot (a wanted player) instead of circling the newest tower
  const world = { HALF, SEA_X, RING, P, R, hub: 7.5 };
  const CAR_COLORS = [0xff2e88, 0x111111, 0xffffff, 0x1a1a1a, 0x2b2b2b, 0xd91a6b];
  return { setCoins, flyTo, scene, cam, towers, burst, solids, bodies, world, canvas, traffic, carColor: (i) => CAR_COLORS[i % 6], turfAt, get turf() { return turf; },
    setLow, get low() { return low; },
    setControl(f) { ctl = f; drag = null; pts.clear(); goal = null; idle = 0; },
    setHeliTarget(v) { heliAt = v; },
    get orbit() { return orbit; } };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
