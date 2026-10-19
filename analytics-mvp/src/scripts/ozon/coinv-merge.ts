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

/** Источник цены покупателя по умолчанию, если срез его не назвал. */
export const SLICE_SOURCE = "snapshot";

/** Метка источника берётся ИЗ СРЕЗА, а не штампуется константой.
 *
 *  24.09 ФЕНИКС показал, чем это плохо: строка, которая сама называет себя ratio_2026-09-09,
 *  выходила из слияния помеченной snapshot и проходила проверку «цена снята», то есть
 *  происхождение отмывалось. Метка это утверждение о том, откуда число, и придумывать его
 *  за источник нельзя. */
export const sourceOf = (s: SliceRow): string => String(s.src ?? "").trim() || SLICE_SOURCE;

export function mergeCoinv(stored: StoredRow[], slice: SliceRow[]): { rows: StoredRow[]; added: number; updated: number; panelCarried: number } {
  const key = (d: string, a: string) => `${d}|${a}`;
  const by = new Map<string, StoredRow>();
  for (const r of stored) by.set(key(r.date, r.art), r);
  // Последний известный флаг панели по артикулу: панель это свойство товара, а не дня.
  const lastPanel = new Map<string, unknown>();
  for (const r of [...stored].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.in_panel !== undefined) lastPanel.set(r.art, r.in_panel);
  }
  // История артикула по stored: первый день с ненулевым соинвестом. Нужна правилу «нет данных» ниже.
  const firstPaid = new Map<string, string>();
  for (const r of stored) {
    if (typeof r.coinv_paid_pct !== "number" || r.coinv_paid_pct <= 0) continue;
    const f = firstPaid.get(r.art);
    if (f === undefined || r.date < f) firstPaid.set(r.art, r.date);
  }
  let added = 0, updated = 0, panelCarried = 0;
  for (const s of slice) {
    const k = key(s.date, s.art);
    const prev = by.get(k);
    const row: StoredRow = { ...(prev ?? { date: s.date, art: s.art }) };
    // Пустой SKU среза не затирает известный: SKU это свойство товара, он не исчезает между съёмами.
    const skuKnown = String(row.sku ?? "").trim() !== "";
    if (s.sku != null && (String(s.sku).trim() || !skuKnown)) row.sku = s.sku;
    // Цена на сайте равна нашей (соинвест 0): витрину не сняли или карточка только опубликована. Это «нет данных»,
    // а не 0, ТОЛЬКО У КАРТОЧКИ БЕЗ ИСТОРИИ - пока у артикула не было в stored ни одного прежнего дня с ненулевым
    // соинвестом (Иван 16.10 «пиши нет данных», 19.10: со SKU или без, но только у карточки без истории разрыва).
    // Тогда поле не пишем, ставим метку no_site. У карточки с историей ноль пишется нулём: это стоп-сигнал
    // теста 4 и чип плана «выпал из бустинга?», список акций его не заменяет (ФЕНИКС 19.10, проба Z2). Правило
    // то же, что в gap-daily.ts (markNoSite).
    const sameAsOurs = s.oa != null && s.seller != null && Math.round(s.oa) === Math.round(s.seller);
    const siteMissing = s.coinv_pct === 0 || sameAsOurs;
    const prevHas = prev != null && typeof prev.coinv_paid_pct === "number" && prev.coinv_paid_pct > 0;
    if (siteMissing && prevHas) {
      // Срез без витрины поверх снятого значения того же дня (утро снято, вечер нет): значение, SKU, цену
      // сайта и источник не трогаем (ФЕНИКС 16.10, проба M1), обновляем только нашу цену. Это правило дня,
      // история артикула на него не влияет.
      if (s.seller != null) row.cap = s.seller;
      updated++; by.set(k, row);
      continue;
    }
    const hasHistory = (firstPaid.get(s.art) ?? "9999-99-99") < s.date;
    const noSite = siteMissing && !hasHistory;
    if (noSite) {
      // Повторный срез без витрины стирает прежний ложный 0 того же дня.
      delete row.coinv_paid_pct; row.no_site = true;
    } else {
      if (s.coinv_pct != null) row.coinv_paid_pct = s.coinv_pct;
      // Цена сайта равна нашей у карточки с историей, а соинвеста в срезе нет: разрыв 0 по определению.
      else if (sameAsOurs) row.coinv_paid_pct = 0;
      // Срез со снятой витриной (или честный ноль) снимает метку.
      delete row.no_site;
    }
    if (s.oa != null) row.site_paid = s.oa;
    if (s.seller != null) row.cap = s.seller;
    row.oa_source = sourceOf(s);
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
