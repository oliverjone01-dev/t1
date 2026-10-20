import { describe, it, expect } from "vitest";
import { adEconPeriod, packAccrual, ueWhy, UE_MATURE_DAYS, UE_TOPUP_WIN_DAYS } from "./ad-econ.js";

// Эталон посчитан вручную. Период 2026-09-01..2026-09-30. Строка: [дата, sku, начислено, к выплате, комиссия].
// SKU A: 3 дня, начислено 300, к выплате 150 -> 50%. SKU B: 1 день, 100/40 -> 60% (порога нет: только период).
// SKU C: 2026-08-31 и 2026-10-01 - вне периода. SKU D: начислено 0 - ставки нет.
// SKU E: доставлен с выручкой 100 и комиссией 0 (к выплате 90) - остаётся в расчёте (Иван 20.10: «1 вернуть»): 10%.
// SKU-ряд за период: 500 / 280 -> 44%. Канал за период: 500, сборы -225 -> 45%; надбавка 1.0 п.п.
const rows = [
  ["2026-09-01", "A", 100, 50, -40], ["2026-09-10", "A", 100, 50, -40], ["2026-09-30", "A", 100, 50, -40],
  ["2026-09-15", "B", 100, 40, -50], ["2026-09-20", "B", 0, 0, 0],
  ["2026-08-31", "C", 1000, 0, -500], ["2026-10-01", "C", 1000, 0, -500],
  ["2026-09-05", "D", 0, 0, 0],
  ["2026-09-06", "E", 100, 90, 0],
];
const ch = [["2026-08-31", 1000, -1000], ["2026-09-01", 500, -225], ["2026-10-01", 500, -500]];
const P = ["2026-09-01", "2026-09-30"] as const;
const MATURE = "2026-10-06"; // «сегодня − 14 дней» для теста: сентябрь закрыт

describe("ставка сборов OZON за выбранный период", () => {
  const r = adEconPeriod(rows, ch, ...P, MATURE);
  it("ставка SKU = (начислено − к выплате) / начислено за дни периода + надбавка канала", () => {
    expect(r.topUp).toBe(1);
    expect(r.warn).toEqual([]);
    expect(r.by.A).toEqual({ com: 51, accr: 300, days: 3 });
    expect(r.by.B).toEqual({ com: 61, accr: 100, days: 1 });
  });
  it("строка с выручкой и нулевой комиссией остаётся в ставке", () => {
    expect(r.by.E).toEqual({ com: 11, accr: 100, days: 1 });
    expect(r.own).toBe(true);
  });
  it("вне периода и без начислений - ставки нет, без подстановок", () => {
    expect(r.by.C).toBeUndefined();
    expect(r.by.D).toBeUndefined();
  });
  it("границы периода включительно: день to входит, день после - нет", () => {
    expect(adEconPeriod(rows, ch, "2026-09-30", "2026-09-30").by.A).toMatchObject({ accr: 100, days: 1 });
    expect(adEconPeriod(rows, ch, "2026-09-01", "2026-09-30").by.C).toBeUndefined();
    expect(adEconPeriod(rows, ch, "2026-10-01", "2026-10-01").by.C).toMatchObject({ accr: 1000, days: 1 });
  });
  it("день to канала входит в надбавку", () => {
    const x = adEconPeriod([["2026-09-30", "A", 100, 50, -40]], [["2026-09-30", 100, -51]], ...P, MATURE);
    expect(x.topUp).toBe(1);
  });
  it("порог расхождения каналов 1%: ровно 1% - надбавка есть, больше - нет", () => {
    const ok = adEconPeriod([["2026-09-01", "A", 100, 50, -40]], [["2026-09-01", 101, -51]], ...P, MATURE);
    expect(ok.topUp).not.toBeNull();
    const bad = adEconPeriod([["2026-09-01", "A", 100, 50, -40]], [["2026-09-01", 101.5, -51]], ...P, MATURE);
    expect(bad.topUp).toBeNull();
    expect(bad.warn[0]).toContain("расходится");
    expect(bad.by.A!.com).toBe(50);
  });
  it(`период моложе ${UE_MATURE_DAYS} дней - надбавка последних ${UE_TOPUP_WIN_DAYS} зрелых дней (до matureTo)`, () => {
    // зрелое окно 2026-08-31..2026-09-29: A 100/50 -> 50%, канал 100/-51 -> 51% -> 1.0; день 2026-09-30 в окно не входит
    const x = adEconPeriod([["2026-09-10", "A", 100, 50, -40], ["2026-09-30", "A", 100, 50, -40]],
      [["2026-08-30", 900, -900], ["2026-09-10", 100, -51], ["2026-09-30", 100, -90]], ...P, "2026-09-29");
    expect(x).toMatchObject({ topUp: 1, topUpFrom: "2026-08-31", topUpTo: "2026-09-29", own: false, warn: [] });
    expect(x.by.A).toEqual({ com: 51, accr: 200, days: 2 });
  });
  it("граница зрелости: период, закончившийся ровно в день matureTo, - зрелый", () => {
    expect(adEconPeriod(rows, ch, ...P, "2026-09-30")).toMatchObject({ topUp: 1, own: true });
  });
  it("канала за период нет - надбавки нет, причина в warn", () => {
    const x = adEconPeriod(rows, [], ...P, MATURE);
    expect(x.topUp).toBeNull();
    expect(x.warn[0]).toContain("канального ряда");
  });
  it("отрицательная надбавка - 0 и предупреждение", () => {
    const x = adEconPeriod(rows, [["2026-09-01", 500, -200]], ...P, MATURE);
    expect(x.topUp).toBe(0);
    expect(x.warn[0]).toContain("отрицательная");
    expect(x.by.A!.com).toBe(50);
  });
  it("начислений за период нет - пусто и причина", () => {
    const x = adEconPeriod(rows, ch, "2026-11-01", "2026-11-30", MATURE);
    expect(x.by).toEqual({});
    expect(x.topUp).toBeNull();
    expect(x.warn[0]).toContain("не доставлены");
  });
});

describe("строка кампании: считать или почему нет (ФЕНИКС B7: без выручки не бывает «в плюс»)", () => {
  it("без выручки - всегда «выручки нет», даже при ставке и с/с", () => {
    expect(ueWhy(0, 3, 50, 1000)).toBe("выручки за период нет");
    expect(ueWhy(-1, 0, 50, 1000)).toBe("выручки за период нет");
  });
  it("ряд начислений устарел - причина про сборщик, а не про недоставку", () => {
    expect(ueWhy(100, 1, null, 1000, "12.10.2026")).toBe("ряд начислений не обновлялся с 12.10.2026");
    expect(ueWhy(100, 1, 50, 1000, "12.10.2026")).toBeNull();
  });
  it("выручка есть: заказы, ставка, с/с - по порядку; всё есть - считаем", () => {
    expect(ueWhy(100, 0, 50, 1000)).toBe("заказов за период нет");
    expect(ueWhy(100, 1, null, 1000)).toContain("нет начислений");
    expect(ueWhy(100, 1, 50, null)).toBe("нет себестоимости");
    expect(ueWhy(100, 1, 50, 1000)).toBeNull();
  });
});

describe("упаковка ряда начислений: битая строка пропускается и считается, сборка не падает", () => {
  it("null, строка без даты или с нечисловой суммой - bad, остальное в массивах", () => {
    const p = packAccrual(
      [null, { d: "2026-09-01", sku: 1, accruals: 10, amount: 5, commission: -3 }, { sku: "x", accruals: 1, amount: 1, commission: 0 },
        { d: "2026-09-02", sku: "y", accruals: null, amount: 1, commission: 0 }, { d: "2026-09-02", sku: "z", accruals: 1, amount: 1 }],
      [{ d: "2026-09-01", accruals: 10, fees: -5 }, "мусор"],
    );
    expect(p.rows).toEqual([["2026-09-01", "1", 10, 5, -3]]);
    expect(p.ch).toEqual([["2026-09-01", 10, -5]]);
    expect(p.bad).toBe(5);
    expect(p.last).toBe("2026-09-01");
  });
});
