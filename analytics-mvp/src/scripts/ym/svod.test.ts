// Свод по дате заказа. Тесты пиннят не «страница собралась», а сами числа и правила разнесения:
// каждый дефект ниже уже случался на живых данных июля 2026 и молча искажал результат.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSvod, svcColumn, isPointsPaid, bonusKind, SVC_OTHER, type OrderRow } from "./derive-lib.js";

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
  const bon = (o: Partial<Record<string, unknown>> = {}) => ({ ym: "2026-07", business: "1", amount: 5000, type: "Начисление", src: "Баллы за скидку Маркета", ...o });
  it("месячный итог приводится к отчёту, доли по позициям остаются пропорциональными", () => {
    const rows = [item({ price: 7500, accruals: 7500, subsidy: 3000 }), item({ pos: 1, sku: "S2", price: 2500, accruals: 2500, subsidy: 1000 })];
    const ms = buildSvod(rows, [] as any, {}, "2026-09-15", [], [bon()] as any);
    const m = ms[0]!;
    expect(m.points_src).toBe("report");
    expect(Math.round(m.rows.reduce((a, r) => a + r.points_accrued, 0))).toBe(5000);
    expect(Math.round(m.rows.find((r) => r.sku === "S1")!.points_accrued)).toBe(3750);
  });
  it("живой июль 2026: разбор сходится с «Премией» кабинета до рубля", () => {
    // fixtures/ym/bonuses-2026-07.json - агрегат выгрузки кабинета (345 строк, 5 видов проводок).
    // Начислено минус потрачено на услуги обязано дать остаток, выплаченный премией.
    const f = JSON.parse(readFileSync("fixtures/ym/bonuses-2026-07.json", "utf-8"));
    const rows: any[] = f.by_type_source.map((x: any) => ({ ym: f.ym, business: f.business, type: x.type, src: x.source, amount: x.sum }));
    const accrued = rows.filter((r) => bonusKind(r) === "accrual").reduce((a, r) => a + r.amount, 0);
    const spent = -rows.filter((r) => bonusKind(r) === "spend").reduce((a, r) => a + r.amount, 0);
    expect(accrued).toBe(f.accrued);
    expect(spent).toBe(f.spent_on_services);
    expect(accrued - spent).toBe(f.balance_to_premium);
  });
  it("вид проводки решает источник, а не знак суммы", () => {
    // По знаку «Возврат списания» (+29 556 ₽) попал бы в начисление, хотя это возврат
    // ПОТРАЧЕННОГО, а «Возврат баллов за скидку Маркета» (-30 420 ₽) выпал бы, хотя начисление
    // как раз уменьшает.
    expect(bonusKind({ ym: "", business: "", src: "Баллы за скидку Маркета", amount: 100 })).toBe("accrual");
    expect(bonusKind({ ym: "", business: "", src: "Возврат баллов за скидку Маркета", amount: -100 })).toBe("accrual");
    expect(bonusKind({ ym: "", business: "", src: "Баллы за скидку Яндекс Плюс", amount: 100 })).toBe("accrual");
    expect(bonusKind({ ym: "", business: "", src: "Скидка за участие в совместных акциях", amount: -100 })).toBe("spend");
    expect(bonusKind({ ym: "", business: "", src: "Возврат скидки за участие в совместных акциях", amount: 100 })).toBe("spend");
  });
  it("списание баллов на услуги в «начислено» не идёт", () => {
    const ms = buildSvod([item({})], [] as any, {}, "2026-09-15", [],
      [bon({ amount: 5000, src: "Баллы за скидку Маркета" }), bon({ amount: -2000, type: "Списание", src: "Скидка за участие в совместных акциях" })] as any);
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

// Раскрытие баллов обязано сходиться с самими баллами: если показать «начислено» и «списано»,
// а их разность не даст показанную сумму, пользователь не сможет проверить число. Первая версия
// копила разбивку по строкам, до которых доходит цикл, а сальдо - по заказу целиком, и
// позиция-доставка в разбивку не попадала: по июлю 2026 расхождение было 160 763 ₽.
describe("раскрытие баллов сходится с показанными баллами", () => {
  it("начислено минус списано = сумма points_accrued строк, по каждой паре кабинет/месяц", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const bad: string[] = [];
    let checked = 0;
    for (const m of svod.months) {
      if (!m.rows.length) continue;
      checked++;
      const shown = m.rows.reduce((a: number, r: any) => a + (r.points_accrued || 0), 0);
      const net = (m.points_acc || 0) - (m.points_ded || 0);
      if (Math.abs(net - shown) > 1) bad.push(`${m.business}/${m.ym}: ${Math.round(net)} против ${Math.round(shown)}`);
    }
    expect(checked).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  // Где месяц приведён к отчёту, раскрытие обязано идти ИЗ ОТЧЁТА, а не из subsidies[] заказа:
  // иначе на экране стоят числа двух источников и их разность не даёт показанную сумму. Живой
  // факт 2026-09-16: по кабинету мебели за июль отчёт давал 2 321 628, а раскрытие от subsidies[]
  // 2 626 846 минус 79 631 - разность не сходилась ни с колонкой, ни с кабинетом.
  it("где источник - отчёт, раскрытие тоже из отчёта: acc - ded = points_report", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const bad: string[] = [];
    let checked = 0;
    for (const m of svod.months) {
      if (m.points_src !== "report" || !m.rows.length) continue;
      checked++;
      const net = (m.points_acc || 0) - (m.points_ded || 0);
      if (Math.abs(net - (m.points_report || 0)) > 1) {
        bad.push(`${m.business}/${m.ym}: ${Math.round(net)} против отчёта ${Math.round(m.points_report || 0)}`);
      }
    }
    expect(checked, "ни одного месяца по отчёту - проверять нечего").toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  // Живая сверка с выгрузкой Ивана из кабинета: июль, кабинет зеркал. Начислено 1 748 465
  // (1 727 820 скидка Маркета + 18 645 Плюс + 2 000 на доставку), возврата начисления нет.
  it("июль по кабинету зеркал совпадает с выгрузкой из кабинета", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const m = svod.months.find((x: any) => x.ym === "2026-07" && x.business === "1023124");
    expect(m, "месяца нет в своде").toBeTruthy();
    expect(m.points_src).toBe("report");
    expect(Math.round(m.points_report)).toBe(1748465);
    expect(Math.round(m.points_acc)).toBe(1748465);
    expect(Math.round(m.points_ded)).toBe(0);
  });

  it("списание неотрицательно - это величина, а не знак", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    for (const m of svod.months) expect(m.points_ded, `${m.business}/${m.ym}`).toBeGreaterThanOrEqual(0);
  });
});

// Вторая нога баллов: сколько Маркет ЗАБРАЛ баллами за услуги по заказам. Начисление к отчёту мы
// привели ещё 2026-09-16, а списание всё это время оставалось нашей классификацией проводок
// реестра и было завышено: июль по обоим кабинетам давал 4 861 651 против 4 060 473 в отчёте,
// то есть на 801 178 руб. Отчёт при этом сходится сам с собой (начислено 4 070 093 минус
// потрачено 4 060 473 = 9 620, строка «Премия, предоставленная Исполнителем»), значит верен он.
describe("списание баллов на услуги тоже приводится к отчёту", () => {
  const spend = (o: Record<string, unknown> = {}) => ({
    ym: "2026-07", business: "1", amount: -600, type: "Списание",
    src: "Скидка за участие в совместных акциях", order: "A", ...o,
  });
  const two = (bonus: any[]) => buildSvod(
    [item({ order: "A", shop_order: "A" }), item({ order: "B", shop_order: "B", sku: "S2" })],
    [net({ order: "A", type: "Списание", amount: -750 }), net({ order: "B", type: "Списание", amount: -250 })] as any,
    {}, "2026-09-15", [], bonus as any,
  )[0]!;

  it("месячный итог равен отчёту, доли по позициям остаются пропорциональными", () => {
    const m = two([spend({ amount: -600 })]);
    expect(m.svc_points_src).toBe("report");
    expect(Math.round(m.svc_points_report!)).toBe(600);
    expect(Math.round(m.rows.reduce((a, r) => a + r.svc_points, 0))).toBe(600);
    expect(Math.round(m.rows.find((r) => r.sku === "S1")!.svc_points)).toBe(450);  // 750 из 1000
    expect(Math.round(m.rows.find((r) => r.sku === "S2")!.svc_points)).toBe(150);
  });

  it("сторно уменьшает списание, а не добавляет второе", () => {
    const m = two([spend({ amount: -600 }), spend({ amount: 200, type: "Возврат списания", src: "Возврат скидки за участие в совместных акциях" })]);
    expect(Math.round(m.rows.reduce((a, r) => a + r.svc_points, 0))).toBe(400);
  });

  it("итог строки и результат по баллам пересчитываются вместе с ногой, а не остаются старыми", () => {
    const m = two([spend({ amount: -600 })]);
    for (const r of m.rows) {
      expect(r.svc_total).toBe(r2x(r.svc_money + r.svc_points));
      expect(r.result_points).toBe(r2x(r.revenue_money + r.points_accrued - r.svc_total));
    }
  });

  it("трата без номера заказа позиции не трогает - это общие расходы кабинета", () => {
    // Полка и Буст за показы приходят строками без заказа. Разносить их по позициям нечем, и
    // масштабировать ими ногу заказов - значит забрать у кабинета его же расход.
    const m = two([spend({ order: "", amount: -600, service: "Полка" })]);
    expect(m.svc_points_src).toBeUndefined();
    expect(Math.round(m.rows.reduce((a, r) => a + r.svc_points, 0))).toBe(1000);
  });

  it("без отчёта нога остаётся реестровой и месяц это не помечает", () => {
    const m = two([]);
    expect(m.svc_points_src).toBeUndefined();
    expect(Math.round(m.rows.reduce((a, r) => a + r.svc_points, 0))).toBe(1000);
  });

  it("на живых данных: по каждой паре кабинет/месяц услуги баллами равны отчёту", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const bad: string[] = [];
    let checked = 0;
    for (const m of svod.months) {
      if (m.svc_points_src !== "report" || !m.rows.length) continue;
      checked++;
      const shown = m.rows.reduce((a: number, r: any) => a + (r.svc_points || 0), 0);
      // Остаток - округление копеек по строкам (на живом снимке максимум 6 копеек за месяц).
      if (Math.abs(shown - m.svc_points_report) > 1) {
        bad.push(`${m.business}/${m.ym}: ${Math.round(shown)} против отчёта ${Math.round(m.svc_points_report)}`);
      }
    }
    expect(checked, "ни одного месяца по отчёту - проверять нечего").toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  // Сверка с выгрузкой Ивана из кабинета зеркал за июль: начислено 1 748 465, списано столько же,
  // остаток 0. Обе ноги списания вместе обязаны дать ровно начисление.
  it("июль по кабинету зеркал: услуги плюс расходы кабинета = начисленным баллам", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const m = svod.months.find((x: any) => x.ym === "2026-07" && x.business === "1023124");
    expect(m, "месяца нет в своде").toBeTruthy();
    expect(Math.round(m.svc_points_report)).toBe(1747178);
    expect(Math.round(m.overhead_points)).toBe(1287);
    expect(Math.round(m.svc_points_report + m.overhead_points)).toBe(1748465);
  });
});

// Отчёт по баллам Маркета. Живой агрегат за июль 2026 по кабинету зеркал, выгруженный Иваном из
// кабинета (Финансы -> Финансовые отчёты -> По платежам -> «О баллах Маркета»). В API это тот же
// reports/united-netting/generate с телом monthOfYear - отдельного метода нет, и пять имён, которые
// я перебирал раньше, были выдуманы.
//
// Главное, что показывает этот отчёт: НАЧИСЛЕННЫЕ баллы не равны СПИСАННЫМ. За июль по зеркалам
// начислено 1 748 465, списано 1 750 954, возвращено 2 489 - баланс -2 000 руб.
describe("отчёт по баллам: разбор типов транзакций", () => {
  const ref = JSON.parse(readFileSync("fixtures/ym/bonuses-2026-07-1023124.json", "utf-8"));
  const rows = ref.by_type_source as Array<{ type: string; source: string; n: number; sum: number }>;
  const kind = (r: { type: string; source: string }) => bonusKind({ ym: "2026-07", business: "1023124", type: r.type, src: r.source, amount: 0 });

  it("начисление узнаётся по ИСТОЧНИКУ проводки, а не по знаку суммы", () => {
    const acc = rows.filter((r) => kind(r) === "accrual");
    expect(acc.map((r) => r.source).sort()).toEqual([
      "Баллы за скидку Маркета", "Баллы за скидку Маркета на доставку", "Баллы за скидку Яндекс Плюс",
    ]);
    expect(Math.round(acc.reduce((a, r) => a + r.sum, 0))).toBe(1748465);
  });

  it("списание и возврат списания - это трата баллов на услуги, а не начисление", () => {
    const sp = rows.filter((r) => kind(r) === "spend");
    expect(sp.map((r) => r.type).sort()).toEqual(["Возврат списания", "Списание"]);
    // Списание -1 750 954.03 плюс возврат списания +2 489.03 = потрачено 1 748 465.
    expect(Math.round(sp.reduce((a, r) => a + r.sum, 0))).toBe(-1748465);
  });

  it("ни одна проводка отчёта не осталась неразобранной", () => {
    expect(rows.filter((r) => kind(r) === "other").map((r) => `${r.type} | ${r.source}`)).toEqual([]);
  });

  it("начислено и потрачено - разные величины, сходятся только по кабинету за месяц", () => {
    const acc = rows.filter((r) => r.type === "Начисление").reduce((a, r) => a + r.sum, 0);
    const ded = rows.filter((r) => r.type === "Списание").reduce((a, r) => a + r.sum, 0);
    const ret = rows.filter((r) => r.type === "Возврат списания").reduce((a, r) => a + r.sum, 0);
    // Валовые суммы не равны: начислено 1 748 465, списано 1 750 954, возвращено 2 489.
    expect(Math.round(acc)).toBe(1748465);
    expect(Math.round(ded)).toBe(-1750954);
    expect(Math.round(ret)).toBe(2489);
    // По кабинету за июль баллы израсходованы полностью, остаток ноль. У мебели за тот же месяц
    // остаток 9 620 руб - строка «Премия, предоставленная Исполнителем». То есть ноль тут факт
    // конкретного месяца, а не тождество: проверяем сведение, а не равенство начислено=списано.
    expect(Math.abs(acc + ded + ret)).toBeLessThan(1);
  });

  it("проводки баллов отличаются от денежных по типу транзакции", () => {
    expect(isPointsPaid("Списание")).toBe(true);
    expect(isPointsPaid("Возврат списания")).toBe(true);
    expect(isPointsPaid("Удержание")).toBe(false);
    expect(isPointsPaid("Начисление")).toBe(false);
  });
});


// ФЕНИКС, аудит 2026-09-17, gaps 6-8. Три дыры, через которые деньги уходили с экрана молча.
describe("деньги кабинета: три источника не должны терять друг друга", () => {
  const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));

  // gap 6: акт замещает реестр целиком. Где акт МЕНЬШЕ, разница исчезала из P&L без следа:
  // на снимке 2026-09-17 это 9 пар из 14 и 14 534,67 ₽ (февраль/зеркала 8 731,67 -> 1 197,26).
  it("месяц по акту помнит, сколько давал реестр до замещения", () => {
    const byAct = svod.months.filter((m: any) => m.overhead_src === "act");
    expect(byAct.length, "нет ни одного месяца по акту - проверять нечего").toBeGreaterThan(3);
    for (const m of byAct) {
      expect(m.overhead_ledger, `${m.business}/${m.ym}: поле реестрового итога не заполнено`).toBeDefined();
      expect(typeof m.overhead_ledger).toBe("number");
    }
    // Хотя бы один месяц, где акт меньше реестра: иначе сторож нечем проверить.
    const shrunk = byAct.filter((m: any) => (m.overhead_ledger || 0) - ((m.overhead_money || 0) + (m.overhead_points || 0)) > 0.5);
    expect(shrunk.length, "ни одной пары, где акт меньше реестра - сторож не на чем показать").toBeGreaterThan(0);
  });

  // gap 7: отчёт о баллах знает о кабинетных тратах больше, чем акт. Сентябрь: 40 094 ₽ при
  // «расходов кабинета нет» на экране, потому что акта за текущий месяц ещё нет.
  it("кабинетные списания баллов из отчёта видны отдельным числом", () => {
    for (const m of svod.months) {
      expect(m.overhead_points_report, `${m.business}/${m.ym}: поле не заполнено`).toBeDefined();
      expect(m.overhead_points_report, `${m.business}/${m.ym}: величина отрицательна`).toBeGreaterThanOrEqual(0);
    }
    const noAct = svod.months.filter((m: any) => m.overhead_src !== "act" && (m.overhead_points_report || 0) > 0);
    expect(noAct.length, "нет месяца без акта, но с тратами по отчёту - сторож не на чем показать").toBeGreaterThan(0);
  });

  // Решение Ивана 2026-09-17: «баллы за полку и за буст относи в общие расходы на кабинет».
  // Источник балльной ноги по этим статьям - отчёт о баллах, а не акт: в акте BONUS_PAID заполнен
  // частично, и где заполнен, отчёт всегда больше (август/мебель 9 262,44 против 52 631,71).
  // Поэтому замещаем, а не складываем, и замещаем ОБЕ статьи целиком: за июль по мебели отчёт
  // знал только Полки, и рядом оставался Буст из акта - опять два источника в одной статье.
  it("баллы за Полку и Буст в расходах кабинета равны отчёту о баллах", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const m of svod.months) {
      const rep = m.overhead_points_report || 0;
      if (!rep) continue;
      checked++;
      const pts = m.overhead_pts || {};
      const governed = (pts["Полка"] || 0) + (pts["Буст продаж"] || 0);
      if (Math.abs(governed - rep) > 1) bad.push(`${m.business}/${m.ym}: в расходах ${Math.round(governed)}, в отчёте ${Math.round(rep)}`);
      // Балльная нога месяца не должна быть МЕНЬШЕ отчёта: иначе кабинетные траты снова невидимы.
      if ((m.overhead_points || 0) + 1 < rep) bad.push(`${m.business}/${m.ym}: всего баллами ${Math.round(m.overhead_points || 0)} против отчёта ${Math.round(rep)}`);
    }
    expect(checked, "нет ни одного месяца с кабинетными списаниями - проверять нечего").toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  // Живой случай, ради которого правка и делалась: за сентябрь акта ещё нет, и до неё страница
  // показывала «расходов кабинета нет» при 40 094 ₽ потраченных баллов.
  it("месяц без акта всё равно показывает кабинетные траты баллами", () => {
    const sep = svod.months.find((m: any) => m.ym === "2026-09" && (m.overhead_points_report || 0) > 0);
    expect(sep, "сентябрь с тратами по отчёту не найден").toBeTruthy();
    expect(sep.overhead_src, "у сентября появился акт - тест потерял смысл, обнови его").toBe("ledger");
    expect(Math.round(sep.overhead_points)).toBe(Math.round(sep.overhead_points_report));
    expect(sep.overhead_points).toBeGreaterThan(0);
  });

  // gap 8: Полка, Подписка и Товарные баннеры не имели правил и падали в «Прочие услуги» -
  // 151 142 ₽ за историю, то есть 65% общих расходов июля лежало под чужим заголовком.
  it("статьи уровня кабинета разложены по своим именам, а не в «прочее»", () => {
    const other: Record<string, number> = {};
    for (const m of svod.months) {
      for (const [col, v] of Object.entries<any>(m.overhead || {})) other[col] = (other[col] || 0) + (v as number);
      for (const [col, v] of Object.entries<any>(m.overhead_pts || {})) other[col] = (other[col] || 0) + (v as number);
    }
    for (const name of ["Полка", "Подписка", "Товарные баннеры"]) {
      expect(other[name], `статья «${name}» не выделена и всё ещё падает в прочее`).toBeGreaterThan(0);
    }
    expect(Math.round(other["Прочие услуги"] || 0), "в «Прочих услугах» снова осели именованные статьи").toBe(0);
  });
});
