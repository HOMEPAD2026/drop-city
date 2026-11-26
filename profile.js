// profile.js — a wallet's page (/w/<wallet>, the owner 2026-11-26: "응 다 진행하자"): its coins, trader cashback and rank,
// LP rewards, GTAFUN cards, badges, and — on the visitor's own profile — the slot title kept on this device. Read from
// ?profile=<wallet> (lib/_profile.mjs). Sharing copies the link or posts it.
import { esc, short, usd, note, getJ, pic, sol } from "/common.js";
import { t } from "/i18n.js";
import { titleOf } from "/slot-data.js";

const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : x >= 1 ? x.toFixed(0) : x > 0 ? x.toFixed(2) : "0");
// [id, icon, name, how it's earned]
export const BADGES = [
  ["launch1", "🚀", ["bgLaunch1", "First launch"], ["bgLaunch1P", "Launched a coin on GTAFUN"]],
  ["launch5", "🏙️", ["bgLaunch5", "Developer"], ["bgLaunch5P", "Five coins launched"]],
  ["made", "🎓", ["bgMade", "Made it"], ["bgMadeP", "A coin graduated off its curve"]],
  ["cash", "💸", ["bgCash", "Cashback"], ["bgCashP", "Earned trader cashback"]],
  ["top10", "👑", ["bgTop10", "Top 10"], ["bgTop10P", "In the cashback top 10"]],
  ["invite1", "🤝", ["bgInvite1", "Recruiter"], ["bgInvite1P", "Brought a trader in"]],
  ["invite5", "📣", ["bgInvite5", "Crew boss"], ["bgInvite5P", "Five traders invited"]],
  ["lp", "💧", ["bgLp", "Liquidity"], ["bgLpP", "Earned LP rewards"]],
  ["card1", "🃏", ["bgCard1", "Collector"], ["bgCard1P", "Holds a GTAFUN card"]],
  ["set", "⭐", ["bgSet", "Full set"], ["bgSetP", "All ten cards"]],
];

export async function paintProfile(box, wallet, CFG) {
  if (!box) return;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(wallet || ""))) { box.innerHTML = `<div class="empty err"><p>${esc(t("pfBad", "That isn't a Solana wallet address."))}</p></div>`; return; }
  let p = null; try { p = await getJ("?profile=" + encodeURIComponent(wallet)); } catch {}
  if (!p || p.error) { box.innerHTML = `<div class="empty err"><p>${esc(t("pfErr", "This profile couldn't be read right now."))}</p><button type="button" class="btn hot" data-retry>${esc(t("retry", "Try again"))}</button></div>`; box.querySelector("[data-retry]").onclick = () => paintProfile(box, wallet, CFG); return; }
  const me = await sol().then((x) => x && x.key).catch(() => null), own = me === wallet;
  let slot = null; if (own) try { slot = JSON.parse(localStorage.getItem("dc.slot") || "null"); } catch {}
  const S = "$" + (p.main || CFG.ticker || "MAIN"), got = new Set(p.badges || []);
  const link = `${location.origin}/w/${wallet}`;
  box.innerHTML = `<div class="pf">
    <div class="pf-head"><div class="pf-av" aria-hidden="true">${esc(wallet.slice(0, 2))}</div><div class="pf-id"><span class="pf-k">${esc(own ? t("pfMine", "YOUR PROFILE") : t("pfK", "PROFILE"))}</span><h3>${esc(short(wallet))}</h3>
      <p class="pf-sub">${slot && slot.streak ? `🔥 ${esc(t(titleOf(slot.streak)[1], titleOf(slot.streak)[2]))} · ` : ""}${got.size} / ${BADGES.length} ${esc(t("pfBadges", "badges"))}</p></div>
      <div class="pf-acts"><button type="button" class="btn ghost" data-pf="copy">${esc(t("kitLink", "Copy link"))}</button><a class="btn hot" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(own ? "My GTAFUN profile 🏙️\n" : "A GTAFUN profile 🏙️\n")}&url=${encodeURIComponent(link)}">${esc(t("kitX", "Post on X"))}</a><a class="btn ghost" target="_blank" rel="noopener" href="https://solscan.io/account/${esc(wallet)}">Solscan ↗</a></div></div>
    <div class="pf-stats"><div><b>${p.coins.length}</b><small>${esc(t("pfCoins", "coins launched"))}</small></div><div><b>${usd(p.mcapUsd)}</b><small>${esc(t("pfMcap", "their market cap"))}</small></div><div><b>${fmt(p.cashback.earned)}</b><small>${esc(S)} ${esc(t("pfCash", "cashback"))}${p.cashback.rank ? ` · #${p.cashback.rank}` : ""}</small></div><div><b>${fmt(p.lp.earned)}</b><small>${esc(S)} ${esc(t("pfLp", "LP rewards"))}</small></div><div><b>${p.cards.kinds} / ${p.cards.of || 10}</b><small>${esc(t("pfCards", "cards collected"))}</small></div><div><b>${p.cashback.invited}</b><small>${esc(t("pfInvited", "traders invited"))}</small></div></div>
    <h4>${esc(t("pfBadgesH", "Badges"))}</h4>
    <div class="pf-badges">${BADGES.map(([id, ic, n, how], i) => `<div class="pf-b${got.has(id) ? " on" : ""}" style="--i:${i}" title="${esc(t(how[0], how[1]))}"><span>${ic}</span><b>${esc(t(n[0], n[1]))}</b><small>${esc(t(how[0], how[1]))}</small></div>`).join("")}</div>
    <h4>${esc(t("pfCoinsH", "Coins launched"))}</h4>
    ${p.coins.length ? `<div class="pf-coins">${p.coins.slice(0, 24).map((c) => `<a class="pf-c" href="/coin/${esc(c.mint)}">${pic(c)}<span><b>$${esc(c.symbol)}</b><small>${esc(c.name || "")}</small></span><em>${usd(c.mcapUsd)}${c.graduated ? " · 🎓" : ""}</em></a>`).join("")}</div>` : `<p class="fine">${esc(t("pfNoCoins", "No coins launched from this wallet yet."))}</p>`}
    ${p.cards.total ? `<h4>${esc(t("pfCardsH", "Cards"))}</h4><div class="pf-cards">${Object.entries(p.cards.mine).map(([id, n]) => `<div class="pf-card"><img src="/nft/img/${esc(id)}-360.webp" alt="" loading="lazy">${n > 1 ? `<i>×${n}</i>` : ""}</div>`).join("")}</div>` : ""}
  </div>`;
  box.querySelector('[data-pf="copy"]').onclick = async () => { try { await navigator.clipboard.writeText(link); note(t("cbCopied", "Link copied.")); } catch { note(link, 6000); } };
}
