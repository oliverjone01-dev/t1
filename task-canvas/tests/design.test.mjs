import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { designCheck } from "../tools/design-check.mjs";
const css = await readFile(
  new URL("../public/styles.css", import.meta.url),
  "utf8",
);
const html = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
test("light and dark semantic tokens, font floor, system preferences and viewport rules pass", () =>
  assert.deepEqual(designCheck(css, html), []));
test("design guard rejects deliberately broken colors, sizes, motion and viewport support", () => {
  const mutants = [
    css.replace("--muted: #596575", "--muted: #cccccc"),
    css.replace("--text: #f3f6fb", "--text: #454545"),
    css + "p{font-size:8px}",
    css.replaceAll("prefers-reduced-motion", "removed-motion"),
    css.replaceAll("forced-colors", "removed-colors"),
    css + "a{transition:width 1s}",
    css
      .replaceAll("100dvh", "100vh")
      .replaceAll("safe-area-inset-bottom", "removed-inset"),
    css + "/* \u2014 */",
  ];
  for (const mutant of mutants)
    assert.ok(designCheck(mutant).length, "A deliberate violation must fail");
});
test("document IDs are unique and static assets exist; all view buttons expose selected state", async () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const mode of ["priority", "owners", "time", "list"])
    assert.match(
      html,
      new RegExp(
        `data-mode="${mode}"[\\s\\S]{0,100}aria-pressed="(?:true|false)"`,
      ),
    );
  const files = await readdir(new URL("../public/", import.meta.url));
  for (const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))
    assert.ok(files.includes(match[1]), match[1]);
});

test('HTML, stylesheet and every local ES-module dependency use one deployment revision',async()=>{
  const rev=html.match(/name="application-version" content="([^"]+)"/)?.[1];assert.ok(rev);
  for(const file of await readdir(new URL('../public/',import.meta.url))) {
    if(!file.endsWith('.mjs'))continue;
    const code=await readFile(new URL('../public/'+file,import.meta.url),'utf8');
    for(const m of code.matchAll(/from\s+["'](\.\/[^"']+\.mjs)([^"']*)["']/g))assert.equal(m[2],'?rev='+rev,file+' '+m[1]);
  }
  assert.ok(html.includes('./app.mjs?rev='+rev));assert.ok(html.includes('./styles.css?rev='+rev));
});
