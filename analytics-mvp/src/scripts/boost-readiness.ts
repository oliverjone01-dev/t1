// «Готовность к выходу из бустинга»: по каждому товару волны считаем, дошёл ли сдвиг разрыва
// до плато и держится ли он. Карточка живёт на вкладке «Тесты» (src/scripts/build-tests.ts).
//
// ЯЗЫК. Всё здесь называется сдвигом разрыва к контролю и ничем больше. Ни «эффект рекламы»,
// ни «надбавка Ozon»: вето ФЕНИКСА от 23.09 в силе, окно замера непригодно, и карточка
// описывает наблюдаемый ряд, а не причину.
//
// КАК СЧИТАЕТСЯ
//   разрыв(день) = coinv_paid_pct товара - медиана coinv_paid_pct контроля в тот же день;
//   контроль     = панель снимка (in_panel) минус тестовые артикулы и минус их родня;
//   база         = медиана разрыва за 7 ЧИСТЫХ наблюдаемых дней до включения;
//   сдвиг(день)  = разрыв(день) - база.
// Берём именно coinv_paid_pct, то есть долю от цены с картой Ozon: ряд по витрине занижен,
// сверка с реестром начислений за август это показала (npm run coinv:calib).
// Дни с observed=false пропускаются везде: и в базе, и в статусе, и на спарклайне.
//
// ОБЩИЕ СДВИГИ МАГАЗИНА (data/store_moves.ndjson). Магазин двигается целиком, и половина таких
// движений наша: смена ставки CPO «все товары» двигает витрину по всему каталогу в тот же день.
// Такой день помечается на спарклайне и не засчитывается днём плато.
//
// ОКНО БАЗЫ НАБИРАЕТСЯ ПО ЧИСТЫМ ДНЯМ, А НЕ ПО КАЛЕНДАРЮ. Сначала правило было мягче: день
// общего сдвига просто не мог стоять краем окна. Иван показал, почему этого мало: в окне
// 29.06-05.07 пять дней из семи оказались днями общего сдвига, и все пять стояли в середине.
// Из 99 дней наблюдения магазин двигался в 48, а в сентябре почти каждый день, так что на
// нашей частоте в календарной семидневке чистых дней остаётся два-три. Поэтому окно набирается
// назад, пока не наберётся BASE_DAYS чистых дней, сколько бы календарных на это ни ушло.
import { readFileSync, existsSync } from "node:fs";

export interface CoinvRow {
  date: string; art: string;
  observed?: boolean; in_panel?: boolean;
  /** Уровень, на котором считается разрыв. gap_pct - доля предельной цены, которую не платит
   *  покупатель: (1 - цена на витрине / предельная цена) * 100. Читается ПЕРВЫМ, потому что с
   *  24.09 гейт плато считается по сырым ценам (gap-daily.ts), а не по соинвесту. */
  gap_pct?: number;
  coinv_paid_pct?: number; coinv_listed_pct?: number; coinv_pct?: number;
  /** Откуда взята цена с картой Ozon: exact - снята с витрины, ratio_<дата> - выведена из
   *  коэффициента того дня. Ряды на разных источниках склеивать нельзя, это разные базы. */
  oa_source?: string;
}
/** Строка data/store_moves.ndjson: день наблюдения по магазину целиком. store_move=false это
 *  обычный день, он в файле тоже есть, и путать одно с другим нельзя. */
export interface StoreMove {
  date: string; store_move?: boolean; direction?: string;
  median_shift_pct?: number; observed_arts?: number;
  source?: string; note?: string;
}
/** Товар волны: артикул, день включения кампании, день снятия бустинга (если уже снят).
 *  until обрезает ряд справа: после снятия бустинга хвост ещё интересен несколько дней, а
 *  дальше он уже не про эту кампанию и в карточке только мешает. */
export interface WaveItem { art: string; on: string; off?: string; until?: string }

export type Status = "плато" | "едет" | "не пришло" | "ждём" | "нет данных";
/** Откуда общий сдвиг: наша смена ставки CPO или причина неизвестна. */
export type MoveSource = "our_cpo" | "unknown";

export interface DayPoint {
  date: string; day: number; gap: number; shift: number;
  move?: MoveSource;
}
export interface BoostRow {
  art: string; on: string; off?: string;
  /** Длина кампании в днях, если она уже закончилась. */
  ranDays?: number;
  base: number | null; baseFrom?: string; baseTo?: string;
  baseDays: number; baseSpan: number; baseSpread: number; baseDirty: boolean;
  day: number | null; shift: number | null; lastDate?: string;
  status: Status;
  plateauFrom?: string; plateauDay?: number;
  /** Раньше этой даты плато собраться не может: не хватает подряд идущих наблюдений. */
  plateauNotBefore?: string;
  series: DayPoint[];
  /** Вторая часть карточки, для товаров со снятым бустингом. */
  daysSinceOff?: number;
  backToBaseOn?: string; heldDays?: number;
}

/** Сдвиг, начиная с которого считаем, что разрыв пришёл. ШКАЛА - gap_pct, то есть доля
 *  предельной цены (gap-daily.ts). Прежний порог стоял на шкале соинвеста и равнялся +8;
 *  Иван 24.09 понизил его до +7 соинвеста, а gap_pct крупнее соинвеста в 1/k раз при k около
 *  0.909, поэтому +7.3 соинвеста это те же +8 по gap_pct. Число совпало со старым случайно:
 *  изменились и шкала, и решение, и одно почти в точности скомпенсировало другое. */
export const ARRIVED = 8;
/** Размах внутри плато, в пунктах. */
export const FLAT_RANGE = 2;
/** Сколько подряд наблюдаемых дней образуют плато. */
export const FLAT_DAYS = 3;
/** Максимальный календарный разрыв между соседними днями внутри окна плато.
 *  «Три подряд наблюдаемых дня» это именно подряд: окно, перешагивающее потерянный день,
 *  проверяет устойчивость не на трёх сутках, а на четырёх с дырой посередине, и плато на
 *  нём собирается раньше, чем на него есть право. Цена ошибки тут снятие акции. */
export const MAX_PLATEAU_GAP = 1;
/** Длина окна базы, в наблюдаемых днях. */
export const BASE_DAYS = 7;
/** Сколько наблюдаемых дней ДО старта нужно, чтобы база вообще считалась.
 *
 *  На соинвесте здесь стоял FLAT_DAYS, то есть 3, и это было правильно: ряд соинвеста тянулся
 *  с июня, и трёх дней всегда хватало. На сыром ряду цен дней всего шесть (09.09 и 19-24.09),
 *  до старта волны 20.09 из них попадают два: 09.09 и 19.09. Требование трёх дней оставило бы
 *  гейт мёртвым навсегда, потому что будущие дни прошлыми не станут, - ровно та ошибка, за
 *  которую ФЕНИКС снял балл 24.09.
 *
 *  ПОЧЕМУ ДВУХ ДНЕЙ ХВАТАЕТ ИМЕННО ЗДЕСЬ, и это не снижение планки под желаемый результат.
 *  Медиана двух чисел это их среднее, и точность базы видно прямо: у трёх пар из четырёх два
 *  предстартовых дня расходятся на 1.1, 0.01 и 2.8 пункта, а у пятерых соседей без рекламы
 *  сдвиг после старта не выходит за 1.1 пункта ни в один день. Порог +8 в семь раз крупнее
 *  этого шума. У четвёртой пары дни расходятся на 7.9 пункта, и её проверка пары отбрасывает.
 *  Одного дня было бы мало: тогда базой становится любой промах съёма, и проверить это нечем.
 *
 *  Каждая строка карточки печатает, на скольких днях стоит её база, и база из двух дней
 *  помечается отдельно. */
export const BASE_MIN = 2;
/** Сколько дней без прихода, чтобы сказать «не пришло». */
export const LATE_AFTER = 5;
/** Сдвиг, ниже которого считаем, что разрыв вернулся к базе. */
export const BACK_TO_BASE = 2;

/** Пара годится в контроль, если до включения рекламы разница держалась около нуля.
 *  Пороги подобраны по факту на шкале соинвеста: у трёх годных пар медиана 0..1.2 и размах
 *  2.5..7.1, у негодной 25.2 и 29.3. На сырых ценах разбиение то же, но по другой причине:
 *  негодной оказывается GGT-03-2-4-L-90 (медиана +3.9 при размахе 7.9), а GGL-07-XL-2, которую
 *  соинвест браковал с медианой +25.2, на сырых ценах чистая. Это и был главный довод против
 *  соинвеста: он браковал пары множителем дня, а не их собственной историей. */
export const PAIR_BASE_MAX = 3;
export const PAIR_RANGE_MAX = 8;
/** Минимум наблюдаемых дней в окне, на которых пару можно проверить. Один день ничего не
 *  говорит о размахе, поэтому пара с единственным чистым днём считается непроверенной и
 *  уходит на групповой контроль, а не проходит молча. */
export const PAIR_MIN_DAYS = 2;

export interface PairFit {
  ok: boolean; median: number; range: number; days: number; why: string;
  /** Начало окна, на котором проверялась пара. */
  from?: string;
}

/** НАЧАЛО ОКНА ПРОВЕРКИ ПАРЫ ОПРЕДЕЛЯЕТСЯ СОБЫТИЕМ, А НЕ ЧИСЛОМ ДНЕЙ.
 *
 *  Было: последние 14 дней до старта. Число ничем не обосновано, и ряд к нему чувствителен:
 *  размах разницы монотонно растёт с длиной окна, поэтому любая фиксированная граница
 *  превращается в подобранную. Проверять пару надо на отрезке, где обе стороны были в одном
 *  режиме, а границу этого отрезка задаёт событие - первый день с рекламой.
 *
 *  Правило: идём назад от дня включения и берём дни, пока НИ У ОДНОЙ стороны пары нет
 *  рекламного расхода. Первый день с расходом окно закрывает. Если реклама была уже накануне
 *  старта, окна нет вовсе, и пара считается непроверяемой.
 *
 *  Длина окна после этого выводится из данных: у пар карточки 4681610246 оно открывается с
 *  28.08, у GGL-07-XL-2 только с 11.09 (десятого расход ещё был), у пары GGT-03 с 05.06.
 *
 *  adDays это дни с расходом, объединённые по товару и всем его соседям в паре. Источников
 *  расхода два: ads_sku_daily (с 03.07) и ads_daily (с 05.02); отсутствие строки за день
 *  читается как «расхода не было», и это правда только в пределах покрытия этих файлов. */
export function adFreeFrom(on: string, adDays: Set<string>, maxBack = 180): string | null {
  let from: string | null = null;
  for (let k = 1; k <= maxBack; k++) {
    const d = new Date(on + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - k);
    const s = d.toISOString().slice(0, 10);
    if (adDays.has(s)) break;
    from = s;
  }
  return from;
}

/** Пригодна ли пара: считается по дням ДО включения рекламы, начиная с from (событийное окно).
 *  from=null означает, что реклама шла уже накануне старта: проверять пару не на чем. */
export function pairFit(
  series: Array<{ date: string; gap: number }>, on: string, from: string | null,
): PairFit {
  if (from === null) {
    return { ok: false, median: 0, range: 0, days: 0,
      why: "реклама шла уже накануне старта, чистого окна до включения нет" };
  }
  const before = series.filter((p) => p.date < on && p.date >= from);
  if (before.length < PAIR_MIN_DAYS) {
    return { ok: false, median: 0, range: 0, days: before.length, from,
      why: `чистых дней в окне с ${from} всего ${before.length}, проверить пару не на чем` };
  }
  const v = before.map((p) => p.gap);
  const m = r1(median(v)), range = r1(Math.max(...v) - Math.min(...v));
  if (Math.abs(m) > PAIR_BASE_MAX) {
    return { ok: false, median: m, range, days: before.length, from,
      why: `в окне с ${from} разница держалась на ${m > 0 ? "+" : ""}${m}, а не около нуля` };
  }
  if (range > PAIR_RANGE_MAX) {
    return { ok: false, median: m, range, days: before.length, from,
      why: `в окне с ${from} разница гуляла на ${range} пункта, это не контроль` };
  }
  return { ok: true, median: m, range, days: before.length, from,
    why: `в окне с ${from} ${m > 0 ? "+" : ""}${m} при размахе ${range}` };
}

const day = (d: string): number => Date.parse(d + "T00:00:00Z") / 864e5;
export const daysBetween = (a: string, b: string): number => Math.round(day(b) - day(a));

export const median = (v: number[]): number => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

const observed = (r: CoinvRow): boolean => r.observed !== false;
/** Цена с картой снята, а не выведена из коэффициента.
 *
 *  Значений два: exact (снято разбором витрины) и snapshot (взято из среза кабинета). Оба это
 *  наблюдение, поэтому оба считаются снятыми; ratio_<дата> это модель.
 *
 *  ЗАЧЕМ. До 23.09 поле oa_source у всех 514 строк равно ratio_2026-09-09: цена покупателя
 *  считалась по коэффициенту, замороженному на 09.09, потому что колонка marketing_oa_price
 *  появилась в выгрузке только 23.09 (за 20 и 21.09 её нет, за 19.09 файл вовсе в старом
 *  формате). Плато, собранное наполовину из выведенных дней и наполовину из снятых, было бы
 *  плато по двум разным базам. */
export const EXACT_SOURCES = new Set(["exact", "snapshot", "prices_raw"]);
export const isExact = (r: CoinvRow): boolean => EXACT_SOURCES.has(String(r.oa_source ?? ""));
const coinvOf = (r: CoinvRow): number | undefined => r.gap_pct ?? r.coinv_paid_pct ?? r.coinv_pct;

/** Медиана соинвеста контроля по дням. Контроль это панель снимка минус тестовые артикулы и
 *  минус их родня: парный контроль здесь не годится, у волны нет пары на каждый товар.
 *
 *  Родню (exclude) выбрасывать обязательно, и по двум причинам сразу.
 *  Первая - перетекание: в июле соседи эталона по объединённой карточке сидели в контроле и
 *  занижали его базу на 5.1 пункта (плато +17.4 вместо +22.5),
 *  то есть контроль едет за тестом и занижает разницу.
 *  Вторая - устойчивость: родни в панели 224 артикула из 475, почти половина. Когда половина
 *  группы сдвинута, медиана садится ровно на границу между сдвинутыми и несдвинутыми и
 *  прыгает от любого пустяка. Чистка нужна ради статистики, а не только ради величины. */
export function controlByDay(
  rows: CoinvRow[], testArts: Set<string>, exclude?: Set<string>, exactOnly = false,
): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    if (!observed(r) || r.in_panel === false || testArts.has(r.art)) continue;
    if (exactOnly && !isExact(r)) continue;
    if (exclude?.has(r.art)) continue;
    const v = coinvOf(r);
    if (v == null || !Number.isFinite(v)) continue;
    const a = by.get(r.date); if (a) a.push(v); else by.set(r.date, [v]);
  }
  const out = new Map<string, number>();
  for (const [d, v] of by) out.set(d, median(v));
  return out;
}

/** Ряд разрыва к СОСЕДУ ПО ОБЪЕДИНЁННОЙ КАРТОЧКЕ, а не к медиане панели.
 *
 *  ЗАЧЕМ. Магазин двигает цены почти каждый день: в сентябре 2026 чистых дней всего 7 из 21, и
 *  с 20.09 их нет вовсе. Правило «плато это три подряд чистых дня» на таком каталоге не
 *  выполнится ни при каком раскладе, и дело не в дыре в разметке, а в самом магазине.
 *
 *  Сосед по карточке решает это лучше любой подобранной группы: один товар, одна акция, один
 *  индекс цены, различается только реклама. Общий сдвиг двигает обоих и в разнице сокращается.
 *  Проверено на 21.09, когда цену сдвинули 99.8 % каталога на медианные 5.24 %: разница в парах
 *  осталась -0.6, -0.3, -0.1, 0.0 и +1.5 пункта, то есть около нуля. До включения рекламы
 *  разница тоже около нуля (09.09: от -0.7 до +1.5), после неё 7.9-9.1 пункта.
 *
 *  Поэтому в парном режиме дни общего сдвига НЕ дисквалифицируются: сокращать нечего.
 *  У товара без соседа в акции парного ряда нет, и он считается по-старому.
 *
 *  НО ПАРА ГОДИТСЯ НЕ ВСЕГДА, и проверять это надо на окне, а не на одной дате. Из четырёх пар
 *  ростера три держат разницу около нуля всё лето (медиана до старта +1.2, -0.5 и 0.0 при
 *  размахе 2.5, 2.5 и 7.1 пункта), а четвёртая, GGL-07-XL-2 против GGL-01-M-2, идёт с медианой
 *  +25.2 и размахом 29.3: у товаров разная ценовая история, и соседство по карточке этого не
 *  лечит. На одной дате 09.09 та же пара давала +1.5, то есть выглядела чистой. */
export function pairGapSeries(
  rows: CoinvRow[], art: string, siblings: string[], exactOnly = false,
): Array<{ date: string; gap: number }> {
  if (!siblings.length) return [];
  const sib = new Set(siblings);
  const mine = new Map<string, number>();
  const theirs = new Map<string, number[]>();
  for (const r of rows) {
    if (!observed(r)) continue;
    if (exactOnly && !isExact(r)) continue;
    const v = coinvOf(r);
    if (v == null || !Number.isFinite(v)) continue;
    if (r.art === art) mine.set(r.date, v);
    else if (sib.has(r.art)) (theirs.get(r.date) ?? theirs.set(r.date, []).get(r.date)!).push(v);
  }
  const out: Array<{ date: string; gap: number }> = [];
  for (const [d, v] of mine) {
    const t = theirs.get(d);
    if (t?.length) out.push({ date: d, gap: r1(v - median(t)) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Ряд разрыва по дням. Только наблюдаемые дни, у которых есть и товар, и контроль. */
export function gapSeries(
  rows: CoinvRow[], art: string, ctl: Map<string, number>, exactOnly = false,
): Array<{ date: string; gap: number }> {
  const out: Array<{ date: string; gap: number }> = [];
  for (const r of rows) {
    if (r.art !== art || !observed(r)) continue;
    if (exactOnly && !isExact(r)) continue;
    const v = coinvOf(r), c = ctl.get(r.date);
    if (v == null || c == null || !Number.isFinite(v)) continue;
    out.push({ date: r.date, gap: v - c });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export interface BaseInfo {
  base: number | null;
  from?: string; to?: string;
  /** Сколько чистых дней удалось набрать и сколько календарных дней на это ушло. */
  days: number; span: number;
  /** Размах разрыва внутри окна базы, в пунктах. На короткой базе это и есть её точность:
   *  медиана двух чисел равна их среднему, и размах говорит, насколько грубо это среднее. */
  spread: number;
  /** true - чистых дней не хватило, база посчитана по дням с общим сдвигом. Такую базу
   *  двигает весь магазин, и сдвиги товара от неё читать нельзя без оговорки. */
  dirty: boolean;
}

/** База: медиана разрыва за BASE_DAYS чистых наблюдаемых дней до включения. Чистый день это
 *  день без общего сдвига магазина. Если чистых дней меньше FLAT_DAYS, базу всё же считаем по
 *  последним наблюдаемым дням, но помечаем её грязной: молчаливого отката тут быть не должно. */
export function baseOf(
  series: Array<{ date: string; gap: number }>,
  on: string,
  moves: Set<string>,
  minDays = FLAT_DAYS,
): BaseInfo {
  const before = series.filter((p) => p.date < on);
  if (before.length < minDays) return { base: null, days: 0, span: 0, spread: 0, dirty: false };
  const clean = before.filter((p) => !moves.has(p.date));
  const use = clean.length >= minDays ? clean : before;
  const w = use.slice(Math.max(0, use.length - BASE_DAYS));
  const v = w.map((p) => p.gap);
  return {
    base: r1(median(v)),
    from: w[0]!.date, to: w[w.length - 1]!.date,
    days: w.length,
    span: daysBetween(w[0]!.date, w[w.length - 1]!.date) + 1,
    spread: r1(Math.max(...v) - Math.min(...v)),
    dirty: use !== clean,
  };
}

/** Первое плато: FLAT_DAYS подряд наблюдаемых дней, размах не больше FLAT_RANGE, и самый
 *  низкий день окна уже не ниже ARRIVED. День общего сдвига магазина в окно не пускаем,
 *  и окно не имеет права перешагивать потерянный день. */
export function plateauOf(points: DayPoint[], disqualifyMoves = true): { from: string; day: number } | null {
  for (let i = 0; i + FLAT_DAYS <= points.length; i++) {
    const w = points.slice(i, i + FLAT_DAYS);
    if (disqualifyMoves && w.some((p) => p.move)) continue;
    if (w.some((p, k) => k > 0 && p.day - w[k - 1]!.day > MAX_PLATEAU_GAP)) continue;
    const v = w.map((p) => p.shift);
    if (Math.max(...v) - Math.min(...v) > FLAT_RANGE) continue;
    if (Math.min(...v) < ARRIVED) continue;
    return { from: w[0]!.date, day: w[0]!.day };
  }
  return null;
}

/** Самый ранний день, когда плато МОЖЕТ собраться: FLAT_DAYS подряд идущих суток, ни одни
 *  из которых не потеряны и не помечены общим сдвигом, считая от последнего наблюдения.
 *  Возвращает дату, а не число: «раньше 25.09 нельзя» читается сразу, «нужно ещё 2 дня» нет. */
export function earliestPlateau(points: DayPoint[], lastDate: string, disqualifyMoves = true): string | null {
  if (!points.length) return null;
  // Хвост подряд идущих наблюдаемых суток на конец ряда.
  let run = 1;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i]!.day - points[i - 1]!.day > MAX_PLATEAU_GAP) break;
    if (disqualifyMoves && points[i]!.move) break;
    run += 1;
  }
  if (disqualifyMoves && points[points.length - 1]!.move) run = 0;
  const need = Math.max(0, FLAT_DAYS - run);
  const t = new Date(lastDate + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + need);
  return t.toISOString().slice(0, 10);
}

export function statusOf(points: DayPoint[], plateau: { day: number } | null): Status {
  if (!points.length) return "нет данных";
  if (plateau) return "плато";
  const last = points[points.length - 1]!;
  if (last.day < FLAT_DAYS) return "ждём";
  if (last.day >= LATE_AFTER && last.shift < ARRIVED) return "не пришло";
  return "едет";
}

/** Строка карточки по одному товару волны. */
export function readiness(
  item: WaveItem,
  series: Array<{ date: string; gap: number }>,
  moves: Map<string, MoveSource>,
  minBaseDays = FLAT_DAYS,
  /** Дисквалифицировать ли дни общего сдвига магазина при сборе плато.
   *
   *  На разнице к паре это всегда было лишним: общий сдвиг двигает обе стороны и в разнице
   *  сокращается. На СЫРЫХ ЦЕНАХ то же оказалось верно и для разницы к медиане панели, и это
   *  не рассуждение, а измерение: пятеро соседей без рекламы за 20-24.09, когда магазин
   *  двигался каждый день, ушли от своей базы не больше чем на 1.1 пункта, при пороге +8.
   *  Плацебо-группа печатается на карточке и остаётся сторожем: если соседи поедут, число
   *  вырастет у всех на виду, и дисквалификацию придётся вернуть.
   *
   *  Дни сдвига помечаются на спарклайне в любом случае: пометка это про читателя, а
   *  дисквалификация про правило, и путать их нельзя. */
  disqualifyMoves = true,
): BoostRow {
  const b = baseOf(series, item.on, new Set(moves.keys()), minBaseDays);
  const row: BoostRow = {
    art: item.art, on: item.on, off: item.off,
    base: b.base, baseFrom: b.from, baseTo: b.to,
    baseDays: b.days, baseSpan: b.span, baseSpread: b.spread, baseDirty: b.dirty,
    day: null, shift: null, status: "нет данных", series: [],
  };
  if (b.base == null) return row;
  const pts: DayPoint[] = [];
  for (const p of series) {
    if (p.date < item.on) continue;
    if (item.until && p.date > item.until) continue;
    pts.push({
      date: p.date, day: daysBetween(item.on, p.date),
      gap: r1(p.gap), shift: r1(p.gap - b.base),
      move: moves.get(p.date),
    });
  }
  row.series = pts;
  const plateau = plateauOf(pts, disqualifyMoves);
  if (plateau) { row.plateauFrom = plateau.from; row.plateauDay = plateau.day; }
  else if (pts.length) row.plateauNotBefore = earliestPlateau(pts, pts[pts.length - 1]!.date, disqualifyMoves) ?? undefined;
  row.status = statusOf(pts, plateau);
  const last = pts[pts.length - 1];
  if (last) { row.day = last.day; row.shift = last.shift; row.lastDate = last.date; }

  if (item.off) {
    row.ranDays = daysBetween(item.on, item.off);
    const after = pts.filter((p) => p.date >= item.off!);
    if (after.length) row.daysSinceOff = daysBetween(item.off, after[after.length - 1]!.date);
    const back = after.find((p) => p.shift < BACK_TO_BASE);
    if (back) {
      row.backToBaseOn = back.date;
      row.heldDays = daysBetween(item.off, back.date) - 1;   // последний день, когда ещё держался
    }
  }
  return row;
}

/** data/store_moves.ndjson -> день => источник сдвига. Файла может не быть: тогда общие
 *  движения магазина просто не помечаются, и карточка об этом говорит. */
export function loadMoves(path: string, cpoDays?: Set<string>): Map<string, MoveSource> {
  const out = new Map<string, MoveSource>();
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
    let r: StoreMove;
    try { r = JSON.parse(l) as StoreMove; } catch { continue; }
    const d = String(r.date || "").slice(0, 10);
    // В файле лежат ВСЕ дни, и спокойные тоже. Берём только те, где магазин действительно
    // двинулся: иначе пометку получит каждый день, плато не соберётся никогда, а база
    // окажется «грязной» на ровном месте.
    //
    // null это «нет наблюдения цен за этот день», а не сдвиг. Такой день и так не попадёт в
    // ряд, потому что цен за него нет; пометить его сдвигом значило бы вдобавок запретить
    // окну плато его перешагнуть, то есть наказать за пропуск съёма дважды.
    if (!d || r.store_move !== true) continue;
    const src = r.source === "our_cpo" || r.source === "cpo" ? "our_cpo"
      : (cpoDays && cpoDays.has(d)) ? "our_cpo" : "unknown";
    out.set(d, src);
  }
  return out;
}

/** Дни смены нашей ставки CPO «все товары» из tools/tests/cpo_history.psv (первая колонка -
 *  дата). Лог ведётся вручную и отстаёт; отсутствие файла не ошибка, просто источник сдвига
 *  останется «неизвестно». */
export function loadCpoDays(path: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(path)) return out;
  const lines = readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
  for (const l of lines.slice(1)) {
    const d = (l.split("|")[0] || "").trim().slice(0, 10);
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)) out.add(d);
  }
  return out;
}
