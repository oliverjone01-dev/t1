import { describe, it, expect } from "vitest";
import { dailyRecords } from "./ads-daily.js";

const row = (date: string, id: string, spent: number, orders: number, om: number, title = "") =>
  ({ id, title, date, views: 0, clicks: 0, toCart: 0, spent, orders, ordersMoney: om });

describe("dailyRecords", () => {
  it("формат, фильтр окна и округление сумм", () => {
    const rows = [
      row("2026-06-01", "1", 100.4, 2, 500.6, "GGT-1"),
      row("2026-05-31", "1", 9, 1, 9, "GGT-1"),      // вне окна снизу
      row("2026-06-02", "2", 50, 0, 0),               // пустой title -> off=id
      row("2026-06-03", "1", 1, 1, 1, "GGT-1"),       // вне окна сверху
    ];
    expect(dailyRecords(rows, "2026-06-01", "2026-06-02")).toEqual([
      { d: "2026-06-01", id: "1", off: "GGT-1", sp: 100, o: 2, om: 501, vw: 0, cl: 0, ca: 0 },
      { d: "2026-06-02", id: "2", off: "2", sp: 50, o: 0, om: 0, vw: 0, cl: 0, ca: 0 },
    ]);
  });

  it("строки без даты пропускаются", () => {
    expect(dailyRecords([row("", "1", 5, 1, 5)], "2026-06-01", "2026-06-30")).toEqual([]);
  });
});
