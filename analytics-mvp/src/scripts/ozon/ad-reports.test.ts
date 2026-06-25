import { describe, it, expect } from "vitest";
import { buildWindowReports, type OfferInfo, type TopCamp } from "./ad-reports.js";

const offers: Record<string, OfferInfo> = {
  "GGT-03-3-3-E-16080": { sku: "3564841366", name: "GENGLASS Стол кухонный овальный белый" },
};

describe("buildWindowReports (per-SKU отчёт прямым джойном)", () => {
  it("резолвит offer кампании в Основную карточку с расходом/заказами/выручкой", () => {
    const ts: TopCamp[] = [{ id: "24141166", off: "GGT-03-3-3-E-16080", sp: 136119, o: 15, om: 868071 }];
    const r = buildWindowReports(ts, offers);
    expect(r["24141166"]).toEqual([
      { sku: "3564841366", name: "GENGLASS Стол кухонный овальный белый", sp: 136119, sold: 15, om: 868071, soldModel: 0, omModel: 0, drr: 15.7 },
    ]);
  });

  it("каталожная кампания (offer не сматчен) -> пусто, фронт покажет «недоступна»", () => {
    const ts: TopCamp[] = [{ id: "28753239", off: "Оплата за заказ - все товары", sp: 105056, o: 0, om: 0 }];
    const r = buildWindowReports(ts, offers);
    expect(r["28753239"]).toEqual([]);
  });

  it("кампания без id пропускается (id - ключ кэша)", () => {
    const r = buildWindowReports([{ off: "GGT-03-3-3-E-16080", sp: 100, o: 1, om: 200 }], offers);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("drr считается из sp/om, при om=0 берётся переданный drr", () => {
    const ts: TopCamp[] = [{ id: "1", off: "GGT-03-3-3-E-16080", sp: 50, o: 0, om: 0, drr: 0 }];
    const r = buildWindowReports(ts, offers);
    expect(r["1"]![0]!.drr).toBe(0);
    expect(r["1"]![0]!.soldModel).toBe(0);
    expect(r["1"]![0]!.omModel).toBe(0);
  });
});
