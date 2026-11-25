// The translations: every language block holds each key once, every language has the same keys, and each block is in its
// own language (on 2026-11-24 the zh and tr lines of 84 keys were pasted into the ko block, so Korean readers saw Turkish).
import { readFileSync } from "node:fs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = readFileSync(new URL("../i18n.js", import.meta.url), "utf8"), L = src.split("\n");
const PAIR = /([A-Za-z_]\w*): ("(?:[^"\\]|\\.)*")/g;
const starts = L.map((l, i) => (/^  (ko|zh|tr): \{/.test(l) ? i : -1)).filter((i) => i >= 0);
for (const s of starts) {
  let k = s + 1; while (k < L.length && !/^  (ko|zh|tr): \{/.test(L[k]) && !L[k].startsWith("}")) k++;
  const seen = {}; for (const m of L.slice(s, k).join("\n").matchAll(PAIR)) seen[m[1]] = (seen[m[1]] || 0) + 1;
  const dup = Object.keys(seen).filter((x) => seen[x] > 1);
  ok(!dup.length, `line ${s + 1} (${L[s].trim().slice(0, 3)}): no key twice — ${dup.slice(0, 5).join(", ")}`);
}
globalThis.localStorage = { getItem: () => null, setItem() {} };
const m = await import("data:text/javascript," + encodeURIComponent(src.replace("export const t =", "export const __D = DICT; export const t =")));
const D = m.__D, keys = (l) => Object.keys(D[l]).sort().join(",");
ok(keys("ko") === keys("zh") && keys("zh") === keys("tr"), "ko, zh and tr carry the same keys");
const hang = /[가-힣]/, han = /[一-鿿]/, trc = /[şğıİŞĞ]/;
const bad = [];
for (const [k, v] of Object.entries(D.ko)) if ((han.test(v) && !hang.test(v)) || trc.test(v)) bad.push("ko:" + k);
for (const [k, v] of Object.entries(D.zh)) if (hang.test(v) || trc.test(v)) bad.push("zh:" + k);
for (const [k, v] of Object.entries(D.tr)) if (hang.test(v) || han.test(v)) bad.push("tr:" + k);
ok(!bad.length, "every line is in its own language — " + bad.slice(0, 6).join(", "));
console.log(`i18n: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
