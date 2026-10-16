// ФЕНИКС iter5 (381f11d5). R3: страница «Тесты» вне блока «План» одинакова на main (9a3a212) и голове.
// Из собранных r_gate5.sh страниц вырезаю html, css и js блока (planBlock каждого дерева на тех же data/ и том же «сегодня»)
// и сравниваю остаток. Время сборки в тексте страницы нормализую. Длинное тире считаю по escape-коду, не буквой (урок iter3).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const SC = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/";
const DATA = SC + "p8/data_381f11d5/analytics-mvp/data";
const TODAY = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const TREES: Record<string, string> = { "9a3a212": SC + "p8/tree_9a3a212", "381f11d5": SC + "p8/tree_381f11d5" };
const EMD = new RegExp("\\u2014", "g");
const rest: Record<string, string> = {};
for (const rev of ["9a3a212", "381f11d5"]) {
  const { planBlock } = await import(TREES[rev] + "/analytics-mvp/src/scripts/plan-tab.ts");
  const b = planBlock(TODAY, (f: string) => join(DATA, f));
  const file = readdirSync(SC + `p8/out_${rev}`).find((f) => f.includes("tests") && f.endsWith(".html"))!;
  let page = readFileSync(SC + `p8/out_${rev}/${file}`, "utf-8");
  const found = [b.html, b.css, b.js].map((s: string) => page.includes(s));
  for (const [k, s] of [["HTML", b.html], ["CSS", b.css], ["JS", b.js]] as const) page = page.split(s).join(`<<PLAN_${k}>>`);
  rest[rev] = page.replace(/\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?/g, "<TS>");
  console.log(rev, file, "today", TODAY, "| блок найден html/css/js:", found.join("/"), "| остаток", rest[rev].length, "| em dash на странице", (page.match(EMD) ?? []).length);
}
console.log("остаток страницы вне блока «План» одинаков:", rest["9a3a212"] === rest["381f11d5"]);
