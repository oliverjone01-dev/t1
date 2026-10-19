// ФЕНИКС iter3, @ 754cf5c. Путь страницы (planBlock, день по МСК через orderDay) против независимого пересчёта g3_msk.py:
// эталон 137 держит netUnits (только тест, по UTC), а страница считает своим циклом. Сверяю, что видит Иван.
// npx tsx g3_page.mts
import { join } from "node:path";
const { planBlock } = await import("/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts");
const b = planBlock("2026-10-15", (f: string) => join("/home/user/t1/analytics-mvp/data", f))!;
const m = /window\.PD=(.*?);\n/s.exec(b.js)!;
const D = JSON.parse(m[1]!);
const sum = (s: Array<number | null>, a: string, z: string) => D.days.reduce((t: number, d: string, j: number) => t + (d >= a && d <= z && s[j] != null ? s[j]! : 0), 0);
console.log("od_last", D.od_last, "| магазин 01-13.10", sum(D.store.orders, "2026-10-01", "2026-10-13"), "| магазин 01-14.10", sum(D.store.orders, "2026-10-01", "2026-10-14"));
D.cards.forEach((c: any, i: number) => console.log(`  ${c.short}: 01-14.10 ${sum(D.ser[i].orders, "2026-10-01", "2026-10-14")} | 14.09-11.10 ${sum(D.ser[i].orders, "2026-09-14", "2026-10-11")}`));
console.log("Как считаем:", /День заказа[^<]*/.exec(b.html)?.[0]);
