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
const our = (art: string, listed: number, cap: number, date = "2026-08-10", paid?: number): OurRow => ({
  date, art, cap, site_listed: listed, site_paid: paid, observed: true, in_panel: true,
  coinv_listed_pct: Math.round(1000 * (1 - listed / cap)) / 10,
  coinv_paid_pct: paid ? Math.round(1000 * (1 - paid / cap)) / 10 : undefined,
});
/** Снимок старой схемы (до 23.09): другие имена полей, флага observed нет. */
const ourOld = (art: string, site: number, cap: number, date = "2026-08-10"): OurRow => ({
  date, art, cap, site, coinv_pct: Math.round(1000 * (1 - site / cap)) / 10,
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
    expect(c.listed).toBe(50);         // 1 - 50/100
    expect(c.withFactBuyer).toBe(60);  // 1 - 40/100, вышли на факт
    expect(c.withFactCap).toBe(50);    // предельная и так верная, ничего не изменилось
    expect(c.fact).toBe(60);
    expect(verdict(c)).toContain("цена, которую платит покупатель");
  });

  it("предельная снята ниже фактической - виновата предельная", () => {
    // Витрина у нас верная (40), а предельную записали 80 вместо 100.
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 40, 80)], "2026-08");
    expect(c.listed).toBe(50);
    expect(c.withFactCap).toBe(60);
    expect(verdict(c)).toContain("предельная цена");
  });

  it("когда обе цены верны, вердикт молчит про вину", () => {
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 40, 100)], "2026-08");
    expect(verdict(c)).toContain("сходится с фактом");
  });

  it("цена по карте вытягивает показатель на факт там, где витрина не дотягивает", () => {
    // Витрина 50, по карте 40, платит покупатель 40. Ряд по карте и есть верный.
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 50, 100, "2026-08-10", 40)], "2026-08");
    expect(c.listed).toBe(50);
    expect(c.paid).toBe(60);
    expect(c.fact).toBe(60);
    expect(c.artsWithPaid).toBe(1);
    expect(verdict(c)).toContain("по цене с картой");
  });

  it("читает снимок старой схемы, а не обнуляет его", () => {
    const c = calibrate([fact("A", 40, 60, 100)], [ourOld("A", 50, 100)], "2026-08");
    expect(c.listed).toBe(50);
    expect(c.paid).toBeNull();
    expect(c.artsWithPaid).toBe(0);
  });

  it("день без наблюдения в свёртку не попадает", () => {
    const bad = { ...our("A", 10, 100, "2026-08-11"), observed: false };
    const c = calibrate([fact("A", 40, 60, 100)], [our("A", 50, 100), bad], "2026-08");
    expect(c.listed).toBe(50);   // не 70, как было бы со средним по обоим дням
    expect(c.snaps[0]!.days).toBe(1);
  });

  it("считает разброс цены внутри периода и отсекает по нему", () => {
    const rows = [our("A", 50, 100, "2026-08-01"), our("A", 80, 100, "2026-08-02")];
    const wide = calibrate([fact("A", 40, 60, 100)], rows, "2026-08");
    expect(wide.snaps[0]!.spread).toBe(0.462);   // (80-50)/65
    expect(calibrate([fact("A", 40, 60, 100)], rows, "2026-08", 0.15).ordersMatched).toBe(0);
  });

  it("считает по заказам, а не по артикулам: частый артикул весит больше", () => {
    // У A два заказа, у B один. Медиана по заказам идёт по A, по артикулам была бы посередине.
    const f = [fact("A", 40, 60, 100), { ...fact("A", 40, 60, 100), accrual_id: "A-2" }, fact("B", 10, 90, 100)];
    const c = calibrate(f, [our("A", 50, 100), our("B", 20, 100)], "2026-08");
    expect(c.ordersMatched).toBe(3);
    expect(c.listed).toBe(50);   // медиана по трём заказам: 50, 50, 80
    expect(c.fact).toBe(60);
  });

  it("артикул без нашего снимка идёт в пробел, а не в среднее", () => {
    const c = calibrate([fact("A", 40, 60, 100), fact("B", 30, 70, 100)], [our("A", 50, 100)], "2026-08");
    expect(c.artsTotal).toBe(2);
    expect(c.artsMatched).toBe(1);
    expect(c.ordersMatched).toBe(1);
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
    expect(c.listed).toBe(50);
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
