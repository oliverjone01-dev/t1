import { describe, it, expect } from "vitest";
import { parseOzonNumber, safeDiv, delta } from "./num.js";

describe("parseOzonNumber - десятичная запятая OZON", () => {
  it("парсит запятую как десятичный разделитель", () => {
    expect(parseOzonNumber("0,00")).toBe(0);
    expect(parseOzonNumber("1234,56")).toBeCloseTo(1234.56);
  });
  it("убирает разделители тысяч (пробелы)", () => {
    expect(parseOzonNumber("1 234,56")).toBeCloseTo(1234.56);
    expect(parseOzonNumber("12 000,00")).toBe(12000);
  });
  it("пропускает обычные числа", () => {
    expect(parseOzonNumber(42)).toBe(42);
    expect(parseOzonNumber("99.9")).toBeCloseTo(99.9);
  });
  it("безопасен к мусору и пустоте", () => {
    expect(parseOzonNumber("")).toBe(0);
    expect(parseOzonNumber(null)).toBe(0);
    expect(parseOzonNumber(undefined)).toBe(0);
    expect(parseOzonNumber("abc")).toBe(0);
    expect(parseOzonNumber(NaN)).toBe(0);
  });
});

describe("safeDiv", () => {
  it("делит как обычно", () => {
    expect(safeDiv(10, 4)).toBe(2.5);
  });
  it("возвращает 0 при нулевом знаменателе", () => {
    expect(safeDiv(5, 0)).toBe(0);
  });
});

describe("delta", () => {
  it("считает абсолют и долю", () => {
    expect(delta(110, 100)).toEqual({ abs: 10, pct: 0.1 });
  });
  it("безопасен при нулевой базе", () => {
    expect(delta(5, 0)).toEqual({ abs: 5, pct: 0 });
  });
});
