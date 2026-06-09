// Витрина и движок сравнения периодов (S4). Работает над payload воркфлоу
// "Товары" (totals + by_line + sku_table) за два окна и считает дельты.
// Формат входа совпадает с DOC_03 §2 (контракт ответа skus-вебхука).

import { safeDiv, delta } from "./util/num.js";

export interface SkuRow {
  sku: string;
  name: string;
  line: string;
  rev: number;
  units: number;
  views: number;
  cart: number;
  ret: number;
  canc: number;
  convOrd: number;
  retp: number;
  aov: number;
  offer: string;
  stock: number;
  pidx: number | null;
  pcol: string;
  oos: number;
}

export interface SkusPayload {
  dateFrom: string;
  dateTo: string;
  totals: {
    rev: number; units: number; ret: number; canc: number; views: number;
    sk: number; oos: number; ad_spend: number; ad_drr: number;
  };
  by_line: Array<{ line: string; rev: number; units: number; ret: number; sk: number; ad_spend: number; ad_drr: number }>;
  sku_table: SkuRow[];
}

export interface Cmp {
  cur: number;
  cmp: number;
  abs: number;
  pct: number;
}

function cmp(cur: number, cmpv: number): Cmp {
  const d = delta(cur, cmpv);
  return { cur, cmp: cmpv, abs: d.abs, pct: d.pct };
}

// Срез тоталов со сравнением окон A/B.
export function compareTotals(a: SkusPayload, b: SkusPayload) {
  const ta = a.totals, tb = b.totals;
  return {
    revenue: cmp(ta.rev, tb.rev),
    units: cmp(ta.units, tb.units),
    views: cmp(ta.views, tb.views),
    cr_order: cmp(round1(safeDiv(ta.units, ta.views) * 100), round1(safeDiv(tb.units, tb.views) * 100)),
    aov: cmp(Math.round(safeDiv(ta.rev, ta.units)), Math.round(safeDiv(tb.rev, tb.units))),
    returns: cmp(ta.ret, tb.ret),
    oos: cmp(ta.oos, tb.oos),
    ad_spend: cmp(ta.ad_spend, tb.ad_spend),
    drr_total: cmp(ta.ad_drr, tb.ad_drr), // RELIABLE (DOC_05 §2)
    sku_count: cmp(ta.sk, tb.sk),
  };
}

// Срез по линиям со сравнением (ДРР по линиям помечаем INDICATIVE отдельно в UI).
export function compareByLine(a: SkusPayload, b: SkusPayload) {
  const mapB = new Map(b.by_line.map((l) => [l.line, l]));
  return a.by_line
    .map((la) => {
      const lb = mapB.get(la.line) ?? { rev: 0, units: 0, ret: 0, sk: 0, ad_spend: 0, ad_drr: 0 };
      return {
        line: la.line,
        revenue: cmp(la.rev, lb.rev),
        units: cmp(la.units, lb.units),
        share_pct: round1(safeDiv(la.rev, a.totals.rev) * 100),
      };
    })
    .sort((x, y) => y.revenue.cur - x.revenue.cur);
}

// Карточки на ремонт (экран Продукта, DOC_05 §3.4): трафик есть, заказов мало.
export function cardsToFix(a: SkusPayload, minViews = 5000): SkuRow[] {
  return a.sku_table
    .filter((s) => s.views >= minViews && s.convOrd < 0.2)
    .sort((x, y) => y.views - x.views)
    .slice(0, 15);
}

// Ценовое позиционирование (экран CMO): сколько SKU дешевле/вровень/дороже рынка.
export function priceDistribution(a: SkusPayload) {
  let cheaper = 0, even = 0, pricier = 0, noIndex = 0;
  for (const s of a.sku_table) {
    if (s.pidx == null || s.pidx === 0) noIndex++;
    else if (s.pidx < 1) cheaper++;
    else if (s.pidx > 1) pricier++;
    else even++;
  }
  return { cheaper, even, pricier, noIndex };
}

// Флаг нарушения позиционирования: VIOLUR/VALONTI не должны быть на МП (DOC_05 §1.6).
export function brandViolations(a: SkusPayload): SkuRow[] {
  return a.sku_table.filter((s) => /VIOLUR|VALONTI/i.test(s.line) || /VIOLUR|VALONTI/i.test(s.name));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
