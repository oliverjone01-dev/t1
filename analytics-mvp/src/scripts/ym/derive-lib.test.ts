import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseOrder, ymDate, decodeReport } from "../../connector/ym-partner.js";
import { normalizeOrder, buildHistory, buildDailyTotals, buildSkusLive, buildPnl, buildPnlSku, buildPnlDaily, buildPnlSkuDaily, buildAccountDaily, accountGroup, feeGroup, type OrderRow, isServiceItem, applyNettingFees, nettingFeeGroup } from "./derive-lib.js";

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
  it("заказ, которого ещё нет в ledger'е, сохраняет комиссии заказа и помечается", () => {
    const r = applyNettingFees([mk({ order: "2" })], [{ order: "1", sku: "A", type: "Удержание", service: "Размещение", amount: -50 }]).rows[0]!;
    expect(r.fee_source).toBe("order");
    expect(r.fee_total).toBe(500);
    expect(r.payout).toBe(9500);
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
