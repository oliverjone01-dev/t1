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
    expect(cpoExportCampaign(dp, cpoOrdersByDay(dp))).toEqual({ id: "28753239", sp: 100, total: 100, err: "" });
  });
});

describe("cpoExportCampaign: ошибки выгрузки - плашка, не падение сборки (ФЕНИКС G1-G3)", () => {
  const base = {
    "orders_daily.ndjson": nd([{ order: "0001-0001-1", d: "2026-09-10", revenue: 300, units: 1, status: "delivered" }]),
    "cpo_orders.ndjson": nd([{ order: "0001-0001", d: "2026-09-10", sp: 60 }, { order: "0001-0001", d: "2026-09-11", sp: 40 }, { order: "0002-0002", d: "2026-09-12", sp: 50 }]),
    "cpo_sku_daily.ndjson": nd([{ d: "2026-09-01" }, { d: "2026-09-30" }]),
    "ads_daily.ndjson": nd([{ d: "2026-09-10", id: "28753239", sp: 150 }]),
    "ads_30d.json": JSON.stringify({ camp_meta: { "28753239": { instr: "Оплата за заказ" } } }),
  };
  it("строки одного заказа по дням складываются; заказа ещё нет в orders_daily - свой текст, а не «чья выгрузка» (G1)", () => {
    const dp = dir(base), co = cpoOrdersByDay(dp);
    expect(co.day["2026-09-10"]!.sp).toBe(100);
    expect([co.miss, co.missSp, co.spAll]).toEqual([1, 50, 150]);
    const r = cpoExportCampaign(dp, co);
    expect(r.id).toBe("");
    expect(r.err).toMatch(/1 заказов выгрузки \(50 ₽\) ещё нет в отправлениях/);
  });
  it("все заказы пришли - расход API сверяется со всеми списаниями (G1)", () => {
    const dp = dir({ ...base, "orders_daily.ndjson": base["orders_daily.ndjson"] + nd([{ order: "0002-0002-1", d: "2026-09-12", revenue: 500, units: 1, status: "delivered" }]) });
    expect(cpoExportCampaign(dp, cpoOrdersByDay(dp))).toEqual({ id: "28753239", sp: 150, total: 150, err: "" });
  });
  it("покрытие пустое или файл битый - ошибка, не тихий проход (G2)", () => {
    const dp1 = dir({ ...base, "cpo_sku_daily.ndjson": "" });
    expect(cpoExportCampaign(dp1, cpoOrdersByDay(dp1)).err).toMatch(/покрытие \(cpo_sku_daily\) пустое/);
    const dp2 = dir({ ...base, "cpo_sku_daily.ndjson": base["cpo_sku_daily.ndjson"] + "<<<<<<< HEAD\n" });
    expect(cpoExportCampaign(dp2, cpoOrdersByDay(dp2)).err).toMatch(/cpo_sku_daily.ndjson: строка 3 не разбирается/);
  });
  it("кампании выгрузки нет - ошибка в err, без исключения (G3)", () => {
    const dp = dir({ ...base, "orders_daily.ndjson": base["orders_daily.ndjson"] + nd([{ order: "0002-0002-1", d: "2026-09-12", revenue: 500, units: 1, status: "delivered" }]), "ads_30d.json": JSON.stringify({ camp_meta: { "28753239": { instr: "Оплата за клик" } } }) });
    const r = cpoExportCampaign(dp, cpoOrdersByDay(dp));
    expect(r.id).toBe("");
    expect(r.err).toMatch(/нет кампании «за заказ»/);
  });
  it("выгрузки нет совсем - без ошибки", () => {
    const dp = dir({ "orders_daily.ndjson": base["orders_daily.ndjson"] });
    expect(cpoExportCampaign(dp, cpoOrdersByDay(dp))).toEqual({ id: "", sp: 0, total: 0, err: "" });
  });
});
