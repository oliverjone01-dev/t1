// Окно, в котором заказы ещё едут. Нужно тестам Маркета, и только им.
//
// ЗАЧЕМ. Часть проверок имеет смысл лишь на НЕДОЗРЕВШЕМ окне: карточка «Оборот» вместо
// дельты обязана писать «не дозрело», свод обязан показывать колонки «В пути», воронка
// обязана называть, сколько штук ещё едет. Пока окно задавалось календарём, такая проверка
// жила ровно до тех пор, пока эти дни не доезжали. 23.09.2026 окно 10-16.09 дозрело
// (доля в пути упала с 0.85 до 0.44), и тест упал на каждом PR в репозитории, не поймав
// при этом ни одной настоящей ошибки.
//
// Здесь окно ищется В ДАННЫХ: берём хвост и растим его, пока доля «в пути» держится выше
// порога. Порог тот же, что у страницы (build-katya.ts, правило `fly / net > 0.5`), поэтому
// тест и страница не могут разойтись в том, что считать дозревшим.
//
// Если недозревшего окна нет вовсе, это НЕ повод молча пройти: значит либо снимок устарел,
// либо доставка встала. Бросаем ошибку с объяснением, чтобы причина была видна сразу.
import { readFileSync } from "node:fs";

/** Та же доля, что в правиле страницы. Меняется только вместе с ним. */
export const FLY_SHARE = 0.5;

export interface DayRow {
  date: string;
  revenue?: number; rev_canc?: number; rev_fly?: number;
  units?: number; delivered?: number; cancellations?: number; returns?: number;
}

export const readDays = (path = "data-ym/daily_totals.ndjson"): DayRow[] =>
  readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as DayRow)
    .filter((r) => !!r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

const sum = (rows: DayRow[], k: keyof DayRow): number =>
  rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

/** Доля денег «в пути» в чистом обороте окна. Ровно то, что считает страница. */
export function flyShare(rows: DayRow[], from: string, to: string): number {
  const sel = rows.filter((r) => r.date >= from && r.date <= to);
  const net = sum(sel, "revenue") - sum(sel, "rev_canc");
  return net > 0 ? sum(sel, "rev_fly") / net : 0;
}

/** Штук окна, которые ещё едут: заказано минус доставлено, отменено и возвращено. */
export function inFlightUnits(rows: DayRow[], from: string, to: string): number {
  const sel = rows.filter((r) => r.date >= from && r.date <= to);
  return sum(sel, "units") - sum(sel, "delivered") - sum(sel, "cancellations") - sum(sel, "returns");
}

const shift = (date: string, days: number): string =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);

/** Самое широкое окно у хвоста данных, которое ещё не дозрело. Растим от minDays к maxDays
 *  и берём последнее, где доля «в пути» выше порога: широкое окно устойчивее узкого, в нём
 *  больше заказов и меньше шанс, что один доехавший заказ перевернёт проверку. */
export function immatureWindow(rows: DayRow[], minDays = 3, maxDays = 21): readonly [string, string] {
  if (!rows.length) throw new Error("test-window: в data-ym/daily_totals.ndjson нет ни одного дня");
  const last = rows[rows.length - 1]!.date;
  let found: readonly [string, string] | null = null;
  for (let n = minDays; n <= maxDays; n++) {
    const from = shift(last, -(n - 1));
    if (flyShare(rows, from, last) > FLY_SHARE) found = [from, last] as const;
  }
  if (!found) {
    throw new Error(
      `test-window: у хвоста данных (по ${last}) нет недозревшего окна: доля «в пути» ниже ${FLY_SHARE} `
      + `даже на ${minDays} днях. Либо снимок Маркета устарел, либо доставка встала. `
      + `Проверку на недозревшем окне на таких данных выполнить нельзя.`,
    );
  }
  return found;
}

/** Окно, в котором точно есть штуки в пути. Для проверок, которым важны не деньги, а штуки. */
export function windowWithInFlight(rows: DayRow[], minDays = 3, maxDays = 21): readonly [string, string] {
  if (!rows.length) throw new Error("test-window: в data-ym/daily_totals.ndjson нет ни одного дня");
  const last = rows[rows.length - 1]!.date;
  for (let n = maxDays; n >= minDays; n--) {
    const from = shift(last, -(n - 1));
    if (inFlightUnits(rows, from, last) > 0) return [from, last] as const;
  }
  throw new Error(
    `test-window: у хвоста данных (по ${last}) ни в одном окне нет заказов в пути. `
    + `Либо снимок устарел, либо всё доехало. Колонки «В пути» на таких данных проверять нечем.`,
  );
}
