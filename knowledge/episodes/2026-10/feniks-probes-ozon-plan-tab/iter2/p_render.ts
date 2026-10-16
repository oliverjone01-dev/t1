// iter2: рендер собранной страницы (или блока на фикстуре) в jsdom, печать видимых чисел блока «План с 15.10».
// npx tsx p_render.ts page <html>            - готовая страница
// npx tsx p_render.ts fx <dataDir> <today>   - planBlock на фикстуре
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planBlock } from "/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts";
import { JSDOM, VirtualConsole } from "/home/user/t1/analytics-mvp/node_modules/jsdom/lib/api.js";

const [mode, a1, a2] = process.argv.slice(2);
let page = "";
if (mode === "page") page = readFileSync(a1!, "utf-8");
else {
  const b = planBlock(a2!, (f) => join(a1!, f));
  if (!b) { console.log("блока нет"); process.exit(0); }
  console.log("warnings:", b.warnings.length, b.warnings.slice(0, 3));
  page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
  writeFileSync(a1 + "/../page_" + a2 + ".html", page);
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
console.log("плашка:", t(root.querySelector(".pt-plaque")));
console.log("--- спидометры");
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  ", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1")), "|", t(g.querySelector(".g-l2"))));
console.log("--- таблица 1 (заказы)");
root.querySelectorAll("table")[0]!.querySelectorAll("tr.crow").forEach((tr) => console.log("  ", t(tr)));
console.log("--- воронка заголовок:", t(root.querySelectorAll("table")[1]!.querySelector("tr.grp")));
console.log("--- легенда рекламы:", t(root.querySelector("#pt-pills .legend")));
console.log("--- плашки рекламы");
root.querySelectorAll("#pt-pills .pg, #pt-pills .wk-grid:not(.wk-head)").forEach((g) => console.log("  ", t(g)));
console.log("--- как считаем");
root.querySelectorAll(".pt-notes li").forEach((li) => console.log("  *", t(li)));
const D = (dom.window as any).PD;
console.log("od_last", D.od_last, "ad_last(ADS_FULL)", D.ad_last, "ad_camp_last", D.ad_camp_last, "sv_last", D.sv_last, "n_in", D.n_in, "mgoal", JSON.stringify(D.mgoal));
const j = D.days.indexOf("2026-10-13"), j2 = D.days.indexOf("2026-10-12"), j10 = D.days.indexOf("2026-10-10");
console.log("store sp/clk 10.10", D.store.sp[j10], D.store.clk[j10], "12.10", D.store.sp[j2], D.store.clk[j2], "13.10", D.store.sp[j], D.store.clk[j]);
writeFileSync("/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it2/pd_" + (mode === "page" ? "page" : a2) + ".json", JSON.stringify(D));
