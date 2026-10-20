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
import { dirname, join } from "node:path";
import type { CoinvRow } from "./boost-readiness.js";

export const GAP_DAILY_FILE = "gap_daily.ndjson";
/** Ручные снятия ложных стопов (Иван 20.10, вариант «отдельный файл»): строка {date, art, reason, by, ts}, по одной
 *  на (день, артикул). Мак пишет gap_daily своей копией дважды в день и стирает метки no_site (подтверждено
 *  автокоммитом 19.10 20:50, ФЕНИКС #488 W1), а этот файл он не трогает, поэтому запись переживает срезы.
 *  Чтение (readGapMarked) ставит такой строке gap_daily метку no_site, как будто она лежит в файле: метка
 *  главнее истории, стоп теста 4 и чип плана гаснут. Запись делает аналитик (автор ветки) после проверки
 *  карточки на витрине: `{"date":"2026-10-19","art":"GGK-02-3-3-80","reason":"сбой витрины","by":"...","ts":"..."}`. */
export const GAP_MANUAL_FILE = "gap_manual.ndjson";

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
  /** «Нет данных»: цена на сайте равна нашей у карточки без истории разрыва (витрина не снята или карточка только
   *  опубликована). Метку ставит скрипт правки данных (v8/fix_nodata_1610.py) или markNoSite при чтении. */
  no_site?: boolean;
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
  /** Строки без витрины у карточек без истории: «нет данных», а не ноль (см. markNoSite). */
  noSite: number;
  /** Системные дни: цена сайта равна нашей у NO_SITE_DAY_SHARE строк дня и больше - все строки дня без витрины
   *  «нет данных», ненулевые остаются (Иван 19.10 по K2 ФЕНИКСА). Читатель должен написать warning, а не молчать. */
  systemDays: string[];
  /** Дни с долей строк без витрины от NO_SITE_DAY_WARN до NO_SITE_DAY_SHARE: значения как есть, но читатель пишет
   *  warning - частичный сбой витрины, при котором нули у зрелых карточек могут быть ложными (как SAME_BEFORE_WARN
   *  у снимка цен API). */
  warnDays: string[];
  /** Строки, снятые вручную через GAP_MANUAL_FILE. */
  manual: number;
}

const EMPTY: GapRead = { exists: false, rows: [], days: [], bySrc: new Map(), withOa: 0, bad: 0, noSite: 0, systemDays: [], warnDays: [], manual: 0 };

/** Системный день (K2 ФЕНИКСА iter4, Иван 19.10 «да, 90% дня = нет данных»): если цена сайта равна нашей у
 *  NO_SITE_DAY_SHARE строк дня и больше, это сбой витрины или съёма, а не 10 карточек теста и 29 карточек плана,
 *  разом выпавших из доплаты. Тогда все такие строки дня - «нет данных» независимо от истории, стопы и чипы
 *  молчат, читатель пишет warning. То же правило для снимка цен API (prices-daily.ts NO_BEFORE_SHARE 0,9).
 *  Нижняя граница NO_SITE_DAY_MIN: правило дня только при полном срезе, иначе срез из одной новой карточки
 *  стал бы «системным днём». История [ДАННЫЕ, gap_daily и coinv_daily на 19.10]: строк в дне 460-516, доля
 *  таких строк максимум 1,9 % (16.10, 9 новых GGT-03-5-1 из 473) - ни один прошлый день правило не задевает. */
export const NO_SITE_DAY_SHARE = 0.9;
/** Нижняя граница - допущение автора [ГИПОТЕЗА], не решение Ивана: срез мака всегда 460-516 строк, у снимка цен API
 *  такой границы нет. */
export const NO_SITE_DAY_MIN = 50;
/** Зона предупреждения: доля от NO_SITE_DAY_WARN до NO_SITE_DAY_SHARE - значения как есть, warning читателю. */
export const NO_SITE_DAY_WARN = 0.15;

/** Строка, в которой цена на сайте равна нашей: разрыв 0 или site_to_seller 1. Сам по себе это ещё не «нет
 *  данных»: решает история артикула (markNoSite). */
const hasGap = (r: GapRow): boolean => r.gap_pct != null && r.gap_pct !== ("" as unknown) && Number.isFinite(Number(r.gap_pct));
export const priceEqualsOurs = (r: GapRow): boolean =>
  (hasGap(r) && Number(r.gap_pct) === 0) || Number(r.site_to_seller) >= 0.9999;
/** Витрина в строке не снята: метка или равенство цен. Нужен для правила «повтор дня не стирает снятое». */
const siteMissing = (r: GapRow): boolean => r.no_site === true || priceEqualsOurs(r);

/** «Нет данных» - это только метка no_site. Её ставит писатель (скрипт правки данных v8/fix_nodata_1610.py) или
 *  markNoSite при чтении, по правилу Ивана 19.10: ноль при цене сайта, равной нашей, это «нет данных» ТОЛЬКО У
 *  КАРТОЧКИ БЕЗ ИСТОРИИ - пока у артикула не было ни одного прежнего дня с ненулевым разрывом. Так бывает в
 *  первые день-два новой карточки: SKU ещё нет или карточка только опубликована, назавтра у тех же товаров
 *  46-53 % (все 14 строк ряда такие: 9 GGT-03-5-1 16.10, GGT-47-5-1-80 10-11.10, GGT-47-5-1-90 12.10,
 *  GGT-03-5-1-O-20090 и GGT-20-5-1-20090 20.09; нулей у зрелых карточек 0 из 13 401 строки [ДАННЫЕ, gap_daily
 *  19.10]). У карточки с историей ноль остаётся нулём: это стоп-сигнал теста 4 «разрыв обвалился к нулю»
 *  (build-tests.ts) и чип плана «OZON не доплачивает?» (plan-tab.ts). Список акций acts_daily стоп не заменяет:
 *  у 50 выходов из «Эластичного бустинга» разрыв ни разу не падал ниже 10 (ФЕНИКС 19.10, проба Z2).
 *  Правило то же, что в coinv-merge.ts (noSite по истории stored). Прямые читатели gap_daily (plan-tab.ts,
 *  build-tests.ts) берут строки через markNoSite и фильтруют этим предикатом - копий правила нет. */
export const noSite = (r: GapRow): boolean => r.no_site === true;

/** Одна строка на (день, артикул) и метка no_site по истории артикула. Чистая функция, входные объекты не меняет.
 *  - Съём утром и вечером (Иван 15.10): повтор заменяет прежнюю строку дня, иначе день товара считается дважды
 *    (К4). Побеждает последняя строка файла, кроме одного случая: повтор без витрины не стирает снятое значение
 *    того же дня (ФЕНИКС 16.10, проба M1) - это правило дня, история артикула на него не влияет. Грабли: мак
 *    заменяет строку дня в gap_daily сам, и до этого кода повтор не доходит; вечерний срез без витрины не должен
 *    заменять утренний в писателе на маке (W1, открыто Ивану).
 *  - История считается по всему файлу: был ли у артикула день РАНЬШЕ этой даты с ненулевым разрывом. Порядок
 *    строк в файле роли не играет, более поздний день историей не считается (первый день карточки - «нет
 *    данных», даже если назавтра 47 %). Готовая метка no_site из файла главнее истории - этим же снимается
 *    ложный стоп: если ноль у зрелой карточки оказался сбоем витрины, строке в gap_daily ставится no_site: true
 *    (скрипт v8/fix_nodata_1610.py этого не делает, он помечает только строки без истории), и стоп гаснет.
 *  - Системный день (NO_SITE_DAY_SHARE): все строки дня без витрины - «нет данных» независимо от истории. */
export function markNoSite(input: GapRow[]): GapRow[] { return markNoSiteEx(input).rows; }

/** То же, что markNoSite, плюс список системных дней (см. NO_SITE_DAY_SHARE). */
export function markNoSiteEx(input: GapRow[]): { rows: GapRow[]; systemDays: string[]; warnDays: string[] } {
  const last = new Map<string, GapRow>();
  for (const r of input) {
    const d = String(r.date || "").slice(0, 10);
    const art = String(r.art || "").trim();
    const k = `${d}|${art}`;
    const cur = last.get(k);
    if (cur && siteMissing(r) && !siteMissing(cur) && hasGap(cur)) continue;
    last.delete(k); last.set(k, r);
  }
  const firstNonZero = new Map<string, string>();
  for (const r of last.values()) {
    if (r.no_site === true || !hasGap(r) || Number(r.gap_pct) <= 0) continue;
    const d = String(r.date || "").slice(0, 10), art = String(r.art || "").trim();
    const f = firstNonZero.get(art);
    if (f === undefined || d < f) firstNonZero.set(art, d);
  }
  // Системный день: доля строк без витрины по дню, считается до правила истории.
  const dayTotal = new Map<string, number>(), dayMissing = new Map<string, number>();
  for (const r of last.values()) {
    const d = String(r.date || "").slice(0, 10);
    dayTotal.set(d, (dayTotal.get(d) ?? 0) + 1);
    if (siteMissing(r)) dayMissing.set(d, (dayMissing.get(d) ?? 0) + 1);
  }
  const systemDays = [...dayTotal.entries()]
    .filter(([d, n]) => n >= NO_SITE_DAY_MIN && (dayMissing.get(d) ?? 0) / n >= NO_SITE_DAY_SHARE)
    .map(([d]) => d).sort();
  const sysDay = new Set(systemDays);
  const warnDays = [...dayTotal.entries()]
    .filter(([d, n]) => n >= NO_SITE_DAY_MIN && !sysDay.has(d) && (dayMissing.get(d) ?? 0) / n >= NO_SITE_DAY_WARN)
    .map(([d]) => d).sort();
  const out: GapRow[] = [];
  for (const r of last.values()) {
    if (r.no_site === true || !priceEqualsOurs(r)) { out.push(r); continue; }
    const d = String(r.date || "").slice(0, 10), art = String(r.art || "").trim();
    const f = firstNonZero.get(art);
    out.push(f !== undefined && f < d && !sysDay.has(d) ? r : { ...r, no_site: true });
  }
  return { rows: out, systemDays, warnDays };
}

/** Ключи (день|артикул) ручных снятий из GAP_MANUAL_FILE рядом с gap_daily. Нет файла - нет снятий. */
export function readGapManual(dir: string): Set<string> {
  const p = join(dir, GAP_MANUAL_FILE);
  const out = new Set<string>();
  if (!existsSync(p)) return out;
  for (const l of readFileSync(p, "utf-8").split("\n").filter((x) => x.trim())) {
    try {
      const r = JSON.parse(l) as { date?: string; art?: string };
      const d = String(r.date || "").slice(0, 10), art = String(r.art || "").trim();
      if (d && art) out.add(`${d}|${art}`);
    } catch { /* битая строка ручного файла снятие не делает */ }
  }
  return out;
}

/** Строки gap_daily с метками: одна на (день, артикул), ручные снятия как метка файла, затем markNoSiteEx.
 *  Единственная точка входа для всех читателей файла (readGapDaily, plan-tab.ts, build-tests.ts) - копий нет. */
export function readGapMarked(path: string): { rows: GapRow[]; systemDays: string[]; warnDays: string[]; bad: number; manual: number } {
  if (!existsSync(path)) return { rows: [], systemDays: [], warnDays: [], bad: 0, manual: 0 };
  const manual = readGapManual(dirname(path));
  const parsed: GapRow[] = [];
  let bad = 0, manualN = 0;
  for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
    let r: GapRow;
    try { r = JSON.parse(l) as GapRow; } catch { bad += 1; continue; }
    const d = String(r.date || "").slice(0, 10);
    const art = String(r.art || "").trim();
    if (!d || !art) { bad += 1; continue; }
    if (manual.has(`${d}|${art}`) && r.no_site !== true) { r = { ...r, no_site: true }; manualN += 1; }
    parsed.push(r);
  }
  const m = markNoSiteEx(parsed);
  return { rows: m.rows, systemDays: m.systemDays, warnDays: m.warnDays, bad, manual: manualN };
}

export function readGapDaily(path: string): GapRead {
  if (!existsSync(path)) return EMPTY;
  const rows: CoinvRow[] = [];
  const bySrc = new Map<string, number>();
  const days = new Set<string>();
  let withOa = 0, noSiteN = 0;
  const marked = readGapMarked(path);
  let bad = marked.bad;
  for (const r of marked.rows) {
    const d = String(r.date || "").slice(0, 10);
    const art = String(r.art || "").trim();
    if (r.oa_used === true) { withOa += 1; continue; }
    if (noSite(r)) { noSiteN += 1; continue; }
    // Number(null) это 0, и он проходит проверку на конечность: пустое значение,
    // прочитанное как ноль, стало бы днём с нулевым разрывом, то есть выдумкой.
    if (r.gap_pct == null || r.gap_pct === ("" as unknown)) { bad += 1; continue; }
    const v = Number(r.gap_pct);
    if (!Number.isFinite(v)) { bad += 1; continue; }
    const src = String(r.src || "").trim() || "нет метки";
    bySrc.set(src, (bySrc.get(src) ?? 0) + 1);
    days.add(d);
    // in_panel здесь всегда true: файл и есть панель дня, других товаров в нём нет.
    // Ноль у карточки с историей проходит сюда как есть: честный 0, а не «нет данных».
    rows.push({ date: d, art, observed: true, in_panel: true, gap_pct: v, oa_source: src });
  }
  return { exists: rows.length > 0, rows, days: [...days].sort(), bySrc, withOa, bad, noSite: noSiteN, systemDays: marked.systemDays, warnDays: marked.warnDays, manual: marked.manual };
}
