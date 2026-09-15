// Свод по дате заказа. Тесты пиннят не «страница собралась», а сами числа и правила разнесения:
// каждый дефект ниже уже случался на живых данных июля 2026 и молча искажал результат.
import { describe, it, expect } from "vitest";
import { buildSvod, svcColumn, isPointsPaid, SVC_OTHER, type OrderRow } from "./derive-lib.js";

const item = (over: Partial<OrderRow>): OrderRow => ({
  platform: "ym", business: "1", campaign: "1", order: "A", shop_order: "A", pos: 0, service: false,
  created: "2026-07-05", statusDate: "2026-07-09", status: "DELIVERED", fin: "2026-07-09",
  sku: "S1", market_sku: "M1", name: "товар", line: "L", units: 1, count: 1, delivered: 1, returned: 0, cancelled: 0,
  price: 10000, p_buyer: 6000, p_mp: 4000, p_cashback: 0, p_spasibo: 0, revenue: 10000, accruals: 10000,
  fees: {}, fee_total: 0, payout: 0, fee_actual: true, paid: 6000, paid_by_type: { PAYMENT: 6000 },
  subsidy: 3900, fake: false, ...over,
} as OrderRow);
const net = (over: Record<string, unknown>) => ({ d: "2026-07-20", business: "1", order: "A", sku: "", type: "Удержание", service: "Размещение товарных предложений", amount: -1000, ...over });
const one = (rows: OrderRow[], netting: any[], cogs: Record<string, number> = {}) => buildSvod(rows, netting as any, cogs)[0]!;

describe("разнесение услуг по статьям", () => {
  it("«средняя миля» получает свою колонку, а не падает в «Прочие»", () => {
    // \\w в JS не матчит кириллицу: regex /средн\\w*\\s*мил/ не срабатывал никогда, и вся средняя
    // миля (60 085 ₽ за июль по кабинету мебели) уходила в «Прочие услуги».
    expect(svcColumn("Доставка (средняя миля)")).toBe("Доставка (средняя миля)");
    expect(svcColumn("Размещение товарных предложений")).toBe("Размещение (комиссия)");
    expect(svcColumn("Приём платежа")).toBe("Приём платежа покупателя");
    expect(svcColumn("Перевод платежа")).toBe("Перевод платежа покупателя");
    expect(svcColumn("Отзывы за баллы")).toBe("Программа лояльности и отзывы");
    expect(svcColumn("Нечто новое от Маркета")).toBe(SVC_OTHER);
  });
});

describe("чем оплачена услуга", () => {
  it("тип решает, пока в снимке нет TRANSACTION_SOURCE", () => {
    expect(isPointsPaid("Списание")).toBe(true);
    expect(isPointsPaid("Возврат списания")).toBe(true);
    expect(isPointsPaid("Удержание")).toBe(false);
  });
  it("источник главнее типа, когда он есть", () => {
    expect(isPointsPaid("Удержание", "Скидка за участие в совместных акциях")).toBe(true);
    expect(isPointsPaid("Списание", "Оплата услуг Маркета")).toBe(false);
  });
});

describe("знак проводки", () => {
  it("сторно уменьшает статью, а не добавляет к ней второй сбор", () => {
    // Math.abs превращал «Возврат списания» +300 в ещё один сбор 300: статья завышалась на 600.
    const m = one([item({})], [net({ type: "Списание", amount: -1000 }), net({ type: "Возврат списания", amount: 300 })]);
    expect(m.rows[0]!.svc_points).toBe(700);
    expect(m.rows[0]!.svc_money).toBe(0);
  });
});

describe("базис свода", () => {
  it("в свод идут только DELIVERED; отменённые не приносят ни выручки, ни услуг", () => {
    const m = one([item({}), item({ order: "B", status: "CANCELLED_IN_PROCESSING", delivered: 0 })],
      [net({}), net({ order: "B", amount: -5000 })]);
    expect(m.orders).toBe(1);
    expect(m.rows.reduce((s, r) => s + r.svc_money, 0)).toBe(1000);
  });
  it("возвращённая штука считается доставленной и вычитается из выкупленных", () => {
    const m = one([item({ delivered: 0, returned: 1 })], []);
    expect(m.rows[0]!.units_delivered).toBe(1);
    expect(m.rows[0]!.units_returned).toBe(1);
    expect(m.rows[0]!.units_net).toBe(0);
  });
  it("месяц - по дате оформления заказа, а не доставки", () => {
    const m = one([item({ created: "2026-07-31", statusDate: "2026-08-04", fin: "2026-08-04" })], []);
    expect(m.ym).toBe("2026-07");
  });
});

describe("выручка считается от платежа покупателя, а не от цены продажи", () => {
  it("цена продажи в результат не идёт: она включает скидку, которую платил Маркет", () => {
    // Прежняя ошибка свода: выручку брали по F (цена продажи 10 000), расходы - по списанным
    // деньгам. Обе половины искажались в одну сторону.
    const m = one([item({})], [net({ amount: -1000 })]);
    const r = m.rows[0]!;
    expect(r.price).toBe(10000);
    expect(r.revenue_money).toBe(6000);            // платёж покупателя, без скидки Маркета
    expect(r.result_money).toBe(5000);             // выручка деньгами - услуги деньгами
    expect(r.result_money).not.toBe(r.price - r.svc_money);
  });
  it("доставка с покупателя добавляется в платёж, возврат по ней разносится на позиции", () => {
    const rows = [
      item({ accruals: 7500, price: 7500, p_buyer: 4500 }),
      item({ pos: 1, sku: "S2", accruals: 2500, price: 2500, p_buyer: 1500 }),
      item({ pos: 2, service: true, sku: "DOSTAVKA", accruals: 4000, price: 4000, p_buyer: 4000, paid_by_type: { REFUND: -400 } }),
    ];
    const m = one(rows, []);
    const s1 = m.rows.find((r) => r.sku === "S1")!, s2 = m.rows.find((r) => r.sku === "S2")!;
    expect(s1.ship_buyer).toBe(3000);              // 75% начислений заказа
    expect(s2.ship_buyer).toBe(1000);
    expect(s1.refunds).toBe(-300);
    expect(s2.refunds).toBe(-100);
    expect(s1.buyer_pay + s2.buyer_pay).toBe(10000);
    expect(Math.round(s1.revenue_money + s2.revenue_money)).toBe(9600);
    expect(m.rows.some((r) => r.sku === "DOSTAVKA")).toBe(false);
  });
  it("результат с учётом баллов добавляет начисленные баллы и вычитает полную стоимость услуг", () => {
    const m = one([item({})], [net({ type: "Удержание", amount: -1000 }), net({ type: "Списание", amount: -2000 })]);
    const r = m.rows[0]!;
    expect(r.svc_money).toBe(1000); expect(r.svc_points).toBe(2000); expect(r.svc_total).toBe(3000);
    expect(r.result_money).toBe(5000);             // 6000 - 1000
    expect(r.result_points).toBe(6900);            // 6000 + 3900 - 3000
  });
});

describe("пробелы видны, а не замазаны", () => {
  it("заказ без строк в реестре считается отдельно, а не растворяется в нуле услуг", () => {
    const m = one([item({}), item({ order: "B", sku: "S2" })], [net({ order: "A" })]);
    expect(m.orders_without_ledger).toBe(1);
  });
  it("SKU без себестоимости помечен, и его выручка не идёт в покрытие", () => {
    const m = one([item({}), item({ order: "B", sku: "S2" })], [], { S1: 2000 });
    expect(m.rows.find((r) => r.sku === "S1")!.cogs_known).toBe(true);
    expect(m.rows.find((r) => r.sku === "S2")!.cogs_known).toBe(false);
    expect(m.cogs_cov).toBe(50);
  });
  it("услуги из чужого акта видны в списке месяцев, а не молча подмешаны", () => {
    const m = one([item({})], [net({ d: "2026-07-20" }), net({ d: "2026-08-15" })]);
    expect(m.svc_months).toEqual(["2026-07", "2026-08"]);
  });
  it("общие расходы кабинета (без заказа) не разносятся на товар", () => {
    const m = one([item({})], [net({ order: "", service: "Подписка Маркета", amount: -500 })]);
    expect(m.overhead_money).toBe(500);
    expect(m.rows[0]!.svc_money).toBe(0);
  });
});
