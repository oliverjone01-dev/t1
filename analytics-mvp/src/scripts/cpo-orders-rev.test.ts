import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cpoOrdersByDay, cpoCampaign, cpoExportCampaign } from "./cpo-orders-rev.js";

const nd = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
function dir(files: Record<string, string>): (f: string) => string {
  const d = mkdtempSync(join(tmpdir(), "cpo-rev-"));
  for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c);
  return (f) => join(d, f);
}

describe("cpoOrdersByDay", () => {
  it("день заказа - самая ранняя дата отправлений, не первая в файле (ФЕНИКС O3)", () => {
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
    expect(r.day["2026-09-10"]).toEqual({ sp: 100, rev: 1000, units: 3 });
    expect(r.day["2026-09-11"]).toEqual({ sp: 50, rev: 0, units: 0 }); // отменённый: списание есть, выручки нет
    expect(r.miss).toBe(1);
    expect([r.from, r.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });
});

describe("cpoCampaign (ФЕНИКС N8)", () => {
  const instr = { "28753239": "Оплата за заказ", "22421802": "Оплата за заказ", "30000001": "Оплата за клик" };
  it("выбирает ближайшую кампанию «за заказ» в допуске 1%", () => {
    expect(cpoCampaign({ "28753239": 4323199, "22421802": 32716, "30000001": 4323000 }, instr, 4323198.65)).toEqual({ id: "28753239", sp: 4323199 });
  });
  it("без кампании выгрузки не берёт CPC-кампанию с близким расходом - отказ", () => {
    expect(() => cpoCampaign({ "22421802": 32716, "30000001": 4323000 }, instr, 4323198.65)).toThrow(/расходится/);
    expect(() => cpoCampaign({ "30000001": 4323000 }, instr, 4323198.65)).toThrow(/нет кампании «за заказ»/);
  });
  it("разница больше 1% - отказ, ровно в допуске - выбор", () => {
    expect(() => cpoCampaign({ "28753239": 1011 }, instr, 1000)).toThrow();
    expect(cpoCampaign({ "28753239": 1010 }, instr, 1000).id).toBe("28753239");
  });
  it("cpoExportCampaign берёт тип из camp_meta и расход только за дни выгрузки", () => {
    const dp = dir({
      "orders_daily.ndjson": nd([{ order: "0001-0001-1", d: "2026-09-10", revenue: 300, units: 1, status: "delivered" }]),
      "cpo_orders.ndjson": nd([{ order: "0001-0001", sp: 100 }]),
      "cpo_sku_daily.ndjson": nd([{ d: "2026-09-01" }, { d: "2026-09-30" }]),
      "ads_daily.ndjson": nd([
        { d: "2026-09-10", id: "28753239", sp: 100 }, { d: "2026-10-01", id: "28753239", sp: 900 },
        { d: "2026-09-10", id: "30000001", sp: 100 },
      ]),
      "ads_30d.json": JSON.stringify({ camp_meta: { "28753239": { instr: "Оплата за заказ" }, "30000001": { instr: "Оплата за клик" } } }),
    });
    expect(cpoExportCampaign(dp, cpoOrdersByDay(dp))).toEqual({ id: "28753239", sp: 100, total: 100 });
  });
});
