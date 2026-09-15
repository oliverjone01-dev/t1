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

describe("многоштучная позиция (дефект, найденный ФЕНИКСОМ)", () => {
  it("цены в заказе - ЗА ШТУКУ, поэтому умножаются на count", () => {
    // Без × count позиция из двух штук приносила выручку одной. По снимку 2026-09 это 576 279 ₽
    // недосчёта, а у SKU GGR-10-1 маржа переворачивалась с +21,8% на -5,2%.
    const m = one([item({ count: 2, delivered: 2, price: 10000, p_buyer: 6000, p_mp: 4000, p_cashback: 100 })], []);
    const r = m.rows[0]!;
    expect(r.units_delivered).toBe(2);
    expect(r.price).toBe(20000);
    expect(r.disc_mp).toBe(8000);
    expect(r.disc_plus).toBe(200);
    expect(r.buyer_pay).toBe(12000);
    expect(r.revenue_money).toBe(12000);
  });
  it("возвраты и начисленные баллы на count НЕ умножаются - это уже разнесённые суммы", () => {
    const m = one([item({ count: 2, delivered: 2, subsidy: 3900, paid_by_type: { REFUND: -500 } })], []);
    const r = m.rows[0]!;
    expect(r.points_accrued).toBe(3900);
    expect(r.refunds).toBe(-500);
  });
  it("доставка берётся по цене × штуки, а не по accruals: полный возврат не съедает её", () => {
    // accruals позиции при полном возврате = 0, и доставка по кабинету мебели за июль выходила
    // 234 800 ₽ вместо 243 800 ₽ кабинета.
    const rows = [
      item({ delivered: 0, returned: 1, accruals: 0 }),
      item({ pos: 1, service: true, sku: "DOSTAVKA", price: 4500, count: 1, accruals: 0, p_buyer: 4500 }),
    ];
    const m = one(rows, []);
    expect(m.rows.find((r) => r.sku === "S1")!.ship_buyer).toBe(4500);
  });
});

describe("пробелы реестра раскрыты, а не потеряны", () => {
  it("сборы по заказу вне свода считаются отдельно, с числом заказов", () => {
    const m = buildSvod([item({}), item({ order: "B", status: "RETURNED", delivered: 0, returned: 1 })],
      [net({ order: "A", amount: -1000 }), net({ order: "B", amount: -700 })] as any, {}, "2026-09-15")[0]!;
    expect(m.ledger_outside).toBe(700);
    expect(m.ledger_outside_orders).toBe(1);
  });
  it("общие расходы в месяце без доставленных заказов не исчезают - месяц заводится ради них", () => {
    const ms = buildSvod([item({})], [net({ order: "", d: "2026-02-10", service: "Подписка", amount: -8732 })] as any, {}, "2026-09-15");
    const feb = ms.find((m) => m.ym === "2026-02")!;
    expect(feb.overhead_money).toBe(8732);
    expect(feb.orders).toBe(0);
  });
  it("баллы, осевшие на строке доставки, названы суммой", () => {
    // Субсидия заказа (3900 + 250) разносится по стоимости позиций: доставка 1000 из 11000 базы
    // забирает 4150 × 1/11. Свод разносит её сам и не полагается на разнесение из снимка.
    const m = one([item({}), item({ pos: 1, service: true, sku: "DOSTAVKA", price: 1000, subsidy: 250 })], []);
    expect(m.points_on_delivery).toBeCloseTo(377.27, 1);
    expect(m.rows[0]!.points_accrued).toBeCloseTo(3772.73, 1);
  });
  it("возврат ложится на возвращённый SKU, а не размазывается по заказу", () => {
    // Живой случай: заказ 58875910850, GGR-11-4 возвращён целиком, а весь -11 066 ₽ садился на
    // соседний GGT-12-2, потому что база разнесения была accruals, а они у возврата равны нулю.
    const rows = [
      item({ sku: "RET", price: 11066, delivered: 0, returned: 1, accruals: 0, paid_by_type: {} }),
      item({ pos: 1, sku: "KEEP", price: 53051, delivered: 1, paid_by_type: { REFUND: -11066 } }),
    ];
    const m = one(rows, []);
    expect(Math.round(m.rows.find((r) => r.sku === "RET")!.refunds)).toBe(-11066);
    expect(m.rows.find((r) => r.sku === "KEEP")!.refunds).toBe(0);
  });
  it("доставка, оплаченная Маркетом, не показывается платежом покупателя", () => {
    // price строки доставки включает MARKETPLACE: 2 599 ₽ по снимку были деньгами Маркета,
    // показанными как деньги покупателя, и при этом не попадали в «Скидку Маркета».
    const m = one([item({}), item({ pos: 1, service: true, sku: "DOSTAVKA", price: 2000, p_buyer: 0, p_mp: 2000 })], []);
    expect(m.rows[0]!.ship_buyer).toBe(0);
    expect(m.rows[0]!.disc_mp).toBe(6000);   // 4000 своих + 2000 доставки за счёт Маркета
  });
});

describe("результат не зависит от дня прогона", () => {
  it("svc_settled считается от переданной даты и по актам СВОЕГО кабинета", () => {
    const rows = [item({})];
    const acts = [net({ d: "2026-08-10" })] as any;
    expect(buildSvod(rows, acts, {}, "2026-09-15")[0]!.svc_settled).toBe(true);
    expect(buildSvod(rows, acts, {}, "2026-08-15")[0]!.svc_settled).toBe(false);
    // акт чужого кабинета о полноте этого ничего не говорит
    const alien = [net({ order: "A" }), net({ order: "", business: "9", d: "2026-08-10" })] as any;
    expect(buildSvod(rows, alien, {}, "2026-09-15").find((m) => m.business === "1")!.svc_settled).toBe(false);
  });
});

describe("акт по стоимости услуг замещает общие расходы реестра", () => {
  const actRow = (o: Partial<Record<string, unknown>> = {}) => ({ ym: "2026-07", business: "1", service: "Полки", money: 1657, points: 15051, ...o });
  it("где акт есть, реестровые общие расходы не суммируются с ним - иначе двойной счёт", () => {
    // Реестр платежей несёт только оплаченные деньгами: живой июль 2026 - 6 строк на 36 875 ₽,
    // ни одной оплаченной баллами. Акт за те же статьи даёт 81 495 ₽, из них 15 051 ₽ баллами.
    const ms = buildSvod([item({})], [net({ order: "", service: "Полки", amount: -1657 })] as any, {}, "2026-09-15", [actRow()] as any);
    const m = ms.find((x) => x.ym === "2026-07")!;
    expect(m.overhead_src).toBe("act");
    expect(m.overhead_money).toBe(1657);
    expect(m.overhead_points).toBe(15051);
  });
  it("где акта нет, остаётся реестр, и месяц это честно помечает", () => {
    const m = one([item({})], [net({ order: "", service: "Подписка", amount: -16990 })]);
    expect(m.overhead_src).toBe("ledger");
    expect(m.overhead_money).toBe(16990);
    expect(m.overhead_points).toBe(0);
  });
  it("услуга акта, привязанная к заказу, в общие расходы не идёт - её несёт реестр", () => {
    const ms = buildSvod([item({})], [] as any, {}, "2026-09-15", [actRow({ order: "A", service: "Буст продаж" })] as any);
    const m = ms.find((x) => x.ym === "2026-07")!;
    expect(m.overhead_src).toBe("ledger");
    expect(m.overhead_money).toBe(0);
  });
});

describe("баллы берутся из отчёта по баллам, а не из скидки Маркета", () => {
  const bon = (o: Partial<Record<string, unknown>> = {}) => ({ ym: "2026-07", business: "1", amount: 5000, type: "Начисление", ...o });
  it("месячный итог приводится к отчёту, доли по позициям остаются пропорциональными", () => {
    const rows = [item({ price: 7500, accruals: 7500, subsidy: 3000 }), item({ pos: 1, sku: "S2", price: 2500, accruals: 2500, subsidy: 1000 })];
    const ms = buildSvod(rows, [] as any, {}, "2026-09-15", [], [bon()] as any);
    const m = ms[0]!;
    expect(m.points_src).toBe("report");
    expect(Math.round(m.rows.reduce((a, r) => a + r.points_accrued, 0))).toBe(5000);
    expect(Math.round(m.rows.find((r) => r.sku === "S1")!.points_accrued)).toBe(3750);
  });
  it("списание баллов на услуги в «начислено» не идёт - отрицательные строки отбрасываются", () => {
    const ms = buildSvod([item({})], [] as any, {}, "2026-09-15", [], [bon({ amount: 5000 }), bon({ amount: -2000, type: "Списание" })] as any);
    expect(Math.round(ms[0]!.points_report)).toBe(5000);
  });
  it("результат с учётом баллов пересчитывается под кабинетный итог, а не остаётся старым", () => {
    const ms = buildSvod([item({})], [] as any, {}, "2026-09-15", [], [bon({ amount: 1000 })] as any);
    const r = ms[0]!.rows[0]!;
    expect(r.points_accrued).toBe(1000);
    expect(r.result_points).toBe(r2x(r.revenue_money + 1000 - r.svc_total));
  });
  it("без отчёта остаётся subsidies[] заказа, и месяц это честно помечает", () => {
    const m = one([item({})], []);
    expect(m.points_src).toBe("orders");
    expect(m.points_report).toBe(0);
  });
});
const r2x = (n: number) => Math.round(n * 100) / 100;
