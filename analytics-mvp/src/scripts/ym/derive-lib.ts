// Чистая логика Маркета (без сети и файлов, тестируется): заказ API -> строки факта,
// строки факта -> файлы контракта снимков OZON (history/daily_totals/skus_live/pnl_*).
// Контракт = атом 1 эпизода feniks-veto-uploaded-docs-20260610: те же имена файлов и поля,
// плюс platform="ym". Дашборды не переписываются - читают data-ym/ через DATA_DIR.
import type { YmOrder } from "../../connector/ym-partner.js";
import { normSku } from "../../util/sku.js";
import { ymDate } from "../../connector/ym-partner.js";
import { lineOf } from "../../util/line.js";

export const PLATFORM = "ym" as const;

// Статусы заказа Маркета (stats/orders). Отменённые - без денег и без единиц в доставке.
export const CANCELLED_STATUSES = new Set(["CANCELLED_BEFORE_PROCESSING", "CANCELLED_IN_DELIVERY", "CANCELLED_IN_PROCESSING", "REJECTED", "UNPAID"]);
// Доставленные (деньги начислены): доставлен, частично возвращён, возвращён целиком.
export const DELIVERED_STATUSES = new Set(["DELIVERED", "PARTIALLY_RETURNED", "RETURNED", "PARTIALLY_DELIVERED"]); // PARTIALLY_DELIVERED встречен вживую 2026-09-04

// Типы цен в позиции: сумма всех типов = стоимость товара для продавца (покупатель платит BUYER,
// Маркет докладывает софинансирование MARKETPLACE, баллы CASHBACK/SPASIBO). [ГИПОТЕЗА] до сверки
// с отчётом по взаиморасчётам; переопределяется YM_REVENUE_PRICE_TYPES.
export function revenuePriceTypes(): Set<string> {
  const raw = process.env.YM_REVENUE_PRICE_TYPES || "BUYER,MARKETPLACE,CASHBACK,SPASIBO";
  return new Set(raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean));
}

// Группы комиссий Маркета -> категории сборов как в OZON-дашборде (одни подписи в обоих каналах).
export const FEE_GROUPS: Record<string, string> = {
  FEE: "Комиссия за продажу",
  AGENCY: "Эквайринг", PAYMENT_TRANSFER: "Эквайринг", WITHDRAW_AGENCY: "Эквайринг",
  DELIVERY_TO_CUSTOMER: "Логистика (прямая+возвратная)", DELIVERY_TO_CUSTOMER_RETURN: "Логистика (прямая+возвратная)",
  EXPRESS_DELIVERY_TO_CUSTOMER: "Логистика (прямая+возвратная)", MIDDLE_MILE: "Логистика (прямая+возвратная)",
  CROSSREGIONAL_DELIVERY: "Логистика (прямая+возвратная)", CROSSREGIONAL_DELIVERY_RETURN: "Логистика (прямая+возвратная)",
  RETURN_PROCESSING: "Логистика (прямая+возвратная)",
  FULFILLMENT: "Хранение", SORTING: "Хранение", RETURNED_ORDERS_STORAGE: "Хранение", DISPOSAL: "Хранение", STORAGE: "Хранение",
  LOYALTY_PARTICIPATION_FEE: "Продвижение (буст/лояльность)", AUCTION_PROMOTION: "Продвижение (буст/лояльность)",
  INSTALLMENT: "Рассрочка",
};
export function feeGroup(type: string): string { return FEE_GROUPS[String(type || "").toUpperCase()] || "Прочее"; }

export interface OrderRow {
  platform: "ym"; business: string; campaign: string; order: string;
  created: string; statusDate: string; status: string; fin: string;
  sku: string; market_sku: string; name: string; line: string;
  units: number; count: number; delivered: number; returned: number; cancelled: number;
  price: number; p_buyer: number; p_mp: number; p_cashback: number; p_spasibo: number;
  revenue: number; accruals: number;
  shop_order: string;
  pos: number;      // номер позиции в заказе: у товара и доставки один shopSku, ключ строки без него схлопывает их
  service: boolean; // позиция-услуга (доставка/подъём): деньги заказа - да, проданные штуки - нет
  fees: Record<string, number>; fee_total: number; payout: number; fee_actual: boolean;
  fee_source?: "netting" | "order"; // откуда взяты сборы: ledger кабинета или комиссии заказа
  paid: number; paid_by_type: Record<string, number>; subsidy: number; fake: boolean;
  // Баллы Маркета из subsidies[] заказа, разнесённые по позициям. `subsidy` - ЧИСТОЕ начисление
  // (ACCRUAL минус DEDUCTION); разбивка нужна, чтобы списание при невыкупе и возврате было видно,
  // а не только сальдо. Ключ разбивки - "<operationType>|<type>", например "ACCRUAL|SUBSIDY".
  sub_acc?: number;                       // начислено баллов (ACCRUAL)
  sub_ded?: number;                       // списано баллов (DEDUCTION, положительное число)
  sub_by_type?: Record<string, number>;   // разбивка по источнику и типу операции
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Заказ API -> строки по позициям. Комиссии уровня заказа разносим по позициям пропорционально
// начислениям (равными долями, если начислений нет). actual предпочтительнее predicted.
// Маркет кладёт доставку и подъём ОТДЕЛЬНОЙ позицией заказа, причём с тем же shopSku, что у товара
// (живой факт 2026-09-04: заказ 55204502850 - «Стол ... 160х80» и «Доставка КГТ без подъема на этаж»,
// оба под GGT-03-1-5-E-16080). Такая позиция - услуга, а не товар: её деньги принадлежат заказу, а её
// count не является проданной штукой. Список закрытый и проверяемый; всё, что под него не подошло,
// считается товаром, а совпадение SKU внутри заказа поднимается в отчёт о покрытии.
export const SERVICE_NAME = /^\s*(доставк|подъ[её]м|подьем|сборк|установк|услуг)/i;
export function isServiceItem(offerName: string): boolean { return SERVICE_NAME.test(String(offerName || "")); }

export function normalizeOrder(o: YmOrder, campaignId: string, businessId: string): OrderRow[] {
  const types = revenuePriceTypes();
  const created = ymDate(o.creationDate), statusDate = ymDate(o.statusUpdateDate) || created;
  const cancelled = CANCELLED_STATUSES.has(o.status);
  const deliveredSet = DELIVERED_STATUSES.has(o.status);
  const fin = deliveredSet ? statusDate : created;

  const items = o.items.map((it, idx) => {
    const per = (t: string) => it.prices.filter((p) => p.type.toUpperCase() === t).reduce((s, p) => s + p.costPerItem, 0);
    const price = it.prices.filter((p) => types.has(p.type.toUpperCase())).reduce((s, p) => s + p.costPerItem, 0);
    const returned = it.details.filter((d) => d.itemStatus === "RETURNED").reduce((s, d) => s + d.itemCount, 0) || (o.status === "RETURNED" ? it.count : 0);
    const rejected = it.details.filter((d) => d.itemStatus === "REJECTED").reduce((s, d) => s + d.itemCount, 0);
    const units = Math.max(it.initialCount || it.count, it.count + rejected);
    const count = it.count;
    const delivered = deliveredSet ? Math.max(0, count - returned) : 0;
    const cancelledUnits = cancelled ? units : rejected;
    // revenue = «заказано на сумму» по дате создания, как revenue в OZON analytics (включая заказы,
    // отменённые позже) - единый смысл поля в обоих каналах (ФЕНИКС G7). Деньги - в accruals/payout.
    const revenue = r2(price * units);
    const accruals = deliveredSet ? r2(price * Math.max(0, count - returned)) : 0;
    // Услуга (доставка, подъём): деньги остаются в заказе, штуки обнуляются - иначе каждая доставка
    // считалась бы проданной единицей и ломала сверку штук с отчётом о реализации.
    const service = isServiceItem(it.offerName);
    return { it, idx, service, price, p_buyer: per("BUYER"), p_mp: per("MARKETPLACE"), p_cashback: per("CASHBACK"), p_spasibo: per("SPASIBO"),
      returned: service ? 0 : returned, units: service ? 0 : units, count, delivered: service ? 0 : delivered,
      cancelledUnits: service ? 0 : cancelledUnits, revenue, accruals };
  });

  // комиссии заказа по группам (положительные суммы)
  const fees: Record<string, number> = {};
  let anyActual = false, anyPredicted = false;
  for (const c of o.commissions) {
    const v = c.actual != null ? c.actual : c.predicted;
    if (c.actual != null) anyActual = true; else if (c.predicted != null) anyPredicted = true;
    if (v == null || !v) continue;
    const g = feeGroup(c.type); fees[g] = r2((fees[g] || 0) + Math.abs(v));
  }
  const feeActual = anyActual || !anyPredicted;
  // Фактические выплаты по заказу из самого API (эталон денег внутри stats/orders, доступен без
  // финансовых отчётов ЛК). Знак: REFUND уменьшает выплату. Разбивку по типам храним, чтобы видеть,
  // из чего складывается платёж (софинансирование Маркета приходит отдельным типом).
  const paidTotal = o.payments.reduce((s, p) => s + (p.type === "REFUND" ? -p.total : p.total), 0);
  const paidByType: Record<string, number> = {};
  for (const p of o.payments) { const k = String(p.type || "?").toUpperCase(); paidByType[k] = r2((paidByType[k] || 0) + (p.type === "REFUND" ? -p.total : p.total)); }
  // Раньше здесь стоял reduce по всем субсидиям без разбора: ACCRUAL и DEDUCTION складывались,
  // то есть СПИСАНИЕ баллов при невыкупе и возврате ПРИБАВЛЯЛОСЬ к начислению. Из-за этого баллы
  // по июлю 2026 были завышены на 2.7%. По спецификации Маркета amount - величина без знака, а
  // направление операции несёт operationType (ACCRUAL / DEDUCTION); источник несёт type
  // (YANDEX_CASHBACK - Плюс, SUBSIDY - скидка Маркета по акциям и промокодам, DELIVERY - DBS).
  let subAcc = 0, subDed = 0;
  const subByType: Record<string, number> = {};
  for (const x of o.subsidies || []) {
    const op = String(x.operationType || "").toUpperCase();
    const amt = Math.abs(Number(x.amount) || 0);
    if (!amt) continue;
    if (op === "DEDUCTION") subDed += amt; else subAcc += amt;
    const k = `${op || "?"}|${String(x.type || "?").toUpperCase()}`;
    subByType[k] = r2((subByType[k] || 0) + amt);
  }
  const subsidyTotal = subAcc - subDed;
  // База разнесения платежей и субсидий - стоимость позиции (цена × штуки), а не accruals:
  // у полностью возвращённой позиции accruals обнуляются, и её возврат уезжал на соседний SKU.
  // Живой случай: заказ 58875910850 (июль, мебель), GGR-11-4 возвращён целиком, а весь возврат
  // -11 066 ₽ сел на GGT-12-2. Сборы остаются на accruals: по недоставленному Маркет и правда
  // ничего не списал.
  const base = items.reduce((s, x) => s + x.accruals, 0);
  const payBase = items.reduce((s, x) => s + x.price * x.count, 0);
  const n = items.length || 1;

  return items.map((x) => {
    const share = base > 0 ? x.accruals / base : 1 / n;
    const payShare = payBase > 0 ? (x.price * x.count) / payBase : 1 / n;
    const f: Record<string, number> = {};
    let ft = 0;
    // сборы относим только к доставленным позициям (по недоставленным Маркет ещё ничего не списал)
    if (deliveredSet) for (const [g, v] of Object.entries(fees)) { const a = r2(v * share); if (a) { f[g] = a; ft += a; } }
    ft = r2(ft);
    return {
      platform: PLATFORM, business: businessId, campaign: campaignId, order: o.id, shop_order: o.partnerOrderId || "", pos: x.idx, service: x.service,
      created, statusDate, status: o.status, fin,
      sku: x.it.shopSku || x.it.marketSku, market_sku: x.it.marketSku, name: x.it.offerName, line: lineOf(x.it.offerName),
      units: x.units, count: x.count, delivered: x.delivered, returned: x.returned, cancelled: x.cancelledUnits,
      price: r2(x.price), p_buyer: r2(x.p_buyer), p_mp: r2(x.p_mp), p_cashback: r2(x.p_cashback), p_spasibo: r2(x.p_spasibo),
      revenue: x.revenue, accruals: x.accruals,
      fees: f, fee_total: ft, payout: deliveredSet ? r2(x.accruals - ft) : 0, fee_actual: feeActual,
      paid: r2(paidTotal * payShare), paid_by_type: Object.fromEntries(Object.entries(paidByType).map(([k, v]) => [k, r2(v * payShare)])), subsidy: r2(subsidyTotal * payShare), fake: !!o.fake,
      sub_acc: r2(subAcc * payShare), sub_ded: r2(subDed * payShare),
      sub_by_type: Object.fromEntries(Object.entries(subByType).map(([k, v]) => [k, r2(v * payShare)])),
    };
  });
}

// ---------- помощники дат ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const fmtD = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export function addDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmtD(d); }
export function daysBetween(from: string, to: string): string[] { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

export const real = (rows: OrderRow[]) => rows.filter((r) => !r.fake);

// ---------- history.ndjson (по дате создания заказа) ----------
// revenue - «заказано на сумму» (все статусы). accruals - деньги ДОСТАВЛЕННОГО за вычетом возврата:
// это тот же базис, что у свода по заказам, и именно он показывается на «Товарах» Маркета.
// rev_canc / rev_fly / rev_ret - деньги отменённого, ещё летящего и возвращённого: не продажи,
// но прятать их нельзя. rev_service - деньги позиций-услуг (доставка, подъём): штук у них нет.
// Тождество: revenue = accruals + rev_ret + rev_canc + rev_fly + rev_service; в штуках без услуг.
export interface Fact { date: string; sku: string; offer_id: string | null; name: string; line: string; revenue: number; units: number; views: number; to_cart: number; delivered: number; returns: number; cancellations: number; accruals: number; flying: number; rev_canc: number; rev_fly: number; rev_ret: number; rev_service: number; platform: "ym"; market_sku?: string }

export function buildHistory(rows: OrderRow[], floor: string, to: string, viewsBy?: Map<string, { views: number; cart: number }>): Fact[] {
  const m = new Map<string, Fact>();
  for (const r of real(rows)) {
    if (r.created < floor || r.created > to) continue;
    const k = `${r.created}|${r.sku}`;
    const f = m.get(k) || { date: r.created, sku: r.sku, offer_id: r.sku, name: r.name, line: r.line, revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, accruals: 0, flying: 0, rev_canc: 0, rev_fly: 0, rev_ret: 0, rev_service: 0, platform: PLATFORM, market_sku: r.market_sku };
    f.revenue = Math.round(f.revenue + r.revenue); f.units += r.units; f.delivered += r.delivered; f.returns += r.returned; f.cancellations += r.cancelled;
    // Отменённое и летящее НЕ хранятся в строке заказа: они выводятся из статуса, цены и штук,
    // которые там уже есть. Иначе за ними пришлось бы гнать полный пересбор заказов по сети, а
    // накопленные снимки (2617 строк с февраля) остались бы без этих колонок навсегда.
    // Позиция-услуга (доставка, подъём) идёт своей ногой: штук у неё нет по построению, а деньги
    // есть, и если сложить их в «продано», выручка артикула вырастет на чужую услугу. В своде это
    // отдельная колонка «Доставка покупателя» - здесь то же самое поле.
    if (r.service) { f.rev_service = Math.round(f.rev_service + r.revenue); }
    else {
      const flying = (!DELIVERED_STATUSES.has(r.status) && !CANCELLED_STATUSES.has(r.status))
        ? Math.max(0, r.units - r.cancelled) : 0;
      f.accruals = Math.round(f.accruals + r.accruals); f.flying += flying;
      f.rev_canc = Math.round(f.rev_canc + r.price * r.cancelled);
      f.rev_fly = Math.round(f.rev_fly + r.price * flying);
      f.rev_ret = Math.round(f.rev_ret + r.price * r.returned);
    }
    if (!f.name && r.name) f.name = r.name;
    m.set(k, f);
  }
  if (viewsBy) for (const [k, v] of viewsBy) { const f = m.get(k); if (f) { f.views += v.views; f.to_cart += v.cart; } }
  const days = new Set([...m.values()].map((f) => f.date));
  for (const d of daysBetween(floor, to)) if (!days.has(d)) m.set(`${d}|__empty__`, { date: d, sku: "__empty__", offer_id: null, name: "", line: "прочее", revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, accruals: 0, flying: 0, rev_canc: 0, rev_fly: 0, rev_ret: 0, rev_service: 0, platform: PLATFORM });
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sku < b.sku ? -1 : 1));
}

// ---------- daily_totals.ndjson ----------
export interface DayTot { date: string; revenue: number; units: number; views: number; views_search: number; pdp_views: number; to_cart: number; delivered: number; returns: number; cancellations: number; accruals: number; flying: number; rev_canc: number; rev_fly: number; rev_ret: number; rev_service: number; platform: "ym" }
export function buildDailyTotals(facts: Fact[], floor: string, to: string, dayViews?: Map<string, { views: number; vsearch: number; pdp: number; cart: number }>): DayTot[] {
  const m = new Map<string, DayTot>();
  for (const d of daysBetween(floor, to)) m.set(d, { date: d, revenue: 0, units: 0, views: 0, views_search: 0, pdp_views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, accruals: 0, flying: 0, rev_canc: 0, rev_fly: 0, rev_ret: 0, rev_service: 0, platform: PLATFORM });
  for (const f of facts) { const t = m.get(f.date); if (!t || f.sku === "__empty__") continue; t.revenue += f.revenue; t.units += f.units; t.delivered += f.delivered; t.returns += f.returns; t.cancellations += f.cancellations; t.accruals += f.accruals || 0; t.flying += f.flying || 0; t.rev_canc += f.rev_canc || 0; t.rev_fly += f.rev_fly || 0; t.rev_ret += f.rev_ret || 0; t.rev_service += f.rev_service || 0; }
  if (dayViews) for (const [d, v] of dayViews) { const t = m.get(d); if (t) { t.views = v.views; t.views_search = v.vsearch; t.pdp_views = v.pdp; t.to_cart = v.cart; } }
  return [...m.values()];
}

// ---------- skus_live_30d.json ----------
export interface CatalogLike { items: Record<string, { name?: string; marketSku?: string; category?: string; price?: number | null; stock?: number | null; business?: string }> }
export function buildSkusLive(rows: OrderRow[], facts: Fact[], catalog: CatalogLike, dateFrom: string, dateTo: string, skuViews?: Map<string, { views: number; cart: number }>) {
  const agg = new Map<string, any>();
  for (const f of facts) {
    if (f.sku === "__empty__" || f.date < dateFrom || f.date > dateTo) continue;
    const a = agg.get(f.sku) || { sku: f.sku, name: f.name, line: f.line, rev: 0, units: 0, views: 0, cart: 0, deliv: 0, ret: 0, canc: 0 };
    a.rev += f.revenue; a.units += f.units; a.deliv += f.delivered; a.ret += f.returns; a.canc += f.cancellations; a.views += f.views; a.cart += f.to_cart;
    if (!a.name && f.name) a.name = f.name;
    agg.set(f.sku, a);
  }
  const skus: any[] = [];
  const lineMap: Record<string, { line: string; rev: number; units: number; ret: number; sk: number }> = {};
  for (const a of agg.values()) {
    if (a.rev <= 0) continue;
    const c = catalog.items[a.sku] || {};
    if (skuViews) { const v = skuViews.get(a.sku); if (v) { a.views = v.views; a.cart = v.cart; } }
    if (!a.name && c.name) a.name = c.name;
    const s = {
      sku: a.sku, name: a.name, line: a.line, rev: Math.round(a.rev), units: a.units, views: a.views, cart: a.cart, deliv: a.deliv, ret: a.ret, canc: a.canc,
      convCart: a.views ? Math.round((a.cart / a.views) * 1000) / 10 : 0, convOrd: a.views ? Math.round((a.units / a.views) * 1000) / 10 : 0,
      retp: (a.units + a.ret) ? Math.round((a.ret / (a.units + a.ret)) * 1000) / 10 : 0, aov: a.units ? Math.round(a.rev / a.units) : 0,
      // stock: null - Маркет остаток не отдал. «Закончился» (oos) объявляем ТОЛЬКО когда он
      // назвал ноль: иначе флаг вешался на каждый артикул, про который просто ничего не известно.
      offer: a.sku, stock: c.stock ?? null, pidx: null as number | null, pcol: "", price: c.price != null ? Math.round(c.price) : null,
      oos: (a.units > 0 && c.stock === 0) ? 1 : 0, market_sku: c.marketSku || "", business: c.business || "", platform: PLATFORM,
    };
    skus.push(s);
    const L = lineMap[a.line] || (lineMap[a.line] = { line: a.line, rev: 0, units: 0, ret: 0, sk: 0 });
    L.rev += a.rev; L.units += a.units; L.ret += a.ret; L.sk += 1;
  }
  skus.sort((x, y) => y.rev - x.rev);
  const by_line = Object.values(lineMap).map((L) => ({ line: L.line, rev: Math.round(L.rev), units: L.units, ret: L.ret, sk: L.sk, ad_spend: 0, ad_drr: 0 })).sort((a, b) => b.rev - a.rev);
  const totals: any = { rev: 0, units: 0, ret: 0, canc: 0, views: 0, sk: skus.length, oos: 0, ad_spend: 0, ad_drr: 0 };
  for (const s of skus) { totals.rev += s.rev; totals.units += s.units; totals.ret += s.ret; totals.canc += s.canc; totals.views += s.views; totals.oos += s.oos; }
  return { platform: PLATFORM, dateFrom, dateTo, generated_at: new Date().toISOString(), totals, by_line, sku_table: skus, ads_note: "реклама Маркета не подключена: ad_spend/ad_drr = 0 (нет источника)" };
}

// ---------- P&L (по дате доставки fin, только доставленные - деньги реально начислены) ----------
const paid = (rows: OrderRow[], from: string, to: string) => real(rows).filter((r) => DELIVERED_STATUSES.has(r.status) && r.fin >= from && r.fin <= to);

export function buildPnl(rows: OrderRow[], dateFrom: string, dateTo: string) {
  const rs = paid(rows, dateFrom, dateTo);
  const breakdown: Record<string, number> = { "Комиссия за продажу": 0 };
  let accruals = 0, payout = 0; const orders = new Set<string>();
  let predicted = 0;
  for (const r of rs) {
    accruals += r.accruals; payout += r.payout; orders.add(r.order); if (!r.fee_actual) predicted++;
    for (const [g, v] of Object.entries(r.fees)) breakdown[g] = (breakdown[g] || 0) - v;
  }
  for (const k of Object.keys(breakdown)) breakdown[k] = Math.round(breakdown[k]!);
  return {
    platform: PLATFORM, dateFrom, dateTo, ops: orders.size, accruals: Math.round(accruals), commission: breakdown["Комиссия за продажу"] || 0,
    payout: Math.round(payout), breakdown, predicted_rows: predicted,
    basis: "доставленные заказы по дате доставки; комиссии actual (predicted - где Маркет ещё не закрыл)",
  };
}

export function buildPnlSku(rows: OrderRow[], dateFrom: string, dateTo: string) {
  const bySku: Record<string, { accruals: number; commission: number; amount: number; ops: number }> = {};
  const rs = paid(rows, dateFrom, dateTo);
  for (const r of rs) {
    const a = bySku[r.sku] || (bySku[r.sku] = { accruals: 0, commission: 0, amount: 0, ops: 0 });
    a.accruals += r.accruals; a.commission -= r.fees["Комиссия за продажу"] || 0; a.amount += r.payout; a.ops++;
  }
  for (const k in bySku) { const a = bySku[k]!; a.accruals = Math.round(a.accruals); a.commission = Math.round(a.commission); a.amount = Math.round(a.amount); }
  const multi = new Set(rs.filter((r) => rs.some((x) => x.order === r.order && x.sku !== r.sku)).map((r) => r.order)).size;
  return { platform: PLATFORM, dateFrom, dateTo, skuCount: Object.keys(bySku).length, singleItemOps: new Set(rs.map((r) => r.order)).size - multi, multiItemOps: multi, bySku, basis: "комиссии заказа разнесены по позициям пропорционально начислениям (в OZON комплекты не разносятся)" };
}

export function buildPnlDaily(rows: OrderRow[]) {
  const m = new Map<string, { d: string; accruals: number; commission: number; delivery: number; fees: number; payout: number; ops: number; platform: "ym" }>();
  for (const r of paid(rows, "0000-00-00", "9999-99-99")) {
    const t = m.get(r.fin) || { d: r.fin, accruals: 0, commission: 0, delivery: 0, fees: 0, payout: 0, ops: 0, platform: PLATFORM };
    t.accruals += r.accruals; t.commission -= r.fees["Комиссия за продажу"] || 0; t.delivery -= r.fees["Логистика (прямая+возвратная)"] || 0; t.fees += r.fee_total; t.payout += r.payout; t.ops++;
    m.set(r.fin, t);
  }
  return [...m.values()].map((t) => ({ ...t, accruals: Math.round(t.accruals), commission: Math.round(t.commission), delivery: Math.round(t.delivery), fees: Math.round(t.fees), payout: Math.round(t.payout) })).sort((a, b) => (a.d < b.d ? -1 : 1));
}

export function buildPnlSkuDaily(rows: OrderRow[]) {
  const m = new Map<string, any>();
  for (const r of paid(rows, "0000-00-00", "9999-99-99")) {
    const k = `${r.fin}|${r.sku}`;
    const t = m.get(k) || { d: r.fin, sku: r.sku, accruals: 0, commission: 0, delivery: 0, acquiring: 0, storage: 0, cofin: 0, promo: 0, otherSvc: 0, amount: 0, platform: PLATFORM };
    t.accruals += r.accruals; t.amount += r.payout;
    for (const [g, v] of Object.entries(r.fees)) {
      if (g === "Комиссия за продажу") t.commission -= v; else if (g === "Логистика (прямая+возвратная)") t.delivery -= v;
      else if (g === "Эквайринг") t.acquiring -= v; else if (g === "Хранение") t.storage -= v;
      // Софинансирование скидок - крупнейшая статья расходов канала (июль 2026, один магазин зеркал:
      // 1 140 019 ₽ против 317 877 ₽ всех остальных услуг вместе). В «Прочих» её быть не должно.
      // Буст продаж и участие в программе лояльности - отдельная статья, а не «прочее»: у Маркета
      // это реклама за продажу, и её нельзя смешивать с эквайрингом и штрафами. Без своей строки
      // она сидела в «Прочих» вместе с софинансированием и читалась как непонятный ком.
      else if (g === COFIN_GROUP) t.cofin -= v;
      else if (g === "Продвижение (буст/лояльность)") t.promo -= v;
      else t.otherSvc -= v;
    }
    m.set(k, t);
  }
  return [...m.values()].map((t) => { for (const k of ["accruals", "commission", "delivery", "acquiring", "storage", "cofin", "promo", "otherSvc", "amount"]) t[k] = Math.round(t[k]); return t; }).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
}

// Сборы уровня кабинета (плата за размещение, буст вне заказа, штрафы, подписки) в stats/orders не
// приходят - [ГИПОТЕЗА] до первого netting. Источник - строки отчёта по взаиморасчётам БЕЗ номера
// заказа: группируем по дате и смыслу услуги. Пока отчёта нет - нули, и полоса покрытия так и пишет
// «сборы уровня кабинета: не подключены» (ФЕНИКС G8), а не молчит.
export interface NettingRow { d: string; order?: string; service?: string; type?: string; amount: number }
export function accountGroup(service: string, type = ""): "adv" | "fines" | "badge" | "delivery" | "other" {
  const n = `${service} ${type}`.toLowerCase();
  if (/буст|продвиж|реклам|полк|shows|boost/.test(n)) return "adv";
  if (/штраф|неустой|penalt/.test(n)) return "fines";
  if (/подписк|premium|плюс|размещен|subscri/.test(n)) return "badge";
  if (/доставк|логист|deliver/.test(n)) return "delivery";
  return "other";
}
export function buildAccountDaily(floor: string, to: string, netting: NettingRow[] = []) {
  const m = new Map<string, any>();
  for (const d of daysBetween(floor, to)) m.set(d, { d, adv: 0, fines: 0, realfbs: 0, badge: 0, delivery: 0, other: 0, platform: PLATFORM });
  for (const r of netting) {
    if (r.order && String(r.order).trim()) continue; // привязано к заказу - уже в pnl_sku_daily
    const t = m.get(r.d); if (!t) continue;
    t[accountGroup(r.service || "", r.type || "")] += Math.round(r.amount * 100) / 100; // знак как в отчёте (удержания отрицательны)
  }
  return [...m.values()].map((t) => { for (const k of ["adv", "fines", "badge", "delivery", "other"]) t[k] = Math.round(t[k]); return t; });
}

export function buildSkuOffer(rows: OrderRow[], catalog: CatalogLike): Record<string, string> {
  const m: Record<string, string> = {};
  for (const k of Object.keys(catalog.items)) m[k] = k;
  for (const r of rows) m[r.sku] = r.sku;
  return m;
}

// Реклама: источника нет (рекламный кабинет Маркета не подключён). Снимок-заглушка с нулями и
// явной пометкой, чтобы дашборд не молчал, а показывал «нет источника».
// Расход на продвижение из реестра взаиморасчётов. «Рекламного кабинета» у Маркета в API нет, но
// деньги на буст кабинет удерживает, и они лежат в реестре отдельными проводками. Утверждение
// «реклама не подключена, расход 0» на странице маркетинга при этом противоречило странице денег,
// где те же деньги проходили строкой «Продвижение (буст/лояльность)»: живой факт 2026-09-07 -
// 1 277 473 ₽ буста в реестре против «Расход рекламы 0 ₽» на соседней вкладке.
// Группа берётся ТЕМ ЖЕ nettingFeeGroup, что и на странице денег. Второе, «похожее» определение
// продвижения гарантированно разошлось бы с первым, и дашборд снова сам себе противоречил бы.
export const PROMO_GROUP = "Продвижение (буст/лояльность)";
export function promoFromNetting(net: Array<{ d: string; type?: string; service?: string; src?: string; amount: number }>, dateFrom?: string, dateTo?: string): number {
  let v = 0;
  for (const n of net) {
    if (dateFrom && n.d < dateFrom) continue;
    if (dateTo && n.d > dateTo) continue;
    if (!isNettingFee(String(n.type || ""), (n as any).src)) continue;
    if (nettingFeeGroup(String(n.service || ""), String((n as any).src || "")) === PROMO_GROUP) v -= n.amount; // списание -> расход плюсом
  }
  return Math.round(v * 100) / 100;
}

export function adsStub(dateFrom: string, dateTo: string, promoSpend = 0) {
  const note = promoSpend > 0
    ? `рекламного кабинета у Маркета в API нет. Расход на продвижение ${Math.round(promoSpend)} ₽ взят из отчёта по взаиморасчётам (группа «${PROMO_GROUP}»), базис - ДАТА ПРОВОДКИ реестра. На странице Деньги та же группа считается по другому базису - по дате доставки заказа, которому проводка разнесена, - поэтому число там отличается: это не расхождение, а два разных вопроса («когда кабинет списал» и «на какие продажи легло»). Привязки расхода к кампаниям и заказам Маркет не отдаёт, поэтому ДРР и CPO не считаются`
    : "реклама Маркета не подключена (нет источника): расход/ДРР = 0, это не «ноль рекламы»";
  return { platform: PLATFORM, dateFrom, dateTo, generated_at: new Date().toISOString(), totals: { spend: promoSpend, adRevenue: 0, orders: 0, drr: 0, cpo: 0, active: 0, campaigns: 0 }, promo_from_netting: promoSpend, burners: [], top_spend: [], by_line: [], note };
}

// ---------- сборы из ledger'а кабинета (united-netting) ----------
// По CLAUDE.md §15 источник денег - кабинет, а не заказ. Блок commissions в stats/orders несёт только
// комиссию по заказу: на живых данных 2026-09-04 мы книжили 3 242 362 ₽ удержаний, а кабинет удержал
// 18 231 203 ₽, то есть видели 18%. Недостающее - размещение товарных предложений (14.9 млн), буст,
// логистика и эквайринг: это отдельные проводки ledger'а, и в заказ они не попадают.
// Начисления при этом сходятся с кабинетом в ноль, поэтому подменяем ТОЛЬКО сборы.
export const NETTING_FEE_GROUPS: Array<[RegExp, string]> = [
  [/размещени.*(товарн|витрин)/i, "Комиссия за продажу"],
  [/буст|лояльност|отзыв/i, "Продвижение (буст/лояльность)"],
  [/доставк|миля|невыкуп/i, "Логистика (прямая+возвратная)"],
  [/перевод платежа|при[её]м платежа|эквайр/i, "Эквайринг"],
  [/хранени/i, "Хранение"],
  [/не вовремя|по вине продавца|штраф/i, "Штрафы"],
];
// Классификация по ИСТОЧНИКУ проводки (TRANSACTION_SOURCE). Она главнее имени услуги и решает первой.
// Сверка с выгрузкой кабинета за июль 2026 (один магазин зеркал) показала: у проводок «Скидка за
// участие в совместных акциях» - 121 строка на 1 142 508 ₽, крупнейшая статья расходов канала - в
// поле имени услуги стоит НАЗВАНИЕ ТОВАРА. Разбор по имени услуги отправил бы их в «Прочее», где они
// неотличимы от проводок без названия. Источник же называет их прямо.
export const COFIN_GROUP = "Софинансирование скидок";
export const NETTING_SOURCE_GROUPS: Array<[RegExp, string]> = [
  [/скидк[аи].*совместн|совместн.*акци/i, COFIN_GROUP],
  [/оплата услуг/i, ""],   // пустая группа = решает имя услуги, это обычные услуги Маркета
];
// Является ли проводка сбором. Решает ИСТОЧНИК, а не тип: внутри «Оплаты услуг Маркета» встречаются
// строки типа «Начисление» - это СТОРНО ранее удержанной услуги, и его надо зачитывать. Прежнее
// правило «Начисление и Возврат - не сбор» отбрасывало их вместе с начислениями за товар, и сборы
// завышались: живой факт июля 2026 по одному магазину зеркал - 329 413 ₽ вместо 317 877 ₽ у кабинета,
// разница ровно в двух строках сторно на 11 536 ₽.
const SRC_FEE = /оплата услуг|скидк[аи].*совместн|совместн.*акци/i;
const SRC_NOT_FEE = /плат[её]ж покупател|баллы за скидку|внесено продавцом|возврат плат|возврат баллов/i;
export function isNettingFee(type: string, source?: string): boolean {
  const src = String(source || "").trim();
  if (src) {
    if (SRC_NOT_FEE.test(src)) return false;
    if (SRC_FEE.test(src)) return true;
  }
  // Источника нет (снимки, собранные до появления колонки) - решаем по типу, как раньше.
  const t = String(type || "");
  return t !== "Начисление" && t !== "Возврат";
}

export function nettingSourceGroup(source: string): string {
  const t = String(source || "");
  for (const [re, g] of NETTING_SOURCE_GROUPS) if (re.test(t)) return g;
  return "";
}
export function nettingFeeGroup(service: string, source?: string): string {
  const bySrc = nettingSourceGroup(source || "");
  if (bySrc) return bySrc;
  const t = String(service || "");
  for (const [re, g] of NETTING_FEE_GROUPS) if (re.test(t)) return g;
  return "Прочее";
}

export interface NetFeeRow { order?: string; sku?: string; service?: string; src?: string; type?: string; amount: number }
export interface FeeMonth {
  orders_netting: number; orders_order: number;
  accruals_netting: number; accruals_order: number;
  fees_netting: number; fees_order: number;
  rate_netting: number | null; rate_order: number | null;
}
export interface NetFeeResult {
  rows: OrderRow[]; orders_from_netting: number; orders_from_commissions: number;
  accruals_from_netting: number; accruals_from_commissions: number;
  fees_from_netting: number; fees_from_commissions: number;
  rate_netting: number | null; rate_order: number | null;
  by_month: Record<string, FeeMonth>;
  // Адресные пробелы: пара (кабинет, месяц), где оборот есть, а реестра нет. Диффузная доля
  // «16.4% оборота» не говорит, что делать; «кабинет 1023124 за 2026-06..08» - говорит.
  gaps: Array<{ business: string; ym: string; accruals: number; orders: number }>;
  unmapped: Record<string, number>;
}

// Доля сборов от начислений. Разрыв между ставкой по ledger'у и ставкой по комиссиям заказа - это и
// есть мера недооценки: комиссия заказа покрывает только комиссию за продажу, а ledger содержит ещё
// размещение, эквайринг, буст и логистику. Живой факт 2026-09: 6.5% против 54%.
function rate(fees: number, accr: number): number | null { return accr > 0 ? Math.round((fees / accr) * 1000) / 10 : null; }

// Заменяем сборы строк на удержания кабинета там, где заказ уже есть в ledger'е. Заказы, которых там
// ещё нет (свежие, выплата не прошла), сохраняют комиссии заказа и помечаются fee_source="order" -
// по ним цифра предварительная, и это должно быть видно, а не смешиваться со сверенными.
export function applyNettingFees(rows: OrderRow[], net: NetFeeRow[]): NetFeeResult {
  // Проводка-сбор - это всё, что не начисление товара и не возврат товара. ВАЖНО: сумму берём СО
  // ЗНАКОМ. Живой факт 2026-09: 21 строка «Возврат списания» на +227 561 ₽ (возврат за размещение и
  // скидка за лояльность) проходила через Math.abs и учитывалась как удержание, хотя это возврат нам
  // ранее списанного. Из-за этого кумулятивное расхождение показывало −408 149 ₽, и я объяснил его
  // «заказами вне ledger'а» - объяснение логически невозможное, несопоставленные заказы в разность не
  // входят по построению. Знак и есть причина.
  const HOLD = (t: string, src?: string) => isNettingFee(t, src);
  const bySku = new Map<string, Record<string, number>>();   // order|sku -> группа -> сумма
  const byOrder = new Map<string, Record<string, number>>(); // order -> группа -> сумма (строки без sku)
  const orders = new Set<string>();
  const unmapped: Record<string, number> = {};
  for (const n of net) {
    const o = String(n.order || "").trim(); if (!o || !HOLD(String(n.type || ""), (n as any).src)) continue;
    const g = nettingFeeGroup(n.service || "", (n as any).src || "");
    if (g === "Прочее" && n.service) unmapped[n.service] = r2((unmapped[n.service] || 0) - n.amount);
    orders.add(o);
    const sku = String(n.sku || "").trim();
    const bag = sku ? (bySku.get(`${o}|${sku}`) || (bySku.set(`${o}|${sku}`, {}), bySku.get(`${o}|${sku}`)!))
                    : (byOrder.get(o) || (byOrder.set(o, {}), byOrder.get(o)!));
    bag[g] = r2((bag[g] || 0) - n.amount); // списание (минус в ledger'е) -> сбор плюсом; возврат списания -> сбор минусом
  }
  // доли внутри заказа и внутри (заказ, sku) - по начислениям, как и для комиссий заказа
  const accrOrder = new Map<string, number>(), accrSku = new Map<string, number>(), nOrder = new Map<string, number>();
  for (const r of rows) {
    accrOrder.set(r.order, (accrOrder.get(r.order) || 0) + r.accruals);
    accrSku.set(`${r.order}|${r.sku}`, (accrSku.get(`${r.order}|${r.sku}`) || 0) + r.accruals);
    nOrder.set(r.order, (nOrder.get(r.order) || 0) + 1);
  }
  const out = rows.map((r) => {
    if (!orders.has(r.order)) return { ...r, fee_source: "order" as const };
    const f: Record<string, number> = {};
    const add = (bag: Record<string, number> | undefined, share: number) => {
      if (!bag) return;
      for (const [g, v] of Object.entries(bag)) { const a = r2(v * share); if (a) f[g] = r2((f[g] || 0) + a); }
    };
    const kSku = `${r.order}|${r.sku}`;
    const aSku = accrSku.get(kSku) || 0, aOrd = accrOrder.get(r.order) || 0, n = nOrder.get(r.order) || 1;
    add(bySku.get(kSku), aSku > 0 ? r.accruals / aSku : 1 / rows.filter((x) => x.order === r.order && x.sku === r.sku).length);
    add(byOrder.get(r.order), aOrd > 0 ? r.accruals / aOrd : 1 / n);
    const ft = r2(Object.values(f).reduce((s, v) => s + v, 0));
    return { ...r, fees: f, fee_total: ft, payout: r2(r.accruals - ft), fee_actual: true, fee_source: "netting" as const };
  });
  return { rows: out, ...feeSourceSplit(out), unmapped };
}

// Разрез «откуда сборы» по месяцам. Где ledger'а нет, сборы взяты из комиссий заказа и занижены:
// комиссия заказа покрывает только комиссию за продажу, ledger содержит ещё размещение, эквайринг,
// буст и логистику. Считаем это ДЕНЬГАМИ, а не заказами: 1081 старый заказ на копейки и 475 свежих
// на миллионы читаются одинаково по счётчику заказов и совершенно по-разному по обороту.
// Один расчёт на два потребителя: снимок fee_source.json и сверка §15 (иначе цифры разъедутся).
export function feeSourceSplit(rows: OrderRow[]): Omit<NetFeeResult, "rows" | "unmapped"> {
  const gapAcc = new Map<string, { business: string; ym: string; accruals: number; orders: Set<string> }>();
  const by_month: Record<string, FeeMonth> = {};
  const seen = new Map<string, string>(); // заказ целиком идёт из одного источника, не считаем его дважды
  for (const r of rows) {
    const m = String(r.created || "").slice(0, 7); if (!m) continue;
    const b = (by_month[m] ||= { orders_netting: 0, orders_order: 0, accruals_netting: 0, accruals_order: 0, fees_netting: 0, fees_order: 0, rate_netting: null, rate_order: null });
    const net = r.fee_source === "netting";
    if (seen.get(r.order) !== m) { seen.set(r.order, m); if (net) b.orders_netting++; else b.orders_order++; }
    if (net) { b.accruals_netting += r.accruals; b.fees_netting += r.fee_total; }
    else {
      b.accruals_order += r.accruals; b.fees_order += r.fee_total;
      if (r.accruals > 0) {
        const gk = `${r.business}/${m}`;
        const g = gapAcc.get(gk) || (gapAcc.set(gk, { business: r.business, ym: m, accruals: 0, orders: new Set() }), gapAcc.get(gk)!);
        g.accruals += r.accruals; g.orders.add(r.order);
      }
    }
  }
  let aNet = 0, aOrd = 0, fNet = 0, fOrd = 0;
  for (const b of Object.values(by_month)) {
    b.accruals_netting = r2(b.accruals_netting); b.accruals_order = r2(b.accruals_order);
    b.fees_netting = r2(b.fees_netting); b.fees_order = r2(b.fees_order);
    b.rate_netting = rate(b.fees_netting, b.accruals_netting);
    b.rate_order = rate(b.fees_order, b.accruals_order);
    aNet += b.accruals_netting; aOrd += b.accruals_order; fNet += b.fees_netting; fOrd += b.fees_order;
  }
  return {
    orders_from_netting: new Set(rows.filter((r) => r.fee_source === "netting").map((r) => r.order)).size,
    orders_from_commissions: new Set(rows.filter((r) => r.fee_source !== "netting").map((r) => r.order)).size,
    accruals_from_netting: r2(aNet), accruals_from_commissions: r2(aOrd),
    fees_from_netting: r2(fNet), fees_from_commissions: r2(fOrd),
    rate_netting: rate(r2(fNet), r2(aNet)), rate_order: rate(r2(fOrd), r2(aOrd)),
    by_month,
    gaps: [...gapAcc.values()].map((g) => ({ business: g.business, ym: g.ym, accruals: r2(g.accruals), orders: g.orders.size }))
      .sort((a, b) => (a.business === b.business ? a.ym.localeCompare(b.ym) : a.business.localeCompare(b.business))),
  };
}

// ---------- Свод по дате заказа (методика Ивана/Кати v4, июль 2026) ----------
// Базис свода отличается от остальных витрин намеренно: период берётся по ДАТЕ ОФОРМЛЕНИЯ заказа,
// в расчёт идут только заказы со статусом DELIVERED, штуки - доставленные минус возвращённые.
// Витрины pnl_* живут по дате доставки/проводки - это другой вопрос, и числа там другие законно.
//
// Главное, чего свод не повторяет за прежним подходом: выручка НЕ берётся по цене продажи.
// Цена продажи включает скидку, которую платил Маркет, а не покупатель; расходы при этом уходили
// в учёт уже за вычетом баллов. Обе половины были искажены в одну сторону. Здесь выручка - это
// платёж покупателя минус возвраты, а услуги - полная начисленная стоимость с разделением на
// оплаченные деньгами и оплаченные баллами.
export const SVC_OTHER = "Прочие услуги";
export const SVC_COLUMNS: Array<[string, RegExp]> = [
  ["Размещение (комиссия)", /размещени/i],
  ["Программа лояльности и отзывы", /лояльност|отзыв/i],
  ["Буст продаж", /буст/i],
  ["Доставка покупателю", /доставка покупателю/i],
  ["Доставка (средняя миля)", /средн[а-яё]*\s*мил/i],
  ["Доставка невыкупов и возвратов", /невыкуп|возврат/i],
  ["Приём платежа покупателя", /при[её]м платежа/i],
  ["Перевод платежа покупателя", /перевод платежа/i],
  ["Обработка в СЦ/ПВЗ", /обработк|сортировк|СЦ|ПВЗ/i],
  ["Хранение", /хранени/i],
  ["Штрафы (не вовремя)", /не вовремя|по вине продавца|штраф/i],
  ["Полка", /полк/i],
  ["Товарные баннеры", /баннер/i],
  ["Подписка", /подписк/i],
];
export function svcColumn(service: string): string {
  const t = String(service || "");
  for (const [name, re] of SVC_COLUMNS) if (re.test(t)) return name;
  return SVC_OTHER;
}

// Чем оплачена услуга. Источник проводки (TRANSACTION_SOURCE) решает первым - он называет
// софинансирование прямо. Пока источника в снимке нет, решает ТИП проводки, и это не догадка:
// на живом июле 2026 по кабинету мебели сумма «Удержание» = 557 521 ₽ против 557 250,20 ₽
// в строке «Стоимость оказанных услуг по актам» отчёта об исполнении поручения (+0,05%),
// а сумма «Списание» = 2 326 514 ₽ против 2 350 590,89 ₽ списанных баллами по акту (-1,0%).
export function isPointsPaid(type: string, source?: string): boolean {
  const src = String(source || "").trim();
  if (src) return nettingSourceGroup(src) === COFIN_GROUP;
  const t = String(type || "").trim();
  return t === "Списание" || t === "Возврат списания";
}

export interface SvodRow {
  business: string; ym: string; d: string; sku: string; name: string; line: string;
  orders: number; units_delivered: number; units_returned: number; units_net: number;
  price: number; ship_buyer: number; disc_mp: number; disc_plus: number;
  buyer_pay: number; refunds: number; revenue_money: number; points_accrued: number;
  svc: Record<string, number>; svc_pts: Record<string, number>; svc_money: number; svc_points: number; svc_total: number;
  result_money: number; result_points: number;
  cogs: number; cogs_known: boolean;
}
export interface SvodMonth {
  business: string; ym: string; orders: number; rows: SvodRow[];
  overhead_money: number; overhead_points: number; overhead: Record<string, number>; overhead_pts: Record<string, number>;
  // Общие расходы кабинета ПО ДНЯМ: {дата: {m: деньгами, p: баллами}}. Нужны, чтобы свод считался
  // за произвольный период, а не только за целый месяц. У акта есть дата оказания услуги, у
  // реестра платежей - дата проводки, так что день известен у обоих источников.
  // По дню: m - оплачено деньгами, p - баллами, c - та же сумма в разрезе статей (колонок
  // svcColumn), чтобы блок «Общие расходы» показывал не один ком, а из чего он сложен, и делал
  // это по тем же дням и статьям, что ИТОГО свода. Значение статьи - [деньги, баллы].
  overhead_daily: Record<string, { m: number; p: number; c?: Record<string, [number, number]> }>;
  points_acc: number;   // начислено баллов за месяц (ACCRUAL из subsidies[])
  points_ded: number;   // списано баллов при невыкупе и возврате (DEDUCTION), положительное число
  overhead_src: "ledger" | "act";   // откуда взяты общие расходы: только реестр или акт по стоимости услуг
  // Сколько давал РЕЕСТР по этой паре кабинет/месяц до того, как его заместил акт. Акт замещает
  // реестр целиком (смешивать два источника одной статьи - двойной счёт), но где акт МЕНЬШЕ,
  // разница просто исчезала из P&L и никто об этом не узнавал: на снимке 2026-09-17 это 9 пар
  // из 14 и 14 534,67 ₽ (февраль по зеркалам: 8 731,67 -> 1 197,26). Держим число рядом, чтобы
  // страница могла сказать вслух, что расходы уменьшились сменой источника, а не делом.
  overhead_ledger: number;
  // Списания баллов УРОВНЯ КАБИНЕТА по отчёту о баллах (Полки, Буст за показы), величина без
  // знака. Это третий источник тех же расходов, и он не всегда сходится с актом: за август по
  // кабинету мебели акт дал 9 310 ₽ баллами, отчёт - 52 632 ₽; за сентябрь акта ещё нет вовсе,
  // а по отчёту кабинет потратил 40 094 ₽, и страница показывала «расходов кабинета нет».
  // Числа НЕ складываем (это был бы двойной счёт) - держим рядом и говорим о расхождении вслух.
  overhead_points_report: number;
  points_src: "orders" | "report"; // откуда взяты баллы: subsidies[] заказа или отчёт по баллам Маркета
  svc_points_src?: "ledger" | "report";  // откуда взято СПИСАНИЕ баллов за услуги по заказам
  svc_points_report?: number;            // сколько списано по отчёту (для сверки)
  points_report: number;           // начислено баллов по отчёту за этот месяц (для сверки с разнесённым)
  // Сколько баллов Маркет СПИСАЛ в этом календарном месяце по своему отчёту. Справочное число,
  // в расчёт не входит ни одной строкой. Оно НЕ равно сумме svc_points строк месяца и равняться
  // не должно: отчёт группирует списания по месяцу списания, свод - по месяцу заказа. Июль 2026:
  // 4 060 473 против 4 861 651. Держим рядом, потому что именно эти два числа один раз сравнили
  // между собой и приняли верное за завышенное.
  points_spent_report: number;
  svc_months: string[];           // из каких месяцев реестра взяты услуги этих заказов
  orders_without_ledger: number;  // заказы периода, которых в реестре ещё нет
  svc_settled: boolean;           // услуги месяца добраны: есть хотя бы один ЗАКРЫТЫЙ акт позже месяца заказа
  // Пробелы, которые иначе исчезли бы молча. Все три - деньги кабинета, не попавшие в свод.
  // Два разных диагноза, склеивать их нельзя: «другой статус» - нормальная работа базиса,
  // «заказа нет в выгрузке» - дыра в сборе заказов, и чинится она в другом месте.
  ledger_outside: number;         // сборы акта этого месяца по заказам вне свода, всего
  ledger_outside_orders: number;
  ledger_status: number;          // из них: заказ есть, но статус не DELIVERED
  ledger_missing: number;         // из них: заказа нет в orders.ndjson вообще
  ledger_missing_orders: number;
  // Заказы, которых НЕТ в выгрузке заказов, целиком: реестр платежей их знает, а карточки заказа
  // (дата, статус, штуки) нет, поэтому в свод они не попадают ни выручкой, ни услугами. ledger_missing
  // выше считает только СБОРЫ по ним, а это - НАЧИСЛЕНИЯ, то есть масштаб пробела для выручки.
  // Месяц берётся по первой проводке реестра: даты заказа у нас нет по определению.
  missing_accrued: number;
  missing_accrued_orders: number;
  // Незавершённость периода. Отменённые заказы - нормальный исход, а не незавершённость, поэтому
  // мерилом служат заказы, которые ЕЩЁ В ПУТИ: пока они есть, месяц продолжает набирать выручку.
  orders_period: number;     // оформлено всего в месяце, любой статус
  orders_inflight: number;   // из них ещё не доставлены и не отменены
  // Недоставленные заказы месяца ПО АРТИКУЛАМ. В расчёт не входят ни одной строкой: свод считает
  // только доставленное. Нужны, чтобы на экране было видно, чем месяц ещё дорастёт: сентябрь на
  // 17.09 показывает 36 доставленных штук при 116 заказах в пути, и без этой колонки он читается
  // как провал продаж, а не как незавершённый месяц.
  inflight_rows: Array<{ d: string; sku: string; units: number; price: number }>;
  points_on_delivery: number;     // доля начисленных баллов, осевшая на строке доставки
  cogs_cov: number;               // доля выручки деньгами, закрытая себестоимостью
}

const svcZero = () => { const o: Record<string, number> = {}; for (const [n] of SVC_COLUMNS) o[n] = 0; o[SVC_OTHER] = 0; return o; };

export interface ActRow { ym: string; business: string; service: string; money: number; points: number; order?: string; d?: string }
export interface BonusRow { ym: string; business: string; type?: string; src?: string; order?: string; sku?: string; amount: number }
// Что считать начислением баллов, решает ИСТОЧНИК проводки, а не знак суммы. По знаку в
// «начислено» попадал бы «Возврат списания» (+29 556 ₽ за июль) - сторно услуги, оплаченной
// баллами, то есть возврат ПОТРАЧЕННОГО, а не новое начисление; и выпадал бы «Возврат баллов за
// скидку Маркета» (-30 420 ₽), который начисление как раз уменьшает.
//
// Правило проверено на живой выгрузке за июль 2026 по кабинету мебели (fixtures/ym/bonuses-2026-07.json):
// начислено 2 296 335 + 55 713 - 30 420 = 2 321 628 ₽, потрачено на услуги 2 341 564 - 29 556 =
// 2 312 008 ₽, остаток 2 321 628 - 2 312 008 = 9 620 ₽ - ровно строка «Премия, предоставленная
// Исполнителем» в отчёте об исполнении поручения.
// «баллы за скидку» у начисления и «баллОВ за скидку» у его возврата - падеж разный, корень один.
const BONUS_ACCRUAL = /балл(ы|ов) за скидку/i;
const BONUS_SPEND = /скидк[аи].{0,30}совместн|совместн.{0,20}акци|оплата бонусами/i;  // оплата услуг баллами и сторно
export type BonusKind = "accrual" | "spend" | "other";
export function bonusKind(r: BonusRow): BonusKind {
  const src = String(r.src || "");
  if (BONUS_ACCRUAL.test(src)) return "accrual";
  if (BONUS_SPEND.test(src)) return "spend";
  return "other";
}
export const isBonusAccrual = (r: BonusRow) => bonusKind(r) === "accrual";
export function buildSvod(rows: OrderRow[], netting: NetFeeRow[] & Array<any>, cogs: Record<string, number>, today?: string, act: ActRow[] = [], bonus: BonusRow[] = []): SvodMonth[] {
  // Часть артикулов Маркет отдаёт с кириллическими двойниками в коде: «GGМ-16-4-3» с русской «М»,
  // «GGTP-20-2х2» с русской «х». В листе себестоимости таких кодов нет ни одного, поэтому прямой
  // ключ по ним не срабатывал никогда, и четыре артикула висели без С\С при том, что в листе она
  // есть. Спрашиваем лист сначала точным кодом, потом нормализованным.
  const cogsAt = (sku: string): number | undefined => {
    const v = cogs[sku];
    if (v != null) return v;
    const n = normSku(sku);
    return n === sku ? undefined : cogs[n];
  };
  // 1. отбор: заказы со статусом DELIVERED, месяц - по дате оформления
  const keyOf = (r: OrderRow) => `${r.business}|${String(r.created || "").slice(0, 7)}`;
  const delivered = new Map<string, string>();  // order -> ключ месяца
  for (const r of rows) if (!r.service && r.status === "DELIVERED" && r.created) delivered.set(r.order, keyOf(r));

  // 2. услуги реестра, разнесённые на заказ (и на SKU, где реестр его называет)
  type Svc = { col: string; points: boolean; amount: number; sku: string };
  const byOrder = new Map<string, Svc[]>();
  const svcMonths = new Map<string, Set<string>>();
  const overheadMoney = new Map<string, Record<string, number>>();
  const overheadPts = new Map<string, Record<string, number>>();
  const pointsOnDelivery = new Map<string, number>();
  const pointsAcc = new Map<string, number>();   // начислено баллов за месяц (ACCRUAL)
  const pointsDed = new Map<string, number>();   // списано при невыкупе и возврате (DEDUCTION)
  const outside = new Map<string, { sum: number; orders: Set<string>; status: number; missing: number; missingOrders: Set<string> }>();
  const knownOrders = new Set<string>(rows.map((r) => r.order));
  // Пробел выгрузки заказов. Считаем ДО разбора сборов, отдельным проходом: нужны строки
  // «Начисление», которые isNettingFee отбрасывает. Заказ относим к месяцу его первой проводки -
  // единственная дата, которая у нас про него есть.
  const missFirst = new Map<string, string>();
  for (const n of netting) {
    const ord = String(n.order || "").trim();
    if (!ord || knownOrders.has(ord)) continue;
    const key = `${String(n.business || "")}|${ord}`;
    const d = String(n.d || "").slice(0, 10);
    if (!d) continue;
    const cur = missFirst.get(key);
    if (!cur || d < cur) missFirst.set(key, d);
  }
  const missAcc = new Map<string, { sum: number; orders: Set<string> }>();
  for (const n of netting) {
    const ord = String(n.order || "").trim();
    if (!ord || knownOrders.has(ord)) continue;
    if (String(n.type || "") !== "Начисление") continue;
    const first = missFirst.get(`${String(n.business || "")}|${ord}`);
    if (!first) continue;
    const k = `${String(n.business || "")}|${first.slice(0, 7)}`;
    const cur = missAcc.get(k) || { sum: 0, orders: new Set<string>() };
    cur.sum = r2(cur.sum + (Number(n.amount) || 0)); cur.orders.add(ord);
    missAcc.set(k, cur);
  }
  let overheadRows: Array<{ business: string; d: string; col: string; points: boolean; amount: number }> = [];
  for (const n of netting) {
    if (!isNettingFee(String(n.type || ""), n.src)) continue;
    // Знак: в реестре удержание/списание приходит отрицательным, сторно («Возврат списания») -
    // положительным. Сбор - это то, что уменьшило счёт, поэтому берём -amount, а не модуль:
    // модуль превращал сторно в ещё один сбор и завышал статью вдвое от суммы сторно.
    const amount = -(Number(n.amount) || 0);
    if (!amount) continue;
    const col = svcColumn(String(n.service || ""));
    const points = isPointsPaid(String(n.type || ""), n.src);
    const ord = String(n.order || "").trim();
    if (ord && delivered.has(ord)) {
      const arr = byOrder.get(ord) || []; arr.push({ col, points, amount, sku: String(n.sku || "").trim() }); byOrder.set(ord, arr);
      const k = delivered.get(ord)!; const s = svcMonths.get(k) || new Set<string>(); s.add(String(n.d || "").slice(0, 7)); svcMonths.set(k, s);
    } else if (!ord) {
      overheadRows.push({ business: String(n.business || ""), d: String(n.d || ""), col, points, amount });
    } else {
      // Заказ есть, но в свод не идёт: другой статус (RETURNED, отмена в доставке, частичная
      // доставка) или заказа вовсе нет в выгрузке. Это деньги кабинета - их нельзя терять молча.
      const k = `${String(n.business || "")}|${String(n.d || "").slice(0, 7)}`;
      const cur = outside.get(k) || { sum: 0, orders: new Set<string>(), status: 0, missing: 0, missingOrders: new Set<string>() };
      cur.sum += amount; cur.orders.add(ord);
      if (knownOrders.has(ord)) cur.status += amount; else { cur.missing += amount; cur.missingOrders.add(ord); }
      outside.set(k, cur);
    }
  }

  // 3. агрегация по (кабинет, месяц, SKU)
  const months = new Map<string, SvodMonth>();
  const acc = new Map<string, SvodRow>();
  const orderSet = new Map<string, Set<string>>();
  const noLedger = new Map<string, Set<string>>();
  const baseOf = new Map<string, number>();   // сумма начислений заказа - для разнесения услуг

  // Возвраты и субсидии заказа свод разносит САМ, по стоимости позиций. Полагаться на разнесение
  // из снимка нельзя: оно шло по accruals, а у полностью возвращённой позиции accruals = 0, и её
  // возврат уезжал на соседний SKU (заказ 58875910850: весь -11 066 ₽ сел на GGT-12-2, хотя
  // возвращён был GGR-11-4). Снимок пересобирается ночным прогоном, а числа нужны верные сегодня.
  const orderRefund = new Map<string, number>();
  const orderSubsidy = new Map<string, number>();
  // Начисление и списание копим НА УРОВНЕ ЗАКАЗА, как и сальдо. Если считать их по строкам, до
  // которых доходит цикл, позиция-доставка в разбивку не попадёт, а в сальдо попадёт - и
  // «начислено минус списано» перестанет сходиться с показанными баллами (на июле это 160 763 ₽).
  const orderSubAcc = new Map<string, number>();
  const orderSubDed = new Map<string, number>();
  const orderBaseAll = new Map<string, number>();   // база субсидии: стоимость всех позиций заказа
  const orderRetBase = new Map<string, number>();   // база возврата: стоимость ВОЗВРАЩЁННОГО
  for (const r of rows) {
    if (!delivered.has(r.order)) continue;
    orderRefund.set(r.order, (orderRefund.get(r.order) || 0) + ((r.paid_by_type || {}).REFUND || 0));
    orderSubsidy.set(r.order, (orderSubsidy.get(r.order) || 0) + (r.subsidy || 0));
    orderSubAcc.set(r.order, (orderSubAcc.get(r.order) || 0) + (r.sub_acc || 0));
    orderSubDed.set(r.order, (orderSubDed.get(r.order) || 0) + (r.sub_ded || 0));
    orderBaseAll.set(r.order, (orderBaseAll.get(r.order) || 0) + (r.price || 0) * (r.count || 0));
    orderRetBase.set(r.order, (orderRetBase.get(r.order) || 0) + (r.price || 0) * (r.returned || 0));
  }

  const itemsOf = new Map<string, OrderRow[]>();
  for (const r of rows) {
    if (!delivered.has(r.order)) continue;
    if (r.service) continue;
    const a = itemsOf.get(r.order) || []; a.push(r); itemsOf.set(r.order, a);
    // База разнесения - стоимость позиции (цена × штуки), а не accruals: у полностью возвращённой
    // позиции accruals обнуляются, база заказа схлопывалась в ноль и услуги расходились равными
    // долями вместо пропорциональных.
    baseOf.set(r.order, (baseOf.get(r.order) || 0) + (r.price || 0) * (r.count || 0));
  }

  // Строка свода - это (кабинет, ДЕНЬ, артикул), а не (кабинет, месяц, артикул). Месячная
  // группировка была решением в коде, а не ограничением API: заказы и реестр платежей приходят
  // с датами, у акта услуг есть дата оказания. С днём свод можно посчитать за любой период,
  // а месяц получается суммированием своих дней. Объём не растёт лавинно: строк ровно столько,
  // сколько пар (заказ, артикул) в снимке, то есть порядка числа строк заказов.
  const touch = (k: string, r: OrderRow): SvodRow => {
    const day = String(r.created || "").slice(0, 10);
    const kk = `${k}|${day}|${r.sku}`;
    let s = acc.get(kk);
    if (!s) {
      s = { business: r.business, ym: k.split("|")[1]!, d: day, sku: r.sku, name: r.name, line: r.line,
        orders: 0, units_delivered: 0, units_returned: 0, units_net: 0,
        price: 0, ship_buyer: 0, disc_mp: 0, disc_plus: 0, buyer_pay: 0, refunds: 0, revenue_money: 0, points_accrued: 0,
        svc: svcZero(), svc_pts: svcZero(), svc_money: 0, svc_points: 0, svc_total: 0, result_money: 0, result_points: 0,
        cogs: 0, cogs_known: cogsAt(r.sku) != null };
      acc.set(kk, s);
    }
    return s;
  };

  for (const r of rows) {
    const k = delivered.get(r.order); if (!k) continue;
    if (!months.has(k)) months.set(k, { business: r.business, ym: k.split("|")[1]!, orders: 0, rows: [],
      overhead_money: 0, overhead_points: 0, overhead: {}, overhead_pts: {}, overhead_src: "ledger", overhead_ledger: 0, overhead_points_report: 0, points_src: "orders", points_report: 0, points_spent_report: 0, overhead_daily: {}, points_acc: 0, points_ded: 0, svc_months: [], orders_without_ledger: 0, svc_settled: false, ledger_outside: 0, ledger_outside_orders: 0, ledger_status: 0, ledger_missing: 0, ledger_missing_orders: 0, missing_accrued: 0, missing_accrued_orders: 0, orders_period: 0, orders_inflight: 0, inflight_rows: [], points_on_delivery: 0, cogs_cov: 0 });
    const os = orderSet.get(k) || new Set<string>(); os.add(r.order); orderSet.set(k, os);
    if (r.service) {
      // строка доставки: разносим по позициям заказа пропорционально начислениям
      const items = itemsOf.get(r.order) || []; const base = baseOf.get(r.order) || 0;
      // Доставка тоже берётся как цена × штуки: по accruals заказ с полным возвратом давал 0,
      // и июльская доставка по кабинету мебели выходила 234 800 ₽ вместо 243 800 ₽ кабинета.
      // Берём ТОЛЬКО долю покупателя: price строки доставки включает и MARKETPLACE, то есть
      // доставку, оплаченную Маркетом (заказы 59225193154 и 56864253122, 2 599 ₽ по снимку).
      // Показывать её платежом покупателя - ровно та ошибка, которую блок объявляет своим
      // отличием. Доля Маркета уходит в «Скидку Маркета», как у товарной строки.
      const ship = (r.p_buyer || 0) * (r.count || 0);
      const shipMp = ((r.p_mp || 0) + (r.p_cashback || 0) + (r.p_spasibo || 0)) * (r.count || 0);
      const droppedPts = (orderBaseAll.get(r.order) || 0) > 0
        ? (orderSubsidy.get(r.order) || 0) * ((r.price || 0) * (r.count || 0)) / (orderBaseAll.get(r.order) || 1) : 0;
      for (const it of items) {
        const share = base > 0 ? (it.price || 0) * (it.count || 0) / base : 1 / (items.length || 1);
        const s2 = touch(k, it);
        s2.ship_buyer += ship * share;
        s2.disc_mp += shipMp * share;
      }
      if (droppedPts) pointsOnDelivery.set(k, (pointsOnDelivery.get(k) || 0) + droppedPts);
      continue;
    }
    const s = touch(k, r);
    // price/p_buyer/p_mp/p_cashback/p_spasibo в строке заказа - цена ЗА ШТУКУ (derive-lib.ts:74).
    // Без × count позиция из двух штук давала выручку одной: по снимку это 576 279 ₽ недосчёта,
    // а у отдельных SKU переворачивался знак маржи. Контр-эталон внутри того же API:
    // Σ(p_buyer × count) + Σ(доставка × count) = Σ paid_by_type.PAYMENT, Δ=0 по всем 14 парам
    // (кабинет, месяц). Возвраты и субсидии умножать НЕ надо - это уже разнесённые суммы.
    const n = r.count || 0;
    s.units_delivered += (r.delivered || 0) + (r.returned || 0);
    s.units_returned += r.returned || 0;
    s.price += (r.price || 0) * n;
    s.disc_mp += (r.p_mp || 0) * n;
    s.disc_plus += ((r.p_cashback || 0) + (r.p_spasibo || 0)) * n;
    s.buyer_pay += (r.p_buyer || 0) * n;
    // Возврат заказа целиком ложится на товарные позиции пропорционально их стоимости; субсидия -
    // пропорционально стоимости позиции в полной базе заказа, поэтому доля строки доставки в свод
    // не попадает (она раскрыта отдельно в points_on_delivery).
    // Возврат платят за ВОЗВРАЩЁННЫЕ штуки, поэтому он разносится по их стоимости, а не по
    // стоимости позиции: иначе возврат за один SKU размазывался по всему заказу. Если в заказе
    // ничего не возвращено, а возврат есть (отмена в доставке), падаем на стоимость позиции.
    const items = itemsOf.get(r.order) || [];
    const retBase = orderRetBase.get(r.order) || 0;
    const itemBase = items.reduce((a, i) => a + (i.price || 0) * (i.count || 0), 0);
    const mineRet = (r.price || 0) * (r.returned || 0);
    const mine = (r.price || 0) * n;
    s.refunds += retBase > 0 ? (orderRefund.get(r.order) || 0) * (mineRet / retBase)
      : (itemBase > 0 ? (orderRefund.get(r.order) || 0) * (mine / itemBase) : 0);
    // Субсидия разносится по той же базе, что и всё остальное в своде - стоимость позиции
    // (цена × штуки). База одна на весь блок, чтобы её нельзя было подобрать под желаемый итог.
    // Цена этого решения названа в YM_SVOD_RECON.md: по июлю/мебели выходит +2,7% к кабинету,
    // тогда как база accruals давала -2,3%, а прежнее равнодолевое разнесение +0,34%. Какая из
    // трёх верна, из наших данных не определяется - вопрос открыт на ДАТУ.
    const baseAll = orderBaseAll.get(r.order) || 0;
    // Начисление и списание копим по отдельности: в свод идёт сальдо (r.subsidy = ACCRUAL минус
    // DEDUCTION), но пользователю надо видеть, что списание вообще было. До правки operationType
    // игнорировался, и списание ПРИБАВЛЯЛОСЬ к начислению - отсюда завышение баллов на 2.7%.
    if (baseAll > 0) {
      const sh = mine / baseAll;
      pointsAcc.set(k, (pointsAcc.get(k) || 0) + (orderSubAcc.get(r.order) || 0) * sh);
      pointsDed.set(k, (pointsDed.get(k) || 0) + (orderSubDed.get(r.order) || 0) * sh);
    }
    s.points_accrued += baseAll > 0 ? (orderSubsidy.get(r.order) || 0) * (mine / baseAll) : 0;
    if (cogsAt(r.sku) != null) s.cogs += cogsAt(r.sku)! * ((r.delivered || 0) + (r.returned || 0) - (r.returned || 0));
  }

  // 4. услуги заказа -> позиции
  for (const [ord, k] of delivered) {
    const list = byOrder.get(ord);
    const items = itemsOf.get(ord) || [];
    if (!list || !list.length) { const n = noLedger.get(k) || new Set<string>(); n.add(ord); noLedger.set(k, n); continue; }
    const base = baseOf.get(ord) || 0;
    for (const sv of list) {
      const direct = sv.sku ? items.filter((i) => i.sku === sv.sku) : [];
      const targets = direct.length ? direct : items;
      const tb = targets.reduce((a, i) => a + (i.price || 0) * (i.count || 0), 0);
      for (const it of targets) {
        const share = tb > 0 ? (it.price || 0) * (it.count || 0) / tb : 1 / (targets.length || 1);
        const s = touch(k, it);
        const part = sv.amount * share;
        if (sv.points) { s.svc_pts[sv.col] = (s.svc_pts[sv.col] || 0) + part; s.svc_points += part; }
        else { s.svc[sv.col] = (s.svc[sv.col] || 0) + part; s.svc_money += part; }
      }
    }
  }

  // 5. общие расходы кабинета (подписки, полки, баннеры) - к заказу не привязаны.
  // Месяц, где расходы есть, а доставленных заказов нет, заводим отдельно: раньше такие расходы
  // (11 392 ₽ по кабинету зеркал за февраль и март) исчезали, потому что пары (кабинет, месяц)
  // просто не существовало.
  for (const o of overheadRows) {
    const k = `${o.business}|${o.d.slice(0, 7)}`;
    let m = months.get(k);
    if (!m) {
      m = { business: o.business, ym: o.d.slice(0, 7), orders: 0, rows: [], overhead_money: 0, overhead_points: 0,
        overhead: {}, overhead_pts: {}, overhead_src: "ledger", overhead_ledger: 0, overhead_points_report: 0, points_src: "orders", points_report: 0, points_spent_report: 0, overhead_daily: {}, points_acc: 0, points_ded: 0, svc_months: [], orders_without_ledger: 0, svc_settled: false,
        ledger_outside: 0, ledger_outside_orders: 0, ledger_status: 0, ledger_missing: 0, ledger_missing_orders: 0, missing_accrued: 0, missing_accrued_orders: 0,
        orders_period: 0, orders_inflight: 0, inflight_rows: [], points_on_delivery: 0, cogs_cov: 0 };
      months.set(k, m);
    }
    const bag = o.points ? overheadPts : overheadMoney;
    const r = bag.get(k) || {}; r[o.col] = (r[o.col] || 0) + o.amount; bag.set(k, r);
    if (o.points) m.overhead_points += o.amount; else m.overhead_money += o.amount;
    const dd = m.overhead_daily[o.d] || (m.overhead_daily[o.d] = { m: 0, p: 0, c: {} });
    const dc = (dd.c ||= {}); const cc = dc[o.col] || (dc[o.col] = [0, 0]);
    if (o.points) { dd.p += o.amount; cc[1] = r2(cc[1] + o.amount); } else { dd.m += o.amount; cc[0] = r2(cc[0] + o.amount); }
  }

  // Баллы из отчёта по баллам Маркета. Это источник кабинета, а subsidies[] заказа - производная
  // от него, которую нам приходилось разносить самим (см. открытый вопрос про базу: три варианта
  // давали +2,7% / -2,3% / +0,34% к кабинету). Где отчёт есть, месячный итог берётся из него, а
  // разнесение по позициям остаётся пропорциональным стоимости: сумма по месяцу при этом ровно
  // кабинетная, а не наша.
  const bonusBy = new Map<string, number>();
  // Начисление и возврат начисления считаем ПО ОТДЕЛЬНОСТИ, а не только сальдо. Раскрытие на
  // странице показывает «начислено» и «списано», и их разность обязана давать показанную сумму
  // баллов. Пока сальдо бралось из отчёта, а разбивка оставалась от subsidies[] заказа, это были
  // числа из двух разных источников: за июль по кабинету мебели отчёт давал 2 321 628, а разбивка
  // 2 626 846 минус 79 631 - разность не сходилась ни с чем на экране.
  const bonusAcc = new Map<string, number>();   // положительные начисления
  const bonusRet = new Map<string, number>();   // возврат начисления (величина, без знака)
  for (const r of bonus) {
    if (bonusKind(r) !== "accrual") continue;   // знак сохраняем: возврат баллов начисление уменьшает
    const k = `${r.business}|${r.ym}`;
    const v = Number(r.amount) || 0;
    bonusBy.set(k, (bonusBy.get(k) || 0) + v);
    if (v >= 0) bonusAcc.set(k, (bonusAcc.get(k) || 0) + v);
    else bonusRet.set(k, (bonusRet.get(k) || 0) - v);
  }
  for (const [k, v] of bonusBy) if (v <= 0) bonusBy.delete(k);   // ноль или минус за месяц - не масштабируем
  // Списания баллов уровня кабинета: строки отчёта БЕЗ номера заказа с тратой (Полки, Буст за
  // показы). К заказу они не привязаны, поэтому в разнесение по позициям не идут - это общие
  // расходы, и увидеть их можно только здесь.
  // Списание баллов по заказам в разрезе МЕСЯЦА ОТЧЁТА - только для показа рядом, см. поле
  // points_spent_report. Строки уровня кабинета (Полки, Буст за показы) сюда не идут: они в
  // общих расходах и считаются отдельно, ниже.
  const bonusSpentRep = new Map<string, number>();
  for (const r of bonus) {
    if (bonusKind(r) !== "spend") continue;
    if (!String((r as any).order || "").trim()) continue;
    const k = `${r.business}|${r.ym}`;
    bonusSpentRep.set(k, r2((bonusSpentRep.get(k) || 0) - (Number(r.amount) || 0)));
  }
  const bonusCab = new Map<string, number>();
  for (const r of bonus) {
    if (bonusKind(r) !== "spend") continue;
    if (String((r as any).order || "").trim()) continue;
    const v = Number(r.amount) || 0;
    if (v >= 0) continue;                       // сторно уменьшает трату, а не добавляет её
    const k = `${r.business}|${r.ym}`;
    bonusCab.set(k, (bonusCab.get(k) || 0) - v);
  }

  // Общие расходы из акта по стоимости услуг. Реестр платежей несёт только оплаченные ДЕНЬГАМИ
  // (живой июль 2026: 6 строк на 36 875 ₽, ни одной оплаченной баллами), а полки, подписки,
  // баннеры и буст за показы в акте дают 81 495 ₽, из них 15 051 ₽ закрыто баллами. Где акт есть,
  // он замещает реестровые общие расходы целиком: смешивать два источника одной статьи - двойной
  // счёт. Где акта нет, остаётся реестр, и месяц честно помечен overhead_src.
  const actBy = new Map<string, ActRow[]>();
  for (const a of act) {
    if (String(a.order || "").trim()) continue;   // услуга привязана к заказу - её несёт реестр
    const k = `${a.business}|${a.ym}`;
    const arr = actBy.get(k) || []; arr.push(a); actBy.set(k, arr);
  }
  for (const [k, list] of actBy) {
    let m = months.get(k);
    if (!m) {
      const [business, ym] = k.split("|") as [string, string];
      m = { business, ym, orders: 0, rows: [], overhead_money: 0, overhead_points: 0, overhead: {}, overhead_pts: {},
        overhead_src: "ledger", overhead_ledger: 0, overhead_points_report: 0, points_src: "orders", points_report: 0, points_spent_report: 0, overhead_daily: {}, points_acc: 0, points_ded: 0, svc_months: [], orders_without_ledger: 0, svc_settled: false, ledger_outside: 0,
        ledger_outside_orders: 0, ledger_status: 0, ledger_missing: 0, ledger_missing_orders: 0, missing_accrued: 0, missing_accrued_orders: 0,
        orders_period: 0, orders_inflight: 0, inflight_rows: [], points_on_delivery: 0, cogs_cov: 0 };
      months.set(k, m);
    }
    // Запоминаем реестровый итог ДО замещения: только так потом видно, что смена источника
    // уменьшила расходы, а не бизнес.
    m.overhead_ledger = r2(m.overhead_money + m.overhead_points);
    m.overhead_src = "act"; m.overhead_money = 0; m.overhead_points = 0;
    // Акт заменяет реестр целиком, поэтому и дневную разбивку пересобираем по датам акта,
    // а не дописываем к прежней - иначе расходы дня посчитались бы дважды.
    m.overhead_daily = {};
    const om: Record<string, number> = {}, op: Record<string, number> = {};
    for (const a of list) {
      const col = svcColumn(a.service);
      const ad = a.d || `${a.ym}-28`;   // строка акта без даты - на конец месяца, чтобы не потерялась
      const dd = m.overhead_daily[ad] || (m.overhead_daily[ad] = { m: 0, p: 0, c: {} });
      const dc = (dd.c ||= {}); const cc = dc[col] || (dc[col] = [0, 0]);
      if (a.money) { om[col] = r2((om[col] || 0) + a.money); m.overhead_money = r2(m.overhead_money + a.money); dd.m = r2(dd.m + a.money); cc[0] = r2(cc[0] + a.money); }
      if (a.points) { op[col] = r2((op[col] || 0) + a.points); m.overhead_points = r2(m.overhead_points + a.points); dd.p = r2(dd.p + a.points); cc[1] = r2(cc[1] + a.points); }
    }
    overheadMoney.set(k, om); overheadPts.set(k, op);
  }

  // Баллы за Полку и Буст за показы - в общие расходы кабинета (решение Ивана 2026-09-17).
  // Источник балльной ноги по этим двум статьям - отчёт о баллах, а не акт: в акте колонка
  // BONUS_PAID заполнена частично (по 8 парам кабинет/месяц из 13 там ноль при непустом отчёте),
  // и там, где она заполнена, отчёт всегда БОЛЬШЕ - август/мебель 9 262,44 против 52 631,71.
  // Поэтому ЗАМЕЩАЕМ, а не складываем: сложение посчитало бы часть дважды. Отчёт при этом
  // сходится сам с собой в ноль (начислено = потрачено − возвращено), то есть он полный.
  // Где отчёт за пару не собран, остаётся то, что дал акт: пустой отчёт не повод терять число.
  // Статьи, которыми управляет отчёт. Берём из самих данных, а не списком в коде: заведёт Маркет
  // третью кабинетную услугу с оплатой баллами - она попадёт сюда сама.
  const cabCols = new Set<string>();
  const cabPts = new Map<string, Map<string, number>>();          // кабинет|месяц -> колонка -> сумма
  const cabPtsDaily = new Map<string, Map<string, Map<string, number>>>(); // + разбивка по дням
  const bonusHave = new Set<string>(bonus.map((r) => `${r.business}|${r.ym}`));
  for (const r of bonus) {
    if (bonusKind(r) !== "spend") continue;
    if (String((r as any).order || "").trim()) continue;
    const v = Number(r.amount) || 0;
    if (v >= 0) continue;                       // сторно уменьшает трату, а не добавляет
    const k = `${r.business}|${r.ym}`;
    const col = svcColumn(String((r as any).service || ""));
    cabCols.add(col);
    const byCol = cabPts.get(k) || new Map<string, number>();
    byCol.set(col, r2((byCol.get(col) || 0) - v)); cabPts.set(k, byCol);
    const d = String((r as any).d || "") || `${r.ym}-${String(new Date(Date.UTC(+r.ym.slice(0, 4), +r.ym.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
    const byDay = cabPtsDaily.get(k) || new Map<string, Map<string, number>>();
    const dayCols = byDay.get(d) || new Map<string, number>();
    dayCols.set(col, r2((dayCols.get(col) || 0) - v)); byDay.set(d, dayCols); cabPtsDaily.set(k, byDay);
  }
  for (const [k, byCol] of cabPts) {
    if (!bonusHave.has(k)) continue;
    let m = months.get(k);
    if (!m) {
      const [business, ym] = k.split("|") as [string, string];
      m = { business, ym, orders: 0, rows: [], overhead_money: 0, overhead_points: 0, overhead: {}, overhead_pts: {},
        overhead_src: "ledger", overhead_ledger: 0, overhead_points_report: 0, points_src: "orders", points_report: 0, points_spent_report: 0,
        overhead_daily: {}, points_acc: 0, points_ded: 0, svc_months: [], orders_without_ledger: 0, svc_settled: false,
        ledger_outside: 0, ledger_outside_orders: 0, ledger_status: 0, ledger_missing: 0, ledger_missing_orders: 0, missing_accrued: 0, missing_accrued_orders: 0,
        orders_period: 0, orders_inflight: 0, inflight_rows: [], points_on_delivery: 0, cogs_cov: 0 };
      months.set(k, m);
    }
    const op = overheadPts.get(k) || {};
    // Замещаем ОБЕ статьи целиком, а не только встретившиеся в этом месяце. Иначе снова выходит
    // смешение источников внутри одной пары: за июль по мебели отчёт знал только Полки, и рядом
    // оставался Буст из акта (7 508,86). Отчёт по паре либо источник по этим статьям целиком,
    // либо не источник вовсе. Прочих статей (Товарные баннеры) отчёт не покрывает - их не трогаем.
    for (const col of cabCols) op[col] = byCol.get(col) || 0;
    overheadPts.set(k, op);
    // Дневная разбивка по этим же статьям - из дат отчёта.
    for (const dd of Object.values(m.overhead_daily)) {
      const c = dd.c || {};
      for (const col of cabCols) if (c[col]) { dd.p = r2(dd.p - c[col]![1]); c[col]![1] = 0; }
    }
    for (const [d, dayCols] of cabPtsDaily.get(k) || []) {
      const dd = m.overhead_daily[d] || (m.overhead_daily[d] = { m: 0, p: 0, c: {} });
      const c = (dd.c ||= {});
      for (const [col, v] of dayCols) { const cc = c[col] || (c[col] = [0, 0]); cc[1] = r2(cc[1] + v); dd.p = r2(dd.p + v); }
    }
    m.overhead_points = r2([...Object.values(op)].reduce((a, v) => a + v, 0));
  }

  // Сборы акта по заказам вне свода. Пара (кабинет, месяц акта) может вообще не иметь
  // доставленных заказов - тогда месяц заводится ради самой суммы, иначе 301 937 ₽ по снимку
  // оставались бы невидимыми.
  for (const [k, out] of outside) {
    let m = months.get(k);
    if (!m) {
      const [business, ym] = k.split("|") as [string, string];
      m = { business, ym, orders: 0, rows: [], overhead_money: 0, overhead_points: 0, overhead: {}, overhead_pts: {}, overhead_src: "ledger", overhead_ledger: 0, overhead_points_report: 0, points_src: "orders", points_report: 0, points_spent_report: 0, overhead_daily: {}, points_acc: 0, points_ded: 0,
        svc_months: [], orders_without_ledger: 0, svc_settled: false, ledger_outside: 0, ledger_outside_orders: 0,
        ledger_status: 0, ledger_missing: 0, ledger_missing_orders: 0, missing_accrued: 0, missing_accrued_orders: 0, orders_period: 0, orders_inflight: 0, inflight_rows: [], points_on_delivery: 0, cogs_cov: 0 };
      months.set(k, m);
    }
    m.ledger_outside = r2(out.sum); m.ledger_outside_orders = out.orders.size;
    m.ledger_status = r2(out.status); m.ledger_missing = r2(out.missing); m.ledger_missing_orders = out.missingOrders.size;
  }
  // Начисления потерянных заказов раскладываем своим проходом: пара кабинет/месяц может не иметь
  // ни доставленных заказов, ни сборов акта, и тогда цикл выше до неё не доходит.
  for (const [k, a] of missAcc) {
    const m = months.get(k);
    if (!m) continue;   // месяцев вне окна свода не заводим: там нечего показывать рядом
    m.missing_accrued = r2(a.sum); m.missing_accrued_orders = a.orders.size;
  }

  for (const s of acc.values()) {
    s.units_net = s.units_delivered - s.units_returned;
    s.revenue_money = r2(s.buyer_pay + s.ship_buyer + s.refunds);
    s.svc_total = r2(s.svc_money + s.svc_points);
    s.result_money = r2(s.revenue_money - s.svc_money);
    s.result_points = r2(s.revenue_money + s.points_accrued - s.svc_total);
    for (const c of Object.keys(s.svc)) s.svc[c] = r2(s.svc[c]!);
    for (const c of Object.keys(s.svc_pts)) s.svc_pts[c] = r2(s.svc_pts[c]!);
    s.price = r2(s.price); s.ship_buyer = r2(s.ship_buyer); s.disc_mp = r2(s.disc_mp); s.disc_plus = r2(s.disc_plus);
    s.buyer_pay = r2(s.buyer_pay + s.ship_buyer); s.refunds = r2(s.refunds); s.points_accrued = r2(s.points_accrued);
    s.svc_money = r2(s.svc_money); s.svc_points = r2(s.svc_points); s.cogs = r2(s.cogs);
    const k = `${s.business}|${s.ym}`; months.get(k)!.rows.push(s);
  }
  // Часть услуг по заказу начисляется в акте СЛЕДУЮЩЕГО месяца (доставка, средняя миля, штрафы).
  // Пока такого закрытого акта нет, услуги месяца неполные, а результат по нему завышен. Это ровно
  // тот пробел, который свод Кати за июль честно назвал «нет данных» по августовскому акту.
  const nowYm = String(today || new Date().toISOString().slice(0, 10)).slice(0, 7);
  // Акты считаем по своему кабинету: чужой закрытый акт ничего не говорит о полноте этого.
  const actMonths = new Map<string, Set<string>>();
  for (const n of netting) {
    if (!isNettingFee(String(n.type || ""), n.src)) continue;
    const b = String(n.business || ""); const set = actMonths.get(b) || new Set<string>();
    set.add(String(n.d || "").slice(0, 7)); actMonths.set(b, set);
  }
  // Сколько заказов месяца оформлено всего (любой статус) - без этого текущий месяц выглядит
  // как обычный, хотя половина заказов ещё в доставке.
  const periodOrders = new Map<string, Set<string>>();
  const inflightOrders = new Map<string, Set<string>>();
  const inflightBySku = new Map<string, Array<{ d: string; sku: string; units: number; price: number }>>();
  const DONE = /^(DELIVERED|RETURNED|CANCELLED)/;
  for (const r of rows) {
    if (r.service || !r.created) continue;
    const k = `${r.business}|${r.created.slice(0, 7)}`;
    const set = periodOrders.get(k) || new Set<string>(); set.add(r.order); periodOrders.set(k, set);
    if (!DONE.test(String(r.status || ""))) {
      const f = inflightOrders.get(k) || new Set<string>(); f.add(r.order); inflightOrders.set(k, f);
      // Те же заказы, но по артикулам и штукам. Штуки берём заказанные (count): доставленных у
      // них по определению нет. Цену - как она стоит в заказе, это ещё не выручка, а ожидание.
      const units = Number(r.count) || 0;
      if (units > 0) {
        const a = inflightBySku.get(k) || []; inflightBySku.set(k, a);
        a.push({ d: String(r.created).slice(0, 10), sku: String(r.sku || ""), units, price: Number(r.price) || 0 });
      }
    }
  }
  // Где отчёт по баллам есть, месячный итог приводим к нему: доли по позициям остаются нашими,
  // а сумма становится кабинетной. Это снимает вопрос выбора базы разнесения с итога - он
  // остаётся только внутри месяца, между артикулами.
  for (const [k, m] of months) {
    const want = bonusBy.get(k);
    if (want == null) continue;
    m.points_src = "report"; m.points_report = r2(want);
    const have = m.rows.reduce((a, r) => a + r.points_accrued, 0);
    if (have > 0) { const f = want / have; for (const r of m.rows) r.points_accrued = r2(r.points_accrued * f); }
    else if (m.rows.length) {
      const base = m.rows.reduce((a, r) => a + r.revenue_money, 0);
      for (const r of m.rows) r.points_accrued = r2(base > 0 ? want * (r.revenue_money / base) : want / m.rows.length);
    }
    // Результат с учётом баллов держится на points_accrued, поэтому пересчитываем его здесь же:
    // иначе в строке остался бы итог, посчитанный по старым, не кабинетным баллам.
    for (const r of m.rows) r.result_points = r2(r.revenue_money + r.points_accrued - r.svc_total);
  }
  for (const [k, m] of months) {
    m.orders = (orderSet.get(k) || new Set()).size;
    m.orders_period = (periodOrders.get(k) || new Set()).size;
    m.orders_inflight = (inflightOrders.get(k) || new Set()).size;
    {
      const agg = new Map<string, { d: string; sku: string; units: number; price: number }>();
      for (const x of inflightBySku.get(k) || []) {
        const kk = `${x.d}|${x.sku}`;
        const a = agg.get(kk) || { d: x.d, sku: x.sku, units: 0, price: 0 };
        a.units += x.units; a.price = r2(a.price + x.price); agg.set(kk, a);
      }
      m.inflight_rows = [...agg.values()].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
    }
    m.svc_settled = [...(actMonths.get(m.business) || new Set<string>())].some((a) => a > m.ym && a < nowYm);
    m.orders_without_ledger = (noLedger.get(k) || new Set()).size;
    m.svc_months = [...(svcMonths.get(k) || new Set<string>())].sort();
    m.overhead = overheadMoney.get(k) || {}; m.overhead_pts = overheadPts.get(k) || {};
    m.points_on_delivery = r2(pointsOnDelivery.get(k) || 0);
    // Раскрытие берётся из ТОГО ЖЕ источника, что и сами баллы строк. Где месяц приведён к
    // отчёту, subsidies[] заказа для раскрытия уже не годится: разность его начислений и списаний
    // не даст кабинетную сумму, которая стоит в колонке. Тождество, на котором держится проверка:
    // points_acc - points_ded = points_report = сумма points_accrued строк.
    if (m.points_src === "report") {
      m.points_acc = r2(bonusAcc.get(k) || 0);
      m.points_ded = r2(bonusRet.get(k) || 0);
    } else {
      m.points_acc = r2(pointsAcc.get(k) || 0);
      m.points_ded = r2(pointsDed.get(k) || 0);
    }
    m.overhead_money = r2(m.overhead_money); m.overhead_points = r2(m.overhead_points);
    m.overhead_points_report = r2(bonusCab.get(k) || 0);
    m.points_spent_report = r2(bonusSpentRep.get(k) || 0);
    m.rows.sort((a, b) => b.revenue_money - a.revenue_money);
    const rev = m.rows.reduce((a, r) => a + r.revenue_money, 0);
    const covered = m.rows.filter((r) => r.cogs_known).reduce((a, r) => a + r.revenue_money, 0);
    m.cogs_cov = rev > 0 ? Math.round((covered / rev) * 1000) / 10 : 0;
  }
  return [...months.values()].sort((a, b) => (a.ym === b.ym ? a.business.localeCompare(b.business) : b.ym.localeCompare(a.ym)));
}
