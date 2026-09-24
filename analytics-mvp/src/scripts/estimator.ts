// Каким числом описывать группу: медианой по артикулам или суммой.
//
// ЗАЧЕМ. 24.09 на графике теста 1 контрольная линия корзины лежала ровно на нуле во все дни,
// а подпись под ней говорила «-18 %». Оба числа были верны по-своему: линию рисовала медиана
// дневных индексов по 369 артикулам, подпись считала медиану приростов средних за окно. У
// корзины в контрольной группе ненулевое значение лишь у 23-37 % артикулов в день, поэтому
// дневная медиана вырождается в ноль, а средние за две недели нет. Картинка спорила с числом.
//
// ПРАВИЛО (Иван, 24.09). Оценщик выбирается по метрике и одинаков для обеих линий и для
// числа под графиком.
//   позиция, показы в поиске, показы всего, посещения карточки - медиана индексов по артикулам;
//   корзина и заказы                                            - индекс суммы по группе.
// Причина: корзина и заказы это количества, поведение группы это её сумма, а медиана дневных
// индексов при одном-двух событиях на артикул в день меряет шум. Позиция и показы плотные,
// там медиана осмысленна и устойчива к одному крупному артикулу.
//
// ПОРОГ ПЛОТНОСТИ РАБОТАЕТ СТОРОЖЕМ, А НЕ ПЕРЕКЛЮЧАТЕЛЕМ. Если у плотной метрики доля
// ненулевых упала ниже порога, страница говорит об этом и не рисует линию. Менять статистику
// в середине ряда нельзя: половина ряда, посчитанная одним способом, и половина другим, это
// не ряд.

export type Est = "median" | "sum";

/** Оценщик по метрике. Ключи страницы, не имена полей файла. */
export const ESTIMATOR: Record<string, Est> = {
  pos: "median", vsearch: "median", views: "median", pdp: "median",
  cart: "sum", units: "sum",
};
export const estOf = (key: string): Est => ESTIMATOR[key] ?? "median";
export const EST_NAME: Record<Est, string> = {
  median: "медиана индексов по артикулам",
  sum: "индекс суммы по группе",
};

/** Доля ненулевых, ниже которой медиана по артикулам перестаёт что-либо мерить. */
export const DENSITY_MIN = 0.6;

/** Матрица «артикул × день». null это день без съёма, а не ноль. */
export type Matrix = Array<Array<number | null>>;

/** Группа ряда: объединённая карточка OZON. Варианты одной карточки идут в медиану ОДНИМ
 *  наблюдением, иначе карточка из одиннадцати вариантов перевесит десять одиночных товаров.
 *  У суммы группировка ничего не меняет: сумма по группе от разбиения не зависит. */
export type Groups = string[] | undefined;

/** Свести значения одной карточки в одно: медиана внутри карточки, как в collapseByCard. */
function collapse(values: Array<number | null>, groups: Groups): number[] {
  const live = values.map((v, i) => [v, groups?.[i] ?? `row:${i}`] as const)
    .filter((x): x is readonly [number, string] => x[0] != null);
  if (!groups) return live.map(([v]) => v);
  const by = new Map<string, number[]>();
  for (const [v, g] of live) (by.get(g) ?? by.set(g, []).get(g)!).push(v);
  const out: number[] = [];
  for (const [, v] of by) { const m = median(v); if (m != null) out.push(m); }
  return out;
}

const mean = (v: number[]): number => v.reduce((x, y) => x + y, 0) / v.length;
export const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};

/** Среднее по окну для одного ряда. Пропуски не участвуют, ноль участвует. */
export function winMean(row: Array<number | null>, idx: number[]): number | null {
  const v = idx.map((i) => row[i]).filter((x): x is number => x != null);
  return v.length ? mean(v) : null;
}

/** Плотность по дням: сколько рядов дали значение и у скольких оно ненулевое. */
export function densityByDay(m: Matrix): Array<{ n: number; nonzero: number }> {
  const days = m[0]?.length ?? 0;
  const out: Array<{ n: number; nonzero: number }> = [];
  for (let d = 0; d < days; d++) {
    let n = 0, nz = 0;
    for (const row of m) { const v = row[d]; if (v == null) continue; n++; if (v !== 0) nz++; }
    out.push({ n, nonzero: nz });
  }
  return out;
}

/** Доля ненулевых по всей матрице. Пропуски в знаменатель не идут. */
export function density(m: Matrix): { n: number; nonzero: number; share: number } {
  let n = 0, nz = 0;
  for (const row of m) for (const v of row) { if (v == null) continue; n++; if (v !== 0) nz++; }
  return { n, nonzero: nz, share: n ? nz / n : 0 };
}

/** Линия по медиане индексов: у каждого ряда своя база, потом медиана по рядам.
 *  Ряд с нулевой или пустой базой в медиану не входит: его нельзя привести к 100. */
export function medianIndexLine(m: Matrix, base: number[], groups?: Groups): Array<number | null> {
  const days = m[0]?.length ?? 0;
  const idx: Array<Array<number | null>> = [];
  const gs: string[] = [];
  m.forEach((row, i) => {
    const b = winMean(row, base);
    if (!b) return;
    idx.push(row.map((v) => v == null ? null : v / b * 100));
    gs.push(groups?.[i] ?? `row:${i}`);
  });
  return Array.from({ length: days }, (_, d) =>
    median(collapse(idx.map((r) => r[d] ?? null), groups ? gs : undefined)));
}

/** Линия по индексу суммы: сумма группы за день к среднему дню базы той же суммы.
 *  День, в котором не отчитался никто, остаётся пропуском, а не нулём. */
export function sumIndexLine(m: Matrix, base: number[]): Array<number | null> {
  const days = m[0]?.length ?? 0;
  const daily: Array<number | null> = Array.from({ length: days }, (_, d) => {
    const v = m.map((r) => r[d]).filter((x): x is number => x != null);
    return v.length ? v.reduce((x, y) => x + y, 0) : null;
  });
  const b = winMean(daily, base);
  if (!b) return Array.from({ length: days }, () => null);
  return daily.map((v) => v == null ? null : v / b * 100);
}

/** Линия выбранным оценщиком. */
export function line(m: Matrix, base: number[], est: Est, groups?: Groups): Array<number | null> {
  return est === "sum" ? sumIndexLine(m, base) : medianIndexLine(m, base, groups);
}

export interface Growth {
  /** Прирост в процентах. null - посчитать не из чего. */
  value: number | null;
  /** Сколько наблюдений стоит за числом: рядов у медианы, дней суммы у суммы. */
  n: number;
}

/** Прирост по медиане: у каждого ряда своё изменение средних, по рядам берётся медиана. */
export function growthMedian(m: Matrix, base: number[], post: number[], groups?: Groups): Growth {
  const raw: Array<number | null> = m.map((row) => {
    const b = winMean(row, base), p = winMean(row, post);
    return (!b || p == null) ? null : (p / b - 1) * 100;
  });
  const ds = collapse(raw, groups);
  return { value: median(ds), n: ds.length };
}

/** Прирост по сумме: сумма группы за день, потом изменение средних дней. */
export function growthSum(m: Matrix, base: number[], post: number[]): Growth {
  const days = m[0]?.length ?? 0;
  const daily: Array<number | null> = Array.from({ length: days }, (_, d) => {
    const v = m.map((r) => r[d]).filter((x): x is number => x != null);
    return v.length ? v.reduce((x, y) => x + y, 0) : null;
  });
  const b = winMean(daily, base), p = winMean(daily, post);
  if (!b || p == null) return { value: null, n: 0 };
  const n = post.filter((i) => daily[i] != null).length;
  return { value: (p / b - 1) * 100, n };
}

/** Прирост выбранным оценщиком. Тот же, что у линии, иначе подпись спорит с картинкой. */
export function growth(m: Matrix, base: number[], post: number[], est: Est, groups?: Groups): Growth {
  return est === "sum" ? growthSum(m, base, post) : growthMedian(m, base, post, groups);
}
