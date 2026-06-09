// Витрины поверх дневной истории (Фаза 3). Чистые функции над SkuDaily[].
// ABC, XYZ, ABC-XYZ матрица, BCG, хитмап по месяцам, дневной тренд, сравнение окон.

import type { SkuDaily } from "./types.js";
import { datesBetween } from "./sync.js";
import { safeDiv } from "./util/num.js";

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

export interface Agg {
  key: string;
  name: string;
  line: string;
  revenue: number;
  units: number;
  views: number;
  returns: number;
  activeDays: number;
}

export interface SkuView extends Agg {
  abc: AbcClass;
  xyz: XyzClass;
  cv: number;
  convOrd: number;
  aov: number;
  revShare: number;
}

const EMPTY_SKU = "__empty__";

export function windowRows(rows: SkuDaily[], from: string, to: string): SkuDaily[] {
  return rows.filter((r) => r.sku !== EMPTY_SKU && r.date >= from && r.date <= to);
}

// Агрегат по SKU за окно.
export function aggBySku(rows: SkuDaily[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const a = m.get(r.sku) ?? { key: r.sku, name: r.name, line: r.line, revenue: 0, units: 0, views: 0, returns: 0, activeDays: 0 };
    a.revenue += r.revenue;
    a.units += r.units;
    a.views += r.views;
    a.returns += r.returns;
    a.activeDays += 1;
    a.name = r.name || a.name;
    a.line = r.line || a.line;
    m.set(r.sku, a);
  }
  return m;
}

export function aggByLine(rows: SkuDaily[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const a = m.get(r.line) ?? { key: r.line, name: r.line, line: r.line, revenue: 0, units: 0, views: 0, returns: 0, activeDays: 0 };
    a.revenue += r.revenue;
    a.units += r.units;
    a.views += r.views;
    a.returns += r.returns;
    m.set(r.line, a);
  }
  return m;
}

// ABC по доле в обороте: A до 80%, B до 95%, C остальное.
export function abc(items: Array<{ key: string; revenue: number }>): Map<string, AbcClass> {
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, x) => s + x.revenue, 0) || 1;
  const out = new Map<string, AbcClass>();
  let cum = 0;
  for (const it of sorted) {
    cum += it.revenue;
    const share = cum / total;
    out.set(it.key, share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C");
  }
  return out;
}

// XYZ по стабильности спроса: коэффициент вариации дневных продаж за окно.
// X стабильный (cv<=0.5), Y переменный (<=1), Z рваный (>1).
export function xyz(
  rows: SkuDaily[],
  from: string,
  to: string,
  keyFn: (r: SkuDaily) => string,
): Map<string, { cv: number; cls: XyzClass }> {
  const dates = datesBetween(from, to);
  // key -> date -> units
  const byKey = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = keyFn(r);
    const d = byKey.get(k) ?? new Map<string, number>();
    d.set(r.date, (d.get(r.date) ?? 0) + r.units);
    byKey.set(k, d);
  }
  const out = new Map<string, { cv: number; cls: XyzClass }>();
  for (const [k, dmap] of byKey) {
    const series = dates.map((d) => dmap.get(d) ?? 0);
    const mean = series.reduce((s, x) => s + x, 0) / series.length;
    const variance = series.reduce((s, x) => s + (x - mean) ** 2, 0) / series.length;
    const cv = mean === 0 ? Infinity : Math.sqrt(variance) / mean;
    const cls: XyzClass = cv <= 0.5 ? "X" : cv <= 1 ? "Y" : "Z";
    out.set(k, { cv: Number.isFinite(cv) ? Math.round(cv * 100) / 100 : 99, cls });
  }
  return out;
}

// Полное представление SKU за окно: агрегат + ABC + XYZ + метрики.
export function skuViews(rows: SkuDaily[], from: string, to: string): SkuView[] {
  const win = windowRows(rows, from, to);
  const agg = aggBySku(win);
  const items = [...agg.values()].map((a) => ({ key: a.key, revenue: a.revenue }));
  const abcMap = abc(items);
  const xyzMap = xyz(win, from, to, (r) => r.sku);
  const total = items.reduce((s, x) => s + x.revenue, 0) || 1;
  return [...agg.values()]
    .map((a) => ({
      ...a,
      abc: abcMap.get(a.key) ?? "C",
      xyz: xyzMap.get(a.key)?.cls ?? "Z",
      cv: xyzMap.get(a.key)?.cv ?? 99,
      convOrd: Math.round(safeDiv(a.units, a.views) * 1000) / 10,
      aov: Math.round(safeDiv(a.revenue, a.units)),
      revShare: Math.round((a.revenue / total) * 1000) / 10,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ABC-XYZ матрица: счётчики и оборот по 9 клеткам.
export function abcXyzMatrix(views: SkuView[]): Record<string, { count: number; revenue: number }> {
  const cell: Record<string, { count: number; revenue: number }> = {};
  for (const a of ["A", "B", "C"]) for (const x of ["X", "Y", "Z"]) cell[a + x] = { count: 0, revenue: 0 };
  for (const v of views) {
    const c = cell[v.abc + v.xyz]!;
    c.count += 1;
    c.revenue += v.revenue;
  }
  return cell;
}

export type Quadrant = "star" | "cow" | "question" | "dog";

// BCG по линиям: рост (окно к окну) против доли в текущем обороте.
export function bcgByLine(cur: SkuDaily[], cmp: SkuDaily[]): Array<{
  line: string; revenue: number; sharePct: number; growth: number; quadrant: Quadrant;
}> {
  const a = aggByLine(cur);
  const b = aggByLine(cmp);
  const total = [...a.values()].reduce((s, x) => s + x.revenue, 0) || 1;
  const shares = [...a.values()].map((x) => x.revenue / total);
  const shareThreshold = shares.length ? median(shares) : 0;
  return [...a.values()]
    .map((la) => {
      const prev = b.get(la.line)?.revenue ?? 0;
      const growth = safeDiv(la.revenue - prev, prev || la.revenue);
      const share = la.revenue / total;
      const highShare = share >= shareThreshold;
      const highGrowth = growth >= 0;
      const quadrant: Quadrant = highShare && highGrowth ? "star" : highShare ? "cow" : highGrowth ? "question" : "dog";
      return { line: la.line, revenue: Math.round(la.revenue), sharePct: Math.round(share * 1000) / 10, growth: Math.round(growth * 1000) / 10, quadrant };
    })
    .sort((x, y) => y.revenue - x.revenue);
}

// Хитмап: заказы по линии × месяц (только реальные месяцы).
export function monthlyOrdersByLine(rows: SkuDaily[]): {
  months: string[];
  lines: Array<{ line: string; byMonth: Record<string, number>; total: number }>;
} {
  const monthsSet = new Set<string>();
  const lineMap = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (r.sku === EMPTY_SKU) continue;
    const mo = r.date.slice(0, 7);
    monthsSet.add(mo);
    const bm = lineMap.get(r.line) ?? {};
    bm[mo] = (bm[mo] ?? 0) + r.units;
    lineMap.set(r.line, bm);
  }
  const months = [...monthsSet].sort();
  const lines = [...lineMap.entries()]
    .map(([line, byMonth]) => ({ line, byMonth, total: Object.values(byMonth).reduce((s, x) => s + x, 0) }))
    .sort((a, b) => b.total - a.total);
  return { months, lines };
}

// Дневной ряд по SKU (для тренда при раскрытии).
export function skuDailySeries(rows: SkuDaily[], sku: string, from: string, to: string): Array<{ date: string; units: number; revenue: number }> {
  const dates = datesBetween(from, to);
  const map = new Map<string, { units: number; revenue: number }>();
  for (const r of rows) if (r.sku === sku && r.date >= from && r.date <= to) {
    const e = map.get(r.date) ?? { units: 0, revenue: 0 };
    e.units += r.units; e.revenue += r.revenue;
    map.set(r.date, e);
  }
  return dates.map((d) => ({ date: d, units: map.get(d)?.units ?? 0, revenue: map.get(d)?.revenue ?? 0 }));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
