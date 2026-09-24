// Помощник решает, на каком окне вообще имеет смысл проверка «ещё едет». Ошибка здесь тихая:
// тест либо молча проходит на дозревшем окне, либо падает через неделю без причины.
import { describe, it, expect } from "vitest";
import {
  flyShare, inFlightUnits, immatureWindow, windowWithInFlight, readDays, FLY_SHARE, type DayRow,
} from "./test-window.js";

const D = (n: number): string => `2026-09-${String(n).padStart(2, "0")}`;
/** День: заказано на revenue, из них fly ещё едет. */
const day = (n: number, revenue: number, fly: number, extra: Partial<DayRow> = {}): DayRow =>
  ({ date: D(n), revenue, rev_canc: 0, rev_fly: fly, units: 0, delivered: 0, cancellations: 0, returns: 0, ...extra });

describe("доля в пути", () => {
  it("считается от чистого оборота, отменённое из знаменателя вычитается", () => {
    const rows = [day(10, 200, 50, { rev_canc: 100 })];
    expect(flyShare(rows, D(10), D(10))).toBe(0.5);   // 50 / (200 - 100)
  });

  it("на пустом окне это ноль, а не деление на ноль", () => {
    expect(flyShare([day(10, 0, 0)], D(10), D(10))).toBe(0);
    expect(flyShare([], D(1), D(30))).toBe(0);
  });
});

describe("штуки в пути", () => {
  it("это заказано минус доставлено, отменено и возвращено", () => {
    const rows = [day(10, 0, 0, { units: 10, delivered: 3, cancellations: 2, returns: 1 })];
    expect(inFlightUnits(rows, D(10), D(10))).toBe(4);
  });
});

describe("поиск недозревшего окна", () => {
  it("берёт самое широкое окно, которое ещё не дозрело", () => {
    // Хвост свежий (едет всё), а вглубь окно дозревает. Ожидаем границу на 3 днях.
    const rows = [day(15, 1000, 0), day(16, 1000, 0), day(17, 1000, 0),
                  day(18, 100, 100), day(19, 100, 100), day(20, 100, 100)];
    const [from, to] = immatureWindow(rows, 1, 6);
    expect(to).toBe(D(20));
    expect(from).toBe(D(18));
    expect(flyShare(rows, from, to)).toBeGreaterThan(FLY_SHARE);
  });

  it("дозревшие данные это ошибка с объяснением, а не молчаливый пропуск", () => {
    const rows = [day(18, 1000, 0), day(19, 1000, 0), day(20, 1000, 0)];
    expect(() => immatureWindow(rows, 1, 3)).toThrowError(/недозревшего окна/);
  });

  it("пустые данные названы отдельно от дозревших", () => {
    expect(() => immatureWindow([], 1, 3)).toThrowError(/нет ни одного дня/);
  });

  it("окно со штуками в пути ищется по штукам, а не по деньгам", () => {
    // Денег в пути нет вовсе, а штуки есть: разные вопросы, разные окна.
    const rows = [day(19, 1000, 0, { units: 5, delivered: 5 }), day(20, 1000, 0, { units: 5, delivered: 1 })];
    const [from, to] = windowWithInFlight(rows, 1, 2);
    expect(inFlightUnits(rows, from, to)).toBeGreaterThan(0);
    expect(to).toBe(D(20));
  });

  it("если всё доехало, это тоже ошибка с объяснением", () => {
    const rows = [day(20, 1000, 0, { units: 5, delivered: 5 })];
    expect(() => windowWithInFlight(rows, 1, 1)).toThrowError(/нет заказов в пути/);
  });
});

describe("на живом снимке Маркета", () => {
  it("недозревшее окно находится и действительно недозрело", () => {
    const rows = readDays();
    const [from, to] = immatureWindow(rows);
    expect(from <= to).toBe(true);
    expect(flyShare(rows, from, to)).toBeGreaterThan(FLY_SHARE);
    expect(to).toBe(rows[rows.length - 1]!.date);   // окно упирается в край данных
  });

  it("окно со штуками в пути находится", () => {
    const rows = readDays();
    const [from, to] = windowWithInFlight(rows);
    expect(inFlightUnits(rows, from, to)).toBeGreaterThan(0);
  });
});
