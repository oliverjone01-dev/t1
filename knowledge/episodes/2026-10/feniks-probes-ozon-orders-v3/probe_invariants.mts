// ФЕНИКС, аудит PR #492 (2026-10-20), проба A5 «мёртвый гейт» на инварианте checkTotals.
// Гоняет НАСТОЯЩИЕ функции ветки (checkTotals, totalsOf из orders-daily.ts) на заведомо плохих и
// заведомо хороших входах, собранных из реальных файлов git (main, ветка, плохой прогон 99149e2).
//
// Запуск (код ветки распакован git archive в scratch, node_modules скопирован туда же):
//   npx tsx probe_invariants.ts <путь к orders-daily.ts ветки> <main.ndjson> <branch.ndjson> <bad.ndjson>
// Файлы ndjson получаются `git show <ref>:analytics-mvp/data/orders_daily.ndjson > <файл в /tmp>`.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [modPath, mainF, branchF, badF] = process.argv.slice(2);
if (!modPath || !mainF || !branchF || !badF) { console.error("usage: probe_invariants.ts <orders-daily.ts> <main> <branch> <bad>"); process.exit(2); }
const mod: any = await import(pathToFileURL(modPath).href);
const { checkTotals, totalsOf } = mod;
const read = (f: string) => readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const main = read(mainF), branch = read(branchF), bad = read(badF);

type Case = { id: string; want: "block" | "pass"; prev: any[]; next: any[]; why: string };
const cases: Case[] = [
  { id: "a.bad-run-99149e2", want: "block", prev: main, next: bad, why: "прогон 39439844466: выручка 0, paid null у всех" },
  { id: "b.good-run-43cd2db", want: "pass", prev: main, next: branch, why: "итоговый сбор v3/v4" },
  { id: "c.fbo-lost", want: "block", prev: main, next: branch.filter((r) => r.scheme !== "FBO"), why: "вся схема FBO пропала (v3 FBO вернул пусто / другое имя списка)" },
  { id: "d.fbo-lost-steady", want: "block", prev: branch, next: branch.filter((r) => r.scheme !== "FBO"), why: "то же в установившемся режиме (prev = вчерашний файл)" },
  { id: "e.fbs-lost", want: "block", prev: main, next: branch.filter((r) => r.scheme === "FBO"), why: "вся FBS пропала" },
  { id: "f.all-duplicated", want: "block", prev: main, next: [...branch, ...branch], why: "курсор отдал страницы дважды: каждый заказ дважды" },
  { id: "g.dates-shifted", want: "block", prev: main, next: branch.map((r) => ({ ...r, d: shift(r.d, 1) })), why: "дата заказа съехала на день (in_process_at -> shipment_date / TZ)" },
  { id: "h.prev-file-missing", want: "block", prev: [], next: bad, why: "прошлого файла нет (переименован OUT, первый сбор) + выручка 0" },
];
function shift(d: string, days: number) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }

let fails = 0;
for (const c of cases) {
  const res = checkTotals(totalsOf(c.prev), totalsOf(c.next));
  const got = res ? "block" : "pass";
  const ok = got === c.want;
  if (!ok) fails++;
  console.log(`${ok ? "OK  " : "MISS"} ${c.id}: ожидание ${c.want}, факт ${got} | prev ${JSON.stringify(totalsOf(c.prev))} next ${JSON.stringify(totalsOf(c.next))} | ${c.why}${res ? " | " + res : ""}`);
}

// Сколько можно потерять молча (prev = main, next = ветка): запас инварианта.
const P = totalsOf(main), N = totalsOf(branch);
console.log(`\nзапас строк: ${N.rows} - ceil(${P.rows}*0.99) = ${N.rows - Math.ceil(P.rows * 0.99)} заказов можно потерять молча`);
console.log(`запас выручки: ${N.revenue} - ${P.revenue}*0.99 = ${Math.floor(N.revenue - P.revenue * 0.99)} руб (${((N.revenue - P.revenue * 0.99) / N.revenue * 100).toFixed(2)}% файла)`);
const fbo = branch.filter((r) => r.scheme === "FBO");
console.log(`FBO в ветке: ${fbo.length} заказов, выручка ${fbo.reduce((s, r) => s + (r.revenue || 0), 0)}, paid не null ${fbo.filter((r) => r.paid != null).length}`);
console.log(`\nинвариант не сработал там, где должен: ${fails} из ${cases.length}`);
