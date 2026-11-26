// creator-ui.js — the creator's tools in a coin's window (round L, the owner 2026-11-26): set the coin's links, pin a
// note, give it a big link card (a poster drawn here from the logo), all with one signed message; and the share kit
// (post on X, copy the CA / the link, the mugshot) any time — it used to vanish once the launch window closed.
import { esc, note, post, b58, sol } from "/common.js";
import { t, tf } from "/i18n.js";
import { ic } from "/icons.js";

const W = 1200, H = 630;
async function img(src) { return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; setTimeout(() => ok(null), 6000); }); }
/// the poster: the coin's link card on X / Telegram — logo, $TICKER, name, the address's end, the locked split
export async function drawPoster(c, CFG) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#1a0f2e"); bg.addColorStop(0.55, "#2a0f2a"); bg.addColorStop(1, "#0b0913"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(330, 315, 40, 330, 315, 420); glow.addColorStop(0, "rgba(255,61,139,0.45)"); glow.addColorStop(1, "rgba(255,61,139,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const sun = g.createLinearGradient(0, H - 10, W, H); sun.addColorStop(0, "#ff3d8b"); sun.addColorStop(0.5, "#ff5e74"); sun.addColorStop(1, "#ff9a62"); g.fillStyle = sun; g.fillRect(0, H - 12, W, 12);
  const pic = await img(c.image);
  g.save(); g.beginPath(); g.arc(330, 300, 190, 0, Math.PI * 2); g.closePath(); g.fillStyle = "#1b1628"; g.fill(); g.clip();
  if (pic) g.drawImage(pic, 140, 110, 380, 380); else { g.fillStyle = "#ff3d8b"; g.font = "800 120px Pretendard, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(c.symbol || "?").slice(0, 3), 330, 300); }
  g.restore(); g.lineWidth = 8; g.strokeStyle = "#ff8ab8"; g.beginPath(); g.arc(330, 300, 194, 0, Math.PI * 2); g.stroke();
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#ff8ab8"; g.font = "800 30px Pretendard, system-ui, sans-serif"; g.fillText(String(CFG.name || "GTAFUN").toUpperCase() + " · PUMP.FUN", 580, 190);
  g.fillStyle = "#ffffff"; g.font = "800 104px Pretendard, system-ui, sans-serif"; g.fillText("$" + String(c.symbol || "").slice(0, 10), 576, 300);
  g.fillStyle = "#d9d2e8"; g.font = "600 44px Pretendard, system-ui, sans-serif"; g.fillText(String(c.name || "").slice(0, 26), 580, 365);
  g.fillStyle = "#b9b0cc"; g.font = "600 30px JetBrains Mono, ui-monospace, monospace"; g.fillText("CA …" + String(c.mint).slice(-8), 580, 440);
  const s = CFG.split || { creator: 6000, vault: 3000, buyer: 1000 };
  g.fillStyle = "#7dffb4"; g.font = "700 28px Pretendard, system-ui, sans-serif"; const solo = c.noSplit || c.mint === CFG.main; // the main coin: no split, its creator fees go 100 % to the dev
  g.fillText(solo ? "Creator fees go 100% to the dev" : c.clean ? "Clean launch · fees locked on chain" : `Fees locked on chain ${s.creator / 100} / ${s.vault / 100} / ${s.buyer / 100}`, 580, 500);
  let data = ""; try { data = cv.toDataURL("image/webp", 0.86); if (!data.startsWith("data:image/webp")) data = cv.toDataURL("image/jpeg", 0.86); } catch { data = ""; }
  return data;
}
const pageMessage = (b) => `GTAFUN coin page\nWallet: ${b.wallet}\nCoin: ${b.mint}\nX: ${b.twitter || ""}\nTelegram: ${b.telegram || ""}\nWebsite: ${b.website || ""}\nNote: ${b.note || ""}\nPoster: ${b.posterSha || "none"}\nIssued: ${b.issued}`;
async function sha256hex(dataUrl) { const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (ch) => ch.charCodeAt(0)); const h = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

export async function openEditor(c, CFG, onSaved) {
  const el = document.createElement("div"); el.className = "wmodal ce-pop";
  const link = `${location.origin}/coin/${c.mint}`, tw = encodeURIComponent(`$${c.symbol} — ${c.name}\n\nCA: ${c.mint}\n`);
  el.innerHTML = `<div class="wm-card ce-card" role="dialog" aria-label="Edit coin page"><button type="button" class="wm-x" aria-label="Close">×</button>
    <h3>${ic("rocket")} ${esc(t("ceH", "Your coin page"))}</h3><p class="wm-sub">${esc(t("ceSub", "Links, a pinned note and a big link card — saved with one signature, nothing on chain. Shown as set by the creator on GTAFUN."))}</p>
    <div class="ce-f"><label>X<input data-c="twitter" type="url" inputmode="url" autocapitalize="none" value="${esc(c.twitter || "")}" placeholder="https://x.com/…"></label>
    <label>Telegram<input data-c="telegram" type="url" inputmode="url" autocapitalize="none" value="${esc(c.telegram || "")}" placeholder="https://t.me/…"></label>
    <label>${esc(t("lsWeb", "Website"))}<input data-c="website" type="url" inputmode="url" autocapitalize="none" value="${esc(c.website || "")}" placeholder="https://…"></label>
    <label>${esc(t("ceNote", "Pinned note (140)"))}<textarea data-c="note" maxlength="140" rows="2" placeholder="${esc(t("ceNoteP", "e.g. Community call on X at 18:00 UTC"))}">${esc(c.note || "")}</textarea></label></div>
    <p class="ce-k">${esc(t("ceCard", "The big link card"))}</p><div class="ce-prev"><p class="fine">${esc(t("ctLoading", "Reading the chain…"))}</p></div>
    <button type="button" class="btn hot ce-go" data-c="save">${esc(t("ceSave", "Save with one signature"))}</button>
    <p class="ce-k">${esc(t("kitH", "Tell the city"))}</p><div class="ce-kit"><a class="btn ghost" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=${tw}&url=${encodeURIComponent(link)}">${esc(t("kitX", "Post on X"))}</a><button type="button" class="btn ghost" data-c="ca">${esc(t("cmCopy", "Copy CA"))}</button><button type="button" class="btn ghost" data-c="link">${esc(t("kitLink", "Copy link"))}</button><button type="button" class="btn ghost" data-c="mug">${ic("camera")} ${esc(t("cmMug", "Mugshot"))}</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("in"));
  const close = () => { el.classList.remove("in"); setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 200); };
  let poster = ""; drawPoster(c, CFG).then((d) => { poster = d; el.querySelector(".ce-prev").innerHTML = d ? `<img src="${d}" alt="">` : `<p class="fine">${esc(t("ceNoCard", "The card couldn't be drawn here — the links and note still save."))}</p>`; });
  const val = (k) => String(el.querySelector(`[data-c="${k}"]`).value || "").trim();
  el.onclick = async (e) => {
    if (e.target === el || e.target.closest(".wm-x")) return close();
    const b = e.target.closest("[data-c]"); if (!b || b.tagName === "INPUT" || b.tagName === "TEXTAREA") return; const k = b.dataset.c;
    if (k === "ca" || k === "link") { try { await navigator.clipboard.writeText(k === "ca" ? c.mint : link); note(k === "ca" ? "Address copied" : "Link copied."); } catch { note(k === "ca" ? c.mint : link, 8000); } return; }
    if (k === "mug") { try { const r = await (await import("/mugshot.js")).shareMugshot(c, CFG); if (r === "downloaded") note("Mugshot saved."); } catch { note("Couldn't make the mugshot."); } return; }
    if (k !== "save") return;
    const S = await sol(); if (!S || !S.key) return note("No Solana wallet found — open this page in Phantom or Solflare.");
    const f = { twitter: val("twitter").replace(/^http:\/\//i, "https://"), telegram: val("telegram").replace(/^http:\/\//i, "https://"), website: val("website").replace(/^http:\/\//i, "https://"), note: val("note").slice(0, 140) };
    for (const x of ["twitter", "telegram", "website"]) if (f[x] && !/^https:\/\//i.test(f[x])) f[x] = "https://" + f[x];
    b.disabled = true;
    try {
      const issued = new Date().toISOString(), posterSha = poster ? await sha256hex(poster) : "";
      const sig = await S.signMessage(new TextEncoder().encode(pageMessage({ ...f, wallet: S.key, mint: c.mint, issued, posterSha })));
      const r = await post({ action: "coin-page", ...f, wallet: S.key, mint: c.mint, issued, poster: poster || undefined, sig: b58(sig) });
      if (r.ok) { note(t("ceDone", "Saved — your coin page is updated (the city's listing refreshes within a minute).")); Object.assign(c, f, { poster: r.j.page.poster, byCreator: true }); onSaved && onSaved(); close(); }
      else { note((r.j && r.j.error) || "Couldn't save.", 4000); b.disabled = false; }
    } catch (x) { note(/reject|denied|cancel/i.test(String(x && x.message)) ? "Cancelled in your wallet." : String((x && x.message) || x).slice(0, 120), 4000); b.disabled = false; }
  };
}
