// Сверка штук: выгрузка заказов против отчёта о реализации (= УПД), ПО НОМЕРУ ЗАКАЗА.
//
// Зачем не по месяцам. Отчёт о реализации группирует по дате РЕАЛИЗАЦИИ, свод - по дате ЗАКАЗА,
// поэтому «за июль 90 штук против 202» не доказывает ничего: это два разных среза. По номеру
// заказа срез один, и расхождение становится фактом, а не следствием базиса. Тот же приём уже
// сработал на баллах: 1008 ключей кабинет+день+артикул из 1008 сошлись до рубля.
//
// Запуск: npx tsx src/scripts/ym/recon-realization.ts [YYYY-MM ...]
import { readNdjson, yp } from "./common.js";

type Ord = { business: string; order: string; sku: string; created: string; status: string; delivered: number; returned: number };
type Rel = { ym: string; business: string; order: string; sku: string; role: string; count: number; d: string };

const key = (b: string, o: string, s: string) => `${b}|${o}|${s}`;

function main() {
  const months = process.argv.slice(2).filter((x) => /^\d{4}-\d{2}$/.test(x));
  const orders = readNdjson<Ord>(yp("orders.ndjson"));
  const rel = readNdjson<Rel>(yp("realization_orders.ndjson"));
  if (!rel.length) {
    console.log("realization_orders.ndjson пуст: строки уровня заказа ещё не собраны (нужен прогон ym:realization после правки разбора)");
    return;
  }
  // Сторона выгрузки заказов: только доставленные, штуки нетто.
  const mine = new Map<string, { n: number; ym: string }>();
  for (const o of orders) {
    if (o.status !== "DELIVERED") continue;
    const ym = String(o.created || "").slice(0, 7);
    if (months.length && !months.includes(ym)) continue;
    const n = (Number(o.delivered) || 0) - (Number(o.returned) || 0);
    if (!n) continue;
    const k = key(String(o.business), String(o.order), String(o.sku));
    const a = mine.get(k) || { n: 0, ym };
    a.n += n; mine.set(k, a);
  }
  // Сторона отчёта: delivered минус returned по тому же ключу.
  const theirs = new Map<string, { n: number; ym: string }>();
  for (const r of rel) {
    const k = key(String(r.business), String(r.order), String(r.sku));
    const a = theirs.get(k) || { n: 0, ym: r.ym };
    a.n += (r.role === "returned" ? -1 : 1) * (Number(r.count) || 0);
    theirs.set(k, a);
  }
  const keys = new Set([...mine.keys(), ...theirs.keys()]);
  let same = 0; const diff: string[] = [], onlyMine: string[] = [], onlyRep: string[] = [];
  let unMine = 0, unRep = 0;
  for (const k of keys) {
    const a = mine.get(k), b = theirs.get(k);
    unMine += a?.n || 0; unRep += b?.n || 0;
    if (a && b) { if (a.n === b.n) same++; else diff.push(`${k}: заказы ${a.n}, отчёт ${b.n}`); }
    else if (a) onlyMine.push(`${k}: ${a.n} шт`);
    else if (b) onlyRep.push(`${k}: ${b.n} шт`);
  }
  console.log(`сверка по номеру заказа${months.length ? " за " + months.join(", ") : ""}`);
  console.log(`  ключей заказ+артикул: ${keys.size}`);
  console.log(`  совпали по штукам:    ${same}`);
  console.log(`  разошлись:            ${diff.length}`);
  console.log(`  только в заказах:     ${onlyMine.length} (${unMine} шт всего по заказам)`);
  console.log(`  только в отчёте:      ${onlyRep.length} (${unRep} шт всего по отчёту)`);
  for (const x of diff.slice(0, 15)) console.log("   разошлось:", x);
  for (const x of onlyMine.slice(0, 15)) console.log("   нет в отчёте:", x);
  for (const x of onlyRep.slice(0, 10)) console.log("   нет в заказах:", x);
}
main();
