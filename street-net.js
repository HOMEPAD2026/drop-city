// street-net.js — the other players in the streets. Every second while you're on foot your browser tells the server
// where you are, what you're doing (the move, an emote, a car) and whom you just punched; the answer is everyone else
// near you and any punches that landed on you. Others are drawn as their own crew body with their street name, eased
// from beat to beat. Keys 1 / 2 (or the 👋 button) wave and cheer. Punching another player is a toy too: it knocks their
// health on their screen, nothing more.
import { post } from "/common.js";

const TINT = { boss: 0xffe08a, made: 0xffd0e4 };
const ONCE = new Set(["punch", "hit", "jump", "wave", "cheer", "spawn", "die"]);
export function streetNet(A) {
  const { THREE, S, me, root, makeBody, tagOf, pop, hooks, PHONE } = A;
  let pid = ""; try { pid = localStorage.getItem("dc.pid") || ""; } catch { /* */ }
  if (!/^[A-Za-z0-9]{12}$/.test(pid)) { pid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[b % 56]).join(""); try { localStorage.setItem("dc.pid", pid); } catch { /* */ } }
  const others = new Map(); // id → { row, body, loading, pos, yaw, seen, lastC, lastE, tag }
  const MAXDRAW = PHONE ? 8 : 16;
  let emote = "", hitId = "", since = 0, busy = false, wait = 0, n = 1, lastHitBy = "";
  const el = document.getElementById("here-n");

  async function beat() {
    if (busy || !S.active || document.hidden || !S.hero) return;
    busy = true;
    const body = { action: "here", id: pid, name: me.name, look: me.look, x: S.pos.x, y: S.pos.y, z: S.pos.z, r: Math.atan2(Math.sin(S.yaw), Math.cos(S.yaw)),
      c: S.inCar ? "drive" : A.clipName(S.hero.clip()), e: emote, car: S.inCar ? S.carColor || 1 : 0, w: S.wanted, p: S.perk || "", hit: hitId, since };
    emote = ""; hitId = "";
    try {
      const r = await post(body);
      if (r.ok) { wait = 0; take(r.j); } else wait = r.status === 429 ? 5 : 3;
    } catch { wait = 5; }
    busy = false;
  }
  function take(j) {
    const t = performance.now(), rows = (j.others || []).slice(0, MAXDRAW);
    n = (j.n || rows.length + 1);
    if (el) el.textContent = String(n);
    for (const r of rows) {
      let o = others.get(r.id);
      if (!o) { o = { row: r, body: null, loading: false, pos: new THREE.Vector3(r.x, r.y, r.z), yaw: r.r, lastC: "", lastE: "" }; others.set(r.id, o); }
      if ((o.row.look !== r.look || (o.row.p || "") !== (r.p || "")) && o.body) { root.remove(o.body.obj); o.body = null; }
      if (o.row.name !== r.name && o.tag) { o.tag.material.map.dispose(); o.tag.material.map = A.tagTex(r.name, "#5ce1ff"); }
      o.row = r; o.seen = t;
      if (!o.body && !o.loading) { o.loading = true; makeBody(r.look, { tint: TINT[r.p] || null }).then((b) => { o.loading = false; if (!others.has(r.id)) return; o.body = b; o.tag = tagOf(o.row.name, r.p === "boss" || r.p === "made" ? "#ffd36b" : "#5ce1ff"); b.obj.add(o.tag); b.obj.position.copy(o.pos); root.add(b.obj); }).catch(() => { o.loading = false; }); }
      if (r.e && r.e !== o.lastE && o.body) o.body.play(r.e, { once: true });
      o.lastE = r.e;
    }
    for (const [id, o] of others) if (t - o.seen > 3500) { if (o.body) root.remove(o.body.obj); if (o.car) root.remove(o.car); others.delete(id); }
    for (const h of j.hits || []) {
      since = Math.max(since, h.at || 0);
      const o = others.get(h.from), from = o ? o.pos : S.pos.clone().add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5));
      lastHitBy = h.name; A.hurtMe(Math.min(15, h.dmg || 8), from);
      if (S.hp <= 0) A.toast(`${h.name} knocked you out.`);
    }
  }
  setInterval(() => { if (wait > 0) { wait--; return; } beat(); }, 1000);

  // every frame: ease the others toward their last beat; play what they're doing
  hooks.step.push((dt) => {
    for (const o of others.values()) {
      const r = o.row, b = o.body; if (!b) continue;
      const tx = r.x, tz = r.z, d = Math.hypot(tx - o.pos.x, tz - o.pos.z);
      if (d > 30) o.pos.set(tx, r.y, tz); else { const k = Math.min(1, dt * 4); o.pos.x += (tx - o.pos.x) * k; o.pos.z += (tz - o.pos.z) * k; o.pos.y += (r.y - o.pos.y) * Math.min(1, dt * 8); }
      let dy = r.r - o.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; o.yaw += dy * Math.min(1, dt * 8);
      if (r.car && A.carOf) { b.obj.visible = false; if (!o.car) { o.car = A.carOf(r.car); root.add(o.car); } o.car.position.copy(o.pos); o.car.rotation.y = o.yaw; }
      else { b.obj.visible = true; if (o.car) { root.remove(o.car); o.car = null; } }
      b.obj.position.copy(o.pos); b.obj.rotation.y = o.yaw;
      if (r.c !== o.lastC) { o.lastC = r.c; if (ONCE.has(r.c)) b.play(r.c, { once: true, speed: r.c === "punch" ? 1.7 : 1.2 }); }
      if (!ONCE.has(r.c) && !b.busy()) { const moving = d > 0.4; b.play(r.c === "drive" ? "idle" : moving ? (r.c === "sprint" || d > 5 ? "sprint" : "walk") : r.c === "walk" || r.c === "sprint" ? "idle" : r.c); }
      b.update(dt);
    }
  });
  // a punch can land on another player standing in front of you
  hooks.punch.push((fx, fz) => {
    for (const [id, o] of others) { if (!o.body || o.row.car) continue; const dx = o.pos.x - S.pos.x, dz = o.pos.z - S.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.3 && (dx * fx + dz * fz) / (d || 1) > 0.2) { hitId = id; pop("POW!", o.pos, "#5ce1ff"); o.body.play("hit", { once: true, speed: 1.3 }); return true; } }
    return false;
  });
  // emotes
  const doEmote = (e) => { if (!S.active || !S.hero || S.inCar || S.down > 0) return; emote = e; S.hero.play(e, { once: true }); };
  hooks.key.push((k, down) => { if (!down) return false; if (k === "1") { doEmote("wave"); return true; } if (k === "2") { doEmote("cheer"); return true; } return false; });
  const eb = document.getElementById("b-emote"); let flip = 0;
  if (eb) eb.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); doEmote(flip++ % 2 ? "cheer" : "wave"); });
  return { get count() { return n; }, others, pid, get lastHitBy() { return lastHitBy; } };
}
