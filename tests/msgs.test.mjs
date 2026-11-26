// msgs.js: every message has its Korean / Chinese / Turkish line in the right script, and tm() picks the reader's one
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0; const ok = (c, m) => (c ? pass++ : (fail++, console.log("FAIL", m)));
const src = readFileSync(new URL("../msgs.js", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "msgs-"));
let L = "ko";
writeFileSync(join(dir, "i18n.mjs"), "export const lang = () => globalThis.__L;");
writeFileSync(join(dir, "msgs.mjs"), src.replace('from "/i18n.js"', 'from "./i18n.mjs"'));
globalThis.__L = L;
const m = await import(join(dir, "msgs.mjs"));
ok(m.tm("Fees paid out.") === "수수료를 지급했어요.", "an exact line in Korean");
ok(m.tm("$OWL launched — welcome to the city.") === "$OWL 런칭 완료 — 도시에 오신 걸 환영해요.", "a line with a value, by pattern");
ok(m.tm("something new") === "something new", "unknown lines stay as they came");
globalThis.__L = "en"; ok(m.tm("Fees paid out.") === "Fees paid out.", "English stays English");
globalThis.__L = "zh"; ok(/[一-鿿]/.test(m.tm("Vote counted.")), "Chinese in Han");
// every line: three translations, each in its own script
const rows = [...src.matchAll(/^\s+"([^"]+)": \["([^"]*)", "([^"]*)", "([^"]*)"\],$/gm)];
ok(rows.length >= 25, "the table parses (" + rows.length + ")");
for (const r of rows) { ok(/[가-힣]/.test(r[2]), "ko in Hangul: " + r[1]); ok(/[一-鿿]/.test(r[3]), "zh in Han: " + r[1]); ok(r[4] && !/[가-힣一-鿿]/.test(r[4]), "tr in Latin: " + r[1]); }
console.log(`msgs: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
