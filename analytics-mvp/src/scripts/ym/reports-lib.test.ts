// Гвоздь для разбора отчётов Маркета: заголовки в fixtures/ym/report-headers.json сняты с живых
// выгрузок 2026-09-04 (data-ym/_probe/*). Живой факт: Маркет отдаёт АНГЛИЙСКИЕ коды колонок
// (TRANSACTION_SUM, SHOWS, DELIVERED_COUNT), а не русские подписи - первый прогон разобрал 0 строк
// именно из-за этого. Если колонки снова разъедутся, тест упадёт до ночного синка, а не после.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { findCol } from "../../util/table.js";
import { realizationRole, isRateLimit } from "./reports-lib.js";

const COLS = JSON.parse(readFileSync("src/scripts/ym/report-columns.json", "utf-8")) as Record<string, Record<string, string[]>>;
const H = JSON.parse(readFileSync("fixtures/ym/report-headers.json", "utf-8")) as Record<string, string[]>;
const col = (type: string, key: string, headers: string[]) => findCol(headers, COLS[type]![key]!);

describe("колонки отчётов Маркета (живые заголовки)", () => {
  it("реализация: delivered.csv даёт sku/sold/amount, returned.csv - sku/returned/amount_returned", () => {
    const d = H["goods-realization/delivered.csv"]!;
    expect(col("goods-realization", "sku", d)).toBe(d.indexOf("YOUR_SKU"));
    expect(col("goods-realization", "sold", d)).toBe(d.indexOf("DELIVERED_COUNT"));
    expect(col("goods-realization", "amount", d)).toBe(d.indexOf("DELIVERED_PRICE_SUM_WITH_VAT_AND_DISCOUNTS"));
    const r = H["goods-realization/returned.csv"]!;
    expect(col("goods-realization", "returned", r)).toBe(r.indexOf("RETURNED_COUNT"));
    expect(col("goods-realization", "amount_returned", r)).toBe(r.indexOf("RETURN_PRICE_SUM_WITH_VAT_AND_DISCOUNTS"));
  });
  it("реализация: «продано» НЕ цепляется за TRANSFERRED_TO_DELIVERY_COUNT (иначе тройной счёт)", () => {
    const t = H["goods-realization/transferred_to_delivery.csv"]!;
    expect(t).toContain("TRANSFERRED_TO_DELIVERY_COUNT");
    expect(col("goods-realization", "sold", t)).toBe(-1); // в этом файле колонки DELIVERED_COUNT нет
  });
  it("роли файлов архива реализации: в штуки идут только delivered и returned", () => {
    expect(realizationRole("delivered.csv", H["goods-realization/delivered.csv"]!)).toBe("delivered");
    expect(realizationRole("returned.csv", H["goods-realization/returned.csv"]!)).toBe("returned");
    expect(realizationRole("transferred_to_delivery.csv", H["goods-realization/transferred_to_delivery.csv"]!)).toBe(null);
    expect(realizationRole("unredeemed.csv", H["goods-realization/unredeemed.csv"]!)).toBe(null);
    expect(realizationRole("lost_items.csv", H["goods-realization/lost_items.csv"]!)).toBe(null);
  });
  it("взаиморасчёты: дата, сумма, заказ, SKU и номер п/п находятся", () => {
    const n = H["united-netting/transaction_date.csv"]!;
    expect(col("united-netting", "date", n)).toBe(n.indexOf("TRANSACTION_DATE"));
    expect(col("united-netting", "amount", n)).toBe(n.indexOf("TRANSACTION_SUM"));
    expect(col("united-netting", "order", n)).toBe(n.indexOf("ORDER_ID"));
    expect(col("united-netting", "sku", n)).toBe(n.indexOf("SHOP_SKU"));
    expect(col("united-netting", "payment_order", n)).toBe(n.indexOf("BANK_ORDER_ID"));
    expect(col("united-netting", "type", n)).toBe(n.indexOf("TRANSACTION_TYPE"));
  });
  it("воронка: показы/клики/корзина/заказы и дата из DAY+MONTH+YEAR (отдельной колонки даты нет)", () => {
    const v = H["shows-sales/sales_funnel_report.csv"]!;
    expect(col("shows-sales", "sku", v)).toBe(v.indexOf("OFFER_ID"));
    expect(col("shows-sales", "shows", v)).toBe(v.indexOf("SHOWS"));
    expect(col("shows-sales", "clicks", v)).toBe(v.indexOf("CLICKS"));
    expect(col("shows-sales", "cart", v)).toBe(v.indexOf("TO_CART"));
    expect(col("shows-sales", "units", v)).toBe(v.indexOf("ORDER_ITEMS"));
    expect(col("shows-sales", "date", v)).toBe(-1);
    expect(col("shows-sales", "day", v)).toBe(v.indexOf("DAY"));
    expect(col("shows-sales", "month", v)).toBe(v.indexOf("MONTH"));
    expect(col("shows-sales", "year", v)).toBe(v.indexOf("YEAR"));
    // SHOWS не должен цепляться за SHOWS_WITH_PROMOTION / SHOWS_SHARE
    expect(v[col("shows-sales", "shows", v)]).toBe("SHOWS");
  });
});

describe("лимит генерации отчётов Маркета - мягкая остановка, а не падение", () => {
  it("HTTP 420 и METHOD_FAILURE распознаются как лимит, обычные ошибки - нет", () => {
    expect(isRateLimit(new Error('Market POST /reports/united-netting/generate -> HTTP 420: {"errors":[{"code":"METHOD_FAILURE","message":"Hit rate limit of 1 points per 2 minutes"}]}'))).toBe(true);
    expect(isRateLimit(new Error("HTTP 403: API_DISABLED"))).toBe(false);
    expect(isRateLimit(new Error("ECONNRESET"))).toBe(false);
  });
});
