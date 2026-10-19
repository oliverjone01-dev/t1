// ФЕНИКС iter4. Рендер блока «План с 15.10» в jsdom: ошибки клиента, отрисовка всех контейнеров, клики,
// спидометры, таблица 1, «Как считаем», сверка, предупреждения.
// npx tsx render4.mts <head|h753|base> <dataDir> <today> [--brief]
// head = scratch/tree_da0a36b (голова после Codex P1), h753 = scratch/tree_753bf11 (запрос аудита), base = scratch/tree_5c4f053 (main).
// jsdom - в scratch (npm ci --ignore-scripts), data/ - копия коммита 753bf11 (рабочее дерево менялось во время аудита).
import { join } from "node:path";
const SP = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const { JSDOM, VirtualConsole } = await import(SP + "tree_753bf11/analytics-mvp/node_modules/jsdom/lib/api.js");
const TREE: Record<string, string> = { head: SP + "tree_da0a36b/analytics-mvp/", h753: SP + "tree_753bf11/analytics-mvp/", base: SP + "tree_5c4f053/analytics-mvp/" };
const [impl, dir, today, flag] = process.argv.slice(2) as [string, string, string, string?];
const { planBlock, PLAN_FILE } = await import(TREE[impl] + "src/scripts/plan-tab.ts");
const b = planBlock(today, (f: string) => join(dir, f));
if (!b) { console.log("блока нет"); process.exit(0); }
const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
const errs: string[] = []; const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document; const t = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const root = doc.querySelector("#pt-plan")!;
const PD = (dom.window as any).PD;
console.log(`[${impl} ${today}] PLAN_FILE ${PLAN_FILE} | jsdom ошибок ${errs.length} ${errs.slice(0, 2).join(";")} | em dash ${(page.match(/—/g) ?? []).length} | warnings ${b.warnings.length}`);
// отрисовка: длина innerHTML каждого контейнера клиента (0 = не нарисован)
const ids = ["pt-gauges", ...PD.cards.map((_: unknown, i: number) => `pt-mc${i}`), "pt-mcS", "pt-cardsel", "pt-metsel", "pt-dynchart", "pt-dyntbl", "pt-stU", "pt-stT", "pt-pills", "pt-pricepills"];
const sizes = ids.map((id) => [id, doc.getElementById(id)?.innerHTML.length ?? -1] as const);
console.log("контейнеры:", sizes.map(([id, n]) => `${id}=${n}`).join(" "), "| пустых", sizes.filter(([, n]) => n <= 0).length, "из", sizes.length);
// клики: строка карточки раскрывает график, кнопка показателя перерисовывает воронку
const crow = root.querySelector("tr.crow") as any; const det = doc.getElementById("pt-cdet0") as any;
const h0 = det?.hidden; crow?.click?.(); console.log("клик по строке карточки: hidden", h0, "->", det?.hidden);
const mb = doc.querySelectorAll("#pt-metsel .mb")[5] as any; const before = doc.getElementById("pt-dynchart")?.innerHTML.length ?? 0;
mb?.click?.(); console.log("клик «Заказы без отмен»:", before, "->", doc.getElementById("pt-dynchart")?.innerHTML.length ?? 0, "| ошибок после кликов", errs.length);
if (flag === "--brief") process.exit(0);
b.warnings.forEach((w: string) => console.log("  W:", w));
console.log("чип:", t(root.querySelector(".chip-run")), "| плашка решения:", t(root.querySelector(".pt-decide")) || "нет");
console.log("ad_last", PD.ad_last, "| od_last", PD.od_last, "| ads_month", JSON.stringify(PD.ads_month ?? null));
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  спидометр:", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1")), "|", t(g.querySelector(".g-l2"))));
const t1 = root.querySelectorAll("table")[0]!;
console.log("таблица 1:", [...t1.querySelectorAll("tr.crow")].map((r) => [...r.querySelectorAll("td")].slice(0, 5).map(t).join(" ")).join(" || "));
console.log("легенда рекламы:", t(root.querySelector("#pt-pills .legend")));
root.querySelectorAll(".pt-notes li").forEach((li) => console.log("  *", t(li)));
