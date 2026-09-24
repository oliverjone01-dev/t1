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
  baseDays: number; baseSpan: number; baseDirty: boolean;
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

/** Сдвиг, начиная с которого считаем, что разрыв пришёл. */
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
/** Сколько дней без прихода, чтобы сказать «не пришло». */
export const LATE_AFTER = 5;
/** Сдвиг, ниже которого считаем, что разрыв вернулся к базе. */
export const BACK_TO_BASE = 2;

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
 *  ЗАЧЕМ. До 23.09 поле oa_source у всех 514 строк равно ratio_2026-09-09: цена покупателя
 *  считалась по коэффициенту, замороженному на 09.09, потому что колонка marketing_oa_price
 *  появилась в выгрузке только 23.09 (за 20 и 21.09 её нет, за 19.09 файл вовсе в старом
 *  формате). Плато, собранное наполовину из выведенных дней и наполовину из снятых, было бы
 *  плато по двум разным базам. */
export const isExact = (r: CoinvRow): boolean => r.oa_source === "exact";
const coinvOf = (r: CoinvRow): number | undefined => r.coinv_paid_pct ?? r.coinv_pct;

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
): BaseInfo {
  const before = series.filter((p) => p.date < on);
  if (before.length < FLAT_DAYS) return { base: null, days: 0, span: 0, dirty: false };
  const clean = before.filter((p) => !moves.has(p.date));
  const use = clean.length >= FLAT_DAYS ? clean : before;
  const w = use.slice(Math.max(0, use.length - BASE_DAYS));
  return {
    base: r1(median(w.map((p) => p.gap))),
    from: w[0]!.date, to: w[w.length - 1]!.date,
    days: w.length,
    span: daysBetween(w[0]!.date, w[w.length - 1]!.date) + 1,
    dirty: use !== clean,
  };
}

/** Первое плато: FLAT_DAYS подряд наблюдаемых дней, размах не больше FLAT_RANGE, и самый
 *  низкий день окна уже не ниже ARRIVED. День общего сдвига магазина в окно не пускаем,
 *  и окно не имеет права перешагивать потерянный день. */
export function plateauOf(points: DayPoint[]): { from: string; day: number } | null {
  for (let i = 0; i + FLAT_DAYS <= points.length; i++) {
    const w = points.slice(i, i + FLAT_DAYS);
    if (w.some((p) => p.move)) continue;
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
export function earliestPlateau(points: DayPoint[], lastDate: string): string | null {
  if (!points.length) return null;
  // Хвост подряд идущих наблюдаемых суток на конец ряда.
  let run = 1;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i]!.day - points[i - 1]!.day > MAX_PLATEAU_GAP || points[i]!.move) break;
    run += 1;
  }
  if (points[points.length - 1]!.move) run = 0;
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
): BoostRow {
  const b = baseOf(series, item.on, new Set(moves.keys()));
  const row: BoostRow = {
    art: item.art, on: item.on, off: item.off,
    base: b.base, baseFrom: b.from, baseTo: b.to,
    baseDays: b.days, baseSpan: b.span, baseDirty: b.dirty,
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
  const plateau = plateauOf(pts);
  if (plateau) { row.plateauFrom = plateau.from; row.plateauDay = plateau.day; }
  else if (pts.length) row.plateauNotBefore = earliestPlateau(pts, pts[pts.length - 1]!.date) ?? undefined;
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
    if (!d || r.store_move === false) continue;
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
