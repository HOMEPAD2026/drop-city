// wallet.js — the wallet window: the wallets this browser has (Phantom, Solflare, Backpack, Wallet Standard ones),
// phones without one open the page inside a wallet's browser, and once connected: the address, balance, copy, explorer,
// disconnect. openWallet() resolves when the window closes; walletButton(el) keeps a button in step.
import { esc, short, note, sol, kit, conn } from "/common.js";

const COLORS = { phantom: "#ab9ff2", solflare: "#fc7d22", backpack: "#e33e3f", metamask: "#f6851b" };
const badge = (w) => (w.icon ? `<img src="${esc(w.icon)}" alt="">` : `<span style="background:${COLORS[w.name.toLowerCase()] || "#22e6ff"}">${esc(w.name[0])}</span>`);
const GET = [["Phantom", "https://phantom.app/download"], ["Solflare", "https://solflare.com/download"], ["Backpack", "https://backpack.app/downloads"]];

function shell(html) {
  let el = document.getElementById("wmodal");
  if (!el) { el = document.createElement("div"); el.id = "wmodal"; el.className = "wmodal"; document.body.appendChild(el); }
  el.innerHTML = `<div class="wm-card" role="dialog" aria-modal="true" aria-label="Wallet"><button type="button" class="wm-x" aria-label="Close">×</button>${html}</div>`;
  el.hidden = false; requestAnimationFrame(() => el.classList.add("in"));
  return el;
}
export async function openWallet() {
  const S = await sol();
  return new Promise((done) => {
    const close = () => { const el = document.getElementById("wmodal"); if (!el) return; el.classList.remove("in"); setTimeout(() => { el.hidden = true; }, 180); document.removeEventListener("keydown", esc_); done(S && S.key); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc_);
    const paint = async () => {
      if (!S) { const el = shell(`<h3>Connect a wallet</h3><p class="wm-sub">No Solana wallet in this browser.</p>${GET.map(([n, u]) => `<a class="wm-row" href="${u}" target="_blank" rel="noopener">${badge({ name: n })}<b>Get ${n}</b><i>↗</i></a>`).join("")}`); wire(el); return; }
      if (S.key) {
        const el = shell(`<h3>Your wallet</h3><div class="wm-acct">${badge({ name: S.name || "Wallet" })}<div><b>${esc(short(S.key))}</b><small>${esc(S.name || "")} · <span data-bal>…</span></small></div></div>
          <div class="wm-acts"><button type="button" data-a="copy">Copy address</button><a href="https://solscan.io/account/${esc(S.key)}" target="_blank" rel="noopener">Solscan ↗</a><button type="button" data-a="off" class="danger">Disconnect</button></div>`);
        wire(el);
        try { const K = await kit(), c = await conn(); const b = await c.getBalance(new K.PublicKey(S.key)); const s = el.querySelector("[data-bal]"); if (s) s.textContent = (b / 1e9).toFixed(3) + " SOL"; } catch {}
        return;
      }
      const list = S.providers();
      const el = shell(`<h3>Connect a wallet</h3><p class="wm-sub">Solana · you sign every launch yourself. Nothing is held for you.</p>
        ${list.length ? `<div class="wm-list">${list.map((w, i) => `<button type="button" class="wm-row" data-i="${i}">${badge(w)}<b>${esc(w.name)}</b><i>Detected</i></button>`).join("")}</div>` : ""}
        ${!list.length && S.mobile() ? `<p class="wm-sub">Open this page inside your wallet app:</p>${["Phantom", "Solflare"].map((n) => `<a class="wm-row" href="${esc(S.openIn(n))}">${badge({ name: n })}<b>Open in ${n}</b><i>↗</i></a>`).join("")}` : ""}
        ${!list.length && !S.mobile() ? GET.map(([n, u]) => `<a class="wm-row" href="${u}" target="_blank" rel="noopener">${badge({ name: n })}<b>Get ${n}</b><i>↗</i></a>`).join("") : ""}
        <p class="wm-fine">By connecting you agree that meme coins are risky and you act for yourself.</p>`);
      wire(el);
    };
    const wire = (el) => {
      el.onclick = async (e) => {
        if (e.target === el || e.target.closest(".wm-x")) return close();
        const r = e.target.closest("[data-i]");
        if (r) { r.classList.add("busy"); r.querySelector("i").textContent = "Connecting…"; try { await S.connect(Number(r.dataset.i)); note("Wallet connected"); close(); } catch (x) { r.classList.remove("busy"); r.querySelector("i").textContent = "Try again"; note(String((x && x.message) || x).slice(0, 120)); } return; }
        const a = e.target.closest("[data-a]");
        if (a && a.dataset.a === "copy") { try { await navigator.clipboard.writeText(S.key); note("Address copied"); } catch {} }
        if (a && a.dataset.a === "off") { await S.disconnect(); close(); }
      };
    };
    paint();
  });
}
/// keep a button showing the wallet's state; a click opens the window
export async function walletButton(btn, onChange) {
  const paint = async () => { const S = await sol(); const on = !!(S && S.key); btn.innerHTML = on ? `<span class="wdot"></span>${esc(short(S.key))}` : "Connect wallet"; btn.classList.toggle("on", on); onChange && onChange(on ? S.key : ""); };
  btn.onclick = async () => { await openWallet(); paint(); };
  document.addEventListener("arc:solwallet", paint);
  sol().then((S) => S && S.quiet && S.quiet()).finally(paint);
  return paint;
}
