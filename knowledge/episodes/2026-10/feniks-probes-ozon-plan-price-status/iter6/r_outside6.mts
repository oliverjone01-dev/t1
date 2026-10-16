// ФЕНИКС iter6 (db5ede19). R3: страница «Тесты» вне блока «План» одинакова на main 9a3a212 и голове db5ede19 (обе собраны
// r_gate6.sh в один день). Блок (html, css, js planBlock каждого дерева на тех же data/ и том же «сегодня») вырезается,
// время сборки нормализуется. Длинное тире считаю по escape-коду.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const SC = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/";
const DATA = SC + "p8/data_381f11d5/analytics-mvp/data";
const TODAY = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const TREES: Record<string, string> = { "9a3a212": SC + "p8/tree_9a3a212", db5ede19: SC + "p9/tree_db5ede19" };
const EMD = new RegExp("\\u2014", "g");
const rest: Record<string, string> = {};
for (const rev of Object.keys(TREES)) {
  const { planBlock } = await import(TREES[rev] + "/analytics-mvp/src/scripts/plan-tab.ts");
  const b = planBlock(TODAY, (f: string) => join(DATA, f));
  const outd = SC + `p9/out_${rev}`;
  const file = readdirSync(outd).find((f) => f.includes("tests") && f.endsWith(".html"))!;
  let page = readFileSync(join(outd, file), "utf-8");
  const found = [b.html, b.css, b.js].map((s: string) => page.includes(s));
  for (const [k, s] of [["HTML", b.html], ["CSS", b.css], ["JS", b.js]] as const) page = page.split(s).join(`<<PLAN_${k}>>`);
  rest[rev] = page.replace(/\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}(:\d{2})?( МСК)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?/g, "<TS>");
  console.log(rev, file, "today", TODAY, "| блок найден html/css/js:", found.join("/"), "| остаток", rest[rev].length, "| em dash", (page.match(EMD) ?? []).length);
}
console.log("остаток страницы вне блока «План» одинаков:", rest["9a3a212"] === rest["db5ede19"]);
