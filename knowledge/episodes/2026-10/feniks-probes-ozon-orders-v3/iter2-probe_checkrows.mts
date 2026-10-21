// ФЕНИКС, аудит PR #492 iter2 (2026-10-20): проба A5 на новом инварианте checkRows (a95fd4b).
// Гоняет НАСТОЯЩИЙ checkRows ветки на реальных файлах git (main v2, ветка v3/v4, плохой прогон 99149e2)
// и на их порче: те же случаи, что iter1 (probe_invariants.mts), плюс новые i-l.
//
// Запуск: npx tsx iter2-probe_checkrows.mts <orders-daily.ts ветки> <main.ndjson> <branch.ndjson> <bad.ndjson>
// Файлы: git show <ref>:analytics-mvp/data/orders_daily.ndjson > <файл в /tmp>.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [modPath, mainF, branchF, badF] = process.argv.slice(2);
if (!modPath || !mainF || !branchF || !badF) { console.error("usage: iter2-probe_checkrows.mts <orders-daily.ts> <main> <branch> <bad>"); process.exit(2); }
const { checkRows }: any = await import(pathToFileURL(modPath).href);
const read = (f: string) => readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const main = read(mainF), branch = read(branchF), bad = read(badF);
const mainKeys = new Set(main.map((r: any) => r.order));
const shift = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

type Case = { id: string; want: "block" | "pass" | "info"; prev: any[]; next: any[]; why: string };
const cases: Case[] = [
  { id: "a.good-run-43cd2db", want: "pass", prev: main, next: branch, why: "итоговый сбор v3/v4 против main" },
  { id: "b.bad-run-99149e2", want: "block", prev: main, next: bad, why: "выручка 0, paid null у всех" },
  { id: "c.fbo-lost", want: "block", prev: main, next: branch.filter((r: any) => r.scheme !== "FBO"), why: "вся FBO пропала (iter1 A5b)" },
  { id: "d.fbo-lost-steady", want: "block", prev: branch, next: branch.filter((r: any) => r.scheme !== "FBO"), why: "то же, prev = вчерашний файл" },
  { id: "e.fbs-lost", want: "block", prev: main, next: branch.filter((r: any) => r.scheme === "FBO"), why: "вся FBS пропала" },
  { id: "f.all-duplicated", want: "block", prev: main, next: [...branch, ...branch], why: "каждый заказ дважды" },
  { id: "g.dates-shifted", want: "info", prev: main, next: branch.map((r: any) => ({ ...r, d: shift(r.d, 1) })), why: "дата заказа +1 день (в rework_tz не входило)" },
  { id: "h.prev-file-missing", want: "info", prev: [], next: bad, why: "нет прошлого файла + выручка 0 (первый сбор, by design)" },
  { id: "i.new-day-zero-money", want: "block", prev: main, next: branch.map((r: any) => (mainKeys.has(r.order) ? r : { ...r, revenue: 0, paid: null })), why: "новые заказы 19.10 с выручкой 0 и paid null (форма цены сменилась только у новых)" },
  { id: "j.one-order-gone", want: "block", prev: main, next: branch.filter((r: any) => r.order !== main[100].order), why: "пропал один старый заказ" },
  { id: "k.short-window-from-input", want: "block", prev: main, next: branch.filter((r: any) => r.d >= "2026-10-01"), why: "workflow_dispatch from=2026-10-01 (E028)" },
  { id: "l.fbo-order-moves-to-rfbs", want: "info", prev: main, next: branch.map((r: any) => (r.order === main.find((x: any) => x.scheme === "FBO").order ? { ...r, scheme: "rFBS" } : r)), why: "один FBO-заказ сменил схему на rFBS (ложный стоп?)" },
];

let miss = 0;
for (const c of cases) {
  const res = checkRows(c.prev, c.next);
  const got = res ? "block" : "pass";
  const ok = c.want === "info" || got === c.want;
  if (!ok) miss++;
  console.log(`${c.want === "info" ? "INFO" : ok ? "OK  " : "MISS"} ${c.id}: ожидание ${c.want}, факт ${got} | ${c.why}${res ? " | " + String(res).slice(0, 160) : ""}`);
}
const newRows = branch.filter((r: any) => !mainKeys.has(r.order));
const revNew = newRows.reduce((s: number, r: any) => s + (r.revenue || 0), 0), revAll = branch.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
console.log(`\nновых заказов за день: ${newRows.length}, их выручка ${revNew} = ${(revNew / revAll * 100).toFixed(2)}% файла (допуск 1%)`);
console.log(`гейт не сработал там, где должен: ${miss}`);
