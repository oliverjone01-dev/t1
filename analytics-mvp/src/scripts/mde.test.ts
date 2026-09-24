// Ошибка в этом расчёте не падает, а печатается на публикуемой странице как авторитетное
// число. 24.09 так и вышло: «288 %» при настоящем пороге падения 94.4 %.
import { describe, it, expect } from "vitest";
import { seLog, detectable, ordersNeeded, Z_POWER } from "./mde.js";

describe("стандартная ошибка", () => {
  it("это корень из суммы обратных по ЧЕТЫРЁМ окнам", () => {
    expect(seLog({ kTb: 1, kTp: 1, kCb: 1, kCp: 1 })).toBe(2);
    expect(seLog({ kTb: 4, kTp: 4, kCb: 4, kCp: 4 })).toBe(1);
  });

  it("реальный случай теста 2 воспроизводится", () => {
    // 2 заказа у теста и 36 у контроля за 14 дней, окно замера тоже 14 дней.
    const se = seLog({ kTb: 2, kTp: 2, kCb: 36, kCp: 36 })!;
    expect(se).toBeCloseTo(1.027402, 5);
  });

  it("пустое окно даёт null, а не бесконечность", () => {
    expect(seLog({ kTb: 0, kTp: 1, kCb: 1, kCp: 1 })).toBeNull();
  });
});

describe("два конца порога", () => {
  it("логарифм переводится в проценты, а не печатается как они", () => {
    const d = detectable(1.027402);
    expect(d.log).toBeCloseTo(2.8767, 3);
    expect(d.rise).toBeCloseTo(1676, 0);
    expect(d.drop).toBeCloseTo(-94.4, 1);
    // Ровно та ошибка, которую поймал ФЕНИКС: 2.8 * se * 100 = 288 %.
    expect(Math.abs(d.drop)).not.toBeCloseTo(287.7, 1);
  });

  it("падение никогда не глубже 100 %: у шкалы есть дно", () => {
    for (const se of [0.1, 0.5, 1, 2, 5]) {
      expect(detectable(se).drop).toBeGreaterThan(-100);
      expect(detectable(se).drop).toBeLessThan(0);
    }
  });

  it("на малых se оба конца сходятся к линейному приближению", () => {
    const d = detectable(0.01);
    expect(d.rise).toBeCloseTo(Z_POWER * 1, 1);      // около 2.8 %
    expect(Math.abs(d.drop)).toBeCloseTo(Z_POWER * 1, 1);
  });

  it("порог тем шире, чем меньше данных", () => {
    expect(detectable(2).rise).toBeGreaterThan(detectable(1).rise);
    expect(detectable(2).drop).toBeGreaterThan(-100);
  });
});

describe("сколько событий нужно", () => {
  it("считается по тем же четырём окнам и по логарифму, а не по проценту", () => {
    // 4 * (2.8 / |ln(0.7)|)^2
    expect(ordersNeeded(30)).toBe(247);
    expect(ordersNeeded(50)).toBe(66);
  });

  it("падение на 100 % не различимо никаким объёмом: возвращается null", () => {
    expect(ordersNeeded(100)).toBeNull();
    expect(ordersNeeded(150)).toBeNull();
  });

  it("бессмысленный запрос не превращается в число", () => {
    expect(ordersNeeded(0)).toBeNull();
    expect(ordersNeeded(-10)).toBeNull();
  });

  it("чем мельче эффект, тем больше нужно данных", () => {
    expect(ordersNeeded(10)!).toBeGreaterThan(ordersNeeded(30)!);
  });

  it("согласовано с порогом: на нужном объёме порог как раз достигается", () => {
    const k = ordersNeeded(30)!;
    const se = seLog({ kTb: k, kTp: k, kCb: k, kCp: k })!;
    expect(Math.abs(detectable(se).drop)).toBeCloseTo(30, 0);
  });
});
