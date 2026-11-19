// street-perks.js — holding the city's main coin dresses you up in the streets (cosmetic only, nothing is paid): CREW
// (any amount) gets a pink name tag, MADE (1M) and BOSS (10M) a gold one, a gilded outfit and a gold car when they steal one.
// The connected wallet's balance is read by the server (?holder=), again every two minutes; others see your tier.
import { getJ, sol } from "/common.js";
export function streetPerks(R) {
  let last = "", tiers = null;
  async function check() {
    let key = ""; try { const S = await sol(); key = (S && S.key) || ""; } catch { /* */ }
    if (!key) { if (last) { last = ""; R.setPerk(""); } return null; }
    try { const j = await getJ("?holder=" + encodeURIComponent(key)); if (j && !j.error) { tiers = j.tiers || tiers; if ((j.perk || "") !== last) { const was = last; last = j.perk || ""; await R.setPerk(last); if (last && was !== last && R.active) R.api.bigText(`${j.name} PERKS`, "#ffd36b"); } return j; } } catch { /* */ }
    return null;
  }
  setTimeout(check, 2500); setInterval(check, 120e3);
  addEventListener("focus", () => setTimeout(check, 500));
  return { check, get tiers() { return tiers; }, get perk() { return last; } };
}
