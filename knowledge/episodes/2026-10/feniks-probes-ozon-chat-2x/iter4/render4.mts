// ФЕНИКС iter4 @ 753bf11. Рендер блока «План с 15.10» в jsdom: спидометры, таблица 1, «Как считаем», сверка, предупреждения.
// npx tsx render4.mts <head|base> <dataDir> <today>
// head = scratch/tree_753bf11 (= коммит 753bf11), base = scratch/tree_5c4f053 (main). jsdom - в scratch (npm ci --ignore-scripts).
import { join } from "node:path";
const SP = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const { JSDOM, VirtualConsole } = await import(SP + "tree_753bf11/analytics-mvp/node_modules/jsdom/lib/api.js");
const TREE: Record<string, string> = { head: SP + "tree_753bf11/analytics-mvp/", base: SP + "tree_5c4f053/analytics-mvp/" };
const [impl, dir, today] = process.argv.slice(2) as [string, string, string];
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
b.warnings.forEach((w: string) => console.log("  W:", w));
console.log("чип:", t(root.querySelector(".chip-run")), "| плашка решения:", t(root.querySelector(".pt-decide")) || "нет");
console.log("ad_last", PD.ad_last, "| od_last", PD.od_last, "| ads_month", JSON.stringify(PD.ads_month ?? null));
root.querySelectorAll("#pt-gauges .gauge").forEach((g) => console.log("  спидометр:", t(g.querySelector(".g-t")), "|", t(g.querySelector(".gv")), "|", t(g.querySelector(".g-l1")), "|", t(g.querySelector(".g-l2"))));
const t1 = root.querySelectorAll("table")[0]!;
console.log("таблица 1:", [...t1.querySelectorAll("tr.crow")].map((r) => [...r.querySelectorAll("td")].slice(0, 5).map(t).join(" ")).join(" || "));
root.querySelectorAll(".pt-notes li").forEach((li) => console.log("  *", t(li)));
