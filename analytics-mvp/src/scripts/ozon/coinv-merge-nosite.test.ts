// Срез мака без SKU: витрина не снята, соинвест 0 ложный - пишем «нет данных» (Иван 16.10).
import { describe, it, expect } from "vitest";
import { mergeCoinv } from "./coinv-merge.js";

describe("coinv:merge - срез без SKU и с соинвестом 0", () => {
  it("0 не пишется ни без SKU, ни со SKU (цена сайта равна нашей, Иван 19.10): поле пустое, метка no_site; ненулевой без SKU остаётся", () => {
    const { rows } = mergeCoinv([], [
      { date: "2026-10-16", art: "NEW", sku: "", coinv_pct: 0, oa: 85900, seller: 85900 },
      { date: "2026-10-17", art: "OLD", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 },
      { date: "2026-10-12", art: "EQ", sku: "456", oa: 86411, seller: 86411 },
      { date: "2026-10-16", art: "X", sku: "", coinv_pct: 55.5 },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.art, r]));
    expect(by.NEW!.coinv_paid_pct).toBeUndefined();
    expect(by.NEW!.no_site).toBe(true);
    expect(by.OLD!.coinv_paid_pct).toBeUndefined();
    expect(by.OLD!.no_site).toBe(true);
    expect(by.EQ!.coinv_paid_pct).toBeUndefined();
    expect(by.X!.coinv_paid_pct).toBe(55.5);
    expect(by.X!.no_site).toBeUndefined();
  });

  it("срез со снятой витриной поверх «нет данных» пишет значение и снимает метку", () => {
    const a = mergeCoinv([], [{ date: "2026-10-17", art: "A", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 }]);
    const b = mergeCoinv(a.rows, [{ date: "2026-10-17", art: "A", sku: "123", coinv_pct: 47.5, oa: 45100, seller: 85900 }]);
    expect(b.rows[0]).toMatchObject({ coinv_paid_pct: 47.5, site_paid: 45100 });
    expect(b.rows[0]!.no_site).toBeUndefined();
  });
  it("повторный срез без витрины стирает прежний ложный 0 того же дня", () => {
    const { rows } = mergeCoinv([{ date: "2026-10-16", art: "NEW", coinv_paid_pct: 0 }], [{ date: "2026-10-16", art: "NEW", sku: "", coinv_pct: 0 }]);
    expect(rows[0]!.coinv_paid_pct).toBeUndefined();
  });

  it("M1: срез без витрины поверх снятого значения того же дня не стирает ни значение, ни SKU, ни цену сайта", () => {
    const { rows, updated } = mergeCoinv(
      [{ date: "2026-10-16", art: "A", sku: "123", coinv_paid_pct: 55, site_paid: 5000, cap: 11000, oa_source: "snapshot", in_panel: true }],
      [{ date: "2026-10-16", art: "A", sku: "", coinv_pct: 0, oa: 11900, seller: 11900, src: "snapshot" }],
    );
    expect(rows).toHaveLength(1);
    expect(updated).toBe(1);
    expect(rows[0]).toMatchObject({ sku: "123", coinv_paid_pct: 55, site_paid: 5000, cap: 11900, oa_source: "snapshot" });
  });

  it("пустой SKU среза не затирает известный, значение при этом обновляется", () => {
    const { rows } = mergeCoinv([{ date: "2026-10-16", art: "A", sku: "123", coinv_paid_pct: 55 }], [{ date: "2026-10-16", art: "A", sku: "", coinv_pct: 56.5 }]);
    expect(rows[0]).toMatchObject({ sku: "123", coinv_paid_pct: 56.5 });
  });

  it("новый товар без SKU получает пустой SKU и пустое поле; срез со SKU потом дописывает оба", () => {
    const a = mergeCoinv([], [{ date: "2026-10-16", art: "N", sku: "", coinv_pct: 0, oa: 85900, seller: 85900 }]);
    expect(a.rows[0]).toMatchObject({ sku: "", site_paid: 85900, cap: 85900 });
    expect(a.rows[0]!.coinv_paid_pct).toBeUndefined();
    const b = mergeCoinv(a.rows, [{ date: "2026-10-16", art: "N", sku: "789", coinv_pct: 47.5, oa: 45100 }]);
    expect(b.rows[0]).toMatchObject({ sku: "789", coinv_paid_pct: 47.5, site_paid: 45100 });
  });
});
