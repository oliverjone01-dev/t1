// ФЕНИКС iter2 (голова 3810a26). Рендер блока «План» в jsdom: ошибки клиента, 20 контейнеров, клики, 5 спидометров
// (значение, l1, l2, статус после клиента), PD.cards_month / ads_month, плашки цены.
// npx tsx render6.mts <tree analytics-mvp> <dataDir> <today> [out.json]
import { join } from "node:path";
import { writeFileSync } from "node:fs";
const NM = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/tree_753bf11/analytics-mvp/node_modules/";
const { JSDOM, VirtualConsole } = await import(NM + "jsdom/lib/api.js");
const [tree, dir, today, out] = process.argv.slice(2) as [string, string, string, string?];
const { planBlock } = await import(join(tree, "src/scripts/plan-tab.ts"));
const b = planBlock(today, (f: string) => join(dir, f));
if (!b) { console.log("блока нет"); process.exit(0); }
const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
const errs: string[] = []; const vc = new VirtualConsole(); vc.on("jsdomError", (e: Error) => errs.push(e.message));
const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
const doc = dom.window.document; const t = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const PD = (dom.window as any).PD;
const ids = ["pt-gauges", ...PD.cards.map((_: unknown, i: number) => `pt-mc${i}`), "pt-mcS", "pt-cardsel", "pt-metsel", "pt-dynchart", "pt-dyntbl", "pt-stU", "pt-stT", "pt-pills", "pt-pricepills"];
const sizes = ids.map((id) => [id, doc.getElementById(id)?.innerHTML.length ?? -1] as const);
const crow = doc.querySelector("#pt-plan tr.crow") as any; const det = doc.getElementById("pt-cdet0") as any;
const h0 = det?.hidden; crow?.click?.();
const mb = doc.querySelectorAll("#pt-metsel .mb")[5] as any; const before = doc.getElementById("pt-dynchart")?.innerHTML.length ?? 0; mb?.click?.();
const em = (page.match(/\u2014/g) ?? []).length;
console.log(`[${tree.split("/").slice(-2, -1)[0]} ${today}] jsdom ошибок ${errs.length} ${errs.slice(0, 2).join("; ")} | em dash ${em}`
  + ` | пустых ${sizes.filter(([, n]) => n <= 0).length} из ${sizes.length} | клик карточки ${h0} -> ${det?.hidden} | клик показателя ${before} -> ${doc.getElementById("pt-dynchart")?.innerHTML.length ?? 0} | warnings ${b.warnings.length}`);
const gauges = [...doc.querySelectorAll("#pt-gauges .gauge")].map((g) => ({ title: t(g.querySelector(".g-t")), v: t(g.querySelector(".gv")), l1: t(g.querySelector(".g-l1")), l2: t(g.querySelector(".g-l2")) }));
gauges.forEach((g) => console.log(`  спидометр: ${g.title} | ${g.v} | ${g.l1} | ${g.l2}`));
const t1 = [...doc.querySelectorAll("#pt-plan table")][0]!;
const st1 = [...t1.querySelectorAll("tr.crow")].map((r) => { const td = [...r.querySelectorAll("td")]; return `${t(td[0]).replace("▸ ", "")}: ${t(td[2])}/${t(td[1])} ${t(td[6])}`; });
console.log("  таблица 1 (с 15.10 / порог, статус):", st1.join(" | "));
console.log("  cards_month:", JSON.stringify(PD.cards_month));
console.log("  ads_month:", JSON.stringify(PD.ads_month), "| od_last", PD.od_last, "| ad_last", PD.ad_last, "| ad_camp_last", PD.ad_camp_last);
console.log("  плашки цены:", [...doc.querySelectorAll("#pt-pricepills .pill-row")].map((r) => `${t(r.querySelector(".pl-n"))}=${t(r.querySelector(".pl-bar"))}`).join(" | "));
b.warnings.forEach((w: string) => console.log("  W:", w));
const notes = [...doc.querySelectorAll("#pt-plan .pt-notes li")].map((li) => t(li));
if (out) writeFileSync(out, JSON.stringify({ today, errs, gauges, cards_month: PD.cards_month, ads_month: PD.ads_month, cards: PD.cards, notes, html: b.html }, null, 1));
