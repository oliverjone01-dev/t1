import { describe, it, expect } from "vitest";
import { adEconPeriod, packAccrual } from "./ad-econ.js";

// Эталон посчитан вручную. Период 2026-09-01..2026-09-30.
// SKU A: 3 дня, начислено 300, к выплате 150 -> 50%. SKU B: 1 день, 100/40 -> 60% (порога нет: только период).
// SKU C: 2026-08-31 - вне периода, ставки нет. SKU D: начислено 0 - ставки нет.
// SKU-ряд за период: 400 / 190 -> 52.5%; канал за период: 400, сборы -214 -> 53.5%; надбавка 1.0 п.п.
const rows = [
  ["2026-09-01", "A", 100, 50], ["2026-09-10", "A", 100, 50], ["2026-09-30", "A", 100, 50],
  ["2026-09-15", "B", 100, 40],
  ["2026-08-31", "C", 1000, 0],
  ["2026-09-05", "D", 0, 0],
];
const ch = [["2026-08-31", 1000, -1000], ["2026-09-01", 400, -214], ["2026-10-01", 500, -500]];
const P = ["2026-09-01", "2026-09-30"] as const;

describe("ставка сборов OZON за выбранный период", () => {
  const r = adEconPeriod(rows, ch, ...P);
  it("ставка SKU = (начислено − к выплате) / начислено за дни периода + надбавка канала", () => {
    expect(r.topUp).toBe(1);
    expect(r.warn).toEqual([]);
    expect(r.by.A).toEqual({ com: 51, accr: 300, days: 3 });
    expect(r.by.B).toEqual({ com: 61, accr: 100, days: 1 });
  });
  it("вне периода и без начислений - ставки нет, без подстановок", () => {
    expect(r.by.C).toBeUndefined();
    expect(r.by.D).toBeUndefined();
  });
  it("границы периода включительно: день to входит, день после - нет", () => {
    expect(adEconPeriod(rows, ch, "2026-09-30", "2026-09-30").by.A).toMatchObject({ accr: 100, days: 1 });
    expect(adEconPeriod(rows, ch, "2026-10-01", "2026-10-31").by).toEqual({});
  });
  it("канал расходится больше 1% - надбавки нет, причина в warn", () => {
    const x = adEconPeriod(rows, [["2026-09-01", 500, -250]], ...P);
    expect(x.topUp).toBeNull();
    expect(x.warn[0]).toContain("расходится");
    expect(x.by.A!.com).toBe(50);
  });
  it("канала за период нет - надбавки нет, причина в warn", () => {
    const x = adEconPeriod(rows, [], ...P);
    expect(x.topUp).toBeNull();
    expect(x.warn[0]).toContain("канального ряда");
  });
  it("отрицательная надбавка - 0 и предупреждение", () => {
    const x = adEconPeriod(rows, [["2026-09-01", 400, -200]], ...P);
    expect(x.topUp).toBe(0);
    expect(x.warn[0]).toContain("отрицательная");
    expect(x.by.A!.com).toBe(50);
  });
  it("начислений за период нет - пусто и причина", () => {
    const x = adEconPeriod(rows, ch, "2026-11-01", "2026-11-30");
    expect(x.by).toEqual({});
    expect(x.topUp).toBeNull();
    expect(x.warn[0]).toContain("не доставлены");
  });
});

describe("упаковка ряда начислений: битая строка пропускается и считается, сборка не падает", () => {
  it("null, строка без даты или с нечисловой суммой - bad, остальное в массивах", () => {
    const p = packAccrual(
      [null, { d: "2026-09-01", sku: 1, accruals: 10, amount: 5 }, { sku: "x", accruals: 1, amount: 1 }, { d: "2026-09-02", sku: "y", accruals: null, amount: 1 }],
      [{ d: "2026-09-01", accruals: 10, fees: -5 }, "мусор"],
    );
    expect(p.rows).toEqual([["2026-09-01", "1", 10, 5]]);
    expect(p.ch).toEqual([["2026-09-01", 10, -5]]);
    expect(p.bad).toBe(4);
  });
});
