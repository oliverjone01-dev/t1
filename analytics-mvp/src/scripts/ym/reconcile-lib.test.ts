import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseOrder } from "../../connector/ym-partner.js";
import { applyNettingFees, normalizeOrder, type OrderRow } from "./derive-lib.js";
import { buildReconcile, moneyTol } from "./reconcile-lib.js";

const sample = JSON.parse(readFileSync("fixtures/ym/orders_sample.json", "utf-8"));
const rows: OrderRow[] = sample.orders.flatMap((o: any) => normalizeOrder(parseOrder(o), sample.campaignId, sample.businessId));
const live = { dateFrom: "2026-08-05", dateTo: "2026-09-03", sku_table: [{ sku: "GGM-16-2-2", rev: 38000 }, { sku: "GGT-03-3-3-O-20090", rev: 200000 }] };
// Полное покрытие отчёта о реализации по умолчанию: базовые проверки §15 описывают случай, когда
// отчёт выпущен по всем магазинам с продажами. Неполное и неизвестное покрытие проверяются отдельно
// в блоке «недобранный отчёт о реализации».
const FULL_COV = { by_month: { "2026-08": { shops_sold: ["21000001"], shops_with_rows: ["21000001"], shops_no_data: [], shops_pending: [] } } };
const base = { rows, cogs: { "GGT-03-3-3-O-20090": 15000 }, tax: { "GGT-03-3-3-O-20090": {} }, live, views: [], ads: null, realizationState: FULL_COV };
const TODAY = "2026-09-04";

describe("несколько кабинетов (свой ключ на кабинет)", () => {
  it("accounts() собирает все заданные ключи и падает, если не задан ни один", async () => {
    const mod = await import("./common.js");
    const save = { a: process.env.YM_API_KEY, b: process.env.YM_API_KEY_2, c: process.env.YM_DASHBOARD_1, d: process.env.YM_DASHBOARD_ZERKALA_2 };
    delete process.env.YM_DASHBOARD_1; delete process.env.YM_DASHBOARD_ZERKALA_2;
    process.env.YM_API_KEY = "k1"; process.env.YM_API_KEY_2 = "k2";
    const accs = mod.accounts();
    expect(accs.map((a) => a.env)).toEqual(["YM_DASHBOARD_1", "YM_DASHBOARD_ZERKALA_2"]);
    delete process.env.YM_API_KEY; delete process.env.YM_API_KEY_2;
    expect(() => mod.accounts()).toThrow(/Нет ключей Маркета/);
    process.env.YM_API_KEY_2 = "only-mirrors";
    expect(mod.accounts().map((a) => a.env)).toEqual(["YM_DASHBOARD_ZERKALA_2"]); // один кабинет тоже работает
    delete process.env.YM_API_KEY_2;
    if (save.a) process.env.YM_API_KEY = save.a; if (save.b) process.env.YM_API_KEY_2 = save.b;
    if (save.c) process.env.YM_DASHBOARD_1 = save.c; if (save.d) process.env.YM_DASHBOARD_ZERKALA_2 = save.d;
  });
  it("недоступные кампании попадают в покрытие и в блокеры", () => {
    const skippedCampaigns = [{ campaign: "21985942", business: "1023124", reason: "API кампании отключён Маркетом из-за неактивности" }];
    const r = buildReconcile({ ...base, realization: [], netting: null, skippedCampaigns }, TODAY);
    expect((r.coverage as any).campaigns_skipped).toEqual(skippedCampaigns);
    expect(r.blockers.some((b) => b.includes("21985942") && b.includes("неактивности"))).toBe(true);
  });
  it("покрытие разложено по кабинетам", () => {
    const rows2 = rows.map((r, i) => ({ ...r, business: i % 2 ? "1023124" : "74986385" }));
    const r = buildReconcile({ ...base, rows: rows2, realization: [], netting: null }, TODAY);
    const bb = (r.coverage as any).by_business;
    expect(Object.keys(bb).sort()).toEqual(["1023124", "74986385"]);
    expect(bb["1023124"].rows + bb["74986385"].rows).toBe(rows2.filter((x) => !x.fake).length);
  });
});

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
  it("сверка с платежами Маркета идёт по ПОКУПАТЕЛЬСКОЙ ноге (начислено − софинансирование)", () => {
    const r = buildReconcile({ ...base, realization: [], netting: null }, TODAY);
    const cp = r.cumulative.payments;
    // заказ 500001: начислено 100000, софинансирование Маркета 2000 -> покупательская нога 98000.
    // Полное «к выплате» 81000 (за вычетом сборов) этой сверкой НЕ проверяется: сборы видны только
    // в отчёте по взаиморасчётам.
    expect(cp.orders_with_payments).toBe(1);
    expect(cp.accruals).toBe(100000);
    expect(cp.subsidy_leg).toBe(2000);
    expect(cp.buyer_leg_derived).toBe(98000);
    expect(cp.payout_full).toBe(81000);
    expect(cp.payments_actual).toBe(62000);
    expect(cp.diff).toBe(36000);
    expect(cp.orders_off).toBe(1); expect(cp.orders_matched).toBe(0); expect(cp.orders_off_pct).toBe(100);
    expect(cp.off_orders[0]).toMatchObject({ order: "500001", expected: 98000, actual: 62000, diff: -36000 });
    expect(cp.status).toContain("РАСХОЖДЕНИЕ");
    expect(cp.covers).toContain("united-netting");
    expect(r.blockers.some((b) => b.includes("покупательская нога"))).toBe(true);
    expect(r.verdict).toBe("return");
  });
  it("покупательская нога сходится, когда payments = оплата покупателя (форма живых данных)", () => {
    // Живые данные: в payments приходит только оплата покупателя, софинансирование Маркета
    // (subsidies / цена типа MARKETPLACE) выплачивается отдельно и в payments не попадает.
    const order = {
      id: 700001, creationDate: "05-08-2026", statusUpdateDate: "10-08-2026", status: "DELIVERED",
      items: [{ offerName: "Зеркало", shopSku: "GGZ-1", marketSku: "1", count: 1, initialCount: 1,
        prices: [{ type: "BUYER", costPerItem: 23018, total: 23018 }, { type: "MARKETPLACE", costPerItem: 20640, total: 20640 }], details: [] }],
      commissions: [{ type: "FEE", actual: 6089 }],
      subsidies: [{ operationType: "MARKETPLACE", type: "SUBSIDY", amount: 20640 }],
      payments: [{ id: "p", date: "20-08-2026", type: "PAYMENT", total: 23018 }],
    };
    const rs = normalizeOrder(parseOrder(order), "c1", "1023124");
    const r = buildReconcile({ ...base, rows: rs, realization: [], netting: null }, TODAY);
    const cp = r.cumulative.payments;
    expect(cp.accruals).toBe(43658);
    expect(cp.subsidy_leg).toBe(20640);
    expect(cp.buyer_leg_derived).toBe(23018);
    expect(cp.payments_actual).toBe(23018);
    expect(cp.diff).toBe(0);
    expect(cp.orders_off).toBe(0); expect(cp.orders_matched).toBe(1);
    expect(cp.status).toContain("сошлось позаказно");
    expect(cp.payout_full).toBe(43658 - 6089); // полное «к выплате» больше ноги покупателя на софинансирование
    expect(r.blockers.some((b) => b.includes("покупательская нога"))).toBe(false);
  });
  it("единичный краевой заказ не объявляет формулу сломанной (порог по доле заказов, не по сумме)", () => {
    // 50 нормальных заказов + 1 краевой: агрегат уедет, но доля несошедшихся 2% -> блокера нет.
    const mk = (id: number, paid: number) => normalizeOrder(parseOrder({
      id, creationDate: "05-08-2026", statusUpdateDate: "10-08-2026", status: "DELIVERED",
      items: [{ offerName: "Зеркало", shopSku: "GGZ-1", marketSku: "1", count: 1, initialCount: 1,
        prices: [{ type: "BUYER", costPerItem: 10000, total: 10000 }, { type: "MARKETPLACE", costPerItem: 5000, total: 5000 }], details: [] }],
      commissions: [{ type: "FEE", actual: 1000 }],
      subsidies: [{ operationType: "MARKETPLACE", type: "SUBSIDY", amount: 5000 }],
      payments: [{ id: "p", date: "20-08-2026", type: "PAYMENT", total: paid }],
    }), "c1", "1023124");
    const rs = [...Array(50).keys()].flatMap((i) => mk(800000 + i, 10000)).concat(mk(800050, 3000));
    const r = buildReconcile({ ...base, rows: rs, realization: [], netting: null }, TODAY);
    const cp = r.cumulative.payments;
    expect(cp.orders_matched).toBe(50); expect(cp.orders_off).toBe(1); expect(cp.orders_off_pct).toBe(2);
    expect(cp.off_amount).toBe(-7000);
    expect(cp.status).toContain("краевые случаи");
    expect(r.blockers.some((b) => b.includes("формула денег неверна"))).toBe(false);
  });
  it("ключ заказа: расхождение денег не объявляется, пока ORDER_ID не подтверждён внешним номером", () => {
    // Живая находка 2026-09-04: по одному id наш заказ давал начисление 3500 ₽, а отчёт - 43 797 ₽
    // по тому же артикулу (медиана по всем заказам 13.5x). Пока не доказано, что ORDER_ID отчёта и
    // id заказа - один номер, рубли расхождения показывать нельзя: это выдуманная цифра.
    const rs = rows.map((r) => ({ ...r, shop_order: "GG-" + r.order }));
    const bad = [
      { d: "2026-08-12", order: "500001", shop_order: "GG-ЧУЖОЙ", amount: 400000 },
      { d: "2026-08-20", order: "500002", shop_order: "GG-ТОЖЕ-ЧУЖОЙ", amount: 300000 },
    ];
    const r = buildReconcile({ ...base, rows: rs, realization: [], netting: bad }, TODAY);
    const kc = r.periods[0]!.money.key_check;
    expect(kc.checked).toBe(2); expect(kc.agree).toBe(0); expect(kc.trusted).toBe(false);
    expect(r.periods[0]!.money.status).toContain("КЛЮЧ ЗАКАЗА НЕ ПОДТВЕРЖДЁН");
    // рублёвого блокера быть не должно - вместо него блокер про ключ
    expect(r.blockers.some((b) => b.includes("деньги закрытого месяца расходятся"))).toBe(false);
    expect(r.blockers.some((b) => b.includes("КЛЮЧ ЗАКАЗА НЕ ПОДТВЕРЖДЁН"))).toBe(true);
    expect((r.coverage as any).netting_key.pct).toBe(0);
  });
  it("ключ заказа подтверждён - сверка денег работает как раньше", () => {
    const rs = rows.map((r) => ({ ...r, shop_order: "GG-" + r.order }));
    const good = [
      { d: "2026-08-12", order: "500001", shop_order: "GG-500001", amount: 81000 },
      { d: "2026-08-20", order: "500002", shop_order: "GG-500002", amount: 32000 },
    ];
    const r = buildReconcile({ ...base, rows: rs, realization: [], netting: good }, TODAY);
    expect(r.periods[0]!.money.key_check.trusted).toBe(true);
    expect(r.periods[0]!.money.diff).toBe(1500);
    expect(r.blockers.some((b) => b.includes("деньги закрытого месяца расходятся с выплатами ЛК на 1500"))).toBe(true);
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

describe("недобранный отчёт о реализации - это пробел, а не расхождение", () => {
  // Живой факт 2026-09: за закрытый месяц 2026-08 отчёт был выпущен лишь по части магазинов, в нём
  // лежало 26 шт против 151 доставленной. Сверка объявляла «расхождение 125 шт», хотя сравнивать
  // было не с чем: три магазина с 78 шт продаж не забраны вовсе, ещё у четырёх отчёт вернул NO_DATA.
  const rows2 = rows.map((r, i) => ({ ...r, campaign: i % 2 ? "shopA" : "shopB" }));
  const realz = [{ ym: "2026-08", sku: "GGT-03-3-3-O-20090", sold: 3, ret: 0, amount: 100000 }];

  it("покрытие неполное: штуки не сверяются, в блокерах названы недостающие магазины", () => {
    const st = { by_month: { "2026-08": { shops_sold: ["shopA", "shopB"], shops_with_rows: ["shopA"], shops_no_data: ["shopB"], shops_pending: [] } } };
    const r = buildReconcile({ ...base, rows: rows2, realization: realz, netting: null, realizationState: st }, TODAY);
    const u = r.periods[0]!.units;
    expect(u.diff).toBe(null);                       // расхождения НЕ объявляем
    expect(u.status).toContain("ОТЧЁТ ДОБРАН ЧАСТИЧНО");
    expect((u as any).coverage).toMatchObject({ known: true, shops_sold: 2, shops_with_rows: 1, shops_missing: ["shopB"], complete: false });
    expect(r.periods[0]!.revenue).toBe(null);        // выручку по неполному отчёту тоже не сверяем
    expect(r.blockers.some((b) => b.includes("добран частично") && b.includes("shopB"))).toBe(true);
    expect(r.blockers.some((b) => b.includes("штуки закрытого месяца расходятся"))).toBe(false);
  });
  it("покрытие полное: сверка работает как раньше", () => {
    const st = { by_month: { "2026-08": { shops_sold: ["shopA", "shopB"], shops_with_rows: ["shopA", "shopB"], shops_no_data: [], shops_pending: [] } } };
    const r = buildReconcile({ ...base, rows: rows2, realization: realz, netting: null, realizationState: st }, TODAY);
    const u = r.periods[0]!.units;
    expect((u as any).coverage.complete).toBe(true);
    expect(u.diff).toBe(u.orders_delivered_net - 3);
    expect(r.periods[0]!.revenue).not.toBe(null);
  });
  it("состояние бэкфилла не записано: покрытие НЕИЗВЕСТНО, а не ноль", () => {
    const r = buildReconcile({ ...base, rows: rows2, realization: realz, netting: null, realizationState: null }, TODAY);
    const u = r.periods[0]!.units;
    expect((u as any).coverage).toMatchObject({ known: false, shops_with_rows: null });
    expect(u.diff).toBe(null);
    expect(u.status).toContain("НЕИЗВЕСТНО");
    expect(r.blockers.some((b) => b.includes("покрытие отчёта о реализации") && b.includes("неизвестно"))).toBe(true);
  });
});

describe("«откуда сборы» видно на страницах, а не только в снимке (ФЕНИКС P0)", () => {
  // Сборы, взятые из комиссий заказа, покрывают только комиссию за продажу. Пока ledger не закрыл
  // весь оборот, «к выплате» и маржа по непокрытой части завышены, и это обязано быть видно.
  it("непокрытая ledger'ом часть оборота попадает в покрытие и в блокеры", () => {
    const r = buildReconcile({ ...base, realization: [], netting: null }, TODAY);
    const fs = (r.coverage as any).fee_source;
    expect(fs.pct_accruals_from_commissions).toBe(100); // netting не подан - весь оборот из комиссий
    expect(r.blockers.some((b) => b.includes("из комиссий заказа") && b.includes("завышены"))).toBe(true);
    expect(r.coverage).toHaveProperty("fee_source.by_month");
  });
  it("когда ledger покрывает оборот, блокера нет", () => {
    const net = rows.map((x) => ({ order: x.order, sku: x.sku, type: "Удержание", service: "Размещение товарных предложений", amount: -100 }));
    const withFees = applyNettingFees(rows, net).rows;
    const r = buildReconcile({ ...base, rows: withFees, realization: [], netting: null }, TODAY);
    expect((r.coverage as any).fee_source.pct_accruals_from_commissions).toBe(0);
    expect(r.blockers.some((b) => b.includes("из комиссий заказа"))).toBe(false);
  });
});

describe("сверка денег не выдаёт тождество за проверку сборов (ФЕНИКС P0)", () => {
  // payout = начислено − сборы, сборы взяты из реестра. В разности payout − реестр член со сборами
  // сокращается тождественно, поэтому «сошлось» относится к начислениям, а не к сборам.
  const net = [
    { d: "2026-08-12", order: "500001", type: "Начисление", amount: 90000 },
    { d: "2026-08-12", order: "500001", sku: "GGT-03-3-3-O-20090", type: "Удержание", service: "Размещение товарных предложений", amount: -9000 },
  ];
  it("нога сборов равна нулю, вся разность объясняется начислениями", () => {
    const withFees = applyNettingFees(rows, net as any).rows;
    const r = buildReconcile({ ...base, rows: withFees, realization: [], netting: net }, TODAY);
    const l = (r.cumulative as any).legs;
    expect(l.fees_derived).toBe(l.fees_ledger);
    expect(l.fees_diff).toBe(0);                       // тождество, а не совпадение
    expect(r.cumulative.diff).toBe(l.accruals_diff);   // разность - это только начисления
    expect(l.covers).toContain("сокращаются тождественно");
  });
  it("разнесение сборов по позициям проверяется независимо и умеет падать", () => {
    const withFees = applyNettingFees(rows, net as any).rows;
    const ok = buildReconcile({ ...base, rows: withFees, realization: [], netting: net }, TODAY);
    expect((ok.cumulative as any).legs.allocation.orders_off).toBe(0);
    // Ломаем разнесение: половина сбора «потерялась» - инвариант обязан это увидеть.
    const broken = withFees.map((x) => (x.order === "500001" ? { ...x, fee_total: x.fee_total / 2 } : x));
    const bad = buildReconcile({ ...base, rows: broken, realization: [], netting: net }, TODAY);
    const a = (bad.cumulative as any).legs.allocation;
    expect(a.orders_off).toBe(1);
    expect(a.status).toContain("РАЗНЕСЕНИЕ ТЕРЯЕТ ДЕНЬГИ");
  });
});
