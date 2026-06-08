import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Store } from "./store.js";
import { backfill, missingDates, datesBetween, type DataSource } from "./sync.js";
import type { SkuDaily } from "./types.js";

function fakeRow(date: string, sku: string, rev: number): SkuDaily {
  return {
    date, sku, offer_id: null, name: "TRUBIS Wood", line: "TRUBIS",
    revenue: rev, units: 1, views: 100, to_cart: 5, delivered: 1, returns: 0, cancellations: 0,
  };
}

// мок-источник: по дате отдаёт одну строку, пустой для дат из emptySet
function makeSource(emptySet: Set<string> = new Set()): DataSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async skuDaily(date: string) {
      calls.push(date);
      return emptySet.has(date) ? [] : [fakeRow(date, "111", 1000)];
    },
  };
}

const noSleep = async () => {};

describe("datesBetween", () => {
  it("включительно", () => {
    expect(datesBetween("2026-02-01", "2026-02-03")).toEqual(["2026-02-01", "2026-02-02", "2026-02-03"]);
  });
});

describe("backfill - идемпотентность и чекпойнт", () => {
  let store: Store;
  beforeEach(() => (store = new Store(":memory:")));
  afterEach(() => store.close());

  it("загружает недостающие даты", async () => {
    const src = makeSource();
    const res = await backfill(store, src, "2026-02-01", "2026-02-05", { sleep: noSleep });
    expect(res.days).toBe(5);
    expect(store.distinctDates()).toEqual([
      "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05",
    ]);
  });

  it("повторный прогон не дёргает источник (всё уже есть)", async () => {
    const src1 = makeSource();
    await backfill(store, src1, "2026-02-01", "2026-02-03", { sleep: noSleep });
    const src2 = makeSource();
    const res2 = await backfill(store, src2, "2026-02-01", "2026-02-03", { sleep: noSleep });
    expect(res2.days).toBe(0);
    expect(src2.calls).toEqual([]); // источник не вызывался
  });

  it("догружает только новые даты", async () => {
    const src1 = makeSource();
    await backfill(store, src1, "2026-02-01", "2026-02-03", { sleep: noSleep });
    const src2 = makeSource();
    await backfill(store, src2, "2026-02-01", "2026-02-05", { sleep: noSleep });
    expect(src2.calls).toEqual(["2026-02-04", "2026-02-05"]);
  });

  it("пустой день помечается якорем и не дёргается повторно", async () => {
    const src1 = makeSource(new Set(["2026-02-02"]));
    await backfill(store, src1, "2026-02-01", "2026-02-03", { sleep: noSleep });
    expect(store.distinctDates()).toContain("2026-02-02"); // дата отмечена
    const src2 = makeSource(new Set(["2026-02-02"]));
    await backfill(store, src2, "2026-02-01", "2026-02-03", { sleep: noSleep });
    expect(src2.calls).toEqual([]); // повторно не тянем
  });

  it("выдерживает паузу между днями", async () => {
    const src = makeSource();
    const sleep = vi.fn(async () => {});
    await backfill(store, src, "2026-02-01", "2026-02-03", { sleep, pauseMs: 500 });
    expect(sleep).toHaveBeenCalledTimes(2); // между 3 днями - 2 паузы
    expect(sleep).toHaveBeenCalledWith(500);
  });
});

describe("missingDates", () => {
  let store: Store;
  beforeEach(() => (store = new Store(":memory:")));
  afterEach(() => store.close());

  it("возвращает только отсутствующие", async () => {
    await backfill(store, makeSource(), "2026-02-01", "2026-02-02", { sleep: noSleep });
    expect(missingDates(store, "2026-02-01", "2026-02-04")).toEqual(["2026-02-03", "2026-02-04"]);
  });
});
