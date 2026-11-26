// lib/_clean.mjs — CLEAN LAUNCH (round L, the owner 2026-11-26; pump.fun starts charging non-dev buys in a coin's first
// block on Dec 4): for each coin launched here, read its bonding curve's oldest transactions from the chain and look at
// the block the coin was made in. If every transaction in that block was signed by the creator (or their crew / the
// agent), the launch was clean — nobody bought in before the market could see it. Read once a coin, kept in
// clean.json: { mint: { v, clean, slot, snipers, n } }; a coin whose start is beyond PAGES pages stays unread (null).
export const CLEAN = { V: 1, PAGES: 4, PER_TICK: 4, TX_MAX: 12 };

export function makeClean({ rpc, store, list, now = () => Date.now() }) {
  async function check(c) {
    const curve = c.curve; if (!curve) return null;
    let before, all = [], end = false;
    for (let p = 0; p < CLEAN.PAGES; p++) {
      const page = await rpc("getSignaturesForAddress", [curve, { limit: 1000, ...(before ? { before } : {}), commitment: "confirmed" }]);
      if (!Array.isArray(page) || !page.length) { end = true; break; }
      all = all.concat(page); before = page[page.length - 1].signature;
      if (page.length < 1000) { end = true; break; }
    }
    if (!end || !all.length) return null; // older than we read: unknown
    const slot = Math.min(...all.map((s) => s.slot)), first = all.filter((s) => s.slot === slot && !s.err).slice(0, CLEAN.TX_MAX);
    const own = new Set([c.creator, ...((c.crew || []).map((m) => m.address)), c.agent].filter(Boolean));
    const snipers = [];
    for (const s of first) {
      const tx = await rpc("getTransaction", [s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed", encoding: "json" }]).catch(() => null);
      const keys = tx && tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys; if (!keys || !keys.length) return null; // can't tell: try again later
      const payer = typeof keys[0] === "string" ? keys[0] : keys[0].pubkey;
      if (!own.has(payer)) snipers.push(payer);
    }
    return { v: CLEAN.V, clean: snipers.length === 0, slot, snipers: [...new Set(snipers)].slice(0, 8), n: first.length, at: now() };
  }
  /// a few unread coins per run (the hourly housekeeping calls it)
  async function tick(n = CLEAN.PER_TICK) {
    const map = (await store.get("clean.json").catch(() => null)) || {};
    const L = await list().catch(() => ({ items: [] })), todo = (L.items || []).filter((c) => (c.kind === "user" || c.kind === "drop") && c.curve && !(map[c.mint] && map[c.mint].v === CLEAN.V));
    let done = 0, err = 0;
    for (const c of todo.slice(0, n)) { try { const r = await check(c); if (r) { map[c.mint] = r; done++; } } catch { err++; } }
    if (done) await store.put("clean.json", map, {}).catch(() => {});
    return { read: done, left: Math.max(0, todo.length - done), err };
  }
  return { check, tick };
}
