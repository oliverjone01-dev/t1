// Контракт файла воронки. Ошибка здесь тихая вдвойне: битая строка либо молча выпадает,
// либо втекает в медиану и сдвигает разницу тест минус контроль.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRow, readFunnelTests, missingDays, testIdOf, MEDIAN_PREFIX } from "./funnel-tests.js";

const ok = { date: "2026-09-22", art: "GGT-03-1-3-S-40", role: "test", search_position: 12, search_views: 100, pdp_views: 9, hits_to_cart: 2, ordered_units: 1 };

describe("разбор строки", () => {
  it("принимает строку контракта как есть", () => {
    expect(parseRow(ok)).toEqual({ ...ok, role: "test" });
  });

  it("позиция может быть null: товара нет в выдаче", () => {
    const r = parseRow({ ...ok, search_position: null });
    expect(typeof r === "string" ? r : r.search_position).toBeNull();
  });

  it("ноль позицией не бывает и читается как «нет в выдаче»", () => {
    const r = parseRow({ ...ok, search_position: 0 });
    expect(typeof r === "string" ? r : r.search_position).toBeNull();
  });

  it("чужая роль отвергается с объяснением, а не молча", () => {
    expect(parseRow({ ...ok, role: "panel" })).toContain("не из test|control|median|reference");
  });

  it("медиана обязана называться MEDIAN:<id>, обычный товар - нет", () => {
    expect(parseRow({ ...ok, role: "median" })).toContain("артикул не");
    expect(parseRow({ ...ok, art: MEDIAN_PREFIX + "cpc_bid_down" })).toContain("с ролью test");
    const m = parseRow({ ...ok, role: "median", art: MEDIAN_PREFIX + "cpc_bid_down" });
    expect(typeof m === "string" ? "" : m.art).toBe(MEDIAN_PREFIX + "cpc_bid_down");
    expect(testIdOf(MEDIAN_PREFIX + "cpc_bid_down")).toBe("cpc_bid_down");
  });

  it("кривая дата и пустой артикул отвергаются", () => {
    expect(parseRow({ ...ok, date: "22.09.2026" })).toContain("не вида");
    expect(parseRow({ ...ok, art: "  " })).toContain("пустой артикул");
  });

  it("отрицательные и нечисловые количества отвергаются, а не приводятся к нулю", () => {
    expect(parseRow({ ...ok, search_views: -1 })).toContain("не неотрицательное");
    expect(parseRow({ ...ok, ordered_units: "много" })).toContain("не неотрицательное");
  });

  it("отсутствующее количество это ноль: ноль заказов за день это нормально", () => {
    const r = parseRow({ date: ok.date, art: ok.art, role: "test", search_position: 5 });
    expect(typeof r === "string" ? null : r.ordered_units).toBe(0);
  });
});

describe("чтение файла", () => {
  const write = (lines: string[]): string => {
    const p = join(mkdtempSync(join(tmpdir(), "ft-")), "funnel_tests.ndjson");
    writeFileSync(p, lines.join("\n") + "\n");
    return p;
  };

  it("файла нет - это не ошибка, а пустой результат с признаком", () => {
    const r = readFunnelTests("нет-такого-файла.ndjson");
    expect(r.exists).toBe(false);
    expect(r.rows).toEqual([]);
  });

  it("медианы и товары раскладываются по разным полкам", () => {
    const r = readFunnelTests(write([
      JSON.stringify(ok),
      JSON.stringify({ ...ok, role: "median", art: MEDIAN_PREFIX + "cpc_bid_down", search_position: 40 }),
      JSON.stringify({ ...ok, art: "GGT-47-3-3-90", role: "reference" }),
    ]));
    expect(r.byArt.size).toBe(2);
    expect(r.medians.get("cpc_bid_down")!.get("2026-09-22")!.search_position).toBe(40);
    expect(r.first).toBe("2026-09-22");
    expect(r.last).toBe("2026-09-22");
  });

  it("битые строки не выбрасываются молча, а называются по номеру", () => {
    const r = readFunnelTests(write([JSON.stringify(ok), "{не json", JSON.stringify({ ...ok, role: "x" })]));
    expect(r.rows).toHaveLength(1);
    expect(r.bad.map((b) => b.line)).toEqual([2, 3]);
    expect(r.bad[0]!.why).toContain("JSON");
  });
});

describe("поиск пропавших дней", () => {
  const all = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"];

  it("день внутри ряда, которого нет, называется", () => {
    // Ровно случай 22.09: товар был до и после, а в этот день выпал из запроса.
    const days = new Map([["2026-09-20", 1], ["2026-09-21", 1], ["2026-09-23", 1]]);
    expect(missingDays(days, all)).toEqual(["2026-09-22"]);
  });

  it("пропажа в ХВОСТЕ ряда тоже называется: товар выпал и не вернулся", () => {
    // Ровно случай 22.09: четыре товара выпали и обратно не пришли. Если правой границей
    // брать последний день самого товара, такая потеря не видна вовсе.
    const days = new Map([["2026-09-20", 1], ["2026-09-21", 1]]);
    expect(missingDays(days, all)).toEqual(["2026-09-22", "2026-09-23"]);
  });

  it("дни ДО появления товара пропажей не считаются: он мог войти в тест позже", () => {
    const days = new Map([["2026-09-22", 1], ["2026-09-23", 1]]);
    expect(missingDays(days, all)).toEqual([]);
  });

  it("пустой ряд пропаж не даёт: не с чем сравнивать", () => {
    expect(missingDays(new Map(), all)).toEqual([]);
  });
});
