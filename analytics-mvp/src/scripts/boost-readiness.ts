// «Готовность к выходу из бустинга»: по каждому товару волны считаем, дошёл ли сдвиг разрыва
// до плато и держится ли он. Карточка живёт на вкладке «Тесты» (src/scripts/build-tests.ts).
//
// ЯЗЫК. Всё здесь называется сдвигом разрыва к контролю и ничем больше. Ни «эффект рекламы»,
// ни «надбавка Ozon»: вето ФЕНИКСА от 23.09 в силе, окно замера непригодно, и карточка
// описывает наблюдаемый ряд, а не причину.
//
// КАК СЧИТАЕТСЯ
//   разрыв(день) = coinv_paid_pct товара - медиана coinv_paid_pct контроля в тот же день;
//   контроль     = панель снимка (in_panel) минус тестовые артикулы;
//   база         = медиана разрыва за 7 наблюдаемых дней до включения;
//   сдвиг(день)  = разрыв(день) - база.
// Берём именно coinv_paid_pct, то есть долю от цены с картой Ozon: ряд по витрине занижен,
// сверка с реестром начислений за август это показала (npm run coinv:calib).
// Дни с observed=false пропускаются везде: и в базе, и в статусе, и на спарклайне.
//
// ОБЩИЕ СДВИГИ МАГАЗИНА (data/store_moves.ndjson, необязательный файл). Магазин двигается
// целиком, и половина таких движений наша: смена ставки CPO «все товары» двигает витрину по
// всему каталогу в тот же день. Такой день помечается на спарклайне, не засчитывается днём
// плато и не может стоять первым или последним в окне базы.
import { readFileSync, existsSync } from "node:fs";

export interface CoinvRow {
  date: string; art: string;
  observed?: boolean; in_panel?: boolean;
  coinv_paid_pct?: number; coinv_listed_pct?: number; coinv_pct?: number;
}
/** Строка data/store_moves.ndjson: день, когда витрина двинулась по всему каталогу. */
export interface StoreMove { date: string; source?: string; note?: string }
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
  base: number | null; baseFrom?: string; baseTo?: string; baseShifted: boolean;
  day: number | null; shift: number | null; lastDate?: string;
  status: Status;
  plateauFrom?: string; plateauDay?: number;
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
const coinvOf = (r: CoinvRow): number | undefined => r.coinv_paid_pct ?? r.coinv_pct;

/** Медиана соинвеста контроля по дням. Контроль это панель снимка минус тестовые артикулы:
 *  парный контроль здесь не годится, у волны нет пары на каждый товар. */
export function controlByDay(rows: CoinvRow[], testArts: Set<string>): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    if (!observed(r) || r.in_panel === false || testArts.has(r.art)) continue;
    const v = coinvOf(r);
    if (v == null || !Number.isFinite(v)) continue;
    const a = by.get(r.date); if (a) a.push(v); else by.set(r.date, [v]);
  }
  const out = new Map<string, number>();
  for (const [d, v] of by) out.set(d, median(v));
  return out;
}

/** Ряд разрыва по дням. Только наблюдаемые дни, у которых есть и товар, и контроль. */
export function gapSeries(rows: CoinvRow[], art: string, ctl: Map<string, number>): Array<{ date: string; gap: number }> {
  const out: Array<{ date: string; gap: number }> = [];
  for (const r of rows) {
    if (r.art !== art || !observed(r)) continue;
    const v = coinvOf(r), c = ctl.get(r.date);
    if (v == null || c == null || !Number.isFinite(v)) continue;
    out.push({ date: r.date, gap: v - c });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** База: медиана разрыва за BASE_DAYS наблюдаемых дней до включения. Окно двигается назад,
 *  пока его первый и последний день не окажутся обычными: день общего сдвига магазина на краю
 *  окна тянул бы базу за собой, а вместе с ней и все сдвиги товара. */
export function baseOf(
  series: Array<{ date: string; gap: number }>,
  on: string,
  moves: Set<string>,
): { base: number | null; from?: string; to?: string; shifted: boolean } {
  const before = series.filter((p) => p.date < on);
  if (before.length < FLAT_DAYS) return { base: null, shifted: false };
  const n = Math.min(BASE_DAYS, before.length);
  // Сначала ищем окно полной длины, двигая его назад; если такого нет (общий сдвиг стоит
  // слишком близко к включению), окно укорачивается, но не короче FLAT_DAYS.
  for (let size = n; size >= FLAT_DAYS; size--) {
    for (let end = before.length; end >= size; end--) {
      const w = before.slice(end - size, end);
      if (moves.has(w[0]!.date) || moves.has(w[w.length - 1]!.date)) continue;
      return {
        base: r1(median(w.map((p) => p.gap))),
        from: w[0]!.date, to: w[w.length - 1]!.date,
        shifted: size !== n || end !== before.length,
      };
    }
  }
  const w = before.slice(before.length - n);
  return { base: r1(median(w.map((p) => p.gap))), from: w[0]!.date, to: w[w.length - 1]!.date, shifted: true };
}

/** Первое плато: FLAT_DAYS подряд наблюдаемых дней, размах не больше FLAT_RANGE, и самый
 *  низкий день окна уже не ниже ARRIVED. День общего сдвига магазина в окно не пускаем. */
export function plateauOf(points: DayPoint[]): { from: string; day: number } | null {
  for (let i = 0; i + FLAT_DAYS <= points.length; i++) {
    const w = points.slice(i, i + FLAT_DAYS);
    if (w.some((p) => p.move)) continue;
    const v = w.map((p) => p.shift);
    if (Math.max(...v) - Math.min(...v) > FLAT_RANGE) continue;
    if (Math.min(...v) < ARRIVED) continue;
    return { from: w[0]!.date, day: w[0]!.day };
  }
  return null;
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
    base: b.base, baseFrom: b.from, baseTo: b.to, baseShifted: b.shifted,
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
    if (!d) continue;
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
