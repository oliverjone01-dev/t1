// Калибровка должна не просто показать расхождение, а назвать виновную цену. Ошибка здесь
// дороже, чем в самом соинвесте: по вердикту калибровки решают, что чинить в сборе данных.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { brokenRows, calibrate, verdict, pts, median, type FactRow, type OurRow } from "./coinv-calibration.js";

const fact = (art: string, buyer: number, ozon: number, seller: number): FactRow => ({
  accrual_id: `${art}-1`, art, qty: 1,
  seller_price_unit: seller, seller_price_total: seller,
  paid_by_buyer: buyer, paid_by_ozon: ozon, partner_programs: 0,
  ozon_share_pct: Math.round(1000 * ozon / seller) / 10, period: "2026-08",
});
const our = (art: string, site: number, cap: number, date = "2026-08-10"): OurRow => ({
  date, art, site, cap, coinv_pct: Math.round(1000 * (1 - site / cap)) / 10,
});

describe("эталон начислений", () => {
  it("ловит строку, где тождество не сходится", () => {
    const rows = [fact("A", 40, 60, 100), { ...fact("B", 40, 60, 100), paid_by_buyer: 10 }];
    expect(brokenRows(rows)).toEqual([{ id: "B-1", art: "B", residual: 30 }]);
  });

  it("копеечное округление битой строкой не считает", () => {
    expect(brokenRows([{ ...fact("A", 40.4, 59.2, 100) }])).toEqual([]);
  });
});

describe("калибровка называет виновную цену", () => {
  it("витрина снята выше фактической - виновата витрина", () => {
    // Покупатель платит 40, мы записали витрину 50. Предельная у нас верная.
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 50, 100)], "2026-08");
    expect(c.our).toBe(50);            // 1 - 50/100
    expect(c.withFactBuyer).toBe(60);  // 1 - 40/100, вышли на факт
    expect(c.withFactCap).toBe(50);    // предельная и так верная, ничего не изменилось
    expect(c.fact).toBe(60);
    expect(verdict(c)).toContain("витрина");
  });

  it("предельная снята ниже фактической - виновата предельная", () => {
    // Витрина у нас верная (40), а предельную записали 80 вместо 100.
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 40, 80)], "2026-08");
    expect(c.our).toBe(50);
    expect(c.withFactCap).toBe(60);
    expect(verdict(c)).toContain("предельная цена");
  });

  it("когда обе цены верны, вердикт молчит про вину", () => {
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 40, 100)], "2026-08");
    expect(verdict(c)).toContain("сходится с фактом");
  });

  it("артикул без нашего снимка идёт в пробел, а не в среднее", () => {
    const c = calibrate([fact("A", 40, 60, 100), fact("B", 30, 70, 100)], [our("A", 50, 100)], "2026-08");
    expect(c.artsTotal).toBe(2);
    expect(c.artsMatched).toBe(1);
    expect(c.missing).toEqual(["B"]);
    expect(c.revenueTotal).toBe(200);
    expect(c.revenueMatched).toBe(100);
  });

  it("возврат (отрицательная сумма) долю не искажает", () => {
    const ret = { ...fact("A", -40, -60, -100), seller_price_unit: -100, accrual_id: "A-2" };
    const c = calibrate([fact("A", 40, 60, 100), ret], [our("A", 50, 100)], "2026-08");
    expect(c.ordersTotal).toBe(1);
    expect(c.fact).toBe(60);
  });

  it("чужой период в расчёт не попадает", () => {
    const july = { ...fact("A", 10, 90, 100), period: "2026-07", accrual_id: "A-7" };
    const c = calibrate([fact("A", 40, 60, 100), july], [our("A", 50, 100), our("A", 10, 100, "2026-07-10")], "2026-08");
    expect(c.ordersTotal).toBe(1);
    expect(c.our).toBe(50);
    expect(c.fact).toBe(60);
  });
});

describe("склонение пунктов", () => {
  it("склоняет по-русски", () => {
    expect(pts(1)).toBe("1 пункт");
    expect(pts(3)).toBe("3 пункта");
    expect(pts(7)).toBe("7 пунктов");
    expect(pts(11)).toBe("11 пунктов");
    expect(pts(21)).toBe("21 пункт");
    expect(pts(-2)).toBe("-2 пункта");
    expect(pts(4.6)).toBe("4.6 пункта");
  });
});

describe("медиана", () => {
  it("на пустом ряду отдаёт NaN, а не ноль", () => {
    expect(median([])).toBeNaN();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

// Эталон лежит в data/ и в CI доступен: держим на нём тот же контракт, что и на синтетике.
describe("эталон августа из data/", () => {
  const P = "data/payout_orders.ndjson";
  const has = existsSync(P);
  it.skipIf(!has)("тождество сходится у всех строк, кроме известной одной", () => {
    const rows = readFileSync(P, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as FactRow);
    expect(rows.length).toBeGreaterThan(300);
    const bad = brokenRows(rows);
    // 05063721-0463-1: в выгрузке у строки qty=1, а суммы покупателя и Ozon идут за две штуки.
    expect(bad.map((b) => b.id)).toEqual(["05063721-0463-1"]);
  });
});
