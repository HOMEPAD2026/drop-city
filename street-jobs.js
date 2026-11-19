// street-jobs.js — three jobs a day (the same three for everyone, picked by the UTC date), a street score for the week
// and the week's board. Jobs: visit towers, knock out rivals, crack an ATM, steal a car, drive, raise the heat, hold
// three stars, deliver a package to a coin's tower before the clock runs out, stop by the newest drop. A job done is
// +100 score, all three +200 and a day on your streak (titles at 1 / 3 / 7 days). The score is a toy kept on the device
// and sent to the week's board; nothing is paid.
import { post, getJ } from "/common.js";

export const JOBS = {
  visit: { n: 3, t: "Case 3 coin towers", s: "Stand at the door of three different towers" },
  ko: { n: 3, t: "Knock out 3 rivals", s: "Rival crews wander the plaza" },
  atm: { n: 1, t: "Crack an ATM", s: "Three punches open one" },
  steal: { n: 1, t: "Steal a car", s: "Walk up to a passing car" },
  drive: { n: 500, t: "Drive 500 m", s: "Any car will do", u: "m" },
  heat: { n: 3, t: "Get 3 wanted stars", s: "Crimes raise the heat" },
  hold: { n: 45, t: "Hold 3 stars for 45 s", s: "Stay hot, stay up", u: "s" },
  deliver: { n: 1, t: "Deliver a package", s: "Pick it up at the clock in the plaza" },
  newest: { n: 1, t: "Visit the newest drop", s: "The latest coin's tower" },
};
const IDS = Object.keys(JOBS);
export const dayOf = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const weekOf = (t = Date.now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
/// the day's three jobs: the same for everyone (a seeded pick by the date)
export function picksOf(day) {
  let h = 2166136261; for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const pool = IDS.slice(), out = [];
  while (out.length < 3) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
export const titleOf = (streak) => (streak >= 7 ? "KINGPIN" : streak >= 3 ? "MADE CREW" : streak >= 1 ? "STREET ROOKIE" : "");
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

export function streetJobs(A, { pid = () => "" } = {}) {
  const { THREE, S, me, city, hooks } = A;
  let J = load("dc.jobs", null), W = load("dc.week", null), K = load("dc.streak", { last: "", n: 0 });
  const fresh = () => { const day = dayOf(); if (!J || J.day !== day) J = { day, picks: picksOf(day), prog: {}, done: [], seen: [] }; const wk = weekOf(); if (!W || W.wk !== wk) W = { wk, s: 0 }; };
  fresh();
  const el = document.getElementById("jobs");
  let open = !A.PHONE, sendAt = 0, sent = -1, board = null, pkg = null, pkgMesh = null, tick = 0;

  function addScore(n) { W.s += n; save("dc.week", W); }
  function bump(id, by = 1) {
    if (!J.picks.includes(id) || J.done.includes(id)) return;
    J.prog[id] = Math.min(JOBS[id].n, (J.prog[id] || 0) + by);
    if (J.prog[id] >= JOBS[id].n) {
      J.done.push(id); addScore(100); A.bigText("JOB DONE", "#3dffb5"); A.sound("win"); A.me.cash += 250; A.saveMe(A.me); A.paintHud();
      if (J.done.length === 3) { addScore(200); const y = dayOf(Date.now() - 864e5); K = { last: J.day, n: K.last === y ? K.n + 1 : K.last === J.day ? K.n : 1 }; save("dc.streak", K); setTimeout(() => A.bigText(titleOf(K.n) || "ALL JOBS DONE", "#ffd36b"), 1800); }
    }
    save("dc.jobs", J); paint();
  }
  // what happened this frame, read from the street's state
  const last = { down: new Set(), cd: new Map(), inCar: false, at: null, hot: 0 };
  hooks.step.push((dt) => {
    if (dayOf() !== J.day) { fresh(); paint(); }
    for (const n of A.rivals) { const d = n.st === "down"; if (d && !last.down.has(n)) { last.down.add(n); bump("ko"); addScore(10); } if (!d) last.down.delete(n); }
    for (const a of A.atms) { const was = last.cd.get(a) || 0; if (a.cd > 0 && was <= 0) { bump("atm"); addScore(25); } last.cd.set(a, a.cd); }
    if (S.inCar && !last.inCar) { bump("steal"); addScore(15); } last.inCar = S.inCar;
    if (S.inCar) { if (last.at) { const d = Math.hypot(S.pos.x - last.at.x, S.pos.z - last.at.z); if (d < 20) { J._m = (J._m || 0) + d; if (J._m >= 1) { const m = Math.floor(J._m); J._m -= m; bump("drive", m); } } } last.at = { x: S.pos.x, z: S.pos.z }; } else last.at = null;
    if (J.picks.includes("heat") && !J.done.includes("heat") && S.wanted > (J.prog.heat || 0)) bump("heat", S.wanted - (J.prog.heat || 0));
    if (S.wanted >= 3) { last.hot += dt; if (last.hot >= 1) { last.hot -= 1; bump("hold"); } } else last.hot = 0;
    if (S.near && !J.seen.includes(S.near)) { J.seen.push(S.near); bump("visit"); const nw = newest(); if (nw && nw === S.near) bump("newest"); }
    // the package: at the clock in the plaza, then a tower's door before the clock runs out
    if (pkg) { pkg.left -= dt; if (pkg.left <= 0) { A.toast("Too slow — the package went cold."); dropPkg(); } else if (S.near === pkg.to) { A.pop("DELIVERED", S.pos, "#3dffb5", 2.8); bump("deliver"); addScore(40); dropPkg(); } }
    if (pkgMesh) { pkgMesh.rotation.y += dt * 2; pkgMesh.position.y = 2.2 + Math.sin(performance.now() / 300) * 0.2; }
    if ((tick += dt) > 1) { tick = 0; paint(true); maybeSend(); }
  });
  function newest() { let b = null; for (const t of city.towers.values()) if (!b || (t.coin.launchedAt || 0) > (b.coin.launchedAt || 0)) b = t; return b ? b.coin.mint : null; }
  function dropPkg() { pkg = null; if (pkgMesh) pkgMesh.visible = false; paint(); }
  hooks.act.push(() => {
    if (!J.picks.includes("deliver") || J.done.includes("deliver") || pkg || S.inCar) return null;
    if (Math.hypot(S.pos.x, S.pos.z) > A.city.world.hub + 3.5) return null;
    return { label: "PICK UP PACKAGE", id: "pkg", run: () => {
      const ts = [...city.towers.values()]; if (!ts.length) { A.toast("No towers to deliver to yet."); return; }
      const t = ts[Math.floor(Math.random() * ts.length)]; pkg = { to: t.coin.mint, sym: t.coin.symbol, left: 120 };
      if (!pkgMesh) { pkgMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xc8a06a, emissive: 0x3a2a10, roughness: 0.8 })); A.root.add(pkgMesh); }
      pkgMesh.visible = true; A.toast(`Take it to $${t.coin.symbol}'s tower — 2 minutes.`); paint();
    } };
  });
  // the package rides with you (above your head)
  hooks.step.push(() => { if (pkg && pkgMesh) pkgMesh.position.set(S.pos.x, 2.2, S.pos.z); });

  async function maybeSend() {
    const now = Date.now(); if (W.s === sent || now - sendAt < 30e3 || !pid()) return;
    sendAt = now; const r = await post({ action: "score", id: pid(), name: me.name, score: W.s }).catch(() => null);
    if (r && r.ok) { sent = W.s; board = r.j; paint(); }
  }
  async function loadBoard() { try { board = await getJ("?street"); paint(); } catch { /* */ } }

  function paint(quiet) {
    if (!el) return;
    const done = J.done.length, rows = (board && board.rows) || [];
    if (quiet && !open) { const c = el.querySelector(".jb-n"); if (c) c.textContent = `${done}/3`; }
    const li = J.picks.map((id) => { const j = JOBS[id], p = Math.min(j.n, J.prog[id] || 0), ok = J.done.includes(id);
      const extra = id === "deliver" && pkg ? `<small class="hot">→ $${pkg.sym} · ${Math.ceil(pkg.left)}s</small>` : `<small>${j.s}</small>`;
      return `<li class="${ok ? "ok" : ""}"><i>${ok ? "✓" : ""}</i><span><b>${j.t}</b>${extra}</span><em>${ok ? "+100" : j.n > 1 ? `${p}/${j.n}${j.u || ""}` : ""}</em></li>`; }).join("");
    if (quiet && open) { const ul = el.querySelector("ul.jb-l"); if (ul) { ul.innerHTML = li; return; } }
    const title = titleOf(K.last >= dayOf(Date.now() - 864e5) ? K.n : 0);
    el.innerHTML = `<button type="button" class="jb-h"><b>DAILY JOBS</b><span class="jb-n">${done}/3</span>${title ? `<em>${title}</em>` : ""}<i>${open ? "–" : "+"}</i></button>
      ${open ? `<ul class="jb-l">${li}</ul><div class="jb-w"><div class="jb-wh"><b>THIS WEEK</b><span>your score <strong>${W.s.toLocaleString("en-US")}</strong></span></div>
      ${rows.length ? `<ol>${rows.slice(0, 8).map((r) => `<li class="${r.name === me.name ? "me" : ""}"><span>${r.name.replace(/[<>&]/g, "")}</span><b>${Number(r.s).toLocaleString("en-US")}</b></li>`).join("")}</ol>` : `<p>No one on the board yet this week.</p>`}
      <small>A score for fun — nothing here is paid or on chain.</small></div>` : ""}`;
    el.querySelector(".jb-h").onclick = () => { open = !open; if (open) loadBoard(); paint(); };
  }
  paint(); loadBoard();
  return { get state() { return { J, W, K }; }, bump };
}
