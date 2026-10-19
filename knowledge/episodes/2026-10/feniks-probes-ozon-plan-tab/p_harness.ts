// Live-проба блока на фикстуре: planBlock(today, dp) + клиентский JS в jsdom. Пишет только в scratchpad.
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { planBlock } from "/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts";
import { JSDOM, VirtualConsole } from "/home/user/t1/analytics-mvp/node_modules/jsdom/lib/api.js";

const SP = "/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/";
const [sc, today] = process.argv.slice(2);
const dir = SP + "fx_" + sc;
const b = planBlock(today!, (f) => join(dir, f));
if (!b) { console.log("блока нет"); process.exit(0); }
console.log("warnings:", b.warnings.length, b.warnings.slice(0, 3));
const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
writeFileSync(SP + `page_${sc}.html`, page);
const errs: string[] = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document;
const t = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
console.log("jsdom ошибок:", errs.length, errs.slice(0, 3));
console.log("чип дня:", t(doc.querySelector("#pt-plan .chip-run")));
console.log("--- спидометры");
doc.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  ", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1")), "|", t(g.querySelector(".g-l2"))));
console.log("--- таблица 1 (заказы)");
doc.querySelectorAll("#pt-plan table")[0]!.querySelectorAll("tr.crow").forEach((tr) => console.log("  ", t(tr)));
console.log("--- плашки рекламы (строки с фактом)");
doc.querySelectorAll("#pt-pills .wk-grid").forEach((g) => { const s = t(g); if (/TRUBIS 160|44989034|44989441|OZEVIS/.test(s)) console.log("  ", s); });
const D = (dom.window as any).PD;
console.log("od_last", D.od_last, "ad_last", D.ad_last);
