import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "./store.js";
import type { SkuDaily } from "./types.js";

function row(date: string, sku: string, revenue: number): SkuDaily {
  return {
    date, sku, offer_id: "GGT-1", name: "TRUBIS Wood", line: "TRUBIS",
    revenue, units: 1, views: 100, to_cart: 5, delivered: 1, returns: 0, cancellations: 0,
  };
}

describe("Store - идемпотентность", () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(":memory:");
  });
  afterEach(() => store.close());

  it("повторный upsert за ту же дату не плодит дубли", () => {
    store.upsertSkuDaily([row("2026-04-01", "111", 1000)]);
    store.upsertSkuDaily([row("2026-04-01", "111", 1500)]); // тот же ключ, новое значение
    expect(store.countSkuDaily()).toBe(1);
    const got = store.skuDailyInWindow({ from: "2026-04-01", to: "2026-04-01" });
    expect(got[0]!.revenue).toBe(1500); // значение обновилось
  });

  it("разные даты и SKU копятся", () => {
    store.upsertSkuDaily([row("2026-04-01", "111", 1000), row("2026-04-02", "111", 2000)]);
    store.upsertSkuDaily([row("2026-04-01", "222", 500)]);
    expect(store.countSkuDaily()).toBe(3);
  });

  it("выборка по окну отсекает лишние даты", () => {
    store.upsertSkuDaily([
      row("2026-03-31", "111", 1),
      row("2026-04-01", "111", 2),
      row("2026-04-30", "111", 3),
      row("2026-05-01", "111", 4),
    ]);
    const apr = store.skuDailyInWindow({ from: "2026-04-01", to: "2026-04-30" });
    expect(apr.length).toBe(2);
  });
});
