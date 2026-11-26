// tools/build-css.mjs — the home page's stylesheets as ONE minified file (2026-11-26, the owner's "CSS 통합·압축"):
// pad.css (site.css's @import) + site → game → premium → cards → street → clean → motion, in that cascade order, comments
// dropped and whitespace squeezed (strings and url(...) left as they are). Writes site.min.css and prints its hash, which
// index.html's link carries as ?v=. Edit the sources, then run: node tools/build-css.mjs  (tests/css.test.mjs fails when
// site.min.css is out of date).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ORDER = ["pad.css", "site.css", "game.css", "premium.css", "cards.css", "street.css", "clean.css", "motion.css"];

/// squeeze CSS without changing what it means: comments out, runs of whitespace to one space, none around { } ; and ,
export function minify(css) {
  let out = "", i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") { const e = css.indexOf("*/", i + 2); i = e < 0 ? css.length : e + 2; continue; }
    if (ch === '"' || ch === "'") { let j = i + 1; while (j < css.length && css[j] !== ch) j += css[j] === "\\" ? 2 : 1; out += css.slice(i, j + 1); i = j + 1; continue; }
    if (/\s/.test(ch)) { let j = i; while (j < css.length && /\s/.test(css[j])) j++; out += " "; i = j; continue; }
    out += ch; i++;
  }
  return out.replace(/ ?([{};,]) ?/g, "$1").replace(/;}/g, "}").trim();
}
export function build() {
  const parts = ORDER.map((f) => readFileSync(join(ROOT, f), "utf8").replace(/@import url\("\/pad\.css"\);?/, ""));
  const css = minify(parts.join("\n"));
  return { css, hash: createHash("sha256").update(css).digest("hex").slice(0, 10) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { css, hash } = build();
  writeFileSync(join(ROOT, "site.min.css"), css);
  const html = readFileSync(join(ROOT, "index.html"), "utf8").replace(/\/site\.min\.css\?v=[a-z0-9]+/, `/site.min.css?v=${hash}`);
  writeFileSync(join(ROOT, "index.html"), html);
  console.log(`site.min.css ${css.length} bytes, v=${hash}`);
}
