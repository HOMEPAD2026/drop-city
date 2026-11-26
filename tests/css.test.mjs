// The home page loads ONE stylesheet (site.min.css) built from the sources by tools/build-css.mjs — it must be up to date.
import { readFileSync } from "node:fs";
import { build, minify } from "../tools/build-css.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const { css, hash } = build();
ok(readFileSync(new URL("../site.min.css", import.meta.url), "utf8") === css, "site.min.css matches its sources — run: node tools/build-css.mjs");
ok(readFileSync(new URL("../index.html", import.meta.url), "utf8").includes(`/site.min.css?v=${hash}`), "index.html loads this build (its ?v= hash)");
ok(minify('a , b { color : red ; /* x */ }\n\n.c::after { content: "a  /* b */  c"; }') === 'a,b{color : red}.c::after{content: "a  /* b */  c"}', "the squeeze keeps strings and drops comments");
console.log(`css: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
