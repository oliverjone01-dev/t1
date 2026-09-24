// Вытяжка eb_pct из снимков кабинета в data/eb_daily.ndjson.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ САМ СНИМОК. Репозиторий публичный, а
// tools/reakciya/data-cabinet/ лежит в .gitignore намеренно: снимок это 30 колонок на
// 500 товаров, среди них предельная и минимальная цена, комиссия, справедливая цена и
// позиция, а рядом cpo_history с именами сотрудников. Гейту выхода из бустинга из всего
// этого нужны три поля. Их и кладём.
//
// Запуск: npm run eb (сети не требует). Снимков нет - файл не трогаем, а не обнуляем.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dp } from "../../paths.js";
import { loadEbFromSnapshots } from "../eb-level.js";

export interface EbRow { date: string; art: string; eb_pct: number }

/** Ряды по артикулам -> строки файла, отсортированные по дате и артикулу: так дифф
 *  читается глазами, а не показывает перестановку всего файла. */
export function toRows(series: Map<string, Array<{ date: string; pct: number }>>): EbRow[] {
  const out: EbRow[] = [];
  for (const [art, pts] of series) for (const p of pts) out.push({ date: p.date, art, eb_pct: p.pct });
  out.sort((a, b) => a.date.localeCompare(b.date) || a.art.localeCompare(b.art));
  return out;
}

/** Слияние с тем, что уже лежит в файле: снимок за день перезаписывает этот день целиком,
 *  прежние дни остаются. Историю задним числом кабинет не отдаёт, терять её нельзя. */
export function merge(existing: EbRow[], fresh: EbRow[]): EbRow[] {
  const days = new Set(fresh.map((r) => r.date));
  const kept = existing.filter((r) => !days.has(r.date));
  return [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.art.localeCompare(b.art));
}

function main(): void {
  const series = loadEbFromSnapshots();
  const fresh = toRows(series);
  if (!fresh.length) {
    console.log("eb-daily: снимков кабинета нет (tools/reakciya/data-cabinet пуст) - файл не трогаю");
    return;
  }
  const path = dp("eb_daily.ndjson");
  let existing: EbRow[] = [];
  if (existsSync(path)) {
    for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
      try { existing.push(JSON.parse(l) as EbRow); } catch { /* битая строка - мимо */ }
    }
  }
  const rows = merge(existing, fresh);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const days = new Set(rows.map((r) => r.date));
  const zero = rows.filter((r) => r.date === [...days].sort().pop() && r.eb_pct === 0).length;
  console.log(`eb_daily.ndjson: ${rows.length} строк, дней ${days.size}, в нуле на последний день ${zero}`);
}

if (process.argv[1]?.endsWith("eb-daily.ts")) main();
