// Срез мака без SKU: витрина не снята, соинвест 0 ложный - пишем «нет данных» (Иван 16.10).
import { describe, it, expect } from "vitest";
import { mergeCoinv } from "./coinv-merge.js";

describe("coinv:merge - срез без SKU и с соинвестом 0", () => {
  it("0 без SKU не пишется, поле пустое; 0 с SKU и ненулевой без SKU остаются", () => {
    const { rows } = mergeCoinv([], [
      { date: "2026-10-16", art: "NEW", sku: "", coinv_pct: 0, oa: 85900, seller: 85900 },
      { date: "2026-10-16", art: "OLD", sku: "123", coinv_pct: 0 },
      { date: "2026-10-16", art: "X", sku: "", coinv_pct: 55.5 },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.art, r]));
    expect(by.NEW!.coinv_paid_pct).toBeUndefined();
    expect(by.OLD!.coinv_paid_pct).toBe(0);
    expect(by.X!.coinv_paid_pct).toBe(55.5);
  });
  it("повторный срез без витрины стирает прежний ложный 0 того же дня", () => {
    const { rows } = mergeCoinv([{ date: "2026-10-16", art: "NEW", coinv_paid_pct: 0 }], [{ date: "2026-10-16", art: "NEW", sku: "", coinv_pct: 0 }]);
    expect(rows[0]!.coinv_paid_pct).toBeUndefined();
  });
});
