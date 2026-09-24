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
