import { describe, it, expect } from "vitest";
import { compareTotals, compareByLine, priceDistribution, brandViolations } from "./report.js";
import type { SkusPayload } from "./report.js";

function payload(over: Partial<SkusPayload>): SkusPayload {
  return {
    dateFrom: "2026-05-09", dateTo: "2026-06-07",
    totals: { rev: 1000, units: 100, ret: 2, canc: 5, views: 10000, sk: 10, oos: 1, ad_spend: 200, ad_drr: 20 },
    by_line: [{ line: "TRUBIS", rev: 600, units: 60, ret: 1, sk: 5, ad_spend: 0, ad_drr: 0 }],
    sku_table: [],
    ...over,
  };
}

describe("compareTotals - сравнение окон", () => {
  it("считает дельты выручки и ДРР", () => {
    const a = payload({ totals: { rev: 1100, units: 110, ret: 2, canc: 5, views: 10000, sk: 10, oos: 1, ad_spend: 220, ad_drr: 22 } });
    const b = payload({ totals: { rev: 1000, units: 100, ret: 2, canc: 5, views: 10000, sk: 10, oos: 1, ad_spend: 200, ad_drr: 20 } });
    const c = compareTotals(a, b);
    expect(c.revenue).toEqual({ cur: 1100, cmp: 1000, abs: 100, pct: 0.1 });
    expect(c.drr_total.cur).toBe(22);
    expect(c.drr_total.abs).toBeCloseTo(2);
  });
});

describe("compareByLine - доли и сортировка по обороту", () => {
  it("считает долю линии в обороте", () => {
    const a = payload({
      by_line: [
        { line: "TRUBIS", rev: 600, units: 60, ret: 1, sk: 5, ad_spend: 0, ad_drr: 0 },
        { line: "зеркала", rev: 400, units: 40, ret: 0, sk: 5, ad_spend: 0, ad_drr: 0 },
      ],
    });
    const lines = compareByLine(a, a);
    expect(lines[0]!.line).toBe("TRUBIS");
    expect(lines[0]!.share_pct).toBe(60);
  });
});

describe("priceDistribution - позиционирование по цене", () => {
  it("разносит по дешевле/дороже/без индекса", () => {
    const a = payload({
      sku_table: [
        { pidx: 0.86, name: "a", line: "TRUBIS" } as any,
        { pidx: 1.2, name: "b", line: "TRUBIS" } as any,
        { pidx: 0, name: "c", line: "столы" } as any,
        { pidx: null, name: "d", line: "столы" } as any,
      ],
    });
    const d = priceDistribution(a);
    expect(d.cheaper).toBe(1);
    expect(d.pricier).toBe(1);
    expect(d.noIndex).toBe(2);
  });
});

describe("brandViolations - VALONTI на МП", () => {
  it("ловит VALONTI (перегородки), но не VIOLUR (столы)", () => {
    const a = payload({
      sku_table: [
        { name: "Перегородка VALONTI", line: "VALONTI" } as any,
        { name: "Стол VIOLUR овальный", line: "VIOLUR (столы)" } as any,
        { name: "Стол TRUBIS", line: "TRUBIS" } as any,
      ],
    });
    expect(brandViolations(a).length).toBe(1);
  });
});
