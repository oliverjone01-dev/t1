// ФЕНИКС iter3 (e063381). Рендер блока «План» в jsdom на парах <dataDir>:<today>: ошибки клиента, пустые контейнеры (20),
// 5 спидометров (центр, l1, l2 со статусом), таблица 1 (с 15.10 / порог, статус), PD.cards_win / ads_month.
// Для B4: число «на пути» спидометра против числа «идём» в таблице 1 на той же сборке.
// npx tsx render7.mts <tree analytics-mvp> <out.jsonl> <dataDir>:<today> [...]
import { join } from "node:path";
import { appendFileSync, writeFileSync } from "node:fs";
const NM = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/tree_753bf11/analytics-mvp/node_modules/";
const { JSDOM, VirtualConsole } = await import(NM + "jsdom/lib/api.js");
const [tree, out, ...pairs] = process.argv.slice(2) as [string, string, ...string[]];
const { planBlock } = await import(join(tree, "src/scripts/plan-tab.ts"));
writeFileSync(out, "");
for (const pr of pairs) {
  const k = pr.lastIndexOf(":"); const dir = pr.slice(0, k), today = pr.slice(k + 1);
  const b = planBlock(today, (f: string) => join(dir, f));
  if (!b) { console.log(pr, "блока нет"); continue; }
  const page = `<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`;
  const errs: string[] = []; const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => errs.push(e.message)); vc.on("error", (e: unknown) => errs.push(String(e)));
  const dom = new JSDOM(page, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  const doc = dom.window.document; const t = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const PD = (dom.window as any).PD;
  const ids = ["pt-gauges", ...PD.cards.map((_: unknown, i: number) => `pt-mc${i}`), "pt-mcS", "pt-cardsel", "pt-metsel", "pt-dynchart", "pt-dyntbl", "pt-stU", "pt-stT", "pt-pills", "pt-pricepills"];
  const empty = ids.filter((id) => (doc.getElementById(id)?.innerHTML.length ?? -1) <= 0);
  const gauges = [...doc.querySelectorAll("#pt-gauges .gauge")].map((g) => ({ title: t(g.querySelector(".g-t")), v: t(g.querySelector(".gv")), l1: t(g.querySelector(".g-l1")), l2: t(g.querySelector(".g-l2")) }));
  const t1 = [...doc.querySelectorAll("#pt-plan table")][0]!;
  const rows = [...t1.querySelectorAll("tr.crow")].map((r) => { const td = [...r.querySelectorAll("td")]; return { n: t(td[0]).replace("▸ ", ""), got: t(td[2]), thr: t(td[1]), st: t(td[6]) }; });
  const cardRows = rows.filter((r) => !r.n.startsWith("Весь магазин"));
  const go = cardRows.filter((r) => r.st === "идём").length;
  const g2 = gauges[1]!; const m = g2.l1.match(/^(\d+) из 10/);
  const rec = { dir: dir.split("/").slice(-1)[0], today, errs, empty, gauges, t1: rows, t1_go: go, t1_early: cardRows.filter((r) => r.st === "рано").length,
    gauge_on: m ? Number(m[1]) : null, cards_win: PD.cards_win, ads_month: PD.ads_month, od_last: PD.od_last, n_in: PD.n_in };
  appendFileSync(out, JSON.stringify(rec) + "\n");
  console.log(`[${rec.dir} ${today}] ошибок ${errs.length}${errs.length ? " " + errs[0] : ""} | пустых ${empty.length} из ${ids.length} | n_in ${PD.n_in} | `
    + gauges.map((g) => `${g.title}: ${g.v} | ${g.l1} | ${g.l2}`).join(" || "));
  console.log(`   таблица 1: идём ${go}, рано ${rec.t1_early} | спидометр «на пути» l1: ${g2.l1} -> ${rec.gauge_on} | ${go === rec.gauge_on || (rec.t1_early === 10 && /рано/.test(g2.v)) || (PD.n_in === 0) ? "СОВПАЛО" : "РАСХОЖДЕНИЕ"}`);
}
