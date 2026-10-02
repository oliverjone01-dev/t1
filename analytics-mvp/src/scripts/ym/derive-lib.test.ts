import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { parseOrder, ymDate, decodeReport } from "../../connector/ym-partner.js";
import { normalizeOrder, buildHistory, buildDailyTotals, buildSkusLive, buildPnl, buildPnlSku, buildPnlDaily, buildPnlSkuDaily, buildAccNetting, accSaleDay, splitNoStatus, accCutDays, nettingCancelled, nettingNoStatus, cogsLookup, buildAccountDaily, accountGroup, feeGroup, type OrderRow, isServiceItem, applyNettingFees, nettingFeeGroup, isNettingFee } from "./derive-lib.js";

const sample = JSON.parse(readFileSync("fixtures/ym/orders_sample.json", "utf-8"));
const rows: OrderRow[] = sample.orders.flatMap((o: any) => normalizeOrder(parseOrder(o), sample.campaignId, sample.businessId));

describe("ym dates", () => {
  it("DD-MM-YYYY и ISO -> YYYY-MM-DD", () => {
    expect(ymDate("05-08-2026")).toBe("2026-08-05");
    expect(ymDate("2026-08-20")).toBe("2026-08-20");
    expect(ymDate("2026-08-20T10:00:00+03:00")).toBe("2026-08-20");
    expect(ymDate("")).toBe("");
  });
});

describe("normalizeOrder", () => {
  it("строка на позицию, platform=ym, sku = артикул (shopSku)", () => {
    expect(rows.every((r) => r.platform === "ym")).toBe(true);
    expect(rows.filter((r) => r.order === "500001").map((r) => r.sku).sort()).toEqual(["GGM-16-2-2", "GGT-03-3-3-O-20090"]);
  });
  it("выручка = сумма типов цен × count; комиссии разнесены пропорционально начислениям", () => {
    const o1 = rows.filter((r) => r.order === "500001");
    const mirror = o1.find((r) => r.sku === "GGM-16-2-2")!, table = o1.find((r) => r.sku === "GGT-03-3-3-O-20090")!;
    expect(mirror.revenue).toBe(20000); // BUYER 18000 + MARKETPLACE 2000
    expect(table.revenue).toBe(80000);
    expect(mirror.accruals + table.accruals).toBe(100000);
    // сборы заказа 19000 (actual): 15000 FEE + 1000 AGENCY + 3000 доставка
    expect(Math.round(mirror.fee_total + table.fee_total)).toBe(19000);
    expect(mirror.fee_total).toBeCloseTo(19000 * 0.2, 0);
    expect(mirror.fee_actual).toBe(true);
    expect(mirror.fees["Комиссия за продажу"]).toBeCloseTo(3000, 0);
    expect(mirror.payout + table.payout).toBeCloseTo(81000, 0);
  });
  it("частичный возврат: units=initialCount, delivered = count − returned, predicted-комиссии помечены", () => {
    const r = rows.find((x) => x.order === "500002")!;
    expect(r.units).toBe(3); expect(r.count).toBe(2); expect(r.returned).toBe(1); expect(r.cancelled).toBe(1);
    expect(r.delivered).toBe(1);
    expect(r.accruals).toBe(40000); expect(r.revenue).toBe(120000); // заказано 3 шт (как revenue OZON: до отклонений/возвратов)
    expect(r.fee_actual).toBe(false); expect(r.fee_total).toBe(6500);
    expect(r.fin).toBe("2026-08-16"); // дата доставки/возврата, не создания
  });
  it("отменённый заказ: revenue = заказано (единый смысл с OZON), cancelled = units, денег нет", () => {
    const r = rows.find((x) => x.order === "500003")!;
    expect(r.revenue).toBe(18000); expect(r.cancelled).toBe(1); expect(r.accruals).toBe(0); expect(r.payout).toBe(0);
  });
  it("заказ в доставке: выручка есть (заказано), начислений/выплаты нет", () => {
    const r = rows.find((x) => x.order === "500004")!;
    expect(r.revenue).toBe(18000); expect(r.accruals).toBe(0); expect(r.payout).toBe(0); expect(r.fee_total).toBe(0);
  });
  it("платежи разложены по типам и разнесены по позициям; субсидии сохранены", () => {
    const o1 = rows.filter((r) => r.order === "500001");
    const paid = o1.reduce((s, r) => s + r.paid, 0);
    expect(Math.round(paid)).toBe(62000); // 60000 PAYMENT + 2000 SUBSIDY
    const mirror = o1.find((r) => r.sku === "GGM-16-2-2")!;
    expect(Math.round(mirror.paid_by_type["PAYMENT"]!)).toBe(12000); // доля 20%
    expect(Math.round(mirror.paid_by_type["SUBSIDY"]!)).toBe(400);
    expect(Math.round(o1.reduce((s, r) => s + r.subsidy, 0))).toBe(2000);
  });
  it("группы комиссий", () => {
    expect(feeGroup("FEE")).toBe("Комиссия за продажу");
    expect(feeGroup("delivery_to_customer")).toBe("Логистика (прямая+возвратная)");
    expect(feeGroup("SOMETHING_NEW")).toBe("Прочее");
  });
});

describe("derive contract files", () => {
  const facts = buildHistory(rows, "2026-08-01", "2026-08-31");
  it("history: тестовые заказы (fake) исключены, пустые дни заполнены __empty__", () => {
    expect(facts.some((f) => f.sku === "TEST-1")).toBe(false);
    expect(facts.filter((f) => f.sku === "__empty__").length).toBe(31 - 4);
    const d05 = facts.filter((f) => f.date === "2026-08-05");
    expect(d05.map((f) => f.sku).sort()).toEqual(["GGM-16-2-2", "GGT-03-3-3-O-20090"]);
    expect(d05.find((f) => f.sku === "GGM-16-2-2")!.revenue).toBe(20000);
    const c = facts.find((f) => f.date === "2026-08-20")!;
    expect(c.cancellations).toBe(1); expect(c.revenue).toBe(18000);
  });
  it("daily_totals: суммы по дням совпадают с history", () => {
    const dt = buildDailyTotals(facts, "2026-08-01", "2026-08-31");
    expect(dt.length).toBe(31);
    expect(dt.reduce((s, t) => s + t.revenue, 0)).toBe(facts.reduce((s, f) => s + f.revenue, 0));
    expect(dt.find((t) => t.date === "2026-08-10")!.units).toBe(3);
  });
  it("skus_live: контракт OZON (totals/by_line/sku_table), platform=ym, остаток и цена из каталога", () => {
    const cat = { items: { "GGM-16-2-2": { name: "x", marketSku: "100200300", price: 17500, stock: 0 }, "GGT-03-3-3-O-20090": { name: "y", marketSku: "100200301", price: 41000, stock: 5 } } };
    const live = buildSkusLive(rows, facts, cat, "2026-08-01", "2026-08-31");
    expect(live.platform).toBe("ym");
    expect(live.totals.rev).toBe(20000 + 80000 + 120000 + 18000 + 18000);
    expect(live.totals.units).toBe(1 + 2 + 3 + 1 + 1);
    const m = live.sku_table.find((s: any) => s.sku === "GGM-16-2-2");
    expect(m.offer).toBe("GGM-16-2-2"); expect(m.price).toBe(17500); expect(m.oos).toBe(1); expect(m.stock).toBe(0);
    expect(live.by_line.map((l: any) => l.line).sort()).toEqual(["NOLVIS", "TRUBIS"]);
    expect(live.totals.ad_spend).toBe(0);
  });
  it("pnl: только доставленные по дате доставки; payout = accruals − сборы; predicted учтён", () => {
    const p = buildPnl(rows, "2026-08-01", "2026-08-31");
    expect(p.accruals).toBe(100000 + 40000);
    expect(p.payout).toBe(81000 + 33500);
    expect(p.ops).toBe(2);
    expect(p.breakdown["Комиссия за продажу"]).toBe(-(15000 + 6000));
    expect(p.breakdown["Логистика (прямая+возвратная)"]).toBe(-(3000 + 500));
    expect(p.predicted_rows).toBe(1);
    const half = buildPnl(rows, "2026-08-01", "2026-08-15");
    expect(half.accruals).toBe(100000); // заказ 500002 закрыт 16.08 - вне первой половины
  });
  it("pnl_sku и pnl_sku_daily сходятся с pnl канала", () => {
    const p = buildPnl(rows, "2026-08-01", "2026-08-31");
    const ps = buildPnlSku(rows, "2026-08-01", "2026-08-31");
    const sumAmt = Object.values(ps.bySku).reduce((s, a) => s + a.amount, 0);
    expect(Math.abs(sumAmt - p.payout)).toBeLessThanOrEqual(2);
    expect(ps.multiItemOps).toBe(1); expect(ps.singleItemOps).toBe(1);
    const daily = buildPnlDaily(rows);
    expect(daily.reduce((s, d) => s + d.payout, 0)).toBe(p.payout);
    const sd = buildPnlSkuDaily(rows);
    expect(Math.abs(sd.reduce((s, d) => s + d.amount, 0) - p.payout)).toBeLessThanOrEqual(2);
    expect(sd.every((d) => d.commission <= 0 && d.delivery <= 0)).toBe(true);
  });
});

describe("сборы уровня кабинета из netting", () => {
  it("строки без заказа раскладываются по группам и датам, строки с заказом пропускаются", () => {
    const acct = buildAccountDaily("2026-08-01", "2026-08-03", [
      { d: "2026-08-02", order: "", service: "Буст продаж", amount: -300 },
      { d: "2026-08-02", order: "", service: "Штраф за отмену", amount: -100 },
      { d: "2026-08-02", order: "500001", service: "Комиссия", amount: -50 },
      { d: "2026-08-03", order: "", service: "Плата за размещение", amount: -20 },
    ]);
    expect(acct.length).toBe(3);
    expect(acct[1]).toMatchObject({ d: "2026-08-02", adv: -300, fines: -100, other: 0 });
    expect(acct[2]!.badge).toBe(-20);
    expect(accountGroup("Доставка до покупателя")).toBe("delivery");
  });
});

describe("классификация недоступных кампаний", () => {
  it("API_DISABLED, 403 и 404 - пропуск; прочие ошибки - настоящие", async () => {
    const { campaignUnavailable } = await import("./common.js");
    expect(campaignUnavailable(new Error('HTTP 403: {"errors":[{"code":"API_DISABLED"}]}'))).toContain("неактивности");
    expect(campaignUnavailable(new Error("Market POST /x -> HTTP 403: forbidden"))).toContain("403");
    expect(campaignUnavailable(new Error("Market POST /x -> HTTP 404"))).toContain("404");
    expect(campaignUnavailable(new Error("Market POST /x -> HTTP 500: server error"))).toBeNull();
    expect(campaignUnavailable(new Error("fetch failed"))).toBeNull();
  });
});

describe("decodeReport", () => {
  it("utf-8 с BOM как есть", () => {
    const { text } = decodeReport(Buffer.from("﻿Дата;Сумма\n01.08.2026;10", "utf-8"));
    expect(text.replace("﻿", "")).toContain("Дата;Сумма");
  });
});

describe("доставка отдельной позицией с тем же SKU (живой факт 2026-09-04)", () => {
  // Маркет кладёт доставку отдельной позицией заказа, причём под тем же shopSku, что и товар.
  // Ключ строки без номера позиции схлопывал их: выживала доставка, товар пропадал. На живом
  // снимке так потерялась 921 строка из 1536 - больше половины данных.
  const order = {
    id: 55204502850, creationDate: "18-03-2026", statusUpdateDate: "30-03-2026", status: "DELIVERED",
    partnerOrderId: "GG-1", items: [
      { offerName: "GEN GROUP Стол обеденный овальный 160х80 см", shopSku: "GGT-03-1-5-E-16080", marketSku: "1", count: 1,
        prices: [{ type: "MARKETPLACE", costPerItem: 13267 }, { type: "BUYER", costPerItem: 30530 }], details: [] },
      { offerName: "Доставка КГТ без подъема на этаж", shopSku: "GGT-03-1-5-E-16080", marketSku: "1", count: 1,
        prices: [{ type: "BUYER", costPerItem: 3500 }], details: [] },
    ],
    commissions: [{ type: "FEE", actual: 6089 }], subsidies: [], payments: [],
  };
  const rs = normalizeOrder(parseOrder(order as any), "c1", "b1");

  it("обе позиции сохраняются и различимы по номеру позиции", () => {
    expect(rs.length).toBe(2);
    expect(rs.map((r) => r.pos)).toEqual([0, 1]);
    expect(rs[0]!.sku).toBe(rs[1]!.sku); // тот же SKU - ключ обязан их различать
  });
  it("товар не потерян: его цена 43 797, а не 3500 от доставки", () => {
    expect(rs[0]!.price).toBe(43797);
    expect(rs[0]!.service).toBe(false);
    expect(rs[1]!.price).toBe(3500);
    expect(rs[1]!.service).toBe(true);
  });
  it("деньги доставки остаются в заказе, а её штуки - нет", () => {
    expect(rs[0]!.delivered).toBe(1);
    expect(rs[1]!.delivered).toBe(0); // доставка - не проданная единица
    expect(rs[1]!.units).toBe(0);
    expect(rs[1]!.revenue).toBe(3500); // но выручка заказа её включает
    expect(rs.reduce((s, r) => s + r.delivered, 0)).toBe(1); // сверка штук не удваивается
    expect(rs.reduce((s, r) => s + r.accruals, 0)).toBe(43797 + 3500);
  });
  it("подъём, сборка и установка тоже считаются услугами, товар - нет", () => {
    expect(isServiceItem("Доставка и подъем КГТ на этаж с лифтом")).toBe(true);
    expect(isServiceItem("Подъём на этаж")).toBe(true);
    expect(isServiceItem("Сборка мебели")).toBe(true);
    expect(isServiceItem("GEN GROUP Стол обеденный")).toBe(false);
    expect(isServiceItem("Зеркало настенное")).toBe(false);
  });
});

describe("сборы из ledger'а кабинета (§15: источник денег - кабинет)", () => {
  // Живой факт 2026-09-04: commissions заказа несут только комиссию по заказу. Мы книжили
  // 3 242 362 ₽ удержаний, кабинет удержал 18 231 203 ₽ - видели 18%. Недостающее (размещение
  // товарных предложений 14.9 млн, буст, логистика, эквайринг) живёт отдельными проводками ledger'а.
  const mk = (over: any = {}) => ({
    platform: "ym", business: "b", campaign: "c", order: "1", shop_order: "GG-1", pos: 0, service: false,
    created: "2026-08-01", statusDate: "2026-08-10", status: "DELIVERED", fin: "2026-08-10",
    sku: "A", market_sku: "1", name: "Стол", line: "", units: 1, count: 1, delivered: 1, returned: 0, cancelled: 0,
    price: 10000, p_buyer: 10000, p_mp: 0, p_cashback: 0, p_spasibo: 0, revenue: 10000, accruals: 10000,
    fees: { "Комиссия за продажу": 500 }, fee_total: 500, payout: 9500, fee_actual: true,
    paid: 10000, paid_by_type: {}, subsidy: 0, fake: false, ...over,
  }) as any;

  it("удержания кабинета заменяют комиссии заказа, payout пересчитывается", () => {
    const net = [
      { order: "1", sku: "A", type: "Удержание", service: "Размещение товарных предложений", amount: -2000 },
      { order: "1", sku: "A", type: "Списание", service: "Буст продаж, оплата за продажи", amount: -300 },
      { order: "1", sku: "A", type: "Удержание", service: "Доставка (средняя миля)", amount: -700 },
      { order: "1", sku: "A", type: "Начисление", service: "Стол", amount: 10000 }, // начисления не трогаем
    ];
    const r = applyNettingFees([mk()], net).rows[0]!;
    expect(r.fee_source).toBe("netting");
    expect(r.fees).toEqual({ "Комиссия за продажу": 2000, "Продвижение (буст/лояльность)": 300, "Логистика (прямая+возвратная)": 700 });
    expect(r.fee_total).toBe(3000);
    expect(r.payout).toBe(7000); // 10000 начислено − 3000 удержано, а не 9500 по комиссии заказа
  });
  it("«Возврат списания» УМЕНЬШАЕТ сбор, а не увеличивает (баг знака)", () => {
    // Живой факт 2026-09: 21 строка «Возврат списания» на +227 561 ₽ проходила через Math.abs и
    // учитывалась как удержание. Кумулятивное расхождение показывало −408 149 ₽, и я объяснил его
    // «заказами вне ledger'а» - объяснение невозможное: несопоставленные заказы в разность не входят
    // по построению. После починки знака остаток стал −4 820 ₽, то есть ровно дельта начислений.
    const net = [
      { order: "1", sku: "A", type: "Списание", service: "Размещение товарных предложений", amount: -3000 },
      { order: "1", sku: "A", type: "Возврат списания", service: "Возврат за размещение товаров на витрине", amount: 1200 },
      { order: "1", sku: "A", type: "Возврат списания", service: "Скидка за лояльность", amount: 800 },
    ];
    const r = applyNettingFees([mk()], net).rows[0]!;
    expect(r.fees["Комиссия за продажу"]).toBe(3000 - 1200); // возврат за размещение гасит списание
    expect(r.fees["Продвижение (буст/лояльность)"]).toBe(-800); // возврат без парного списания - кредит
    expect(r.fee_total).toBe(1000);
    expect(r.payout).toBe(9000); // 10000 начислено − 1000 чистых сборов
  });
  it("заказ, которого ещё нет в ledger'е, сохраняет комиссии заказа и помечается", () => {
    const r = applyNettingFees([mk({ order: "2" })], [{ order: "1", sku: "A", type: "Удержание", service: "Размещение", amount: -50 }]).rows[0]!;
    expect(r.fee_source).toBe("order");
    expect(r.fee_total).toBe(500);
    expect(r.payout).toBe(9500);
  });
  it("разрез «откуда сборы» считается деньгами и по месяцам, а не числом заказов", () => {
    // ФЕНИКС P0: 1081 старый заказ на копейки и 475 свежих на миллионы по счётчику заказов читаются
    // одинаково. Мера завышения маржи - разрыв СТАВОК на непокрытой части оборота, а не доля заказов.
    const rows = [
      mk({ order: "1", created: "2026-08-02", accruals: 10000 }),                      // будет netting
      mk({ order: "2", created: "2026-05-02", accruals: 90000, fee_total: 4500 }),     // останется order
    ];
    const net = [{ order: "1", sku: "A", type: "Удержание", service: "Размещение товарных предложений", amount: -5000 }];
    const r = applyNettingFees(rows, net);
    expect(r.orders_from_netting).toBe(1);
    expect(r.orders_from_commissions).toBe(1);       // по заказам ровно пополам
    expect(r.accruals_from_netting).toBe(10000);
    expect(r.accruals_from_commissions).toBe(90000); // по деньгам - 90% без ledger'а
    expect(r.rate_netting).toBe(50);                 // 5000 / 10000
    expect(r.rate_order).toBe(5);                    // 4500 / 90000 - вот она, заниженная ставка
    expect(r.by_month["2026-08"]!.rate_netting).toBe(50);
    expect(r.by_month["2026-05"]!.accruals_netting).toBe(0);
    expect(r.by_month["2026-05"]!.rate_order).toBe(5);
  });
  it("заказ из двух позиций не считается двумя заказами в разрезе источника", () => {
    const rows = [mk({ pos: 0, sku: "A", accruals: 5000 }), mk({ pos: 1, sku: "B", accruals: 5000 })];
    const r = applyNettingFees(rows, []);
    expect(r.orders_from_commissions).toBe(1);
    expect(r.by_month["2026-08"]!.orders_order).toBe(1);
    expect(r.by_month["2026-08"]!.accruals_order).toBe(10000);
  });
  it("удержания без SKU делятся по начислениям внутри заказа", () => {
    const rows = [mk({ pos: 0, sku: "A", accruals: 7500 }), mk({ pos: 1, sku: "B", accruals: 2500 })];
    const net = [{ order: "1", sku: "", type: "Удержание", service: "Перевод платежа", amount: -400 }];
    const out = applyNettingFees(rows, net).rows;
    expect(out[0]!.fees["Эквайринг"]).toBe(300); // 75%
    expect(out[1]!.fees["Эквайринг"]).toBe(100); // 25%
  });
  it("группы услуг кабинета совпадают с подписями OZON, неизвестное идёт в Прочее", () => {
    expect(nettingFeeGroup("Размещение товарных предложений")).toBe("Комиссия за продажу");
    expect(nettingFeeGroup("Буст продаж, оплата за продажи")).toBe("Продвижение (буст/лояльность)");
    expect(nettingFeeGroup("Доставка невыкупов и возвратов")).toBe("Логистика (прямая+возвратная)");
    expect(nettingFeeGroup("Приём платежа")).toBe("Эквайринг");
    expect(nettingFeeGroup("Отмена заказа по вине продавца")).toBe("Штрафы");
    expect(nettingFeeGroup("Новая услуга Маркета")).toBe("Прочее");
  });
});

describe("софинансирование скидок: сверено с выгрузкой кабинета за июль 2026", () => {
  // Живая сверка одного магазина зеркал (кампания 149154933) с четырьмя выгрузками кабинета.
  // Классификация проводки лежит в TRANSACTION_SOURCE, а не в имени услуги: у строк
  // «Скидка за участие в совместных акциях» в имени услуги стоит НАЗВАНИЕ ТОВАРА.
  it("источник решает раньше имени услуги", () => {
    expect(nettingFeeGroup("GENGLASS Зеркало напольное EVELIX", "Скидка за участие в совместных акциях")).toBe("Софинансирование скидок");
    expect(nettingFeeGroup("Размещение товарных предложений", "Оплата услуг Маркета")).toBe("Комиссия за продажу");
    expect(nettingFeeGroup("Доставка (средняя миля)", "")).toBe("Логистика (прямая+возвратная)"); // старые снимки без источника
  });
  it("сторно услуги внутри «Оплаты услуг» зачитывается, начисление за товар - нет", () => {
    // Прежнее правило «Начисление - не сбор» отбрасывало два сторно на 11 536 ₽, и сборы за июль
    // выходили 329 413 ₽ вместо 317 877 ₽ у кабинета.
    expect(isNettingFee("Начисление", "Оплата услуг Маркета")).toBe(true);
    expect(isNettingFee("Удержание", "Оплата услуг Маркета")).toBe(true);
    expect(isNettingFee("Начисление", "Баллы за скидку Маркета")).toBe(false);
    expect(isNettingFee("Начисление", "Платёж покупателя")).toBe(false);
    expect(isNettingFee("Списание", "Скидка за участие в совместных акциях")).toBe(true);
  });
  it("без источника поведение прежнее - снимки, собранные до появления колонки, не ломаются", () => {
    expect(isNettingFee("Удержание", "")).toBe(true);
    expect(isNettingFee("Начисление", "")).toBe(false);
    expect(isNettingFee("Возврат", undefined)).toBe(false);
  });
});

// Баллы Маркета. По спецификации Partner API (OrdersStatsSubsidyDTO) amount - величина БЕЗ знака,
// а направление несёт operationType: ACCRUAL - начисление, DEDUCTION - списание при невыкупе и
// возврате. Разбор складывал их подряд, то есть списание ПРИБАВЛЯЛОСЬ к начислению: по июлю 2026
// это давало завышение баллов на 2.7%. Отдельного отчёта по баллам в API нет (все 22 метода
// генерации отчётов выписаны из OpenAPI-спецификации), поэтому subsidies[] - единственный источник,
// и разбирать его надо правильно.
describe("баллы Маркета из subsidies[]: списание вычитается, а не прибавляется", () => {
  const mk = (subsidies: any[]) => normalizeOrder(parseOrder({
    id: 1, status: "DELIVERED", substatus: "", creationDate: "01-07-2026", statusUpdateDate: "05-07-2026",
    partnerOrderId: "GG-P", items: [
      { offerName: "Стол", shopSku: "S1", marketSku: "1", count: 1,
        prices: [{ type: "BUYER", costPerItem: 10000 }], details: [] },
    ],
    commissions: [], subsidies, payments: [{ type: "PAYMENT", total: 10000 }],
  } as any), "c1", "b1")[0]!;

  it("начисление минус списание, а не сумма", () => {
    const r = mk([
      { operationType: "ACCRUAL", type: "SUBSIDY", amount: 1000 },
      { operationType: "DEDUCTION", type: "SUBSIDY", amount: 300 },
    ]);
    expect(r.subsidy, "сальдо").toBe(700);       // раньше было бы 1300
    expect(r.sub_acc).toBe(1000);
    expect(r.sub_ded).toBe(300);
  });

  it("знак у amount игнорируется - направление задаёт operationType", () => {
    // Маркет может прислать списание отрицательным. Тогда прежний код вычитал его дважды.
    const r = mk([
      { operationType: "ACCRUAL", type: "YANDEX_CASHBACK", amount: 500 },
      { operationType: "DEDUCTION", type: "YANDEX_CASHBACK", amount: -200 },
    ]);
    expect(r.subsidy).toBe(300);
    expect(r.sub_ded).toBe(200);
  });

  it("разбивка хранит источник баллов, а не только итог", () => {
    const r = mk([
      { operationType: "ACCRUAL", type: "YANDEX_CASHBACK", amount: 400 },
      { operationType: "ACCRUAL", type: "SUBSIDY", amount: 600 },
      { operationType: "DEDUCTION", type: "DELIVERY", amount: 100 },
    ]);
    expect(r.sub_by_type).toEqual({
      "ACCRUAL|YANDEX_CASHBACK": 400,
      "ACCRUAL|SUBSIDY": 600,
      "DEDUCTION|DELIVERY": 100,
    });
    expect(r.subsidy).toBe(900);
  });

  it("неизвестный operationType считается начислением, а не теряется", () => {
    const r = mk([{ operationType: "", type: "SUBSIDY", amount: 250 }]);
    expect(r.sub_acc).toBe(250);
    expect(r.subsidy).toBe(250);
  });

  it("баллов нет - нули, а не undefined", () => {
    const r = mk([]);
    expect(r.subsidy).toBe(0);
    expect(r.sub_acc).toBe(0);
    expect(r.sub_ded).toBe(0);
  });
});

// Что такое «баллы за скидку». Маркет опускает цену на кассе за свой счёт (в ценах позиции это
// тип MARKETPLACE, у нас p_mp; скидка по подписке Плюс - CASHBACK/SPASIBO), покупатель платит
// меньше, и ровно эту сумму Маркет возвращает продавцу баллами через subsidies[]. То есть
// начисленные баллы - не бонус сверху, а возврат скидки. На живой выгрузке заказов тождество
// сходится по всем восьми месяцам БЕЗ расхождения, и это лучшая имеющаяся проверка разбора
// баллов: отдельного отчёта по баллам у Маркета нет, сверять больше не с чем.
describe("баллы за скидку = сама скидка, возвращённая продавцу", () => {
  const snap = "data-ym/orders.ndjson";
  it("по каждому месяцу: начислено баллов = скидка Маркета + Плюс + Спасибо (доставленные заказы)", () => {
    if (!existsSync(snap)) throw new Error(`нет ${snap} - тест обязан падать, а не молча проходить`);
    const rows: any[] = readFileSync(snap, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    const delivered = rows.filter((r) => r.status === "DELIVERED");
    expect(delivered.length, "в снимке нет доставленных заказов").toBeGreaterThan(100);
    expect(delivered.filter((r) => r.sub_acc !== undefined).length, "снимок собран до разбора subsidies[]").toBe(delivered.length);
    const by: Record<string, { disc: number; acc: number }> = {};
    for (const r of delivered) {
      const m = String(r.created).slice(0, 7);
      const b = by[m] || (by[m] = { disc: 0, acc: 0 });
      const n = r.count || 0;
      b.disc += ((r.p_mp || 0) + (r.p_cashback || 0) + (r.p_spasibo || 0)) * n;
      b.acc += r.sub_acc || 0;
    }
    const months = Object.keys(by).sort();
    expect(months.length).toBeGreaterThan(5);
    const bad = months.filter((m) => Math.abs(by[m]!.acc - by[m]!.disc) > 1)
      .map((m) => `${m}: скидка ${Math.round(by[m]!.disc)} против баллов ${Math.round(by[m]!.acc)}`);
    expect(bad, "баллы разошлись со скидкой - значит разбор subsidies[] сломан").toEqual([]);
  });
});

// Внешний эталон для доли Маркета в доставке (§15 п.1). ФЕНИКС 2026-09-21 справедливо указал,
// что ship_mp добавлен в доход без сверки с источником ВНЕ артефакта: «баллы за неё начислены» -
// внутренняя согласованность заказа, а не эталон.
//
// Эталон нашёлся: Маркет отдаёт эту субсидию отдельной строкой отчёта о баллах с источником
// «Баллы за скидку Маркета на доставку». Реестр взаиморасчётов здесь беднее (за май 2026 строки
// нет вовсе), поэтому эталоном служит отчёт о баллах, а не реестр.
describe("доля Маркета в доставке сверена с отчётом о баллах", () => {
  const svodP = "data-ym/svod_orders.json";
  const bonP = "data-ym/bonuses_monthly.ndjson";

  it("по каждой паре кабинет+месяц ship_mp равен субсидии Маркета на доставку", () => {
    if (!existsSync(svodP) || !existsSync(bonP)) return;      // снимка нет - сверять нечего
    const svod = JSON.parse(readFileSync(svodP, "utf-8"));
    const mine: Record<string, number> = {};
    for (const m of svod.months) for (const r of m.rows) {
      if (!r.ship_mp) continue;
      const k = `${m.business}|${m.ym}`;
      mine[k] = Math.round(((mine[k] || 0) + r.ship_mp) * 100) / 100;
    }
    // Знак берётся из источника: «Возврат ...» уменьшает субсидию, как и везде в отчёте.
    const theirs: Record<string, number> = {};
    for (const line of readFileSync(bonP, "utf-8").split("\n")) {
      const t = line.trim(); if (!t) continue;
      const r = JSON.parse(t);
      const src = String(r.src || "");
      if (!/доставку/i.test(src)) continue;
      const k = `${r.business}|${String(r.d || r.ym).slice(0, 7)}`;
      const sign = /^Возврат/i.test(src) ? -1 : 1;
      theirs[k] = Math.round(((theirs[k] || 0) + sign * Math.abs(Number(r.amount) || 0)) * 100) / 100;
    }
    const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].sort();
    expect(keys.length, "субсидии на доставку в снимке не нашлось - сверять нечего").toBeGreaterThan(0);
    const bad = keys.filter((k) => Math.abs((mine[k] || 0) - (theirs[k] || 0)) > 1)
      .map((k) => `${k}: свод ${mine[k] || 0}, отчёт о баллах ${theirs[k] || 0}`);
    expect(bad, "доля Маркета в доставке разошлась с отчётом Маркета").toEqual([]);
  });
});

// Катя 28.09.2026 сверила блок «за выбранный период» с отчётом о платежах Маркета: GGL-09-2 за июль
// «Получено от потребителей» 15 шт на 205 035 ₽, «Возвращено» 3 шт на 40 459 ₽, а в блоке стояло 8 шт -
// блок брал заказы по дате их финансового закрытия. Теперь он строится из проводок по дате транзакции.
describe("блок по начислениям из проводок реестра", () => {
  const ord = (order: string, sku: string, count: number, p_buyer: number) =>
    ({ order, sku, count, p_buyer, service: false, business: "1", status: "DELIVERED", fin: "2026-07-25", delivered: count, returned: 0, fees: {}, accruals: 0, payout: 0, fee_total: 0 } as any);
  const pay = (d: string, order: string, amount: number, extra: any = {}) =>
    ({ d, business: "1", order, sku: "A", type: "Начисление", src: "Платёж покупателя", service: "Товар A", amount, ...extra });

  it("штуки и платёж - по дате транзакции, возврат вычитается в месяце возврата", () => {
    const orders = [ord("o1", "A", 1, 100), ord("o2", "A", 3, 50)];
    const net = [
      pay("2026-07-03", "o1", 100),
      pay("2026-07-04", "o2", 150),
      { d: "2026-07-04", business: "1", order: "o2", sku: "", type: "Начисление", src: "Платёж покупателя", service: "Доставка", amount: 500 },
      { d: "2026-07-04", business: "1", order: "o2", sku: "A", type: "Начисление", src: "Баллы за скидку Маркета", service: "Товар A", amount: 90 },
      { d: "2026-07-09", business: "1", order: "o2", sku: "A", type: "Удержание", src: "Оплата услуг Маркета", service: "Размещение товарных предложений", amount: -20 },
      { d: "2026-07-09", business: "1", order: "o2", sku: "A", type: "Списание", src: "Скидка за участие в совместных акциях", service: "Товар A", amount: -70 },
      { d: "2026-07-20", business: "1", order: "o1", sku: "A", type: "Возврат", src: "Возврат платежа покупателя", service: "Товар A", amount: -100 },
      { d: "2026-07-20", business: "1", order: "", sku: "", type: "Удержание", src: "Оплата услуг Маркета", service: "", amount: -5 },
    ];
    const { rows, fallback } = buildAccNetting(net, orders);
    expect(fallback).toEqual([]);
    const jul = rows.filter((r) => r.d.startsWith("2026-07"));
    const s = (f: keyof typeof jul[0]) => jul.reduce((a, r) => a + (r[f] as number), 0);
    expect(s("sold"), "штуки берутся из заказа, когда COUNT в реестре нет").toBe(4);
    expect(s("ret")).toBe(1);
    expect(s("units")).toBe(3);
    expect(s("pay"), "получено − возвращено по товару").toBe(150);
    expect(s("dlv"), "доставка покупателя - отдельно, на артикул заказа").toBe(500);
    expect(jul.every((r) => r.sku === "A"), "проводка без артикула легла на артикул заказа").toBe(true);
    expect(s("commission")).toBe(-20);
    expect(s("cofin"), "списание баллами лежит справкой").toBe(-70);
    expect(s("points"), "баллы лежат справкой").toBe(90);
    // Только деньги, как в отчёте о платежах: баллы и списание баллами в начисления и к выплате не
    // входят. Проводка уровня кабинета (без заказа) сюда тоже не входит.
    expect(s("accruals")).toBe(150 + 500);
    expect(s("amount")).toBe(s("accruals") - 20);
  });

  it("COUNT из реестра главнее заказа", () => {
    const { rows } = buildAccNetting([pay("2026-07-03", "o9", 300, { count: 2 })], []);
    expect(rows[0]).toMatchObject({ sold: 2, units: 2, pay: 300, basis: "netting" });
  });

  // Ответ «1а» 02.10 (сверка с выгрузкой кабинета): заказ оплатили в августе и отменили в сентябре.
  // Маркет помечает платёж «Не будет переведён из-за отмены заказа», возврат - «Не будет удержан».
  // Денег не было: ни август, ни сентябрь не должны их видеть, а справка - видеть.
  it("оплаченный и отменённый заказ - не продажа и не возврат, ни в каком месяце; справкой - да", () => {
    const st = (status: string) => ({ status });
    const net = [
      pay("2026-08-14", "c1", 60_578, { count: 1, ...st("Не будет переведён из-за отмены заказа") }),
      { d: "2026-08-14", business: "1", order: "c1", sku: "", type: "Начисление", src: "Платёж покупателя", service: "Доставка", amount: 4_500, status: "Не будет переведён из-за отмены заказа" },
      { d: "2026-08-14", business: "1", order: "c1", sku: "A", type: "Начисление", src: "Баллы за скидку Маркета", service: "Товар A", amount: 9_000, status: "Справочно: не будет пополнен баланс" },
      { d: "2026-09-01", business: "1", order: "c1", sku: "A", type: "Возврат", src: "Возврат платежа покупателя", service: "Товар A", amount: -60_578, count: 1, status: "Не будет удержан из-за отмены заказа" },
      { d: "2026-09-01", business: "1", order: "c1", sku: "", type: "Возврат", src: "Возврат платежа покупателя", service: "Доставка", amount: -4_500, status: "Не будет удержан из-за отмены заказа" },
      // Обычная продажа рядом - считается как раньше.
      pay("2026-08-15", "o7", 1_000, { count: 1, ...st("Переведён по графику выплат") }),
    ];
    const { rows } = buildAccNetting(net as any, []);
    const sum = (m: string, f: string) => rows.filter((r) => r.d.startsWith(m)).reduce((a, r: any) => a + (r[f] || 0), 0);
    expect(sum("2026-08", "accruals"), "август: только живая продажа").toBe(1_000);
    expect(sum("2026-08", "units")).toBe(1);
    expect(sum("2026-08", "points"), "баллы «не будет пополнен» - не баллы").toBe(0);
    expect(sum("2026-09", "accruals"), "сентябрь: отмена августовского заказа не вычитается").toBe(0);
    expect(sum("2026-09", "ret")).toBe(0);
    expect(sum("2026-08", "cgot"), "справка: оплачено и отменено, с доставкой").toBe(65_078);
    expect(sum("2026-08", "csold")).toBe(1);
    expect(sum("2026-09", "cback")).toBe(-65_078);
    expect(sum("2026-09", "cret")).toBe(1);
  });

  it("статус платежа: «не будет» - отменено; пусто и прочие - нет; пары без статуса помечаются", () => {
    expect(nettingCancelled({ status: "Не будет переведён из-за отмены заказа" })).toBe(true);
    expect(nettingCancelled({ status: "Справочно: не будет пополнен баланс" })).toBe(true);
    expect(nettingCancelled({ status: "Будет переведён по графику выплат" })).toBe(false);
    expect(nettingCancelled({ status: "" })).toBe(false);
    expect(nettingCancelled({})).toBe(false);
    expect(nettingNoStatus([
      { d: "2026-07-03", business: "1", src: "Платёж покупателя" },
      { d: "2026-08-03", business: "1", src: "Платёж покупателя", status: "Переведён по графику выплат" },
      { d: "2026-05-03", business: "1" }, // схема без источника - помечается другим флагом (fallback)
    ])).toEqual(["1/2026-07"]);
  });

  it("месяц, собранный без колонки источника, берётся из заказов и помечен", () => {
    const orders = [{ ...ord("o5", "B", 1, 80), fin: "2026-05-10", price: 120, accruals: 120, fees: {}, payout: 120, fee_total: 0 }];
    const net = [{ d: "2026-05-10", business: "1", order: "o5", sku: "B", type: "Начисление", service: "Товар B", amount: 80 }];
    const { rows, fallback } = buildAccNetting(net as any, orders);
    expect(fallback).toEqual(["1/2026-05"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ basis: "orders", sku: "B", units: 1 });
  });
});

describe("блок по начислениям: себестоимость и договор", () => {
  it("С\\С ищется как в своде: кириллическая «М» в коде находит латинский ключ листа", () => {
    const net = [{ d: "2026-07-03", business: "1", order: "o1", sku: "GGМ-02-4-2", type: "Начисление", src: "Платёж покупателя", service: "Товар", amount: 100, count: 2, contract: "54641824/26" }];
    const { rows } = buildAccNetting(net, [], cogsLookup({ "GGM-02-4-2": 50 }));
    expect(rows[0]).toMatchObject({ cogs_known: true, cogs: 100, contract: "54641824/26" });
  });
  it("два договора одного кабинета - разные строки", () => {
    const net = [
      { d: "2026-07-03", business: "1", order: "o1", sku: "A", type: "Начисление", src: "Платёж покупателя", service: "Товар", amount: 100, count: 1, contract: "X" },
      { d: "2026-07-03", business: "1", order: "o2", sku: "A", type: "Начисление", src: "Платёж покупателя", service: "Товар", amount: 50, count: 1, contract: "Y" },
    ];
    const { rows } = buildAccNetting(net, []);
    expect(rows.map((r) => [r.contract, r.pay]).sort()).toEqual([["X", 100], ["Y", 50]]);
  });
});

// Решение 02.10 «два столбца» (спека ym-monthly-report v4, ответ «по 5 вопросам да»). Эталон - реальные
// заказы из прототипа knowledge/episodes/2026-10/proto-ym-dva-stolbca-20261002.html, суммы из реестра.
describe("второй столбец блока ACC: заказы со сбором Маркета за продажу", () => {
  const P = (d: string, order: string, sku: string, amount: number, extra: any = {}) =>
    ({ d, business: "1", order, sku, type: "Начисление", src: "Платёж покупателя", service: sku ? `Товар ${sku}` : "Доставка", amount, count: sku ? 1 : undefined, ...extra });
  const F = (d: string, order: string, service: string, amount: number, src = "Оплата услуг Маркета") =>
    ({ d, business: "1", order, sku: "", type: "Удержание", src, service, amount });
  const B = (d: string, order: string, sku: string, amount: number) =>
    ({ d, business: "1", order, sku, type: "Возврат", src: "Возврат платежа покупателя", service: sku ? `Товар ${sku}` : "Доставка", amount, count: sku ? 1 : undefined });
  const sum = (rows: any[], m: string, f: string) => rows.filter((r) => r.d.startsWith(m)).reduce((a, r) => a + (r[f] || 0), 0);

  // 59831744643: оплачен 02.08 (25 741 + доставка 2 500), «Приём платежа» 02.08, сборы за продажу 08.09.
  const o1 = [P("2026-08-02", "59831744643", "GGM-20-2", 25_741), P("2026-08-02", "59831744643", "", 2_500),
    F("2026-08-02", "59831744643", "Приём платежа", -0.12), F("2026-09-08", "59831744643", "Размещение товарных предложений", -309.45),
    F("2026-09-08", "59831744643", "Перевод платежа", -1_666.25), F("2026-09-08", "59831744643", "Размещение товарных предложений", -30_635.23, "Скидка за участие в совместных акциях")];

  it("день продажи - первый сбор за размещение или перевод платежа; «Приём платежа» не признак", () => {
    expect(accSaleDay(o1 as any).get("59831744643")).toBe("2026-09-08");
  });

  it("оплачен в августе, доставлен в сентябре: столбец 1 - август, столбец 2 - сентябрь целиком", () => {
    const { rows } = buildAccNetting(o1 as any, [], () => 10_000, new Map([["59831744643", 4_414.07]]));
    expect(sum(rows, "2026-08", "accruals")).toBe(28_241);
    expect(sum(rows, "2026-08", "raccruals"), "август второго столбца пуст").toBe(0);
    expect(sum(rows, "2026-09", "raccruals")).toBe(28_241);
    expect(sum(rows, "2026-09", "runits")).toBe(1);
    expect(sum(rows, "2026-09", "rcogs"), "С\\С по штукам второго столбца").toBe(10_000);
    expect(sum(rows, "2026-09", "ship"), "наша перевозка - в день продажи").toBeCloseTo(4_414.07, 2);
    // Сборы одни: К выплате2 = К выплате1 − Начислено1 + Начислено2 по месяцам.
    expect(sum(rows, "2026-09", "ramount")).toBeCloseTo(28_241 - 309.45 - 1_666.25, 2);
    expect(sum(rows, "2026-08", "ramount")).toBeCloseTo(-0.12, 2);
    // Платёж заказа без сбора за продажу (август) - не услуга: прочие услуги и сборы первого столбца не трогаются.
    for (const m of ["2026-08", "2026-09"]) expect(sum(rows, m, "otherSvc"), m).toBe(0);
    expect(sum(rows, "2026-08", "amount")).toBeCloseTo(28_241 - 0.12, 2);
  });

  it("сбор за продажу, оплаченный только баллами, - тоже признак продажи", () => {
    const net = [P("2026-07-03", "o2", "A", 1_000), F("2026-08-01", "o2", "Размещение товарных предложений", -500, "Скидка за участие в совместных акциях")];
    expect(accSaleDay(net as any).get("o2")).toBe("2026-08-01");
  });

  // 60558005824: продан 30.08 (8 606), возвращён 05.09.
  it("возврат проданного заказа - в своём месяце", () => {
    const net = [P("2026-08-19", "60558005824", "GGR-10-1", 8_606), F("2026-08-30", "60558005824", "Перевод платежа", -641.03),
      B("2026-09-05", "60558005824", "GGR-10-1", -8_606)];
    const { rows } = buildAccNetting(net as any, []);
    expect(sum(rows, "2026-08", "raccruals")).toBe(8_606);
    expect(sum(rows, "2026-09", "raccruals")).toBe(-8_606);
    expect(sum(rows, "2026-09", "rret")).toBe(1);
  });

  it("возврат раньше сбора за продажу ложится на день продажи (не раньше продажи)", () => {
    const net = [P("2026-08-20", "o3", "A", 5_000), B("2026-08-28", "o3", "A", -1_000), F("2026-09-02", "o3", "Перевод платежа", -100)];
    const { rows } = buildAccNetting(net as any, []);
    expect(sum(rows, "2026-08", "raccruals")).toBe(0);
    expect(sum(rows, "2026-09", "raccruals")).toBe(4_000);
    expect(sum(rows, "2026-08", "accruals"), "первый столбец не меняется").toBe(4_000);
  });

  it("оплатили и отменили до доставки (сборов за продажу нет) - во втором столбце ни оплаты, ни возврата, ни перевозки", () => {
    const net = [P("2026-08-10", "o4", "A", 7_000), F("2026-08-10", "o4", "Приём платежа", -0.12), F("2026-08-12", "o4", "Отмена заказа по вине продавца", -500),
      B("2026-09-03", "o4", "A", -7_000)];
    const { rows } = buildAccNetting(net as any, [], () => 3_000, new Map([["o4", 2_000]]));
    for (const m of ["2026-08", "2026-09"]) for (const f of ["raccruals", "runits", "rcogs", "ship"]) expect(sum(rows, m, f), `${m} ${f}`).toBe(0);
    expect(sum(rows, "2026-08", "ramount"), "штраф остаётся в сборах").toBeCloseTo(-500.12, 2);
    // Платёж и возврат такого заказа - не услуга: в «Штрафы и прочие услуги» не попадают (поймано на живой сборке 02.10).
    expect(sum(rows, "2026-08", "otherSvc"), "в августе только штраф").toBe(-500);
    expect(sum(rows, "2026-09", "otherSvc"), "возврат - не услуга").toBe(0);
  });

  it("перевозка мультиартикульного заказа - по артикулам пропорционально платежу", () => {
    const net = [P("2026-08-01", "o5", "A", 3_000), P("2026-08-01", "o5", "B", 1_000), F("2026-08-05", "o5", "Перевод платежа", -100)];
    const { rows } = buildAccNetting(net as any, [], undefined, new Map([["o5", 4_000]]));
    const by = (sk: string) => rows.filter((r) => r.sku === sk).reduce((a, r) => a + r.ship, 0);
    expect(by("A")).toBe(3_000);
    expect(by("B")).toBe(1_000);
  });
});

// G4 и G5 ФЕНИКСА iter2 (мутанты M10, M11): пометки пар без статуса и отрезанных дней.
describe("пары без статуса и отрезанные дни реестра", () => {
  it("месяцы до FLOOR бот не перезабирает - отдельная группа, без обещания перезабора", () => {
    const r = splitNoStatus(["1/2025-12", "1/2026-01", "1/2026-02", "2/2026-09"], "2026-02-01");
    expect(r.never).toEqual(["1/2025-12", "1/2026-01"]);
    expect(r.refetch).toEqual(["1/2026-02", "2/2026-09"]);
  });
  it("отрезаются ВСЕ дни после границы, по разу и по порядку (G1 ФЕНИКСА 02.10)", () => {
    expect(accCutDays(["2026-09-30", "2026-09-27", "2026-09-26", "2026-09-30", "2026-09-28"], "2026-09-26")).toEqual(["2026-09-27", "2026-09-28", "2026-09-30"]);
    expect(accCutDays(["2026-09-26"], "2026-09-26")).toEqual([]);
  });
});
