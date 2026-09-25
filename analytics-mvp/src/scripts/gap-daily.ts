// data/gap_daily.ndjson - разрыв между предельной ценой продавца и ценой на витрине, по дням.
// Это ЕДИНСТВЕННЫЙ источник, на котором считается гейт плато (карточка выхода из акции в
// build-tests.ts). Соинвест из coinv_daily.ndjson остаётся для показа на странице.
//
// ПОЧЕМУ ГЕЙТ УШЁЛ С СОИНВЕСТА НА СЫРЫЕ ЦЕНЫ. Соинвест считался от цены с картой Ozon
// (marketing_oa_price). Проверка Ивана 24.09 на всех трёх наблюдаемых днях показала, что это
// цена на витрине, умноженная на одну константу дня:
//   09.09 oa/site = 0.9002 у 511 из 514; 23.09 - 0.9107 у 494 из 500; 24.09 - 0.9093 у 496 из 500.
// Скидка по карте плоская, 9-10 % на весь каталог, и поартикульной информации в ней нет. Всё,
// что она добавляла к ряду, это множитель дня, общий для теста и контроля, плюс риск
// подмешать модельные дни: до 23.09 колонки marketing_oa_price в выгрузке не было вовсе, и
// значения за неё выводились из коэффициента, замороженного на 09.09 (oa_source=ratio_*).
//
// ЧТО В ФАЙЛЕ. gap_pct = (1 - marketing_price / marketing_seller_price) * 100, то есть доля
// предельной цены, которую не платит покупатель. oa_used=false в каждой строке: цена с картой
// в расчёт не входит. Строки с oa_used=true, если такие однажды приедут, отбрасываются здесь
// же: смешивать шкалы в одном ряду нельзя, разница между ними это множитель дня.
//
// ШКАЛА. gap_pct крупнее соинвеста в 1/k раз, k около 0.909, потому что делится на предельную
// цену, а не на цену с картой. Пороги гейта заданы на шкале gap_pct (см. ARRIVED).
import { readFileSync, existsSync } from "node:fs";
import type { CoinvRow } from "./boost-readiness.js";

export const GAP_DAILY_FILE = "gap_daily.ndjson";

// ЧТО ИЗ ФАЙЛА НЕ ИДЁТ В РЕПОЗИТОРИЙ. Исходный срез Ивана нёс ещё site и seller, то есть цену
// на витрине и ПРЕДЕЛЬНУЮ ЦЕНУ продавца в рублях. Предельная цена в публичный репозиторий не
// едет - это то же правило, по которому в .gitignore лежит data-cabinet. В data/ остаётся
// отношение site_to_seller и посчитанный из него gap_pct: доля, а не рубли. Соинвест по
// артикулам публиковать разрешено (решение Ивана от 24.09), а это та же доля, вид сбоку.
// Гейт читает только gap_pct, так что обрезка ничего не ломает. Если срез однажды приедет с
// рублями, их надо снять перед коммитом, а не после.

export interface GapRow {
  date: string; art: string; sku?: string;
  /** Доля предельной цены, которую платит покупатель. Рублёвых цен в файле нет намеренно. */
  site_to_seller?: number;
  gap_pct?: number; src?: string; oa_used?: boolean;
}

export interface GapRead {
  exists: boolean;
  /** Ряд в том же виде, в котором его читают controlByDay / gapSeries / pairGapSeries. */
  rows: CoinvRow[];
  days: string[];
  /** Сколько строк по каждому источнику: snapshot - срез кабинета, prices_raw - суточная выгрузка. */
  bySrc: Map<string, number>;
  /** Строки, отброшенные потому, что в них замешана цена с картой. */
  withOa: number;
  /** Строки без gap_pct или с нечисловым значением. */
  bad: number;
}

const EMPTY: GapRead = { exists: false, rows: [], days: [], bySrc: new Map(), withOa: 0, bad: 0 };

export function readGapDaily(path: string): GapRead {
  if (!existsSync(path)) return EMPTY;
  const rows: CoinvRow[] = [];
  const bySrc = new Map<string, number>();
  const days = new Set<string>();
  let withOa = 0, bad = 0;
  for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
    let r: GapRow;
    try { r = JSON.parse(l) as GapRow; } catch { bad += 1; continue; }
    const d = String(r.date || "").slice(0, 10);
    const art = String(r.art || "").trim();
    if (!d || !art) { bad += 1; continue; }
    if (r.oa_used === true) { withOa += 1; continue; }
    // Number(null) это 0, и он проходит проверку на конечность: пустое значение,
    // прочитанное как ноль, стало бы днём с нулевым разрывом, то есть выдумкой.
    if (r.gap_pct == null || r.gap_pct === ("" as unknown)) { bad += 1; continue; }
    const v = Number(r.gap_pct);
    if (!Number.isFinite(v)) { bad += 1; continue; }
    const src = String(r.src || "").trim() || "нет метки";
    bySrc.set(src, (bySrc.get(src) ?? 0) + 1);
    days.add(d);
    // in_panel здесь всегда true: файл и есть панель дня, других товаров в нём нет.
    rows.push({ date: d, art, observed: true, in_panel: true, gap_pct: v, oa_source: src });
  }
  return { exists: rows.length > 0, rows, days: [...days].sort(), bySrc, withOa, bad };
}
