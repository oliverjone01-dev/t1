// Тест 4 (OZON): держит ли Ozon процент скидки, когда мы снижаем предельную цену.
// Спека: knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml (Иван 01.10).
//
// Здесь только чистые функции: сборщик вкладки (build-tests.ts) читает файлы и рисует,
// а всё, что решает вердикт, живёт тут и проверяется в price-test.test.ts.
//
// ГЛАВНАЯ ЛОВУШКА, РАДИ КОТОРОЙ ЕСТЬ priceApplied. Если цену в кабинете забыли снизить, разрыв
// не меняется, сдвиг стоит около нуля, и тест без этой проверки читался бы как «Ozon держит».
// Поэтому день товара засчитывается только тогда, когда снимок цен в этот день уже показывает
// сниженную предельную. Нет снимка, цена старая или вне коридора - товара в этом дне нет, а не «держит».

export interface PriceTestDef {
  id: string; название: string; гипотеза?: string; правило?: string;
  условие_завершения?: string; условие_перехода?: string;
  старт: string; замер: string; продление_до?: string;
  снижение: number;                     // доля, 0.10 = минус 10%
  тест: string[];
  модели?: Record<string, string>;
  статус?: string; заметка?: string;
  /** Закрытие по решению владельца: итог фиксируется отдельно от живой диагностики. */
  закрыт?: string; итог?: string;
  напоминание?: string;
  /** Исключены решением Ивана: артикул -> причина. В расчёт не входят, знаменатель группы прежний. */
  исключены?: Record<string, string>;
  /** Оговорка к итогу, печатается под вердиктом (Иван 12.10, вариант «а»). */
  оговорка?: string;
}

/** Пороги правила, п. разрыва. [ГИПОТЕЗА], приняты Иваном 01.10. */
export const HOLD_MIN = -1;
export const FAIL_MAX = -4;
export const RUN_DAYS = 3;
export const BASE_DAYS = 7;
/** Допуск к проверке цены: «снижена» - в пределах ±PRICE_TOL от база * (1 - снижение), «не снижена» - ±PRICE_TOL от базы. */
export const PRICE_TOL = 0.015;
export const VIEWS_DROP = -0.20;
/** Доля группы, которая должна быть засчитана в дне (правило 5 из 10, Иван 01.10). */
export const MIN_SHARE = 0.5;
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

/** Состояние предельной в этот день. Коридор, а не «не выше»: если поле снимка поменяет смысл
 *  (например, снова станет витриной) или в кабинете ошибутся (-19%, -90%), это «аномалия»,
 *  товар не засчитывается и плашка краснеет. Сбой не пропускается как «снижена» (fail-closed).
 *  base - предельная в базе, now - в этот день, cut - снижение (0.10). */
export type PriceState = "снижена" | "не снижена" | "аномалия" | "нет цены";
export function priceState(base: number | null, now: number | null, cut: number): PriceState {
  if (base == null || now == null || !(base > 0) || !(now > 0)) return "нет цены";
  const target = base * (1 - cut);
  if (Math.abs(now / target - 1) <= PRICE_TOL) return "снижена";
  if (Math.abs(now / base - 1) <= PRICE_TOL) return "не снижена";
  return "аномалия";
}

/** Засчитывается ли товар в дне: только при цене в коридоре «снижена». */
export const priceApplied = (base: number | null, now: number | null, cut: number): boolean =>
  priceState(base, now, cut) === "снижена";

export interface DayDiff {
  d: string;
  t: number | null; c: number | null; diff: number | null;
  /** сколько тестовых товаров вошло в медиану дня (только с подтверждённым снижением после старта) */
  nt: number; nc: number;
}

/** Грязный ли тестовый товар в день d (E065): исключён в реестре, или есть расход на клик в любой день
 *  с dirtyFrom по d (ступень разрыва от рекламы держится днями после выключения), или в этот день он
 *  в акции, которая сама двигает разрыв («Максимальный бустинг», «Усиление»). */
export function isDirty(
  a: string, d: string, dirtyFrom: string, excluded: Set<string>,
  cpcDays: Map<string, string[]>, boostDays: Map<string, Set<string>>,
): boolean {
  if (excluded.has(a)) return true;
  if ((cpcDays.get(a) ?? []).some((x) => x >= dirtyFrom && x <= d)) return true;
  return boostDays.get(a)?.has(d) ?? false;
}

/** Данные о рекламе и акциях за день d есть (E065, fail-closed): реклама снята не раньше d,
 *  снимок акций за d есть. Нет данных - товар в этот день не засчитывается: без них грязь не проверить. */
export const covered = (d: string, adsTo: string, actsDays: Set<string>): boolean => !!adsTo && d <= adsTo && actsDays.has(d);

/** Ключи «исключены» обязаны быть артикулами теста: опечатка иначе молча оставит товар в расчёте. */
export function badExcluded(test: string[], excl: Record<string, string> | undefined): string[] {
  const t = new Set(test); return Object.keys(excl || {}).filter((a) => !t.has(a));
}

/** Почему товар не засчитывается на день asOf (последний день окна с данными): исключён, реклама за клик
 *  с dirtyFrom по asOf, вторая акция в asOf. Окно ограничено сверху: события после замера итог не трогают. */
export function dirtyReasons(
  test: string[], asOf: string, dirtyFrom: string, excl: Record<string, string> | undefined,
  cpcDays: Map<string, string[]>, boostDays: Map<string, Set<string>>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of test) {
    if (excl && a in excl) { out.set(a, `исключён: ${excl[a]}`); continue; }
    const cpc = (cpcDays.get(a) ?? []).filter((x) => x >= dirtyFrom && x <= asOf).sort();
    if (cpc.length) { out.set(a, `реклама за клик с ${cpc[0]!.slice(8, 10)}.${cpc[0]!.slice(5, 7)}`); continue; }
    if (boostDays.get(a)?.has(asOf)) out.set(a, "вторая акция («Максимальный бустинг»)");
  }
  return out;
}

/** Разница «медиана теста минус медиана контроля» по дням. Для графиков и базы группы.
 *  Вердикт по ней НЕ считается: после старта в медиану дня входят не все товары, а база - по всем
 *  (это разные популяции, E056). Вердикт - по shiftSeries. */
export function diffSeries(
  gap: Map<string, Map<string, number>>, test: string[], ctrl: Set<string>, start: string,
  applied: (art: string, d: string) => boolean, minShare = 0.5,
  skip: (art: string, d: string) => boolean = () => false,
): DayDiff[] {
  const out: DayDiff[] = [];
  for (const d of [...gap.keys()].sort()) {
    const day = gap.get(d)!;
    const tv: number[] = [];
    for (const a of test) {
      const v = day.get(a);
      if (v == null || skip(a, d)) continue;
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

export interface DayShift { d: string; s: number | null; nt: number }

/** skip(a, d) - товар грязный в этот день (реклама за клик, вторая акция, исключён Иваном): не входит
 *  ни в базу, ни в день, но знаменатель minShare остаётся вся группа (правило 5 из 10, E065).
 *  Сдвиг по дням на одной популяции (ФЕНИКС G1, 01.10). Для каждого товара своя база:
 *  медиана (разрыв товара - медиана контроля) за дни базы. Сдвиг товара в дне = (разрыв - контроль) - его база.
 *  Сдвиг дня = медиана сдвигов засчитанных товаров; день пустой, если засчитано меньше minShare группы. */
export function shiftSeries(
  gap: Map<string, Map<string, number>>, test: string[], ctrl: Set<string>, start: string,
  baseDays: string[], applied: (art: string, d: string) => boolean, minShare = 0.5,
  skip: (art: string, d: string) => boolean = () => false,
): DayShift[] {
  const ctrlMed = (d: string): number | null => {
    const m = gap.get(d); if (!m) return null;
    const cv: number[] = []; for (const [a, v] of m) if (ctrl.has(a)) cv.push(v);
    return median(cv);
  };
  const own = new Map<string, number>();
  for (const a of test) {
    const xs: number[] = [];
    for (const d of baseDays) { const v = gap.get(d)?.get(a), c = ctrlMed(d); if (v != null && c != null && !skip(a, d)) xs.push(v - c); }
    const b = median(xs); if (b != null) own.set(a, b);
  }
  const out: DayShift[] = [];
  for (const d of [...gap.keys()].sort()) {
    const c = ctrlMed(d), day = gap.get(d)!;
    const xs: number[] = [];
    for (const a of test) {
      const v = day.get(a), b = own.get(a);
      if (v == null || b == null || c == null || skip(a, d)) continue;
      if (d >= start && !applied(a, d)) continue;
      xs.push(v - c - b);
    }
    const enough = xs.length >= Math.ceil(test.length * minShare);
    out.push({ d, s: enough ? median(xs) : null, nt: xs.length });
  }
  return out;
}

export type Verdict = "не запущен" | "идёт" | "держит" | "не держит" | "держит частично" | "мало данных";

export interface VerdictCalc {
  v: Verdict;
  /** true - до конца окна: класс по последним дням, не итог */
  prelim: boolean;
  /** конец окна вердикта: замер или, после «держит частично» на замере, продление */
  end: string;
  extended: boolean;
  shifts: Array<{ d: string; s: number }>;
  /** дни, по которым посчитана медиана (последние BASE_DAYS наблюдаемых в окне) */
  window: string[];
  medShift: number | null;
  share: number | null;   // доля скидки, которую держит Ozon: 1 - медиана сдвига / E
}

/** Класс по медиане сдвига. */
export const classOf = (med: number): Verdict => (med >= HOLD_MIN ? "держит" : med <= FAIL_MAX ? "не держит" : "держит частично");

/** Вердикт (Иван 01.10, п. 1а): итог окна - медиана сдвига за последние BASE_DAYS наблюдаемых дней
 *  окна [старт, конец). До конца окна тот же расчёт, но «предварительно». «Держит частично» на замере
 *  продлевает окно до ext (продление_до), итог - на ext. Меньше RUN_DAYS точек - «мало данных».
 *  today - дата сборки (инъекция ради тестов). */
export function verdictOf(
  xs: DayShift[], start: string, end: string, today: string, E: number | null, ext?: string,
): VerdictCalc {
  const empty = { shifts: [], window: [], medShift: null, share: null };
  if (today < start) return { v: "не запущен", prelim: true, end, extended: false, ...empty };
  const calc = (to: string) => {
    const shifts = xs.filter((x) => x.d >= start && x.d < to && x.s != null).map((x) => ({ d: x.d, s: x.s! }));
    const win = shifts.slice(-BASE_DAYS);
    const med = median(win.map((x) => x.s));
    return { shifts, window: win.map((x) => x.d), medShift: med,
      share: med != null && E != null && E < 0 ? 1 - med / E : null };
  };
  let r = calc(end), to = end, extended = false;
  if (today >= end && ext && ext > end && r.window.length >= RUN_DAYS && classOf(r.medShift!) === "держит частично") {
    to = ext; extended = true; r = calc(ext);
  }
  const prelim = today < to;
  if (!r.shifts.length) return { v: prelim ? "идёт" : "мало данных", prelim, end: to, extended, ...r };
  if (r.window.length < RUN_DAYS) return { v: prelim ? "идёт" : "мало данных", prelim, end: to, extended, ...r };
  return { v: classOf(r.medShift!), prelim, end: to, extended, ...r };
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
