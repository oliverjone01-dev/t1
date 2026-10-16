// ФЕНИКС iter4. Проба R3b: страница «Тесты» вне блока «План» байт-в-байт одинакова на main и голове.
// Из собранных r4_build.py страниц вырезаю html, css и js блока (planBlock каждого дерева на тех же data/ и сегодня по МСК)
// и сравниваю остаток. npx tsx r4_outside.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
const SP = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const DATA = SP + "data_753bf11/analytics-mvp/data";
const TODAY = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const rest: Record<string, string> = {};
for (const rev of ["5c4f053", "da0a36b"]) {
  const { planBlock } = await import(SP + `tree_${rev}/analytics-mvp/src/scripts/plan-tab.ts`);
  const b = planBlock(TODAY, (f: string) => join(DATA, f));
  let page = readFileSync(SP + `out_${rev}/katya-tests.html`, "utf-8");
  const found = [b.html, b.css, b.js].map((s: string) => page.includes(s));
  for (const [k, s] of [["HTML", b.html], ["CSS", b.css], ["JS", b.js]] as const) page = page.split(s).join(`<<PLAN_${k}>>`);
  rest[rev] = page.replace(/\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?/g, "<TS>");
  console.log(rev, "today", TODAY, "| блок найден в странице html/css/js:", found.join("/"), "| остаток", rest[rev].length);
}
console.log("остаток страницы вне блока «План» одинаков:", rest["5c4f053"] === rest["da0a36b"]);
