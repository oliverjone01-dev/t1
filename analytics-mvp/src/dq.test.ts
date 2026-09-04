import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "./store.js";
import { runDq } from "./dq.js";
import type { SkuDaily } from "./types.js";

function row(date: string, rev: number): SkuDaily {
  return {
    date, sku: "111", offer_id: null, name: "x", line: "TRUBIS",
    revenue: rev, units: 1, views: 10, to_cart: 1, delivered: 1, returns: 0, cancellations: 0,
  };
}

describe("runDq", () => {
  let store: Store;
  beforeEach(() => (store = new Store(":memory:")));
  afterEach(() => store.close());

  it("свежесть ок, когда есть ожидаемая дата", () => {
    store.upsertSkuDaily([row("2026-06-06", 1000), row("2026-06-07", 1000)]);
    const r = runDq(store, "2026-06-06", "2026-06-07");
    expect(r.freshness.ok).toBe(true);
    expect(r.freshness.latest).toBe("2026-06-07");
  });

  it("свежесть падает, если последней даты нет", () => {
    store.upsertSkuDaily([row("2026-06-05", 1000)]);
    const r = runDq(store, "2026-06-05", "2026-06-07");
    expect(r.freshness.ok).toBe(false);
  });

  it("ловит пропуск даты в середине", () => {
    store.upsertSkuDaily([row("2026-06-05", 1000), row("2026-06-07", 1000)]);
    const r = runDq(store, "2026-06-05", "2026-06-07");
    expect(r.gaps).toEqual(["2026-06-06"]);
    expect(r.ok).toBe(false);
  });

  it("ловит провал объёма в последний день", () => {
    // 7 ровных дней по 1000, последний день 100 (провал >60%)
    const rows: SkuDaily[] = [];
    for (let d = 1; d <= 7; d++) rows.push(row(`2026-06-0${d}`, 1000));
    rows.push(row("2026-06-08", 100));
    store.upsertSkuDaily(rows);
    const r = runDq(store, "2026-06-01", "2026-06-08");
    expect(r.volumeDrop?.ok).toBe(false);
    expect(r.volumeDrop?.date).toBe("2026-06-08");
  });

  it("провал объёма в последний день НЕ фатален (свежий день частичный, ok=true)", () => {
    // 7 ровных дней по 1000, последний день 100 (провал >60%) - типичный неустоявшийся свежий день
    const rows: SkuDaily[] = [];
    for (let d = 1; d <= 7; d++) rows.push(row(`2026-06-0${d}`, 1000));
    rows.push(row("2026-06-08", 100));
    store.upsertSkuDaily(rows);
    const r = runDq(store, "2026-06-01", "2026-06-08");
    expect(r.volumeDrop?.ok).toBe(false); // проверка сработала - предупреждение есть
    expect(r.ok).toBe(true);              // но общий DQ не фатал - данные коммитятся
  });

  it("дыра в датах остаётся фатальной даже при провале объёма", () => {
    const rows: SkuDaily[] = [];
    for (const d of [1, 2, 3, 4, 5, 7]) rows.push(row(`2026-06-0${d}`, d === 7 ? 100 : 1000));
    store.upsertSkuDaily(rows);
    const r = runDq(store, "2026-06-01", "2026-06-07");
    expect(r.gaps).toEqual(["2026-06-06"]);
    expect(r.ok).toBe(false); // дыра - реальная поломка, синк должен падать
  });

  it("норма: ровный объём - провала нет", () => {
    const rows: SkuDaily[] = [];
    for (let d = 1; d <= 8; d++) rows.push(row(`2026-06-0${d}`, 1000));
    store.upsertSkuDaily(rows);
    const r = runDq(store, "2026-06-01", "2026-06-08");
    expect(r.volumeDrop?.ok).toBe(true);
  });
});
