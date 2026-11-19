// music.js — the city's K-pop: ARCIRCLE WORLD's six tracks (audio/music, Pixabay Content License — CREDITS.txt) in a
// shuffled order, one after another. On by default, it starts with your first tap or key (browsers don't play sound
// before that); the ♫ button turns it off and on (dc.music, kept on the device). It pauses while the tab is
// hidden. A small card says what's playing when a track starts.
export const PLAYLIST = ["kpop-1", "kpop-2", "kpop-3", "kpop-4", "kpop-5", "kpop-6"];
export const TITLES = { "kpop-1": ["Epic K-pop Music", "ribhavagrawal"], "kpop-2": ["Tell Me", "kontraa"], "kpop-3": ["Modern K-pop", "kulakovka"], "kpop-4": ["Han River Nights", "ultrafi"], "kpop-5": ["Neon Run", "sounovamusic"], "kpop-6": ["K-pop", "kulakovka"] };
/// a shuffled order that never starts with the track that just ended
export function shuffled(list, last = "", rnd = Math.random) {
  const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.length > 1 && a[0] === last) [a[0], a[1]] = [a[1], a[0]];
  return a;
}
export function makeMusic({ button = null, notify = null, volume = 0.32 } = {}) {
  let on = true; try { on = localStorage.getItem("dc.music") !== "0"; } catch { /* */ }
  const au = new Audio(); au.preload = "none"; au.volume = volume;
  let order = shuffled(PLAYLIST), i = 0, started = false;
  const show = (id) => { const [t, by] = TITLES[id] || [id, ""]; if (notify) notify(`♫ ${t} — ${by}`); };
  const load = () => { const id = order[i]; au.src = `/audio/music/${id}.mp3`; return id; };
  const play = () => { if (!on) return; if (!au.src) load(); const id = order[i]; au.play().then(() => { if (!started) { started = true; } show(id); }).catch(() => {}); };
  au.addEventListener("ended", () => { i++; if (i >= order.length) { order = shuffled(PLAYLIST, order[order.length - 1]); i = 0; } load(); play(); });
  au.addEventListener("error", () => { i = (i + 1) % order.length; load(); if (started) setTimeout(play, 800); });
  const paint = () => { if (button) { button.classList.toggle("on", on); button.title = on ? "Music on — tap to turn off" : "Music off — tap to turn on"; button.setAttribute("aria-pressed", String(on)); } };
  const set = (v) => { on = v; try { localStorage.setItem("dc.music", on ? "1" : "0"); } catch { /* */ } paint(); if (on) play(); else au.pause(); };
  if (button) button.addEventListener("click", (e) => { e.stopPropagation(); set(!on); });
  // the first tap or key starts it (once)
  const first = () => { removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true); if (on && au.paused) play(); };
  addEventListener("pointerdown", first, true); addEventListener("keydown", first, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) au.pause(); else if (on && started) au.play().catch(() => {}); });
  paint();
  return { get on() { return on; }, set, audio: au, next: () => { au.dispatchEvent(new Event("ended")); } };
}
