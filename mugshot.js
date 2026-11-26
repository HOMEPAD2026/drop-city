// mugshot.js — a coin's mugshot: a 1200×630 card drawn on the device (the logo against the height lines, the booking
// placard, the record: market cap, curve, when it dropped, the CA's last letters, a raid stamp), shared on phones or
// downloaded elsewhere. The name and the suffix come from the config; nothing is sent anywhere to make it.
const W = 1200, H = 630;
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; setTimeout(() => res(null), 6000); });
const money = (n) => (n == null ? "–" : n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : "$" + Math.round(n));
export async function mugshotCanvas(c, cfg = {}) {
  try { await Promise.all(["400 80px Anton", "800 20px 'Pretendard Variable'", "700 20px 'JetBrains Mono'"].map((f) => document.fonts.load(f))); } catch { /* */ }
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  // the room
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#141015"); bg.addColorStop(1, "#070708"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // the height lines behind the mugshot
  const L = 60, T = 50, MW = 470, MH = 530;
  x.fillStyle = "#1d1a1f"; x.fillRect(L, T, MW, MH);
  x.strokeStyle = "rgba(255,255,255,0.18)"; x.fillStyle = "rgba(255,255,255,0.45)"; x.font = "700 14px 'JetBrains Mono', monospace"; x.lineWidth = 2;
  for (let i = 0; i <= 10; i++) { const y = T + 20 + i * 48; x.beginPath(); x.moveTo(L, y); x.lineTo(L + MW, y); x.stroke(); x.fillText(`${7 - i * 0.5 >= 2 ? (7 - i * 0.5).toFixed(1) : ""}`, L + 8, y - 6); }
  // the face: the coin's logo, round, a spotlight
  const img = await loadImg(c.image);
  const cx = L + MW / 2, cy = T + 230, R = 160;
  const glow = x.createRadialGradient(cx, cy, 20, cx, cy, 260); glow.addColorStop(0, "rgba(255,46,136,0.35)"); glow.addColorStop(1, "rgba(255,46,136,0)"); x.fillStyle = glow; x.fillRect(L, T, MW, MH);
  x.save(); x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
  let drew = false;
  if (img) try { x.drawImage(img, cx - R, cy - R, R * 2, R * 2); x.getImageData(cx, cy, 1, 1); drew = true; } catch { drew = false; }
  if (!drew) { x.fillStyle = "#2a1520"; x.fillRect(cx - R, cy - R, R * 2, R * 2); x.fillStyle = "#ff2e88"; x.font = "400 130px Anton, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(c.symbol || "?").slice(0, 3), cx, cy + 8); x.textAlign = "left"; x.textBaseline = "alphabetic"; }
  x.restore();
  x.strokeStyle = "#fff"; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  // the booking placard
  const py = T + MH - 118; x.fillStyle = "#0b0a0c"; x.fillRect(L + 50, py, MW - 100, 96); x.strokeStyle = "rgba(255,255,255,0.7)"; x.lineWidth = 3; x.strokeRect(L + 50, py, MW - 100, 96);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "400 44px Anton, Impact, sans-serif"; x.fillText("$" + String(c.symbol || "").slice(0, 12), cx, py + 50);
  x.font = "700 16px 'JetBrains Mono', monospace"; x.fillStyle = "#ff6fae"; const d = new Date((c.launchedAt || Date.now() / 1000) * 1000);
  x.fillText(`BOOKED ${d.toISOString().slice(0, 10)} · ${d.toISOString().slice(11, 16)} UTC`, cx, py + 80); x.textAlign = "left";
  // the record
  const RX = 590;
  x.fillStyle = "#ff2e88"; x.font = "800 16px 'JetBrains Mono', monospace"; x.fillText(`${String(cfg.name || "THE CITY").toUpperCase()} · CITY RECORDS`, RX, 92);
  x.fillStyle = "#fff"; x.font = "400 92px Anton, Impact, sans-serif"; x.fillText("WANTED", RX, 190);
  x.font = "800 34px 'Pretendard Variable', Pretendard, system-ui, sans-serif"; let nm = String(c.name || ""); while (x.measureText(nm).width > 560 && nm.length > 3) nm = nm.slice(0, -2) + "…"; x.fillText(nm, RX, 244);
  x.fillStyle = "#ff2e88"; x.font = "400 34px 'Pretendard Variable', Pretendard, sans-serif"; const st = Math.max(1, Math.min(5, Math.round(((c.graduated ? 100 : c.progress || 0) / 100) * 4) + 1)); x.fillText("★".repeat(st) + "☆".repeat(5 - st), RX, 292);
  const rows = [["MARKET CAP", money(c.mcapUsd)], ["BONDING CURVE", c.graduated ? "GRADUATED" : `${(c.progress || 0).toFixed(1)}%`], ["DROPPED", c.hour ? `${c.hour.slice(11, 13)}:00 UTC` : "a launch"], ["CA", `…${String(c.mint || "").slice(-6)}`]];
  rows.forEach(([k, v], i) => { const y = 350 + i * 52; x.fillStyle = "rgba(255,255,255,0.08)"; x.fillRect(RX, y - 32, 540, 44); x.fillStyle = "#9a9498"; x.font = "800 14px 'JetBrains Mono', monospace"; x.fillText(k, RX + 14, y - 4);
    x.fillStyle = "#fff"; x.font = "700 24px 'JetBrains Mono', monospace"; x.textAlign = "right"; x.fillText(v, RX + 526, y - 2); x.textAlign = "left"; });
  if (cfg.suffix) { x.fillStyle = "#ff2e88"; x.font = "800 18px 'JetBrains Mono', monospace"; x.fillText(`EVERY CA ENDS IN ${cfg.suffix}`, RX, 578); }
  x.fillStyle = "#9a9498"; x.font = "600 16px 'Pretendard Variable', Pretendard, sans-serif"; x.textAlign = "right"; x.fillText(location.host, W - 60, 578); x.textAlign = "left";
  // the raid stamp
  if (c.raid) { x.save(); x.translate(L + MW - 150, T + 90); x.rotate(-0.22); x.strokeStyle = "#ffd21f"; x.lineWidth = 6; x.strokeRect(-170, -48, 340, 96); x.fillStyle = "#ffd21f"; x.font = "400 60px Anton, Impact, sans-serif"; x.textAlign = "center"; x.fillText("RAIDED", 0, 22); x.restore(); }
  return cv;
}
/// make the card and hand it over: the share sheet on phones (with the file), else a download
export async function shareMugshot(c, cfg = {}) {
  const cv = await mugshotCanvas(c, cfg);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (!blob) throw new Error("couldn't draw the card");
  const name = `mugshot-${String(c.symbol || "coin").replace(/[^A-Za-z0-9]/g, "")}.png`, file = new File([blob], name, { type: "image/png" });
  const text = `$${c.symbol} — booked in ${cfg.name || "the city"}.${cfg.suffix ? ` CA ends in ${cfg.suffix}.` : ""}`, url = `${location.origin}/coin/${c.mint}`;
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) { try { await navigator.share({ files: [file], text, url }); return "shared"; } catch (e) { if (e && e.name === "AbortError") return "cancelled"; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
