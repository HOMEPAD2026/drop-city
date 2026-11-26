// lib/_bag.mjs — "My bag" (round K, the owner 2026-11-26): which of the city's coins a wallet holds and what they're worth.
// One getTokenAccountsByOwner per token program (classic + Token-2022), parsed, matched against the city's list; a minute
// per wallet in the warm function. Read-only: nothing is stored.
const PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PE9ZwRaSHymNmGv"];
export const BAG = { TTL: 60e3, KEEP: 400, MAX: 30 };

export function makeBag({ rpc, list, now = () => Date.now() }) {
  const memo = new Map();
  async function view(wallet) {
    const w = String(wallet || "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) return { status: 400, body: { error: "that isn't a Solana wallet" } };
    const m = memo.get(w); if (m && now() - m.at < BAG.TTL) return { status: 200, body: m.body };
    const L = await list().catch(() => ({ items: [] })), by = new Map((L.items || []).map((c) => [c.mint, c]));
    const held = new Map();
    for (const prog of PROGRAMS) {
      const r = await rpc("getTokenAccountsByOwner", [w, { programId: prog }, { encoding: "jsonParsed", commitment: "confirmed" }]).catch(() => null);
      for (const a of (r && r.value) || []) {
        const info = a && a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info; if (!info || !by.has(info.mint)) continue;
        const ui = Number(info.tokenAmount && (info.tokenAmount.uiAmountString ?? info.tokenAmount.uiAmount)) || 0; if (ui <= 0) continue;
        held.set(info.mint, (held.get(info.mint) || 0) + ui);
      }
    }
    const items = [...held].map(([mint, amt]) => { const c = by.get(mint); return { mint, symbol: c.symbol, amt, usd: c.priceUsd ? amt * c.priceUsd : null }; })
      .sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, BAG.MAX);
    const body = { wallet: w, items, usd: items.reduce((s, x) => s + (x.usd || 0), 0), at: now() };
    memo.set(w, { at: now(), body }); if (memo.size > BAG.KEEP) memo.delete(memo.keys().next().value);
    return { status: 200, body };
  }
  return { view };
}
