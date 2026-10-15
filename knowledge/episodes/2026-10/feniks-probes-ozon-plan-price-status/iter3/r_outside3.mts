// ФЕНИКС iter3 (e063381). R3: страница «Тесты» вне блока «План» одинакова на main (b55e514 = 3810a26) и голове.
// Из собранных r_gate3.sh страниц вырезаю html, css и js блока (planBlock каждого дерева на тех же data/ и том же «сегодня»)
// и сравниваю остаток. Время сборки в тексте страницы нормализую.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const SC = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const DATA = SC + "p5/data_4f2409c/analytics-mvp/data";
const TODAY = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const TREES: Record<string, string> = { main: SC + "p5/tree_3810a26", e063381: SC + "p6/tree_e063381" };
const rest: Record<string, string> = {};
for (const rev of ["main", "e063381"]) {
  const { planBlock } = await import(TREES[rev] + "/analytics-mvp/src/scripts/plan-tab.ts");
  const b = planBlock(TODAY, (f: string) => join(DATA, f));
  const file = readdirSync(SC + `p6/out_${rev}`).find((f) => f.includes("tests") && f.endsWith(".html"))!;
  let page = readFileSync(SC + `p6/out_${rev}/${file}`, "utf-8");
  const found = [b.html, b.css, b.js].map((s: string) => page.includes(s));
  for (const [k, s] of [["HTML", b.html], ["CSS", b.css], ["JS", b.js]] as const) page = page.split(s).join(`<<PLAN_${k}>>`);
  rest[rev] = page.replace(/\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?/g, "<TS>");
  console.log(rev, file, "today", TODAY, "| блок найден html/css/js:", found.join("/"), "| остаток", rest[rev].length, "| em dash на странице", (page.match(/\u2014/g) ?? []).length);
}
console.log("остаток страницы вне блока «План» одинаков:", rest["main"] === rest["e063381"]);
