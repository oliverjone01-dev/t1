// Вкладка «Отчет» OZON: периоды «месяц к месяцу» и разложения отклонений (Иван 01.10.2026, «2а», «4»).
// Клиентский код страницы (REPORT_JS) исполняется здесь как есть - те же функции, что в браузере.
import { describe, expect, it } from "vitest";
import { REPORT_JS, isCpoCampaign } from "./report-page.js";

const load = (maxD: string) =>
  new Function("MAXD", "fmtRu", REPORT_JS + ";return {rpPeriods,rpUnitsPrice,rpVolRate,rpPrevYm,rpPct};")(maxD, (n: number) => String(Math.round(n)));

describe("отчёт: периоды", () => {
  it("незакрытый месяц сравнивается с теми же числами прошлого (данные по 29.09)", () => {
    const P = load("2026-09-29").rpPeriods("2026-09");
    expect(P.partial).toBe(true);
    expect(P.cur).toEqual({ from: "2026-09-01", to: "2026-09-29" });
    expect(P.prev).toEqual({ from: "2026-08-01", to: "2026-08-29" });
  });
  it("закрытый месяц - целиком к целому прошлому", () => {
    const P = load("2026-09-29").rpPeriods("2026-08");
    expect(P.partial).toBe(false);
    expect(P.cur).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(P.prev).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });
  it("31-е число прошлого месяца обрезается по его концу, январь -> декабрь прошлого года", () => {
    expect(load("2026-03-30").rpPeriods("2026-03").prev).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(load("2027-01-31").rpPeriods("2027-01").prev).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("отчёт: разложение отклонений", () => {
  it("штуки и цена в сумме дают отклонение (эталон: «Деньги», июль -> август 2026)", () => {
    // ИТОГО таблицы «Аналитика по артикулам»: июль 22 301 584 ₽ / 383 шт, август 18 905 221 ₽ / 299 шт.
    const r = load("2026-09-29").rpUnitsPrice(22_301_584, 383, 18_905_221, 299)!;
    expect(r.vol + r.price).toBeCloseTo(18_905_221 - 22_301_584, 6);
    expect(Math.round(r.vol)).toBe(-4_891_209); // (299-383) × 58 228,68
    expect(Math.round(r.p1)).toBe(63_228);
  });
  it("объём и ставка статьи в сумме дают отклонение статьи", () => {
    // Комиссия июль 10 274 159 / август 9 055 751 при начислено 22 301 584 / 18 905 221.
    const r = load("2026-09-29").rpVolRate(10_274_159, 22_301_584, 9_055_751, 18_905_221)!;
    expect(r.vol + r.rate).toBeCloseTo(9_055_751 - 10_274_159, 6);
    expect(r.r1).toBeGreaterThan(r.r0); // доля комиссии выросла 46,1% -> 47,9%
  });
  it("без штук или оборота в одном из месяцев разложения нет (не делим на 0)", () => {
    const f = load("2026-09-29");
    expect(f.rpUnitsPrice(100, 0, 200, 2)).toBeNull();
    expect(f.rpVolRate(10, 0, 20, 100)).toBeNull();
  });
  it("процент от базы меньше 1000 ₽ не показывается", () => {
    const f = load("2026-09-29");
    expect(f.rpPct(786_225, -380)).toBeNull();
    expect(f.rpPct(110, 100_000)).toBeCloseTo(-99.89, 2);
  });
});

describe("отчёт: тип кампании", () => {
  it("«за заказ» по названию кампании", () => {
    expect(isCpoCampaign("Оплата за заказ - все товары")).toBe(true);
    expect(isCpoCampaign("GGM-01")).toBe(false);
    expect(isCpoCampaign("")).toBe(false);
  });
});
