// FENIKS iter8: the author's O3 case run against the OLD cpoOrdersByDay (origin/main sandbox) - must fail if the test discriminates.
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cpoOrdersByDay } from "./cpo-orders-rev.js";

const nd = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
function dir(files: Record<string, string>): (f: string) => string {
  const d = mkdtempSync(join(tmpdir(), "cpo-rev-old-"));
  for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c);
  return (f) => join(d, f);
}

describe("old cpoOrdersByDay", () => {
  it("день заказа - самая ранняя дата отправлений (O3)", () => {
    const dp = dir({
      "orders_daily.ndjson": nd([
        { order: "0001-0001-2", d: "2026-09-12", revenue: 700, units: 1, status: "delivered" },
        { order: "0001-0001-1", d: "2026-09-10", revenue: 300, units: 2, status: "delivered" },
        { order: "0002-0002-1", d: "2026-09-11", revenue: 500, units: 1, status: "cancelled" },
      ]),
      "cpo_orders.ndjson": nd([{ order: "0001-0001", sp: 100 }, { order: "0002-0002", sp: 50 }, { order: "0009-0009", sp: 7 }]),
      "cpo_sku_daily.ndjson": nd([{ d: "2026-09-01" }, { d: "2026-09-30" }]),
    });
    const r = cpoOrdersByDay(dp);
    expect(Object.keys(r.day).sort()).toEqual(["2026-09-10", "2026-09-11"]);
  });
});
