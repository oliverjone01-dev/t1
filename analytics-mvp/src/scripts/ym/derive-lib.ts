// Чистая логика Маркета (без сети и файлов, тестируется): заказ API -> строки факта,
// строки факта -> файлы контракта снимков OZON (history/daily_totals/skus_live/pnl_*).
// Контракт = атом 1 эпизода feniks-veto-uploaded-docs-20260610: те же имена файлов и поля,
// плюс platform="ym". Дашборды не переписываются - читают data-ym/ через DATA_DIR.
import type { YmOrder } from "../../connector/ym-partner.js";
import { ymDate } from "../../connector/ym-partner.js";
import { lineOf } from "../../util/line.js";

export const PLATFORM = "ym" as const;

// Статусы заказа Маркета (stats/orders). Отменённые - без денег и без единиц в доставке.
export const CANCELLED_STATUSES = new Set(["CANCELLED_BEFORE_PROCESSING", "CANCELLED_IN_DELIVERY", "CANCELLED_IN_PROCESSING", "REJECTED", "UNPAID"]);
// Доставленные (деньги начислены): доставлен, частично возвращён, возвращён целиком.
export const DELIVERED_STATUSES = new Set(["DELIVERED", "PARTIALLY_RETURNED", "RETURNED"]);

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
  fees: Record<string, number>; fee_total: number; payout: number; fee_actual: boolean;
  paid: number; fake: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Заказ API -> строки по позициям. Комиссии уровня заказа разносим по позициям пропорционально
// начислениям (равными долями, если начислений нет). actual предпочтительнее predicted.
export function normalizeOrder(o: YmOrder, campaignId: string, businessId: string): OrderRow[] {
  const types = revenuePriceTypes();
  const created = ymDate(o.creationDate), statusDate = ymDate(o.statusUpdateDate) || created;
  const cancelled = CANCELLED_STATUSES.has(o.status);
  const deliveredSet = DELIVERED_STATUSES.has(o.status);
  const fin = deliveredSet ? statusDate : created;

  const items = o.items.map((it) => {
    const per = (t: string) => it.prices.filter((p) => p.type.toUpperCase() === t).reduce((s, p) => s + p.costPerItem, 0);
    const price = it.prices.filter((p) => types.has(p.type.toUpperCase())).reduce((s, p) => s + p.costPerItem, 0);
    const returned = it.details.filter((d) => d.itemStatus === "RETURNED").reduce((s, d) => s + d.itemCount, 0) || (o.status === "RETURNED" ? it.count : 0);
    const rejected = it.details.filter((d) => d.itemStatus === "REJECTED").reduce((s, d) => s + d.itemCount, 0);
    const units = Math.max(it.initialCount || it.count, it.count + rejected);
    const count = it.count;
    const delivered = deliveredSet ? Math.max(0, count - returned) : 0;
    const cancelledUnits = cancelled ? units : rejected;
    const revenue = cancelled ? 0 : r2(price * count);
    const accruals = deliveredSet ? r2(price * Math.max(0, count - returned)) : 0;
    return { it, price, p_buyer: per("BUYER"), p_mp: per("MARKETPLACE"), p_cashback: per("CASHBACK"), p_spasibo: per("SPASIBO"), returned, units, count, delivered, cancelledUnits, revenue, accruals };
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
  const paidTotal = o.payments.reduce((s, p) => s + (p.type === "REFUND" ? -p.total : p.total), 0);
  const base = items.reduce((s, x) => s + x.accruals, 0);
  const n = items.length || 1;

  return items.map((x) => {
    const share = base > 0 ? x.accruals / base : 1 / n;
    const f: Record<string, number> = {};
    let ft = 0;
    // сборы относим только к доставленным позициям (по недоставленным Маркет ещё ничего не списал)
    if (deliveredSet) for (const [g, v] of Object.entries(fees)) { const a = r2(v * share); if (a) { f[g] = a; ft += a; } }
    ft = r2(ft);
    return {
      platform: PLATFORM, business: businessId, campaign: campaignId, order: o.id,
      created, statusDate, status: o.status, fin,
      sku: x.it.shopSku || x.it.marketSku, market_sku: x.it.marketSku, name: x.it.offerName, line: lineOf(x.it.offerName),
      units: x.units, count: x.count, delivered: x.delivered, returned: x.returned, cancelled: x.cancelledUnits,
      price: r2(x.price), p_buyer: r2(x.p_buyer), p_mp: r2(x.p_mp), p_cashback: r2(x.p_cashback), p_spasibo: r2(x.p_spasibo),
      revenue: x.revenue, accruals: x.accruals,
      fees: f, fee_total: ft, payout: deliveredSet ? r2(x.accruals - ft) : 0, fee_actual: feeActual,
      paid: r2(paidTotal * share), fake: !!o.fake,
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
export interface Fact { date: string; sku: string; offer_id: string | null; name: string; line: string; revenue: number; units: number; views: number; to_cart: number; delivered: number; returns: number; cancellations: number; platform: "ym"; market_sku?: string }

export function buildHistory(rows: OrderRow[], floor: string, to: string, viewsBy?: Map<string, { views: number; cart: number }>): Fact[] {
  const m = new Map<string, Fact>();
  for (const r of real(rows)) {
    if (r.created < floor || r.created > to) continue;
    const k = `${r.created}|${r.sku}`;
    const f = m.get(k) || { date: r.created, sku: r.sku, offer_id: r.sku, name: r.name, line: r.line, revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, platform: PLATFORM, market_sku: r.market_sku };
    f.revenue = Math.round(f.revenue + r.revenue); f.units += r.units; f.delivered += r.delivered; f.returns += r.returned; f.cancellations += r.cancelled;
    if (!f.name && r.name) f.name = r.name;
    m.set(k, f);
  }
  if (viewsBy) for (const [k, v] of viewsBy) { const f = m.get(k); if (f) { f.views += v.views; f.to_cart += v.cart; } }
  const days = new Set([...m.values()].map((f) => f.date));
  for (const d of daysBetween(floor, to)) if (!days.has(d)) m.set(`${d}|__empty__`, { date: d, sku: "__empty__", offer_id: null, name: "", line: "прочее", revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, platform: PLATFORM });
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sku < b.sku ? -1 : 1));
}

// ---------- daily_totals.ndjson ----------
export interface DayTot { date: string; revenue: number; units: number; views: number; views_search: number; pdp_views: number; to_cart: number; delivered: number; returns: number; cancellations: number; platform: "ym" }
export function buildDailyTotals(facts: Fact[], floor: string, to: string, dayViews?: Map<string, { views: number; vsearch: number; pdp: number; cart: number }>): DayTot[] {
  const m = new Map<string, DayTot>();
  for (const d of daysBetween(floor, to)) m.set(d, { date: d, revenue: 0, units: 0, views: 0, views_search: 0, pdp_views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0, platform: PLATFORM });
  for (const f of facts) { const t = m.get(f.date); if (!t || f.sku === "__empty__") continue; t.revenue += f.revenue; t.units += f.units; t.delivered += f.delivered; t.returns += f.returns; t.cancellations += f.cancellations; }
  if (dayViews) for (const [d, v] of dayViews) { const t = m.get(d); if (t) { t.views = v.views; t.views_search = v.vsearch; t.pdp_views = v.pdp; t.to_cart = v.cart; } }
  return [...m.values()];
}

// ---------- skus_live_30d.json ----------
export interface CatalogLike { items: Record<string, { name?: string; marketSku?: string; category?: string; price?: number | null; stock?: number; business?: string }> }
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
      offer: a.sku, stock: c.stock || 0, pidx: null as number | null, pcol: "", price: c.price != null ? Math.round(c.price) : null,
      oos: (a.units > 0 && (c.stock || 0) <= 0) ? 1 : 0, market_sku: c.marketSku || "", business: c.business || "", platform: PLATFORM,
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
    const t = m.get(k) || { d: r.fin, sku: r.sku, accruals: 0, commission: 0, delivery: 0, acquiring: 0, storage: 0, otherSvc: 0, amount: 0, platform: PLATFORM };
    t.accruals += r.accruals; t.amount += r.payout;
    for (const [g, v] of Object.entries(r.fees)) {
      if (g === "Комиссия за продажу") t.commission -= v; else if (g === "Логистика (прямая+возвратная)") t.delivery -= v;
      else if (g === "Эквайринг") t.acquiring -= v; else if (g === "Хранение") t.storage -= v; else t.otherSvc -= v;
    }
    m.set(k, t);
  }
  return [...m.values()].map((t) => { for (const k of ["accruals", "commission", "delivery", "acquiring", "storage", "otherSvc", "amount"]) t[k] = Math.round(t[k]); return t; }).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
}

// Сборы уровня кабинета: у Маркета в stats/orders все комиссии привязаны к заказу и разнесены по
// SKU, поэтому здесь нули (честно: не «нет данных», а «в этом канале так не списывают»).
export function buildAccountDaily(floor: string, to: string) {
  return daysBetween(floor, to).map((d) => ({ d, adv: 0, fines: 0, realfbs: 0, badge: 0, delivery: 0, other: 0, platform: PLATFORM }));
}

export function buildSkuOffer(rows: OrderRow[], catalog: CatalogLike): Record<string, string> {
  const m: Record<string, string> = {};
  for (const k of Object.keys(catalog.items)) m[k] = k;
  for (const r of rows) m[r.sku] = r.sku;
  return m;
}

// Реклама: источника нет (рекламный кабинет Маркета не подключён). Снимок-заглушка с нулями и
// явной пометкой, чтобы дашборд не молчал, а показывал «нет источника».
export function adsStub(dateFrom: string, dateTo: string) {
  return { platform: PLATFORM, dateFrom, dateTo, generated_at: new Date().toISOString(), totals: { spend: 0, adRevenue: 0, orders: 0, drr: 0, cpo: 0, active: 0, campaigns: 0 }, burners: [], top_spend: [], by_line: [], note: "реклама Маркета не подключена (нет источника): расход/ДРР = 0, это не «ноль рекламы»" };
}
