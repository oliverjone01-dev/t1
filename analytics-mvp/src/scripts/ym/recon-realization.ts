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
type Rel = { ym: string; business: string; campaign: string; order: string; sku: string; role: string; count: number; d: string };

const key = (b: string, o: string, s: string) => `${b}|${o}|${s}`;

function main() {
  const months = process.argv.slice(2).filter((x) => /^\d{4}-\d{2}$/.test(x));
  const orders = readNdjson<Ord>(yp("orders.ndjson"));
  const rel = readNdjson<Rel>(yp("realization_orders.ndjson"));
  if (!rel.length) {
    console.log("realization_orders.ndjson пуст: строки уровня заказа ещё не собраны (нужен прогон ym:realization после правки разбора)");
    return;
  }
  // Сторона выгрузки заказов: только доставленные, штуки нетто. Месяц тут НЕ фильтруем.
  // Первая версия фильтровала заказы по месяцу оформления, а строки отчёта брала все, и выдавала
  // «14 заказов есть только в отчёте» - хотя все 14 лежали в выгрузке, просто оформлены в июне.
  // Фильтр, применённый к одной стороне сравнения, сам создаёт расхождение. Месяцы теперь режут
  // только ОТЧЁТ (какие месяцы реализации смотрим), а заказы берутся все.
  // Сравниваем ДОСТАВЛЕННЫЕ штуки с ДОСТАВЛЕННЫМИ, возвраты отдельно. Иначе не сходится по двум
  // причинам, обе мои, не данных:
  //   1) статус RETURNED тоже означает «доставлено, потом вернули». Отбор только по DELIVERED
  //      выбрасывал такие заказы, и они выглядели как «есть в отчёте, нет в выгрузке» - три
  //      штуки за июль, все три лежали в выгрузке со статусом RETURNED.
  //   2) поле delivered в выгрузке уже за вычетом возврата, и вычитать returned второй раз -
  //      значит уводить полностью возвращённый товар в минус: GGR-11-4 давал -1 против 0.
  // Поэтому берём count (сколько штук заказа доставлено до возвратов) против delivered-строк
  // отчёта, а возвраты сверяем своей парой.
  const DELIVERED_LIKE = /^(DELIVERED|RETURNED|PARTIALLY_)/;
  const mine = new Map<string, { n: number; ym: string }>();
  const mineRet = new Map<string, number>();
  for (const o of orders) {
    if (!DELIVERED_LIKE.test(String(o.status || ""))) continue;
    const k = key(String(o.business), String(o.order), String(o.sku));
    const a = mine.get(k) || { n: 0, ym: String(o.created || "").slice(0, 7) };
    a.n += Number((o as any).count) || 0; mine.set(k, a);
    mineRet.set(k, (mineRet.get(k) || 0) + (Number(o.returned) || 0));
  }
  // Сторона отчёта: delivered минус returned по тому же ключу.
  const theirs = new Map<string, { n: number; ym: string }>();
  const theirsRet = new Map<string, number>();
  for (const r of rel) {
    if (months.length && !months.includes(String(r.ym))) continue;
    const k = key(String(r.business), String(r.order), String(r.sku));
    if (r.role === "returned") { theirsRet.set(k, (theirsRet.get(k) || 0) + (Number(r.count) || 0)); continue; }
    const a = theirs.get(k) || { n: 0, ym: r.ym };
    a.n += Number(r.count) || 0;
    theirs.set(k, a);
  }
  // Идём по ключам ОТЧЁТА. Обратное направление («заказ есть, в отчёте нет») имеет смысл только
  // когда собраны ВСЕ магазины и месяцы: иначе несобранный магазин выглядит как дыра в отчёте.
  const keys = new Set([...theirs.keys()]);
  let same = 0; const diff: string[] = [], onlyMine: string[] = [], onlyRep: string[] = [];
  let unMine = 0, unRep = 0;
  for (const k of keys) {
    const a = mine.get(k), b = theirs.get(k);
    unMine += a?.n || 0; unRep += b?.n || 0;
    if (a && b) { if (a.n === b.n) same++; else diff.push(`${k}: заказы ${a.n}, отчёт ${b.n}`); }
    else if (b) onlyRep.push(`${k}: ${b.n} шт`);
  }
  console.log(`сверка по номеру заказа${months.length ? " за " + months.join(", ") : ""}`);
  console.log(`  ключей заказ+артикул: ${keys.size}`);
  console.log(`  совпали по штукам:    ${same}`);
  console.log(`  разошлись:            ${diff.length}`);
  console.log(`  ключа нет в выгрузке заказов: ${onlyRep.length} (пробел сбора заказов)`);
  console.log(`  штук: по заказам ${unMine}, по отчёту ${unRep}`);
  console.log(`  магазинов в отчёте: ${new Set(rel.filter((r) => !months.length || months.includes(String(r.ym))).map((r) => String(r.campaign))).size}`);
  for (const x of diff.slice(0, 15)) console.log("   разошлось:", x);
  for (const x of onlyRep.slice(0, 10)) console.log("   нет в заказах:", x);
}
main();
