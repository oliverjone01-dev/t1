// Слияние дневного среза соинвеста с тем, что уже лежит в data/coinv_daily.ndjson.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ. Съём привозит плоский срез (art, sku, seller, oa, coinv_pct, coinv_abs,
// src), а в репозитории лежит накопленный ряд с полями, которых в срезе нет: cap, in_panel,
// site_listed, observed. Простая дописка сломала бы ряд дважды: за уже накопленные дни
// появились бы вторые строки на тот же (день, артикул), и медиана контроля посчиталась бы по
// удвоенной группе; а за новые дни пропал бы флаг панели, и группа контроля молча выросла.
//
// ЧТО ДЕЛАЕТ. Ключ (дата, артикул). Строка среза обновляет соинвест и цену покупателя, но не
// стирает поля, которых в срезе нет: они переносятся из прежней строки того же дня, а флаг
// панели, если дня ещё не было, берётся с последнего дня, где он известен.
//
// ПОЧЕМУ СРЕЗ ГЛАВНЕЕ ПО ВЕЛИЧИНЕ. У него src = snapshot, то есть цена покупателя взята из
// кабинета. Сверка 24.09: за 23.09 совпали ВСЕ 498 строк до сотых, за 09.09 совпали 12 из 513
// при медиане расхождения 2.7 пункта и размахе от -8.3 до +24.3. Прежние строки за 09.09 были
// выведены из коэффициента (oa_source = ratio_2026-09-09), то есть модель, а не наблюдение.
//
// Запуск: npm run coinv:merge <файл среза>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dp } from "../../paths.js";

export interface SliceRow {
  date: string; art: string; sku?: string;
  seller?: number; oa?: number; coinv_pct?: number; coinv_abs?: number; src?: string;
}
export type StoredRow = Record<string, unknown> & { date: string; art: string };

/** Источник цены покупателя для строки среза: снимок кабинета это наблюдение. */
export const SLICE_SOURCE = "snapshot";

export function mergeCoinv(stored: StoredRow[], slice: SliceRow[]): { rows: StoredRow[]; added: number; updated: number; panelCarried: number } {
  const key = (d: string, a: string) => `${d}|${a}`;
  const by = new Map<string, StoredRow>();
  for (const r of stored) by.set(key(r.date, r.art), r);
  // Последний известный флаг панели по артикулу: панель это свойство товара, а не дня.
  const lastPanel = new Map<string, unknown>();
  for (const r of [...stored].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.in_panel !== undefined) lastPanel.set(r.art, r.in_panel);
  }
  let added = 0, updated = 0, panelCarried = 0;
  for (const s of slice) {
    const k = key(s.date, s.art);
    const prev = by.get(k);
    const row: StoredRow = { ...(prev ?? { date: s.date, art: s.art }) };
    if (s.sku != null) row.sku = s.sku;
    if (s.coinv_pct != null) row.coinv_paid_pct = s.coinv_pct;
    if (s.oa != null) row.site_paid = s.oa;
    if (s.seller != null) row.cap = s.seller;
    row.oa_source = SLICE_SOURCE;
    if (row.in_panel === undefined) {
      const p = lastPanel.get(s.art);
      // Товара не было в прежнем ряду вовсе: он есть в снимке цен, значит соинвест по нему
      // снимается ежедневно, а это и есть определение панели.
      row.in_panel = p === undefined ? true : p;
      if (p !== undefined) panelCarried++;
    }
    if (prev) updated++; else added++;
    by.set(k, row);
  }
  const rows = [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.art.localeCompare(b.art));
  return { rows, added, updated, panelCarried };
}

function main(): void {
  const src = process.argv[2];
  if (!src || !existsSync(src)) {
    console.log("coinv:merge <файл среза>: путь не указан или файла нет");
    process.exit(1);
  }
  const path = dp("coinv_daily.ndjson");
  const read = (p: string): any[] => readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const stored: StoredRow[] = existsSync(path) ? read(path) : [];
  const slice: SliceRow[] = read(src);
  const { rows, added, updated, panelCarried } = mergeCoinv(stored, slice);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const days = [...new Set(rows.map((r) => r.date))].sort();
  console.log(`coinv_daily.ndjson: ${rows.length} строк, дней ${days.length} (${days[0]}..${days[days.length - 1]});`
    + ` из среза добавлено ${added}, обновлено ${updated}, флаг панели перенесён у ${panelCarried}`);
}

if (process.argv[1]?.endsWith("coinv-merge.ts")) main();
