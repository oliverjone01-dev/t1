// Тест 4 (OZON): держит ли Ozon процент скидки, когда мы снижаем предельную цену.
// Спека: knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml (Иван 01.10).
//
// Здесь только чистые функции: сборщик вкладки (build-tests.ts) читает файлы и рисует,
// а всё, что решает вердикт, живёт тут и проверяется в price-test.test.ts.
//
// ГЛАВНАЯ ЛОВУШКА, РАДИ КОТОРОЙ ЕСТЬ priceApplied. Если цену в кабинете забыли снизить, разрыв
// не меняется, сдвиг стоит около нуля, и тест без этой проверки читался бы как «Ozon держит».
// Поэтому день товара засчитывается только тогда, когда снимок цен в этот день уже показывает
// сниженную предельную. Нет снимка или цена старая - товара в этом дне нет, а не «держит».

export interface PriceTestDef {
  id: string; название: string; гипотеза?: string; правило?: string;
  условие_завершения?: string; условие_перехода?: string;
  старт: string; замер: string; продление_до?: string;
  снижение: number;                     // доля, 0.10 = минус 10%
  тест: string[];
  модели?: Record<string, string>;
  статус?: string; заметка?: string;
  напоминание?: string;
}

/** Пороги правила, п. разрыва. [ГИПОТЕЗА], приняты Иваном 01.10. */
export const HOLD_MIN = -1;
export const FAIL_MAX = -4;
export const RUN_DAYS = 3;
export const BASE_DAYS = 7;
/** Допуск к проверке «цена снижена»: предельная не выше база * (1 - снижение) * (1 + PRICE_TOL). */
export const PRICE_TOL = 0.015;
export const VIEWS_DROP = -0.20;
export const STOP_SHARE = 0.5;

export const median = (xs: number[]): number | null => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};

/** Ожидаемый сдвиг разрыва, если Ozon процент НЕ держит и витрина стоит на месте.
 *  g - разрыв в базе, %, cut - снижение предельной (0.10). Отрицательное число, п. */
export const expectedDrop = (g: number, cut: number): number => -(100 - g) * cut / (1 - cut);

/** Снижена ли предельная в этот день. base - предельная в базе, now - в этот день. */
export const priceApplied = (base: number | null, now: number | null, cut: number): boolean =>
  base != null && now != null && base > 0 && now <= base * (1 - cut) * (1 + PRICE_TOL);

export interface DayDiff {
  d: string;
  t: number | null; c: number | null; diff: number | null;
  /** сколько тестовых товаров вошло в медиану дня (только с подтверждённым снижением после старта) */
  nt: number; nc: number;
}

/** Разница «медиана теста минус медиана контроля» по дням.
 *  gap: день -> артикул -> разрыв. applied(art, d) решает, засчитан ли тестовый товар в дне
 *  после старта; до старта засчитываются все. minShare - доля тестовых товаров, без которой
 *  день не считается (половина группы). */
export function diffSeries(
  gap: Map<string, Map<string, number>>, test: string[], ctrl: Set<string>, start: string,
  applied: (art: string, d: string) => boolean, minShare = 0.5,
): DayDiff[] {
  const out: DayDiff[] = [];
  for (const d of [...gap.keys()].sort()) {
    const day = gap.get(d)!;
    const tv: number[] = [];
    for (const a of test) {
      const v = day.get(a);
      if (v == null) continue;
      if (d >= start && !applied(a, d)) continue;
      tv.push(v);
    }
    const cv: number[] = [];
    for (const [a, v] of day) if (ctrl.has(a)) cv.push(v);
    const enough = tv.length >= Math.ceil(test.length * minShare);
    const t = enough ? median(tv) : null, c = median(cv);
    out.push({ d, t, c, diff: t != null && c != null ? t - c : null, nt: tv.length, nc: cv.length });
  }
  return out;
}

/** База: медиана разницы за последние n наблюдаемых дней до старта. */
export function baseOf(s: DayDiff[], start: string, n = BASE_DAYS): { base: number | null; days: string[] } {
  const pre = s.filter((x) => x.d < start && x.diff != null).slice(-n);
  return { base: median(pre.map((x) => x.diff!)), days: pre.map((x) => x.d) };
}

export type Verdict = "не запущен" | "идёт" | "держит" | "не держит" | "держит частично" | "мало данных";

export interface VerdictCalc {
  v: Verdict;
  shifts: Array<{ d: string; s: number }>;
  /** первый день серии, на которой вынесен вердикт */
  from: string | null;
  medShift: number | null;
  share: number | null;   // доля скидки, которую держит Ozon: 1 - медиана сдвига / E
}

/** Первая серия из k подряд наблюдаемых дней, где pred истинен. */
export function firstRun(xs: Array<{ d: string; s: number }>, pred: (s: number) => boolean, k = RUN_DAYS): string | null {
  let run = 0;
  for (let i = 0; i < xs.length; i++) {
    run = pred(xs[i]!.s) ? run + 1 : 0;
    if (run >= k) return xs[i - k + 1]!.d;
  }
  return null;
}

/** Вердикт по правилу теста. today - дата сборки (инъекция ради тестов). */
export function verdictOf(s: DayDiff[], start: string, end: string, today: string, E: number | null): VerdictCalc {
  const { base } = baseOf(s, start);
  if (today < start) return { v: "не запущен", shifts: [], from: null, medShift: null, share: null };
  if (base == null) return { v: "мало данных", shifts: [], from: null, medShift: null, share: null };
  const shifts = s.filter((x) => x.d >= start && x.d < end && x.diff != null).map((x) => ({ d: x.d, s: x.diff! - base }));
  const med = median(shifts.map((x) => x.s));
  const share = med != null && E != null && E < 0 ? 1 - med / E : null;
  const fail = firstRun(shifts, (v) => v <= FAIL_MAX);
  const hold = firstRun(shifts, (v) => v >= HOLD_MIN);
  // Обе серии бывают только на очень шумном ряду; верим той, что пришла позже: она ближе к замеру.
  if (fail && (!hold || fail >= hold)) return { v: "не держит", shifts, from: fail, medShift: med, share };
  if (hold) return { v: "держит", shifts, from: hold, medShift: med, share };
  if (today >= end) return { v: shifts.length >= RUN_DAYS ? "держит частично" : "мало данных", shifts, from: null, medShift: med, share };
  return { v: "идёт", shifts, from: null, medShift: med, share };
}

/** Доля группы в показах магазина за окно [from, to). null, если показов магазина в окне нет. */
export function viewShare(
  views: Map<string, Map<string, number>>, test: Set<string>, from: string, to: string,
): { share: number | null; days: number; t: number; all: number } {
  let t = 0, all = 0, days = 0;
  for (const [d, m] of views) {
    if (d < from || d >= to) continue;
    days += 1;
    for (const [a, v] of m) { all += v; if (test.has(a)) t += v; }
  }
  return { share: all > 0 ? t / all : null, days, t, all };
}

/** Стоп по показам: k дней подряд дневная доля ниже stop * база. */
export function viewsStop(
  views: Map<string, Map<string, number>>, test: Set<string>, start: string, base: number | null, k = RUN_DAYS,
): string | null {
  if (base == null || base <= 0) return null;
  const xs: Array<{ d: string; s: number }> = [];
  for (const d of [...views.keys()].sort()) {
    if (d < start) continue;
    const r = viewShare(views, test, d, nextDay(d));
    if (r.share != null) xs.push({ d, s: r.share / base });
  }
  return firstRun(xs, (v) => v < STOP_SHARE, k);
}

export const nextDay = (d: string, k = 1): string => {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10);
};
