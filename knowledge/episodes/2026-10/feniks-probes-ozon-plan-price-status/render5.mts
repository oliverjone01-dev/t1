// ФЕНИКС, раздел 5 «Цена» (4f2409c). Рендер блока «План» в jsdom: ошибки клиента, 20 контейнеров, клики,
// плашки цены (из DOM, после клиента), таблица 6 (чип статуса, класс, «Скидка OZON 14.10/сейчас», п.п.).
// npx tsx render5.mts <tree> <dataDir> <today> [out.json]
// tree = путь к analytics-mvp дерева коммита (scratch, git archive), dataDir - закреплённые data/ коммита 4f2409c.
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
console.log(`[${tree.split("/").slice(-2, -1)[0]} ${today}] jsdom ошибок ${errs.length} ${errs.slice(0, 2).join("; ")} | em dash ${(page.match(/\u2014/g) ?? []).length}`
  + ` | пустых контейнеров ${sizes.filter(([, n]) => n <= 0).length} из ${sizes.length} | клик карточки hidden ${h0} -> ${det?.hidden}`
  + ` | клик показателя ${before} -> ${doc.getElementById("pt-dynchart")?.innerHTML.length ?? 0}`);
// плашки цены после клиента
const pills = [...doc.querySelectorAll("#pt-pricepills .pill-row")].map((r) => ({ label: t(r.querySelector(".pl-n")), n: t(r.querySelector(".pl-bar")), pct: t(r.querySelector(".pl-p")),
  color: (r.querySelector(".pl-fill") as any)?.style?.background ?? "" }));
console.log("плашки:", pills.map((p) => `${p.label}=${p.n} (${p.pct}${p.color ? ", " + p.color : ""})`).join(" | "), "|", t(doc.querySelector("#pt-pricepills .legend")));
console.log("price_st:", JSON.stringify(PD.price_st), "price_n", PD.price_n, "price_first", PD.price_first);
// таблица 6: последняя таблица раздела 5
const sec = [...doc.querySelectorAll("#pt-plan details.pt-sec")].find((d) => t(d.querySelector("summary")).startsWith("5."))!;
const tbl = sec.querySelector("table")!;
const head = [...tbl.querySelectorAll("thead th")].map((th) => t(th));
console.log("шапка:", head.join(" | "));
const nP = head.length - 8;   // колонки цен PCOLS (вне их: С, Артикул, Сейчас, Целевая, Статус, 2 скидки, пустая)
const rows = [...tbl.querySelectorAll("tbody tr")].map((r) => {
  const td = [...r.querySelectorAll("td")];
  const chip = td[2 + nP + 2]?.querySelector(".chip") as any;
  const gNow = td[2 + nP + 4];
  return { when: t(td[0]), art: t(td[1]?.childNodes[0] as any), pcols: td.slice(2, 2 + nP).map((x) => t(x)),
    now: t(td[2 + nP]?.childNodes[0] as any), now_d: t(td[2 + nP]?.querySelector(".muted")), target: t(td[2 + nP + 1]),
    status: t(chip), cls: String(chip?.className ?? "").replace("chip ", ""),
    g0: t(td[2 + nP + 3]), gp: t(gNow?.childNodes[0] as any), gd: t(gNow?.querySelector(".muted")), gdd: t(gNow?.querySelector("div.s:not(.muted)")),
    gdd_color: (gNow?.querySelector("div.s:not(.muted)") as any)?.style?.color ?? "", eb: t(td[2 + nP + 5]) };
});
for (const r of rows) console.log(`  ${r.when} ${r.art.padEnd(26)} ${r.pcols.join("/").padEnd(22)} сейчас ${r.now} (${r.now_d}) цель ${r.target.padEnd(16)} | ${r.status.padEnd(34)} ${r.cls.padEnd(9)} | 14.10 ${r.g0} сейчас ${r.gp} (${r.gd}) ${r.gdd} ${r.eb}`);
const cnt: Record<string, number> = {}; rows.forEach((r) => { const k = r.status.replace(/[-0-9,%.]+/g, "#").replace(/\s+/g, " "); cnt[k] = (cnt[k] ?? 0) + 1; });
console.log("статусы по тексту:", JSON.stringify(cnt));
if (out) writeFileSync(out, JSON.stringify({ today, errs, pills, price_st: PD.price_st, head, rows }, null, 1));
