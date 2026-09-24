// Вытяжка участия в акциях из снимков кабинета в data/promo_daily.ndjson.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ САМ СНИМОК. Репозиторий публичный, а
// tools/reakciya/data-cabinet/ лежит в .gitignore намеренно: в снимке предельная и
// минимальная цена, комиссия, справедливая цена и позиция. Гейту выхода из акции нужны
// артикул, тип акции и окно дат. Цена по акции из строки acts отбрасывается.
//
// Запуск: npm run promo (сети не требует). Снимков нет - файл не трогаем, а не обнуляем.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dp } from "../../paths.js";
import { loadPromoFromSnapshots, promoKey, type PromoRow } from "../promo.js";

/** Слияние с тем, что уже лежит в файле: снимок за день перезаписывает этот день целиком,
 *  прежние дни остаются. Историю задним числом кабинет не отдаёт, терять её нельзя. */
export function merge(existing: PromoRow[], fresh: PromoRow[]): PromoRow[] {
  const days = new Set(fresh.map((r) => r.date));
  const kept = existing.filter((r) => !days.has(r.date));
  return [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.art.localeCompare(b.art));
}

/** Насколько просел состав акций против предыдущего дня, ниже чего день не принимается. */
export const PROMO_DROP_LIMIT = 0.5;

/** Сторож на деградировавший снимок.
 *
 *  ЗАЧЕМ. Участие в акции читается из колонки acts, и достаточно смены формата выгрузки или
 *  пустой колонки, чтобы у всех 500 товаров вышел пустой список. Тогда страница напишет
 *  «вышли все», дата выхода уедет на день сбоя, и быстрый признак начнёт отсчёт от неё.
 *  Хуже того, merge перезаписывает день целиком, а кабинет истории задним числом не отдаёт,
 *  значит битый день останется в файле навсегда.
 *
 *  Проверка простая: число записей об акциях не должно падать больше чем вдвое за сутки.
 *  Настоящий массовый выход возможен (6 октября кончаются обе STO), поэтому это не запрет, а
 *  требование подтвердить руками: день отклоняется, причина печатается. */
export function degraded(existing: PromoRow[], fresh: PromoRow[]): string | null {
  const count = (rows: PromoRow[]) => rows.reduce((s, r) => s + r.promos.length, 0);
  const days = [...new Set(existing.map((r) => r.date))].sort();
  const prevDay = days.filter((d) => d < (fresh[0]?.date ?? "")).pop();
  if (!prevDay) return null;                       // сравнивать не с чем, первый день
  const was = count(existing.filter((r) => r.date === prevDay)), now = count(fresh);
  if (was === 0) return null;
  if (now >= was * PROMO_DROP_LIMIT) return null;
  return `записей об акциях было ${was} на ${prevDay}, стало ${now}`
    + ` (падение больше чем в ${Math.round(1 / PROMO_DROP_LIMIT)} раза)`;
}

function main(): void {
  const fresh = loadPromoFromSnapshots();
  if (!fresh.length) {
    console.log("promo-daily: снимков кабинета нет или в них нет колонки acts - файл не трогаю");
    return;
  }
  const path = dp("promo_daily.ndjson");
  const existing: PromoRow[] = [];
  if (existsSync(path)) {
    for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
      try { existing.push(JSON.parse(l) as PromoRow); } catch { /* битая строка - мимо */ }
    }
  }
  const bad = degraded(existing, fresh);
  if (bad) {
    console.log(`promo-daily: день ОТКЛОНЁН, похоже на сбой выгрузки: ${bad}.`);
    console.log("  Если акции действительно кончились, удали эту проверку осознанно или залей день руками:");
    console.log("  иначе ложный массовый выход уедет на страницу и останется в файле навсегда.");
    return;
  }
  const rows = merge(existing, fresh);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const days = [...new Set(rows.map((r) => r.date))].sort();
  const last = days[days.length - 1]!;
  const byKey = new Map<string, number>();
  for (const r of rows) {
    if (r.date !== last) continue;
    for (const p of r.promos) byKey.set(promoKey(p), (byKey.get(promoKey(p)) ?? 0) + 1);
  }
  const top = [...byKey].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([k, n]) => `${k} ${n}`).join(", ");
  console.log(`promo_daily.ndjson: ${rows.length} строк, дней ${days.length}, на ${last}: ${top}`);
}

if (process.argv[1]?.endsWith("promo-daily.ts")) main();
