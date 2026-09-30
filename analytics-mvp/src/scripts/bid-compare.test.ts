import { describe, it, expect } from "vitest";
import { sideStat, sideWindow, perWeek, type Day } from "./bid-compare.js";

const daily = new Map<string, Day>([
  ["2026-09-21", { vsearch: 100, pdp: 10, cart: 1, units: 0, spend: 50 }],
  ["2026-09-22", { vsearch: 200, pdp: 20, cart: 2, units: 1, spend: 300 }],
  ["2026-09-23", { spend: 300 }],                       // расход есть, воронки нет
  ["2026-09-24", { vsearch: 400, pdp: 40, cart: 4, units: 0, spend: 300 }],
]);
const gap = new Map([["2026-09-22", 53.5], ["2026-09-24", 55.9], ["2026-09-25", 40]]);

describe("bid-compare", () => {
  it("суммирует окно, пропуск воронки не считает днём, расход берёт за все дни", () => {
    const s = sideStat(daily, gap, "2026-09-22", "2026-09-24");
    expect(s.days).toBe(2);
    expect(s.vsearch).toBe(600);
    expect(s.cart).toBe(6);
    expect(s.units).toBe(1);
    expect(s.spend).toBe(900);
    expect(s.spendDays).toBe(3);
    expect(s.cartPer1k).toBeCloseTo(6 / 900 * 1000);
    expect(s.gapMed).toBeCloseTo((53.5 + 55.9) / 2);
    expect(s.gapDays).toBe(2);
  });
  it("расход только до spendTo, корзины на 1 000 ₽ за те же дни", () => {
    const s = sideStat(daily, gap, "2026-09-22", "2026-09-24", "2026-09-23");
    expect(s.spend).toBe(600);
    expect(s.spendDays).toBe(2);
    expect(s.cart).toBe(6);
    expect(s.cartPer1k).toBeCloseTo(2 / 600 * 1000);
  });
  it("без расхода корзин на 1 000 ₽ нет, без наблюдений соинвеста нет", () => {
    const s = sideStat(new Map([["2026-10-01", { vsearch: 5, cart: 1 }]]), undefined, "2026-10-01", "2026-10-01");
    expect(s.cartPer1k).toBeNull();
    expect(s.gapMed).toBeNull();
    expect(sideStat(undefined, undefined, "2026-10-01", "2026-10-02").days).toBe(0);
  });
  it("окно стороны: своё с/по или старт пары и последний день", () => {
    const p = { название: "x", старт: "2026-09-22", большая: { артикул: "A" }, малая: { артикул: "B", с: "2026-10-01" } };
    expect(sideWindow(p, p.большая, "2026-09-28")).toEqual({ from: "2026-09-22", to: "2026-09-28" });
    expect(sideWindow(p, p.малая, "2026-09-28")).toEqual({ from: "2026-10-01", to: "2026-09-28" });
    expect(sideWindow(p, { артикул: "A", по: "2026-09-27" }, "2026-09-29").to).toBe("2026-09-27");
  });
  it("в неделю: к семи дням наблюдения", () => {
    expect(perWeek(600, 2)).toBe(2100);
    expect(perWeek(5, 0)).toBeNull();
  });
});
