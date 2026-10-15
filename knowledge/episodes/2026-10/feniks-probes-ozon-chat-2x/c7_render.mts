// ФЕНИКС, PR #477 @ 889c35b. Рендер блока «План с 15.10» в jsdom (перенос p3_render.mts iter3, без N6).
// npx tsx c7_render.mts <new|base> <dataDir> <today>
// base = 628695b (scratch/base_tree), new = рабочее дерево 889c35b.
// jsdom в analytics-mvp/node_modules не установлен (объявлен в package.json), копия поставлена в scratch/dom.
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/dom/node_modules/jsdom/lib/api.js";

const SP = "/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/";
const IMPL: Record<string, string> = {
  new: "/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts",
  base: SP + "base_tree/src/scripts/plan-tab.ts",
};
const [impl, dir, today] = process.argv.slice(2) as [string, string, string];
const { planBlock } = await import(IMPL[impl]!);
const b = planBlock(today, (f: string) => join(dir, f));
if (!b) { console.log("блока нет"); process.exit(0); }
console.log("warnings:", b.warnings.length, JSON.stringify(b.warnings.slice(0, 3)));
const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
const errs: string[] = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document;
const t = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const root = doc.querySelector("#pt-plan")!;
console.log("jsdom ошибок:", errs.length, "| em dash:", (page.match(/—/g) ?? []).length);
console.log("чип:", t(root.querySelector(".chip-run")));
console.log("плашка решения:", t(root.querySelector(".pt-decide")) || "нет");
console.log("pt-warn:", [...root.querySelectorAll(".pt-warn:not(.pt-decide)")].map(t).join(" | ") || "нет");
const tr = [...root.querySelectorAll("table")[0]!.querySelectorAll("tr.crow")].find((x) => /TRUBIS 160/.test(t(x)));
console.log("TRUBIS 160:", tr ? t(tr) : "нет строки");
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  спидометр:", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1"))));
console.log("легенда рекламы:", t(root.querySelector("#pt-pills .legend")));
root.querySelectorAll(".pt-notes li").forEach((li) => { const s = t(li); if (/Сверка|Данные:/.test(s)) console.log("  *", s); });
