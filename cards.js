// cards.js — the CARDS tab (GTAFUN CARDS, Season 1): a pack of 3 NFT cards for 0.1 SOL from the Core Candy Machine
// (random on chain), the opening (three cards face down, flipped one by one, the rarer the brighter), the 18-card
// gallery with what you own, the latest pulls, the odds; and the operations wallet's one-time setup of the machine.
// Transactions are built by vendor/cards-kit.js, signed in the visitor's wallet (one approval for the lot) and sent
// through the page's own connection; the server records each pack after reading it back from the chain.
import { esc, short, sleep, note, DEMO, sol, conn, getJ, kit } from "/common.js";
import { openWallet } from "/wallet.js";
import { t, tf } from "/i18n.js";
import { SEASON, CARDS, RARITY, CARD_LAMPORTS, odds, cardById } from "/cards-data.js";

const API = "/api/pad";
const EP = () => new URL(API + "?solrpc=1", location.origin).href;
let kitP = null;
const cardsKit = () => (kitP = kitP || new Promise((ok, no) => { if (window.CardsKit) return ok(window.CardsKit); const s = document.createElement("script"); s.src = "/vendor/cards-kit.js?v=1"; s.onload = () => ok(window.CardsKit); s.onerror = () => { kitP = null; no(new Error("the cards kit didn't load")); }; document.head.appendChild(s); }));
const img = (c, big) => `/nft/img/${c.id}${big ? ".png" : "-360.webp"}`;
const post = (b) => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }));
async function sendAll(cn, signed, onEach) {
  const out = [];
  for (let i = 0; i < signed.length; i++) {
    try {
      const sig = await cn.sendRawTransaction(signed[i].serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
      let st = null; for (let k = 0; k < 30; k++) { await sleep(1200); st = await cn.getSignatureStatuses([sig]).then((r) => r && r.value && r.value[0]).catch(() => null); if (st && (st.err || st.confirmationStatus)) break; }
      out.push(st && !st.err && st.confirmationStatus ? { sig } : { sig, err: (st && st.err) || "not confirmed" });
    } catch (e) { out.push({ err: String((e && e.message) || e).slice(0, 160) }); }
    onEach && onEach(i + 1, signed.length);
  }
  return out;
}

export async function paintCards(box, { CFG }) {
  if (!box) return;
  const W = await sol().catch(() => null);
  let V = null; try { V = await getJ(`?cards=1${W && W.key ? "&w=" + W.key : ""}`); } catch {}
  if (!V || V.season == null) { box.innerHTML = `<div class="empty err"><p>${esc(t("cdErr", "The cards couldn't be read right now — try again in a moment."))}</p><button type="button" class="btn hot" data-retry>${esc(t("retry", "Try again"))}</button></div>`; box.querySelector("[data-retry]").onclick = () => paintCards(box, { CFG }); return; }
  const own = {}; for (const m of V.mine || []) own[m.card] = (own[m.card] || 0) + 1;
  const left = V.available != null ? Math.floor((V.available - V.redeemed) / SEASON.pack) : null, od = odds();
  box.innerHTML = `
    <div class="cd-hero">
      <div class="cd-pack" aria-hidden="true"><div class="cd-fan"><img class="f1" src="/nft/img/pepe-360.webp" alt=""><img class="f3" src="/nft/img/pengu-360.webp" alt=""><img class="f2" src="/nft/img/doge-360.webp" alt=""><span class="cd-fl"><img src="/images/logo-96.webp" alt="">SEASON 1 · ${SEASON.pack} ${esc(t("cdCardsWord", "CARDS"))}</span></div></div>
      <div class="cd-buy">
        <h3>${esc(t("cdPackH", "Open a pack"))}</h3>
        <p>${esc(tf("cdPackP", "{n} random cards from the 10 top meme characters — real NFTs in your wallet, picked on chain.", { n: SEASON.pack }))}</p>
        <div class="cd-price"><b>${SEASON.packSol} SOL</b><span>${left != null ? esc(tf("cdLeft", "{n} packs left", { n: left.toLocaleString("en-US") })) : esc(t("cdSoon", "On sale soon"))}</span></div>
        <button type="button" class="btn hot big" data-cd="open" ${V.ready || DEMO ? "" : "disabled"}>${esc(V.ready || DEMO ? t("cdOpen", "Open a pack") : t("cdSoon", "On sale soon"))}</button>
        <div class="cd-odds">${Object.entries(RARITY).map(([k, r]) => `<span style="--r:${r.color}"><i></i>${esc(t("rar_" + k, r.label))} ${(od[k] * 100).toFixed(od[k] < 0.02 ? 1 : 0)}%</span>`).join("")}</div>
      </div>
    </div>
    <h4 class="cd-h">${esc(t("cdSet", "The set"))} <small>${Object.keys(own).length} / ${CARDS.length}</small>${Object.keys(own).length >= CARDS.length ? `<span class="cd-done">★ ${esc(t("cdComplete", "SET COMPLETE"))}</span>` : Object.keys(own).length ? `<span class="cd-prog"><i style="width:${Math.round((Object.keys(own).length / CARDS.length) * 100)}%"></i></span>` : ""}</h4>
    <div class="cd-grid">${CARDS.map((c) => `<button type="button" class="cd-c${own[c.id] ? " own" : ""}" data-card="${c.id}" style="--r:${RARITY[c.rarity].color}"><img src="${img(c)}" alt="${esc(c.name)}" loading="lazy">${own[c.id] ? `<i>×${own[c.id]}</i>` : ""}</button>`).join("")}</div>
    ${V.board && V.board.pulls && V.board.pulls.length ? `<h4 class="cd-h">${esc(t("cdPulls", "Latest pulls"))}</h4><div class="cd-pulls">${V.board.pulls.slice(0, 12).map((p) => { const c = cardById(p.card); return c ? `<span style="--r:${RARITY[c.rarity].color}"><img src="${img(c)}" alt=""><b>${esc(c.name)}</b><small>${esc(short(p.owner))}</small></span>` : ""; }).join("")}</div>` : ""}
    ${!W || !W.key ? `<p class="cd-note">${esc(t("cdConn", "Connect your wallet to see your cards."))}</p>` : ""}
    <div class="cd-admin" hidden></div>`;
  box.querySelector('[data-cd="open"]').onclick = () => openPack(V, () => paintCards(box, { CFG }));
  box.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => zoom(cardById(b.dataset.card), own[b.dataset.card] || 0)));
  if (V.wallet && W && W.key === V.wallet) adminDesk(box.querySelector(".cd-admin"), V, () => paintCards(box, { CFG }));
}

function zoom(c, n) {
  const el = document.createElement("div"); el.className = "cd-zoom";
  el.innerHTML = `<div class="cd-zi" style="--r:${RARITY[c.rarity].color}"><div class="cd-flip"><div class="cd-fr"><img src="${img(c, true)}" alt="${esc(c.name)}"></div><div class="cd-bk"><img src="/images/logo-192.webp" alt=""><b>#${c.no} ${esc(c.name)}</b><span class="cd-bk-r">${esc(t("rar_" + c.rarity, RARITY[c.rarity].label))}</span><small>${esc(tf("cdExist2", "{n} in Season 1", { n: RARITY[c.rarity].each.toLocaleString("en-US") }))}</small><p>${esc(c.line || "")}</p></div></div><p><b>${esc(c.name)}</b> · ${esc(t("rar_" + c.rarity, RARITY[c.rarity].label))}${n ? ` · ${esc(t("cdOwned", "you own"))} ${n}` : ""}</p><small class="cd-hint">${esc(t("cdFlipHint", "Tap the card to flip it"))}</small></div>`;
  el.onclick = (e) => { const f = e.target.closest(".cd-flip"); if (f) { f.classList.toggle("back"); return; } el.remove(); }; document.body.appendChild(el);
}

/// the opening: three face-down cards; each flips on a tap (or by itself), the rarer the brighter
function reveal(cards, again) {
  const el = document.createElement("div"); el.className = "cd-rev";
  el.innerHTML = `<div class="cd-rt">${esc(t("cdTap", "Tap a card to flip it"))}</div><div class="cd-row">${cards.map((c, i) => `<div class="cd-f" data-i="${i}" data-rar="${esc(t("rar_" + c.rarity, RARITY[c.rarity].label))}" style="--r:${RARITY[c.rarity].color};--d:${i * 120}ms"><div class="cd-in"><div class="cd-back"><img src="/images/logo-192.webp" alt=""><b>GTAFUN</b></div><div class="cd-front ${c.rarity}"><img src="${img(c, true)}" alt="${esc(c.name)}"></div></div></div>`).join("")}</div>
    <div class="cd-ra" hidden><button type="button" class="btn ghost" data-r="done">${esc(t("cdDone", "Done"))}</button><button type="button" class="btn hot" data-r="again">${esc(t("cdAgain", "Open another"))}</button></div>`;
  document.body.appendChild(el);
  const flip = (f) => { if (f.classList.contains("up")) return; f.classList.add("up"); const c = cards[Number(f.dataset.i)]; if (c.rarity !== "common") f.classList.add("glow"); if (c.rarity === "legendary") { el.classList.add("legend"); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); import("/site-x.js").then((m) => m.confetti && m.confetti()).catch(() => {}); if (navigator.vibrate) try { navigator.vibrate([20, 40, 60]); } catch {} } else if (c.rarity === "epic" && navigator.vibrate) try { navigator.vibrate(18); } catch {}
    if (el.querySelectorAll(".cd-f.up").length === cards.length) { el.querySelector(".cd-ra").hidden = false; el.querySelector(".cd-rt").textContent = t("cdGot", "Added to your wallet"); } };
  el.querySelectorAll(".cd-f").forEach((f) => (f.onclick = () => flip(f)));
  setTimeout(() => el.querySelectorAll(".cd-f").forEach((f, i) => setTimeout(() => flip(f), 1400 + i * 900)), 0);
  el.querySelector('[data-r="done"]').onclick = () => el.remove();
  el.querySelector('[data-r="again"]').onclick = () => { el.remove(); again(); };
}

async function openPack(V, done) {
  if (DEMO) return reveal(["pepe", "wif", "bonk"].map(cardById), () => openPack(V, done));
  const W = await sol(); if (!W) return note(t("noWallet", "No Solana wallet found — open this page in Phantom or Solflare."));
  if (!W.key) { await openWallet(); if (!W.key) return; }
  const btn = document.querySelector('[data-cd="open"]'), label = btn ? btn.textContent : "";
  const set = (s) => { if (btn) btn.textContent = s; };
  if (btn) btn.disabled = true;
  let mo = null;
  try {
    const cn = await conn(), K = await cardsKit();
    const PK = (await kit()).PublicKey, bal = await cn.getBalance(new PK(W.key)).catch(() => null);
    if (bal != null && bal < CARD_LAMPORTS * SEASON.pack + 0.02e9) throw new Error(tf("cdNoSol", "Not enough SOL — a pack is {p} SOL plus about 0.02 SOL of network fees.", { p: SEASON.packSol }));
    set(t("cdPreparing", "Preparing…"));
    const { txs, assets } = await K.packTxs({ endpoint: EP(), wallet: W.key, candyMachine: V.cm, collection: V.collection, destination: V.wallet, n: SEASON.pack });
    set(t("cdSign", "Approve in your wallet…"));
    const signed = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions(txs) : await Promise.all(txs.map((x) => W.p.signTransaction(x)));
    mo = mintOverlay(signed.length);
    const res = await sendAll(cn, signed, (i, n) => { set(`${t("cdMinting", "Minting…")} ${i}/${n}`); mo.step(i, n); });
    mo.close(); mo = null;
    const got = [];
    for (let i = 0; i < res.length; i++) {
      if (!res[i].sig || res[i].err) continue;
      for (let k = 0; k < 5; k++) { const r = await post({ action: "cards-minted", sig: res[i].sig, assets: [assets[i]] }); if (r.ok && r.j.cards) { for (const c of r.j.cards) got.push(cardById(c.card)); break; } await sleep(2000); }
    }
    const failed = res.filter((r) => !r.sig || r.err).length;
    if (got.length) reveal(got.filter(Boolean), () => openPack(V, done));
    if (failed) note(tf("cdPartial", "{n} of the cards didn't go through — you weren't charged for those.", { n: failed }), 6000);
    if (!got.length && !failed) note(t("cdLater", "Your cards are minted — they'll show here in a moment."), 5000);
    done && setTimeout(done, 1500);
  } catch (e) { if (mo) mo.close(); const s = String((e && e.message) || e); note(/reject|denied|cancel/i.test(s) ? t("cancelled", "Cancelled in your wallet.") : s.slice(0, 180), 6000); }
  if (btn) { btn.disabled = false; btn.textContent = label; }
}
/// while a pack mints (15–40 s on chain): a sealed pack that breathes, shakes as each card lands, and a dot a card
function mintOverlay(n) {
  const el = document.createElement("div"); el.className = "cd-mint"; el.setAttribute("role", "status");
  el.innerHTML = `<div class="cm-pack"><img src="/images/logo-192.webp" alt=""><b>GTAFUN CARDS</b><small>${esc(t("cdPackOf", "3 cards inside"))}</small></div><p>${esc(t("cdMintingP", "Minting your cards on chain…"))}</p><div class="cm-dots">${Array.from({ length: n }, () => "<i></i>").join("")}</div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("in"));
  let last = 0;
  return {
    step(i) { const d = el.querySelectorAll(".cm-dots i"); for (let k = 0; k < d.length; k++) d[k].classList.toggle("on", k < i); if (i > last) { last = i; const p = el.querySelector(".cm-pack"); p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake"); } },
    close() { el.classList.remove("in"); setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 220); },
  };
}

/// the operations wallet's one-time setup: the collection + the machine (2 approvals' worth in one), then the items
async function adminDesk(el, V, again) {
  el.hidden = false;
  let st = null; if (V.cm) try { st = await (await cardsKit()).machineState({ endpoint: EP(), candyMachine: V.cm }); } catch {}
  const loaded = st ? st.itemsLoaded : 0, need = SEASON.supply;
  el.innerHTML = `<h4>${esc(t("cdAdmin", "Operations wallet"))}</h4>
    ${!V.cm ? `<p>${esc(tf("cdSetupP", "Create the collection and the machine: {n} cards, {p} SOL a pack, the SOL to this wallet, 5 % royalties. Then load the items (about {k} approvals in one).", { n: need, p: SEASON.packSol, k: Math.ceil(need / 110) }))}</p><button type="button" class="btn hot" data-a="setup">${esc(t("cdSetup", "Set up the machine"))}</button>`
      : `<p>${esc(t("cdMachine", "Machine"))} <code>${esc(short(V.cm))}</code> · ${esc(t("cdItems", "items"))} ${loaded} / ${need}${st ? ` · ${esc(t("cdSold", "sold"))} ${st.itemsRedeemed}` : ""}</p>${st && loaded < need ? `<button type="button" class="btn hot" data-a="load">${esc(t("cdLoad", "Load the remaining items"))}</button>` : ""}`}
    <p class="cd-st" data-a="st"></p>`;
  const say = (s) => (el.querySelector('[data-a="st"]').textContent = s);
  const load = async (cm, from) => {
    const W = await sol(), K = await cardsKit(), cn = await conn();
    const txs = await K.linesTxs({ endpoint: EP(), wallet: W.key, candyMachine: cm, from, count: need - from });
    say(t("cdSign", "Approve in your wallet…"));
    const signed = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions(txs) : await Promise.all(txs.map((x) => W.p.signTransaction(x)));
    const r = await sendAll(cn, signed, (i, n) => say(`${t("cdLoading", "Loading items")} ${i}/${n}`));
    if (r.some((x) => x.err)) throw new Error(t("cdLoadErr", "Some item batches didn't go through — press Load again."));
  };
  const sb = el.querySelector('[data-a="setup"]');
  if (sb) sb.onclick = async () => {
    sb.disabled = true;
    try {
      const W = await sol(), K = await cardsKit(), cn = await conn();
      say(t("cdPreparing", "Preparing…"));
      const s = await K.setupTxs({ endpoint: EP(), wallet: W.key, name: SEASON.name, uri: `${SEASON.site}/nft/collection.json`, royaltyBps: SEASON.royaltyBps, supply: need,
        prefixName: "GTAFUN Card #$ID+1$", prefixUri: `${SEASON.site}/nft/m/$ID$.json`, lamports: CARD_LAMPORTS, destination: W.key });
      say(t("cdSign", "Approve in your wallet…"));
      const signed = typeof W.p.signAllTransactions === "function" ? await W.p.signAllTransactions(s.txs) : await Promise.all(s.txs.map((x) => W.p.signTransaction(x)));
      const r = await sendAll(cn, signed, (i, n) => say(`${t("cdCreating", "Creating")} ${i}/${n}`));
      if (r.some((x) => x.err)) throw new Error(t("cdSetupErr", "The setup didn't go through — nothing was created; try again."));
      for (let k = 0; k < 6; k++) { const p = await post({ action: "cards-setup", cm: s.candyMachine }); if (p.ok) break; await sleep(2500); }
      await load(s.candyMachine, 0);
      note(t("cdReady", "The machine is ready — packs are on sale."), 5000); again();
    } catch (e) { say(String((e && e.message) || e).slice(0, 200)); sb.disabled = false; }
  };
  const lb = el.querySelector('[data-a="load"]');
  if (lb) lb.onclick = async () => { lb.disabled = true; try { await load(V.cm, loaded); note(t("cdReady", "The machine is ready — packs are on sale."), 5000); again(); } catch (e) { say(String((e && e.message) || e).slice(0, 200)); lb.disabled = false; } };
}
