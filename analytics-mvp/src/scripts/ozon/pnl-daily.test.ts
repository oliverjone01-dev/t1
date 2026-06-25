import { describe, it, expect } from "vitest";
import { dailyChannel } from "./pnl-daily.js";

const op = (date: string, accr: number, comm: number, amount: number, svc = 0) =>
  ({ operation_date: `${date} 12:30:00`, accruals_for_sale: accr, sale_commission: comm, amount, services: svc ? [{ name: "Логистика", price: svc }] : [] });

describe("dailyChannel", () => {
  it("бакетит операции по дню и считает P&L на день", () => {
    const ops = [
      op("2026-06-01", 1000, -100, 800, -50),
      op("2026-06-01", 500, -50, 420),
      op("2026-06-02", 200, -20, 160),
    ];
    const r = dailyChannel(ops);
    expect(r.map((x) => x.d)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(r[0]).toMatchObject({ d: "2026-06-01", accruals: 1500, payout: 1220, fees: 280, ops: 2 });
    expect(r[1]).toMatchObject({ d: "2026-06-02", accruals: 200, payout: 160, fees: 40, ops: 1 });
  });

  it("операции без даты пропускаются, дни отсортированы", () => {
    const ops = [op("2026-06-03", 10, 0, 10), { accruals_for_sale: 99, amount: 99, operation_date: "" }, op("2026-06-01", 5, 0, 5)];
    expect(dailyChannel(ops).map((x) => x.d)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});
