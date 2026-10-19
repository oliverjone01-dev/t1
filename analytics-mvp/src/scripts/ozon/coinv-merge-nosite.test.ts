// Срез мака с соинвестом 0: витрина не снята, у карточки без истории это «нет данных» (Иван 16.10, 19.10),
// у карточки с историей - честный 0 (Иван 19.10 после ФЕНИКСА Z1).
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

  it("ноль у артикула с историей в stored пишется нулём и без метки (Иван 19.10): стоп теста 4 и чип плана его увидят", () => {
    const { rows } = mergeCoinv(
      [{ date: "2026-10-12", art: "GGK-02-3-3-80", sku: "123", coinv_paid_pct: 47, site_paid: 45100, cap: 85900, in_panel: true }],
      [{ date: "2026-10-19", art: "GGK-02-3-3-80", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 }],
    );
    const r = rows.find((x) => x.date === "2026-10-19")!;
    expect(r.coinv_paid_pct).toBe(0);
    expect(r.no_site).toBeUndefined();
    expect(r.site_paid).toBe(85900);
  });

  it("цена сайта равна нашей без coinv_pct у артикула с историей - тоже честный 0", () => {
    const { rows } = mergeCoinv(
      [{ date: "2026-10-12", art: "EQ", coinv_paid_pct: 47 }],
      [{ date: "2026-10-19", art: "EQ", sku: "456", oa: 86411, seller: 86411 }],
    );
    expect(rows.find((x) => x.date === "2026-10-19")!.coinv_paid_pct).toBe(0);
  });

  it("история - только прежние дни: ненулевой день позже нуля честным его не делает", () => {
    const { rows } = mergeCoinv(
      [{ date: "2026-10-17", art: "NEW", coinv_paid_pct: 47 }],
      [{ date: "2026-10-16", art: "NEW", sku: "", coinv_pct: 0, oa: 85900, seller: 85900 }],
    );
    const r = rows.find((x) => x.date === "2026-10-16")!;
    expect(r.coinv_paid_pct).toBeUndefined();
    expect(r.no_site).toBe(true);
  });

  it("история - только ненулевой соинвест: прежние строки с «нет данных» или нулём её не дают", () => {
    const { rows } = mergeCoinv(
      [{ date: "2026-10-16", art: "NEW", no_site: true }, { date: "2026-10-15", art: "Z", coinv_paid_pct: 0 }],
      [{ date: "2026-10-17", art: "NEW", coinv_pct: 0 }, { date: "2026-10-17", art: "Z", coinv_pct: 0 }],
    );
    for (const a of ["NEW", "Z"]) {
      const r = rows.find((x) => x.date === "2026-10-17" && x.art === a)!;
      expect(r.coinv_paid_pct).toBeUndefined();
      expect(r.no_site).toBe(true);
    }
  });

  it("M1 не зависит от истории: вечерний ноль у зрелой карточки не стирает снятое утром значение того же дня", () => {
    const { rows } = mergeCoinv(
      [{ date: "2026-10-12", art: "A", coinv_paid_pct: 47 }, { date: "2026-10-19", art: "A", sku: "123", coinv_paid_pct: 55, site_paid: 5000, cap: 11000 }],
      [{ date: "2026-10-19", art: "A", sku: "", coinv_pct: 0, oa: 11900, seller: 11900 }],
    );
    expect(rows.find((x) => x.date === "2026-10-19")).toMatchObject({ coinv_paid_pct: 55, site_paid: 5000, cap: 11900 });
  });
});
