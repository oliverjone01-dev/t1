// iter3: рендер блока «План с 15.10» в jsdom, печать видимых чисел + проверка N6 (затенение динамики «Магазин»).
// npx tsx p3_render.ts page <html>
// npx tsx p3_render.ts fx <new|base> <dataDir> <today>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "/home/user/t1/analytics-mvp/node_modules/jsdom/lib/api.js";

const SP = "/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it3/";
const IMPL: Record<string, string> = {
  new: "/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts",
  base: SP + "base/src/scripts/plan-tab.ts",
};
const args = process.argv.slice(2);
const mode = args[0];
let page = "", tag = "";
if (mode === "page") { page = readFileSync(args[1]!, "utf-8"); tag = "page"; }
else {
  const impl = args[1]!, dir = args[2]!, today = args[3]!;
  const { planBlock } = await import(IMPL[impl]!);
  const b = planBlock(today, (f: string) => join(dir, f));
  if (!b) { console.log("блока нет"); process.exit(0); }
  console.log("warnings:", b.warnings.length, b.warnings.slice(0, 3));
  page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
  tag = impl + "_" + dir.split("/").filter(Boolean).pop() + "_" + today;
  writeFileSync(SP + "page_" + tag + ".html", page);
}
const errs: string[] = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document;
const t = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
console.log("jsdom ошибок:", errs.length, errs.slice(0, 3));
const root = doc.querySelector("#pt-plan");
if (!root) { console.log("нет #pt-plan"); process.exit(1); }
console.log("чип дня:", t(root.querySelector(".chip-run")));
console.log("--- спидометры");
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  ", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1")), "|", t(g.querySelector(".g-l2"))));
console.log("--- таблица 1 (заказы)");
root.querySelectorAll("table")[0]!.querySelectorAll("tr.crow").forEach((tr) => console.log("  ", t(tr)));
console.log("--- легенда рекламы:", t(root.querySelector("#pt-pills .legend")));
console.log("--- плашки рекламы (первые 3 группы)");
root.querySelectorAll("#pt-pills .pg, #pt-pills .wk-grid:not(.wk-head)").forEach((g, k) => { if (k < 40) console.log("  ", t(g)); });
console.log("--- как считаем");
root.querySelectorAll(".pt-notes li").forEach((li) => console.log("  *", t(li)));
const D = (dom.window as any).PD;
console.log("od_last", D.od_last, "ad_last(ADS_FULL)", D.ad_last, "ad_camp_last", D.ad_camp_last, "sv_last", D.sv_last, "n_in", D.n_in, "mgoal", JSON.stringify(D.mgoal));
// N6: динамика воронки, набор «Магазин», показатель «Расход на клики» / «CPC»: где начинается «ещё нет данных»
const click = (sel: string, txt: string) => {
  const b = [...doc.querySelectorAll(sel + " .mb")].find((x) => t(x) === txt) as HTMLElement | undefined;
  if (!b) { console.log("нет кнопки", sel, txt); return false; } b.click(); return true;
};
const shade = (): string => {
  const ch = doc.querySelector("#pt-dynchart")!, svg = ch.querySelector("svg")!;
  const r = [...svg.querySelectorAll("rect")].find((x) => x.getAttribute("fill") === "rgba(93,116,132,.08)");
  if (!r) return "нет затенения";
  const j1 = D.days.indexOf(D.w1), n = j1 + 1, W = 900, L = 46, R = 12;
  const x0 = Number(r.getAttribute("x")); const nodata = Math.round((x0 - L) / (W - L - R) * (n - 1) + 0.5);
  return `затенение с ${D.days[nodata]} (последний день с данными ${D.days[nodata - 1]})`;
};
for (const set of ["Магазин", "Все 10", "TRUBIS 160"]) for (const met of ["Расход на клики, ₽", "CPC, ₽", "Заказы без отмен"]) {
  if (click("#pt-cardsel", set) && click("#pt-metsel", met)) console.log("N6:", set, "·", met, "->", shade());
}
writeFileSync(SP + "pd_" + tag + ".json", JSON.stringify(D));
