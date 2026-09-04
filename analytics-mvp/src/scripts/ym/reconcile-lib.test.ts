import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseOrder } from "../../connector/ym-partner.js";
import { normalizeOrder, type OrderRow } from "./derive-lib.js";
import { buildReconcile, moneyTol } from "./reconcile-lib.js";

const sample = JSON.parse(readFileSync("fixtures/ym/orders_sample.json", "utf-8"));
const rows: OrderRow[] = sample.orders.flatMap((o: any) => normalizeOrder(parseOrder(o), sample.campaignId, sample.businessId));
const live = { dateFrom: "2026-08-05", dateTo: "2026-09-03", sku_table: [{ sku: "GGM-16-2-2", rev: 38000 }, { sku: "GGT-03-3-3-O-20090", rev: 200000 }] };
const base = { rows, cogs: { "GGT-03-3-3-O-20090": 15000 }, tax: { "GGT-03-3-3-O-20090": {} }, live, views: [], ads: null };
const TODAY = "2026-09-04";

describe("reconcile §15", () => {
  it("штуки: нетто заказов vs нетто реализации, без двойного вычета возвратов (G1)", () => {
    // август: 500001 доставлен (1+2), 500002 частично возвращён (2 − 1) => нетто 4, возвраты 1
    const realz = [{ ym: "2026-08", sku: "GGM-16-2-2", sold: 1, ret: 0 }, { ym: "2026-08", sku: "GGT-03-3-3-O-20090", sold: 4, ret: 1, amount: 140000 }];
    const r = buildReconcile({ ...base, realization: realz, netting: null }, TODAY);
    const closed = r.periods[0]!;
    expect(closed.kind).toBe("closed_month"); expect(closed.dateFrom).toBe("2026-08-01");
    expect(closed.units.orders_delivered_net).toBe(4); expect(closed.units.orders_returned).toBe(1);
    expect(closed.units.realization_net).toBe(4); expect(closed.units.diff).toBe(0); expect(closed.units.status).toBe("сошлось");
    // часть месяца 1-15: только 500001 (доставлен 09.08)
    expect(r.periods[1]!.units.orders_delivered_net).toBe(3);
    expect(r.periods[2]!.label).toContain("2026-09");
  });
  it("деньги: сверка по номеру заказа + кумулятив, допуск max(50 ₽, 0.5%) (G2)", () => {
    const netting = [
      { d: "2026-08-12", order: "500001", amount: 81000 },              // выплата за заказ 1
      { d: "2026-08-20", order: "500002", amount: 32000 },              // 33500 ожидаем, расхождение 1500 > допуска 573
      { d: "2026-08-31", order: "", service: "Буст продаж", amount: -700 }, // уровень кабинета
    ];
    const r = buildReconcile({ ...base, realization: [], netting }, TODAY);
    const m = r.periods[0]!.money;
    expect(m.orders_total).toBe(2); expect(m.orders_matched).toBe(2);
    expect(m.payout_matched).toBe(81000 + 33500); expect(m.netting_by_order).toBe(113000);
    expect(m.diff).toBe(1500); expect(m.status).toContain("расхождение 1500");
    expect(r.cumulative.netting_account).toBe(-700);
    expect(moneyTol(1000)).toBe(50); expect(moneyTol(100000)).toBe(500);
    expect(r.blockers.some((b) => b.includes("деньги закрытого месяца"))).toBe(true);
  });
  it("выручка vs реализация: подбор состава типов цен (G7)", () => {
    // accruals августа = 100000 (BUYER 98000 + MARKETPLACE 2000) + 40000 = 140000; amount отчёта 138000 => ближе BUYER-only
    const realz = [{ ym: "2026-08", sku: "GGT-03-3-3-O-20090", sold: 4, ret: 1, amount: 138000 }, { ym: "2026-08", sku: "GGM-16-2-2", sold: 1, ret: 0 }];
    const r = buildReconcile({ ...base, realization: realz, netting: null }, TODAY);
    const rev = r.periods[0]!.revenue;
    expect(rev.accruals).toBe(140000); expect(rev.realization_amount).toBe(138000);
    expect(rev.best_price_types).toBe("BUYER"); expect(rev.status).toContain("BUYER");
  });
  it("покрытие и пробелы: нет СС / нет в таксономии / нет в реализации; вердикт return без отчётов", () => {
    const r = buildReconcile({ ...base, realization: [], netting: null }, TODAY);
    expect(r.verdict).toBe("return");
    expect(r.coverage.gaps["GGM-16-2-2"]).toEqual(["нет СС", "нет в таксономии"]);
    expect(r.coverage.cogs.pct_rev).toBeCloseTo(84, 0);
    expect(r.coverage.account_fees.note).toContain("[ГИПОТЕЗА]");
    expect(r.blockers.length).toBeGreaterThanOrEqual(2);
  });
  it("«текущий месяц» от сегодняшней даты (G13): 1-го числа текущий = этот месяц", () => {
    const r = buildReconcile({ ...base, realization: [], netting: null }, "2026-09-01");
    expect(r.periods[2]!.dateFrom).toBe("2026-09-01"); expect(r.periods[0]!.dateFrom).toBe("2026-08-01");
  });
});
