import { describe, it, expect } from "vitest";
import { resolvePeriod, lenDays, isClosedFullMonth, DATA_FLOOR } from "./period.js";

// Фиксируем "сегодня" = 2026-06-05, значит вчера (потолок) = 2026-06-04.
const today = "2026-06-05";

describe("resolvePeriod - равные окна", () => {
  it("дефолт: неделя к неделе, окна равной длины", () => {
    const p = resolvePeriod({ today });
    expect(lenDays(p.cur)).toBe(7);
    expect(lenDays(p.cmp)).toBe(7);
    expect(p.cur.to).toBe("2026-06-04"); // вчера
    expect(p.cur.from).toBe("2026-05-29");
    expect(p.cmp.to).toBe("2026-05-28");
  });

  it("вчера к позавчера", () => {
    const p = resolvePeriod({ today, question: "что было вчера" });
    expect(p.cur).toEqual({ from: "2026-06-04", to: "2026-06-04" });
    expect(p.cmp).toEqual({ from: "2026-06-03", to: "2026-06-03" });
  });
});

describe("resolvePeriod - месяцы", () => {
  it("разбери апрель: полный закрытый месяц против марта", () => {
    const p = resolvePeriod({ today, question: "разбери апрель" });
    expect(p.cur).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    expect(p.cmp.from).toBe("2026-03-01");
    expect(lenDays(p.cur)).toBe(lenDays(p.cmp));
  });

  it("начало июня к маю: равные окна, верх клампится к вчера", () => {
    const p = resolvePeriod({ today, question: "сравни начало июня к маю" });
    // начало июня = 1-10, но потолок вчера = 4 июня -> 1-4
    expect(p.cur).toEqual({ from: "2026-06-01", to: "2026-06-04" });
    expect(lenDays(p.cur)).toBe(4);
    expect(p.cmp.from).toBe("2026-05-01");
    expect(lenDays(p.cmp)).toBe(4); // равная длина
  });
});

describe("resolvePeriod - клампинг к полу данных", () => {
  it("не уходит ниже февраля 2026", () => {
    const p = resolvePeriod({
      today: "2026-02-10",
      explicit: { curFrom: "2026-01-01", curTo: "2026-01-31" },
    });
    expect(p.cur.from >= DATA_FLOOR).toBe(true);
  });
});

describe("isClosedFullMonth - авто-режим P&L", () => {
  it("полный апрель при закрытом апреле = true", () => {
    expect(
      isClosedFullMonth({ from: "2026-04-01", to: "2026-04-30" }, ["2026-02", "2026-03", "2026-04"]),
    ).toBe(true);
  });
  it("часть месяца = false", () => {
    expect(
      isClosedFullMonth({ from: "2026-04-01", to: "2026-04-04" }, ["2026-04"]),
    ).toBe(false);
  });
  it("незакрытый месяц = false", () => {
    expect(
      isClosedFullMonth({ from: "2026-05-01", to: "2026-05-31" }, ["2026-02", "2026-03", "2026-04"]),
    ).toBe(false);
  });
});
