// Разбор периода - единый для всего сервиса (DOC_05 §5, DOC_03 §1).
// Поддержка: "вчера", названия месяцев, модификаторы начало/середина/конец,
// конструкция "X к Y", дефолт неделя к неделе. Окна всегда равной длины.
// Клампинг: низ к полу данных (2026-02-01), верх к вчера.

import type { Window, PeriodPair } from "./types.js";

export const DATA_FLOOR = "2026-02-01";

// ---- помощники дат (всё в UTC, формат YYYY-MM-DD) ----

export function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

// число дней в окне включительно
export function lenDays(w: Window): number {
  return Math.round((toDate(w.to).getTime() - toDate(w.from).getTime()) / 86400000) + 1;
}

export function maxStr(a: string, b: string): string {
  return a >= b ? a : b;
}
export function minStr(a: string, b: string): string {
  return a <= b ? a : b;
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// ---- словарь месяцев (по префиксу основы) ----

// \b в JS не работает с кириллицей (ASCII-граница), поэтому начало слова
// задаём через lookbehind по кириллической букве (DOC_03 §5.3 про слеши - смежная грабля).
const MONTH_PREFIXES: Array<[RegExp, number]> = [
  [/(?<![а-яё])январ/, 0],
  [/(?<![а-яё])феврал/, 1],
  [/(?<![а-яё])март/, 2],
  [/(?<![а-яё])апрел/, 3],
  [/(?<![а-яё])ма[йя](?![а-яё])/, 4],
  [/(?<![а-яё])июн/, 5],
  [/(?<![а-яё])июл/, 6],
  [/(?<![а-яё])авгус/, 7],
  [/(?<![а-яё])сентябр/, 8],
  [/(?<![а-яё])октябр/, 9],
  [/(?<![а-яё])ноябр/, 10],
  [/(?<![а-яё])декабр/, 11],
];

type Modifier = "start" | "mid" | "end" | "full";

function detectModifier(q: string): Modifier {
  if (/начал/.test(q)) return "start";
  if (/серед/.test(q)) return "mid";
  if (/(конц|конец|конце)/.test(q)) return "end";
  return "full";
}

// окно месяца с учётом модификатора (без клампинга)
function monthWindow(year: number, month0: number, mod: Modifier): Window {
  const last = lastDayOfMonth(year, month0);
  const mm = String(month0 + 1).padStart(2, "0");
  const day = (d: number) => `${year}-${mm}-${String(d).padStart(2, "0")}`;
  switch (mod) {
    case "start":
      return { from: day(1), to: day(Math.min(10, last)) };
    case "mid":
      return { from: day(11), to: day(Math.min(20, last)) };
    case "end":
      return { from: day(21), to: day(last) };
    default:
      return { from: day(1), to: day(last) };
  }
}

// все месяцы, упомянутые в вопросе, в порядке появления
function findMonths(q: string): number[] {
  const hits: Array<{ idx: number; month: number }> = [];
  for (const [re, month] of MONTH_PREFIXES) {
    const m = re.exec(q);
    if (m) hits.push({ idx: m.index, month });
  }
  hits.sort((a, b) => a.idx - b.idx);
  return hits.map((h) => h.month);
}

export interface ResolveOpts {
  question?: string;
  explicit?: { curFrom?: string; curTo?: string; cmpFrom?: string; cmpTo?: string };
  today?: string; // для тестов; иначе системное "сегодня"
  floor?: string;
}

// Приводит окно сравнения к длине L, заякоренное в anchorFrom, с клампингом низа к полу.
function cmpOfLength(anchorFrom: string, L: number, floor: string): Window {
  const from = maxStr(anchorFrom, floor);
  return { from, to: addDays(from, L - 1) };
}

export function resolvePeriod(opts: ResolveOpts = {}): PeriodPair {
  const floor = opts.floor ?? DATA_FLOOR;
  const today = opts.today ?? fmt(new Date());
  const ceiling = addDays(today, -1); // вчера

  const clampWin = (w: Window): Window => ({
    from: maxStr(minStr(w.from, ceiling), floor),
    to: maxStr(minStr(w.to, ceiling), floor),
  });

  // 1) явные даты
  if (opts.explicit?.curFrom && opts.explicit?.curTo) {
    const cur = clampWin({ from: opts.explicit.curFrom, to: opts.explicit.curTo });
    const L = lenDays(cur);
    let cmp: Window;
    if (opts.explicit.cmpFrom) {
      cmp = cmpOfLength(maxStr(opts.explicit.cmpFrom, floor), L, floor);
    } else {
      cmp = cmpOfLength(addDays(cur.from, -L), L, floor);
    }
    return { cur, cmp, label: "явный период" };
  }

  const q = (opts.question ?? "").toLowerCase();

  // 2) "вчера"
  if (/вчера/.test(q)) {
    const cur = clampWin({ from: ceiling, to: ceiling });
    const cmp = cmpOfLength(addDays(cur.from, -1), 1, floor);
    return { cur, cmp, label: "вчера к позавчера" };
  }

  const months = findMonths(q);
  const mod = detectModifier(q);
  const year = toDate(today).getUTCFullYear();

  // 3) два месяца: "X к Y"
  if (months.length >= 2) {
    const cur = clampWin(monthWindow(year, months[0]!, mod));
    const L = lenDays(cur);
    const cmpAnchor = monthWindow(year, months[1]!, mod).from;
    const cmp = cmpOfLength(cmpAnchor, L, floor);
    return { cur, cmp, label: `${monthName(months[0]!)} к ${monthName(months[1]!)}` };
  }

  // 4) один месяц: сравнение с предыдущим месяцем той же длины
  if (months.length === 1) {
    const m = months[0]!;
    const cur = clampWin(monthWindow(year, m, mod));
    const L = lenDays(cur);
    const prevMonth = (m + 11) % 12;
    const prevYear = m === 0 ? year - 1 : year;
    const cmpAnchor = monthWindow(prevYear, prevMonth, mod).from;
    const cmp = cmpOfLength(cmpAnchor, L, floor);
    return { cur, cmp, label: `${monthName(m)} к ${monthName(prevMonth)}` };
  }

  // 5) дефолт: последние 7 дней против предыдущих 7
  const cur = clampWin({ from: addDays(ceiling, -6), to: ceiling });
  const L = lenDays(cur);
  const cmp = cmpOfLength(addDays(cur.from, -L), L, floor);
  return { cur, cmp, label: "неделя к неделе" };
}

function monthName(m: number): string {
  return [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
  ][m]!;
}

// Полный ли это закрытый месяц - для авто-режима P&L (DOC_03 §1).
// closedMonths: список 'YYYY-MM' с подписанным Актом.
export function isClosedFullMonth(w: Window, closedMonths: string[]): boolean {
  const from = toDate(w.from);
  const ym = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!closedMonths.includes(ym)) return false;
  const last = lastDayOfMonth(from.getUTCFullYear(), from.getUTCMonth());
  return w.from.endsWith("-01") && w.to.endsWith(`-${String(last).padStart(2, "0")}`);
}
