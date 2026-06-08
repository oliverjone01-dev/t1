import { describe, it, expect } from "vitest";
import { abc, xyz, bcgByLine, abcXyzMatrix, monthlyOrdersByLine, skuViews } from "./marts.js";
import type { SkuDaily } from "./types.js";

function r(date: string, sku: string, line: string, revenue: number, units: number, views = 1000): SkuDaily {
  return { date, sku, offer_id: null, name: sku, line, revenue, units, views, to_cart: 0, delivered: 0, returns: 0, cancellations: 0 };
}

describe("abc", () => {
  it("крупнейший по обороту = A, хвост = C", () => {
    const m = abc([
      { key: "big", revenue: 800 },
      { key: "mid", revenue: 150 },
      { key: "small", revenue: 50 },
    ]);
    expect(m.get("big")).toBe("A");
    expect(m.get("mid")).toBe("B");
    expect(m.get("small")).toBe("C");
  });
});

describe("xyz", () => {
  it("ровные продажи = X, рваные = Z", () => {
    const rows: SkuDaily[] = [
      r("2026-05-01", "stable", "L", 100, 2), r("2026-05-02", "stable", "L", 100, 2), r("2026-05-03", "stable", "L", 100, 2),
      r("2026-05-01", "spiky", "L", 100, 6),
    ];
    const m = xyz(rows, "2026-05-01", "2026-05-03", (x) => x.sku);
    expect(m.get("stable")!.cls).toBe("X");
    expect(m.get("spiky")!.cls).toBe("Z"); // 6,0,0 - большой разброс
  });
});

describe("bcgByLine", () => {
  it("растущая крупная линия = star, падающая = cow/dog", () => {
    const cur = [r("2026-05-01", "1", "TRUBIS", 1000, 10), r("2026-05-01", "2", "зеркала", 200, 5)];
    const cmp = [r("2026-04-01", "1", "TRUBIS", 500, 5), r("2026-04-01", "2", "зеркала", 400, 8)];
    const res = bcgByLine(cur, cmp);
    const trubis = res.find((x) => x.line === "TRUBIS")!;
    expect(trubis.growth).toBeGreaterThan(0); // вырос
    expect(["star", "cow"]).toContain(trubis.quadrant); // крупная доля
    const mirror = res.find((x) => x.line === "зеркала")!;
    expect(mirror.growth).toBeLessThan(0); // упал
  });
});

describe("abcXyzMatrix", () => {
  it("раскладывает по 9 клеткам", () => {
    const views = skuViews(
      [r("2026-05-01", "x", "L", 1000, 10), r("2026-05-02", "x", "L", 1000, 10)],
      "2026-05-01", "2026-05-02",
    );
    const m = abcXyzMatrix(views);
    const total = Object.values(m).reduce((s, c) => s + c.count, 0);
    expect(total).toBe(1);
  });
});

describe("monthlyOrdersByLine", () => {
  it("группирует заказы по линии и месяцу", () => {
    const rows = [
      r("2026-04-10", "1", "TRUBIS", 100, 3), r("2026-05-10", "2", "TRUBIS", 100, 2),
      r("2026-05-11", "3", "зеркала", 100, 4),
    ];
    const { months, lines } = monthlyOrdersByLine(rows);
    expect(months).toEqual(["2026-04", "2026-05"]);
    const trubis = lines.find((l) => l.line === "TRUBIS")!;
    expect(trubis.byMonth["2026-04"]).toBe(3);
    expect(trubis.byMonth["2026-05"]).toBe(2);
    expect(trubis.total).toBe(5);
  });
});
