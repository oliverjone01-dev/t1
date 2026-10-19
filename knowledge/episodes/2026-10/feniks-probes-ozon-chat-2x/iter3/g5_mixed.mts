// ФЕНИКС iter3, @ 754cf5c. Допуск 1 шт держится на поле t: что видит читатель, если у части заказов t нет
// (фикстура cab3edge2not: 2 ночных заказа TRUBIS без t). npx tsx g5_mixed.mts <dataDir> <today>
import { join } from "node:path";
const { planBlock } = await import("/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts");
const [dir, today] = process.argv.slice(2) as [string, string];
const b = planBlock(today, (f: string) => join(dir, f))!;
console.log("Как считаем:", /День заказа[^<]*/.exec(b.html)?.[0]);
console.log("Сверка:", /Сверка с кабинетом[^<]*(<b>[^<]*<\/b>)?[^<]*/.exec(b.html)?.[0]);
console.log("pt-warn:", b.warnings.join(" | ") || "нет");
