// Слияние дневного среза с накопленным рядом. Ошибка здесь не падает, а удваивает строки за
// день: медиана контроля посчиталась бы по удвоенной группе и выглядела бы нормально.
import { describe, it, expect } from "vitest";
import { mergeCoinv, SLICE_SOURCE, type StoredRow, type SliceRow } from "./ozon/coinv-merge.js";
import { isExact } from "./boost-readiness.js";

const stored = (d: string, art: string, extra: Record<string, unknown> = {}): StoredRow =>
  ({ date: d, art, coinv_paid_pct: 50, cap: 100, in_panel: true, oa_source: "ratio_2026-09-09", ...extra });
const slice = (d: string, art: string, pct: number): SliceRow =>
  ({ date: d, art, sku: "1", seller: 200, oa: 90, coinv_pct: pct, src: "snapshot" });

describe("слияние среза соинвеста", () => {
  it("день и артикул обновляются, а не задваиваются", () => {
    const r = mergeCoinv([stored("2026-09-23", "A")], [slice("2026-09-23", "A", 55)]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.coinv_paid_pct).toBe(55);
    expect(r.updated).toBe(1);
    expect(r.added).toBe(0);
  });

  it("поля, которых в срезе нет, сохраняются", () => {
    const r = mergeCoinv([stored("2026-09-23", "A", { site_listed: 111, observed: true })], [slice("2026-09-23", "A", 55)]);
    expect(r.rows[0]!.site_listed).toBe(111);
    expect(r.rows[0]!.observed).toBe(true);
  });

  it("срез помечается как наблюдение, а не как модель", () => {
    const r = mergeCoinv([stored("2026-09-23", "A")], [slice("2026-09-23", "A", 55)]);
    expect(r.rows[0]!.oa_source).toBe(SLICE_SOURCE);
  });

  it("новый день получает флаг панели с последнего дня, где он известен", () => {
    const r = mergeCoinv(
      [stored("2026-09-22", "A", { in_panel: false }), stored("2026-09-23", "A", { in_panel: false })],
      [slice("2026-09-24", "A", 55)],
    );
    const last = r.rows[r.rows.length - 1]!;
    expect(last.date).toBe("2026-09-24");
    expect(last.in_panel).toBe(false);
    expect(r.panelCarried).toBe(1);
  });

  it("товар, которого в ряду не было, попадает в панель: он есть в снимке цен", () => {
    const r = mergeCoinv([], [slice("2026-09-24", "NEW", 55)]);
    expect(r.rows[0]!.in_panel).toBe(true);
    expect(r.added).toBe(1);
  });

  it("строки идут по дате, потом по артикулу: дифф читается глазами", () => {
    const r = mergeCoinv([], [slice("2026-09-24", "B", 1), slice("2026-09-23", "C", 2), slice("2026-09-23", "A", 3)]);
    expect(r.rows.map((x) => `${x.date}/${x.art}`))
      .toEqual(["2026-09-23/A", "2026-09-23/C", "2026-09-24/B"]);
  });
});

describe("метка источника не штампуется", () => {
  it("берётся из среза, а не константой", () => {
    // 24.09: слияние ставило snapshot всем подряд, и строка, называвшая себя моделью,
    // выходила «снятой с витрины». Происхождение нельзя придумывать за источник.
    const r = mergeCoinv([], [{ ...slice("2026-09-09", "A", 51), src: "ratio_2026-09-09" }]);
    expect(r.rows[0]!.oa_source).toBe("ratio_2026-09-09");
  });

  it("срез без метки получает значение по умолчанию, а не чужое", () => {
    const { src, ...noSrc } = slice("2026-09-24", "A", 51);
    const r = mergeCoinv([stored("2026-09-24", "A", { oa_source: "exact" })], [noSrc]);
    expect(r.rows[0]!.oa_source).toBe(SLICE_SOURCE);
  });

  it("честная метка модели не проходит за наблюдение", () => {
    const r = mergeCoinv([], [{ ...slice("2026-09-09", "A", 51), src: "ratio_2026-09-09" }]);
    expect(isExact(r.rows[0] as never)).toBe(false);
  });
});
