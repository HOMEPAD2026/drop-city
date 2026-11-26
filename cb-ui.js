// cb-ui.js — the trader cashback dashboard under the LP pools (the owner, 2026-11-26: "응 다 진행하자"): my cashback
// (earned, today, my rank, what's waiting to be paid), the leaderboard (all time + today), and invites — my link, who
// I've brought in and the bonus it earned, and linking the wallet that invited me (one free signature; the inviter then
// earns refBps of my cashback on top, never out of mine).
import { esc, short, note, sol, post, b58, DEMO } from "/common.js";
import { openWallet } from "/wallet.js";
import { t } from "/i18n.js";

const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : x >= 1 ? x.toFixed(0) : x > 0 ? x.toFixed(2) : "0");
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/// a ?ref=<wallet> in the address is kept on this device until it's linked (site.js calls this on load)
export function keepRef() { try { const r = new URLSearchParams(location.search).get("ref"); if (r && B58.test(r) && !localStorage.getItem("dc.refDone")) localStorage.setItem("dc.ref", r); } catch {} }
const refMessage = (wallet, ref, issued) => `GTAFUN referral\nWallet: ${wallet}\nInvited by: ${ref}\nIssued: ${issued}`;

/// link the inviter kept on this device to the connected wallet: one signed message (nothing on chain); true when done
export async function linkInviter(S, inv) {
  try {
    const issued = new Date().toISOString(), sig = await S.signMessage(new TextEncoder().encode(refMessage(S.key, inv, issued)));
    const r = await post({ action: "cb-ref", wallet: S.key, ref: inv, issued, sig: b58(sig) });
    if (r.ok || r.status === 409) { try { localStorage.setItem("dc.refDone", "1"); localStorage.removeItem("dc.ref"); } catch {} note(r.ok ? t("cbInvDone", "Linked — your inviter now earns a bonus on your cashback.") : (r.j && r.j.error) || "Already linked."); return true; }
    note((r.j && r.j.error) || "Couldn't link it.", 4000); return false;
  } catch (e) { note(/reject|denied|cancel/i.test(String(e && e.message)) ? t("cbCancel", "Cancelled in your wallet.") : String((e && e.message) || e).slice(0, 120), 4000); return false; }
}
export function dashHtml(CB, V, mainSym, me, tg = "") {
  if (!CB || !CB.on) return "";
  const S = "$" + mainSym, m = CB.me, pend = V && V.me ? V.me.pending : null, pct = (CB.refBps || 0) / 100;
  let inv = ""; try { inv = localStorage.getItem("dc.ref") || ""; } catch {}
  const link = me ? `${location.origin}/?ref=${me}` : "";
  const row = (x, i) => `<li class="${x.w === me ? "me" : ""}"><span class="n">${i + 1}</span><span class="w">${esc(short(x.w))}${x.w === me ? ` <em>${esc(t("cbYou", "you"))}</em>` : ""}</span><b>${fmt(x.amt)}</b></li>`;
  return `<div class="cbd">
    <div class="cbd-me">${m ? `<div><b>${fmt(m.earned)}</b><small>${esc(t("cbMeAll", "my cashback"))} · ${esc(S)}</small></div><div><b>${fmt(m.today)}</b><small>${esc(t("cbMeToday", "today"))}</small></div><div><b>${m.rank ? "#" + m.rank : "–"}</b><small>${esc(fill(t("cbRankOf", "rank of {n}"), { n: CB.earners || 0 }))}</small></div><div class="hi"><b>${pend != null ? fmt(pend) : "–"}</b><small>${esc(t("cbPending", "waiting to be paid (LP + cashback)"))}</small></div>`
      : `<p>${esc(t("cbConnect", "Connect your wallet to see your cashback, your rank and your invite link."))}</p><button type="button" class="btn ghost" data-cbd="conn">${esc(t("connect", "Connect wallet"))}</button>`}</div>
    <div class="cbd-grid">
      <div class="cbd-board"><h4>${esc(t("cbTop", "Top cashback earners"))}</h4>${CB.top && CB.top.length ? `<ol>${CB.top.map(row).join("")}</ol>` : `<p class="fine">${esc(t("cbTopNone", "No cashback earned yet — the first trades take the top spots."))}</p>`}
        ${CB.topToday && CB.topToday.length ? `<p class="cbd-today">${esc(t("cbTopToday", "Today"))}: ${CB.topToday.map((x) => `<span>${esc(short(x.w))} <b>${fmt(x.amt)}</b></span>`).join("")}</p>` : ""}</div>
      <div class="cbd-inv"><h4>${esc(t("cbInvH", "Invite traders"))}</h4>
        <p>${esc(fill(t("cbInvP", "Share your link. Every trader who links you as their inviter earns you {p}% of their cashback on top — it never comes out of theirs."), { p: pct }))}</p>
        ${me ? `<div class="cbd-link"><code>${esc(link)}</code><button type="button" class="btn ghost" data-cbd="copy">${esc(t("copy", "Copy"))}</button><a class="btn ghost" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(fill(t("cbInvTw", "Trade on GTAFUN and get {p}% back on every trade, paid in {s}.\n"), { p: CB.bps / 100, s: S }))}&url=${encodeURIComponent(link)}">X ↗</a></div>
          ${me && tg ? `<p class="cbd-tg"><a href="${esc(tg)}?start=cb_${esc(me)}" target="_blank" rel="noopener">${esc(t("cbTg", "Get your cashback in Telegram — /cashback any time ›"))}</a></p>` : ""}<div class="cbd-kv"><span>${esc(t("cbInvited", "Traders you invited"))}</span><b>${m ? m.invited : 0}</b><span>${esc(t("cbBonus", "Invite bonus earned"))}</span><b>${m ? fmt(m.refEarned) : 0} ${esc(S)}</b></div>`
          : `<p class="fine">${esc(t("cbInvConn", "Connect your wallet to get your invite link."))}</p>`}
        ${m && m.ref ? `<p class="cbd-by">${esc(t("cbInvBy", "Invited by"))} ${esc(short(m.ref))} ✓</p>` : inv && me && inv !== me ? `<div class="cbd-claim"><p>${esc(fill(t("cbInvLink", "You came through {w}'s invite. Link it — one free signature, no transaction."), { w: short(inv) }))}</p><button type="button" class="btn hot" data-cbd="link">${esc(t("cbInvBtn", "Link my inviter"))}</button></div>` : ""}
      </div>
    </div></div>`;
}

export function wireDash(box, again) {
  box.querySelectorAll("[data-cbd]").forEach((b) => (b.onclick = async () => {
    const k = b.dataset.cbd;
    if (k === "conn") { await openWallet(); return again(); }
    if (k === "copy") { const c = box.querySelector(".cbd-link code"); try { await navigator.clipboard.writeText(c.textContent); note(t("cbCopied", "Link copied.")); } catch { note(c.textContent, 6000); } return; }
    if (k === "link") {
      if (DEMO) return note("Demo — nothing is signed.");
      const S = await sol(); if (!S || !S.key) { await openWallet(); return again(); }
      let inv = ""; try { inv = localStorage.getItem("dc.ref") || ""; } catch {}
      if (!B58.test(inv) || inv === S.key) return;
      b.disabled = true; if (await linkInviter(S, inv)) again(); else b.disabled = false;
    }
  }));
}
