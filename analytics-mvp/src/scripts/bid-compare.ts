// Тест «большая ставка против маленькой» (tests.json, ключ тесты_ставок).
//
// ПОЧЕМУ НЕ ОБЫЧНАЯ КАРТОЧКА. Карточки тестов построены на «реклама против её отсутствия»:
// контроль обязан быть без рекламы, товар под рекламой и родня по карточке из контроля
// выбрасываются. Здесь обе стороны под рекламой по построению, а пара KONUX делит одну
// карточку 6279981715 - общая машинерия выбросила бы контроль целиком. Поэтому своя
// простая сводка: каждая сторона пары своим окном, суммы по дням и соинвест медианой.
//
// ИСТОЧНИКИ. Воронка и расход - ночной синк (sku_views.ndjson, ads_sku_daily.ndjson), он
// приходит сам каждую ночь, без съёма кабинета. Соинвест - gap_daily.ndjson. Выручки по
// товару здесь нет и не будет: репозиторий публичный.

export type Day = Record<string, number | undefined>;

export interface SideDef {
  артикул: string;
  ставка?: number | string;
  бюджет?: number;
  кампания?: string;
  /** Окно стороны. По умолчанию старт пары и последний день данных. */
  с?: string;
  по?: string;
  /** Первый день нового режима стороны, до начала окна: дни разгона. По ним итог теста 3
   *  печатает предварительные цифры с пометкой «не для решения» (Иван 30.09, вариант а).
   *  KUVINO малая: включена в общую GGM-18 28.09. OZEVIS малая: своя кампания выключена 28.09,
   *  первый полный день без неё 29.09 (28.09 товар ещё на прежнем уровне показов). */
  разгон_с?: string;
}

export interface PairDef {
  название: string;
  старт: string;
  большая: SideDef;
  малая: SideDef;
  заметка?: string;
}

export interface BidTestDef {
  id: string;
  название: string;
  гипотеза?: string;
  старт?: string;
  быстрый_признак?: string;
  замер?: string;
  правило?: string;
  заметка?: string;
  статус?: string;
  условие_завершения?: string;
  пары: PairDef[];
}

export interface SideStat {
  from: string;
  to: string;
  /** Дней с воронкой в окне. Пропущенный день не ноль, а отсутствие строки. */
  days: number;
  vsearch: number;
  pdp: number;
  cart: number;
  units: number;
  spend: number;
  /** Календарных дней окна, за которые расход уже выгружен (до spendTo). Расход в неделю
   *  делится на них, а не на дни воронки: воронка по тестам приходит на день раньше расхода. */
  spendDays: number;
  /** Корзин на 1 000 ₽ расхода. null, если расхода нет. */
  cartPer1k: number | null;
  /** Медиана соинвеста (gap_pct) по дням окна. null, если наблюдений нет. */
  gapMed: number | null;
  gapDays: number;
}

const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Сводка стороны за окно [from, to]. Воронка считается только по дням, где строка есть. */
export function sideStat(
  daily: Map<string, Day> | undefined,
  gap: Map<string, number> | undefined,
  from: string,
  to: string,
  /** Последний день, за который выгружен расход. По умолчанию to. */
  spendTo: string = to,
): SideStat {
  const sTo = spendTo < to ? spendTo : to;
  let days = 0, vsearch = 0, pdp = 0, cart = 0, units = 0, spend = 0;
  for (const [d, c] of daily ?? []) {
    if (d < from || d > to) continue;
    if (d <= sTo) spend += c["spend"] || 0;
    if (c["vsearch"] == null && c["pdp"] == null && c["cart"] == null && c["units"] == null) continue;
    days += 1;
    vsearch += c["vsearch"] || 0; pdp += c["pdp"] || 0; cart += c["cart"] || 0; units += c["units"] || 0;
  }
  const g: number[] = [];
  let cart2 = 0;                        // корзины за те же дни, что и расход
  for (const [d, c] of daily ?? []) if (d >= from && d <= sTo) cart2 += c["cart"] || 0;
  const spendDays = sTo >= from ? Math.round((Date.parse(sTo) - Date.parse(from)) / 864e5) + 1 : 0;
  for (const [d, v] of gap ?? []) if (d >= from && d <= to && Number.isFinite(v)) g.push(v);
  return {
    from, to, days, vsearch, pdp, cart, units, spend, spendDays,
    cartPer1k: spend > 0 ? cart2 / spend * 1000 : null,
    gapMed: median(g), gapDays: g.length,
  };
}

/** Окно стороны: её с/по, иначе старт пары и последний день данных. */
export function sideWindow(p: PairDef, s: SideDef, last: string): { from: string; to: string } {
  const from = s.с || p.старт;
  const to = s.по && s.по < last ? s.по : last;
  return { from, to };
}

/** В неделю: сумма окна, приведённая к 7 дням наблюдения. */
export const perWeek = (sum: number, days: number): number | null => (days ? sum / days * 7 : null);
