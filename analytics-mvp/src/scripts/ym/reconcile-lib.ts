// Чистая логика сверки Маркета по CLAUDE.md §15 (без файлов, тестируется). ФЕНИКС G1/G2/G7/G13:
//  - штуки: delivered в строках УЖЕ нетто (count − returned), поэтому сравниваем нетто с нетто реализации;
//  - деньги: по КЛЮЧУ ЗАКАЗА (netting.order ↔ orders.order), а не по датам выплат; плюс кумулятив с начала данных;
//  - выручка: начислено vs realization.amount закрытого месяца + подбор состава типов цен;
//  - «текущий месяц» - от сегодняшней даты, не от вчера.
import { DELIVERED_STATUSES, real, type OrderRow } from "./derive-lib.js";

export interface RealizationRow { ym: string; sku: string; sold: number; ret: number; amount?: number }
export interface NettingRow { d: string; order?: string; sku?: string; service?: string; type?: string; amount: number }
export interface ReconInput {
  rows: OrderRow[]; realization: RealizationRow[]; netting: NettingRow[] | null;
  cogs: Record<string, number>; tax: Record<string, any>; live: { dateFrom?: string; dateTo?: string; sku_table: any[] };
  views: Array<{ date: string }>; ads: any; badCells?: number;
  skippedCampaigns?: Array<{ campaign: string; business: string; reason: string }>;
}

const r0 = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const pad = (n: number) => String(n).padStart(2, "0");
export function monthBounds(ym: string): { dateFrom: string; dateTo: string } {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return { dateFrom: `${ym}-01`, dateTo: `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}` };
}
// Допуск денег: max(50 ₽, 0.5% базы) - округления и копеечные корректировки, не сдвиг дат.
export const moneyTol = (base: number) => Math.max(50, Math.abs(base) * 0.005);

export function buildReconcile(inp: ReconInput, today: string) {
  const { rows, realization: realz, netting, cogs, tax, live, views, ads } = inp;
  const yesterday = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  const curYm = today.slice(0, 7);
  const prevD = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1));
  const prevYm = `${prevD.getUTCFullYear()}-${pad(prevD.getUTCMonth() + 1)}`;

  const delivered = real(rows).filter((r) => DELIVERED_STATUSES.has(r.status));
  const netRows = netting || [];
  const netByOrder = new Map<string, number>();
  let nettingAccount = 0;
  for (const n of netRows) { const o = String(n.order || "").trim(); if (o) netByOrder.set(o, (netByOrder.get(o) || 0) + n.amount); else nettingAccount += n.amount; }

  // Сверка с ФАКТИЧЕСКИМИ выплатами Маркета из самого stats/orders (блок payments заказа).
  // Это эталон денег, не зависящий от доступа к финансовым отчётам ЛК: если расчётное «к выплате»
  // расходится с тем, что Маркет реально заплатил по тем же заказам, цифра дашборда неверна.
  const paymentsCheck = (d: OrderRow[], label: string) => {
    const withPay = d.filter((r) => r.paid !== 0);
    const orders = new Set(withPay.map((r) => r.order));
    const allOrders = new Set(d.map((r) => r.order));
    const payout = withPay.reduce((s, r) => s + r.payout, 0);
    const paid = withPay.reduce((s, r) => s + r.paid, 0);
    const diff = r0(payout - paid);
    const cov = pct(orders.size, allOrders.size);
    const byType: Record<string, number> = {};
    for (const r of withPay) for (const [k, v] of Object.entries(r.paid_by_type || {})) byType[k] = r0((byType[k] || 0) + v);
    const status = !orders.size ? "в заказах нет платежей (Маркет ещё не выплатил за период)"
      : Math.abs(diff) <= moneyTol(paid) ? `сошлось с платежами Маркета по ${orders.size}/${allOrders.size} заказам`
      : `РАСХОЖДЕНИЕ ${diff} ₽ (${payout ? Math.round((diff / payout) * 1000) / 10 : 0}%): расчётное «к выплате» ${r0(payout)} vs фактические платежи Маркета ${r0(paid)} по ${orders.size}/${allOrders.size} заказам${label === "cum" ? "" : "; для незакрытого периода часть платежей могла не прийти"}`;
    return { payout_with_payments: r0(payout), payments_actual: r0(paid), diff, orders_with_payments: orders.size, orders_total: allOrders.size, coverage_pct: cov, by_type: byType, status };
  };

  const moneyCheck = (d: OrderRow[]) => {
    const orders = new Map<string, number>();
    for (const r of d) orders.set(r.order, (orders.get(r.order) || 0) + r.payout);
    let pay = 0, matched = 0, net = 0;
    for (const [o, p] of orders) { pay += p; if (netByOrder.has(o)) { matched++; net += netByOrder.get(o)!; } }
    const payMatched = [...orders].filter(([o]) => netByOrder.has(o)).reduce((s, [, p]) => s + p, 0);
    const diff = netting ? r0(payMatched - net) : null;
    const status = !netting ? "нет отчёта по взаиморасчётам (netting не собран) - выплаты ЛК не сверены"
      : orders.size === 0 ? "доставленных заказов нет"
      : matched === 0 ? "в отчёте взаиморасчётов нет номеров этих заказов (колонка order пуста? см. _probe/united-netting.json)"
      : Math.abs(diff!) <= moneyTol(payMatched) ? `сошлось по ${matched}/${orders.size} заказам (допуск ${r0(moneyTol(payMatched))} ₽)`
      : `расхождение ${diff} ₽ по ${matched}/${orders.size} сопоставленным заказам (predicted-комиссии, удержания вне позиций)`;
    return { payout_derived: r0(pay), payout_matched: r0(payMatched), netting_by_order: netting ? r0(net) : null, orders_total: orders.size, orders_matched: matched, diff, status };
  };

  const check = (kind: "closed_month" | "half_month" | "current_month", label: string, dateFrom: string, dateTo: string, ym: string, fullMonth: boolean) => {
    const d = delivered.filter((r) => r.fin >= dateFrom && r.fin <= dateTo);
    const odNet = d.reduce((s, r) => s + r.delivered, 0), orr = d.reduce((s, r) => s + r.returned, 0);
    const rz = fullMonth ? realz.filter((r) => r.ym === ym) : [];
    const hasRz = rz.length > 0;
    const rs = hasRz ? rz.reduce((s, r) => s + (r.sold || 0), 0) : null, rr = hasRz ? rz.reduce((s, r) => s + (r.ret || 0), 0) : null;
    const rzNet = hasRz ? rs! - rr! : null;
    const udiff = hasRz ? odNet - rzNet! : null; // нетто vs нетто (G1: delivered уже count − returned)
    const ustatus = !fullMonth ? "частичный месяц: отчёт о реализации помесячный - сверка только по заказам"
      : !hasRz ? "нет отчёта о реализации за месяц (не собран / NO_DATA)"
      : udiff === 0 ? "сошлось" : `расхождение ${udiff} шт: заказы vs реализация (доначисления, поздние возвраты, месяц ещё не закрыт)`;
    const acc = d.reduce((s, r) => s + r.accruals, 0), fees = d.reduce((s, r) => s + r.fee_total, 0);
    const predShare = d.length ? pct(d.filter((r) => !r.fee_actual).length, d.length) : 0;
    const money = { ...moneyCheck(d), accruals: r0(acc), fees: r0(fees), predicted_share: predShare, payments: paymentsCheck(d, kind) };
    // выручка vs реализация (G7): начислено за доставленные vs amount отчёта; подбор состава типов цен
    let revenue: any = null;
    if (fullMonth && hasRz && rz.some((r) => r.amount != null)) {
      const ra = rz.reduce((s, r) => s + (r.amount || 0), 0);
      const combos: Record<string, (r: OrderRow) => number> = {
        "BUYER": (r) => r.p_buyer, "BUYER,MARKETPLACE": (r) => r.p_buyer + r.p_mp,
        "BUYER,MARKETPLACE,CASHBACK": (r) => r.p_buyer + r.p_mp + r.p_cashback, "BUYER,MARKETPLACE,CASHBACK,SPASIBO": (r) => r.price,
      };
      let best = "", bestDiff = Infinity;
      for (const [k, f] of Object.entries(combos)) { const v = d.reduce((s, r) => s + f(r) * r.delivered, 0); if (Math.abs(v - ra) < bestDiff) { bestDiff = Math.abs(v - ra); best = k; } }
      const diff = r0(acc - ra);
      revenue = { accruals: r0(acc), realization_amount: r0(ra), diff, best_price_types: best, status: Math.abs(diff) <= moneyTol(ra) ? "сошлось" : `расхождение ${diff} ₽; ближе всего состав цен ${best} (YM_REVENUE_PRICE_TYPES)` };
    }
    const per = real(rows).filter((r) => r.created >= dateFrom && r.created <= dateTo && r.revenue > 0);
    const bySku = new Map<string, number>(); for (const r of per) bySku.set(r.sku, (bySku.get(r.sku) || 0) + r.revenue);
    let sc = 0, rc = 0, rt = 0; for (const [sku, rev] of bySku) { rt += rev; if ((cogs[sku] || 0) > 0) { sc++; rc += rev; } }
    const cstatus = bySku.size === 0 ? "продаж нет" : sc === bySku.size ? "все SKU периода с СС" : `без СС ${bySku.size - sc} SKU (${Math.round((100 - pct(rc, rt)) * 10) / 10}% оборота) - маржа по ним завышена`;
    return {
      kind, label, dateFrom, dateTo,
      units: { orders_delivered_net: odNet, orders_returned: orr, realization_sold: rs, realization_ret: rr, realization_net: rzNet, diff: udiff, status: ustatus },
      money, revenue,
      cogs: { sku_total: bySku.size, sku_with_cogs: sc, rev_total: r0(rt), rev_with_cogs: r0(rc), pct_sku: pct(sc, bySku.size), pct_rev: pct(rc, rt), status: cstatus },
    };
  };
  const pb = monthBounds(prevYm), cb = monthBounds(curYm);
  const curTo = yesterday >= cb.dateFrom ? yesterday : cb.dateFrom;
  const periods = [
    check("closed_month", `закрытый месяц ${prevYm}`, pb.dateFrom, pb.dateTo, prevYm, true),
    check("half_month", `часть месяца ${prevYm}-01..15`, pb.dateFrom, `${prevYm}-15`, prevYm, false),
    check("current_month", `текущий месяц ${curYm} (по ${curTo})`, cb.dateFrom, curTo, curYm, false),
  ];
  const cumD = delivered.filter((r) => r.fin <= yesterday);
  const cumM = moneyCheck(cumD);
  const cumulative = { ...cumM, netting_account: netting ? r0(nettingAccount) : null, status: cumM.status, payments: paymentsCheck(cumD, "cum") };

  const gaps: Record<string, string[]> = {};
  const add = (sku: string, g: string) => { (gaps[sku] ||= []).push(g); };
  let sk = 0, skC = 0, skT = 0, rt = 0, rC = 0, rT = 0;
  const rzSkus = new Set(realz.filter((r) => r.ym === prevYm).map((r) => String(r.sku)));
  for (const s of live.sku_table || []) {
    sk++; rt += s.rev;
    if ((cogs[s.sku] || 0) > 0) { skC++; rC += s.rev; } else add(s.sku, "нет СС");
    if (tax[s.sku]) { skT++; rT += s.rev; } else add(s.sku, "нет в таксономии");
  }
  const prevDelivered = new Set(delivered.filter((r) => r.fin >= pb.dateFrom && r.fin <= pb.dateTo).map((r) => r.sku));
  if (rzSkus.size) for (const s of prevDelivered) if (!rzSkus.has(s)) add(s, `нет в реализации ${prevYm}`);
  const viewDays = new Set(views.map((v) => v.date));
  // Разбивка по бизнес-кабинетам: у каждого кабинета свой ключ, и по каждому надо видеть, что он вообще
  // отдаёт данные (кабинет без строк = ключ не подключён или в кабинете нет продаж).
  const byBusiness: Record<string, { orders: number; rows: number; revenue: number; delivered: number; payout: number; skus: number }> = {};
  const bizSku: Record<string, Set<string>> = {}, bizOrd: Record<string, Set<string>> = {};
  for (const r of real(rows)) {
    const b = r.business || "?";
    const a = byBusiness[b] || (byBusiness[b] = { orders: 0, rows: 0, revenue: 0, delivered: 0, payout: 0, skus: 0 });
    a.rows++; a.revenue += r.revenue; a.delivered += r.delivered; a.payout += r.payout;
    (bizSku[b] ||= new Set()).add(r.sku); (bizOrd[b] ||= new Set()).add(r.order);
  }
  for (const [b, a] of Object.entries(byBusiness)) { a.revenue = r0(a.revenue); a.payout = r0(a.payout); a.skus = bizSku[b]!.size; a.orders = bizOrd[b]!.size; }
  const accountRows = netRows.filter((n) => !String(n.order || "").trim()).length;
  const coverage = {
    window: { dateFrom: live.dateFrom, dateTo: live.dateTo },
    sku_total: sk, cogs: { sku: skC, pct_sku: pct(skC, sk), pct_rev: pct(rC, rt) }, taxonomy: { sku: skT, pct_sku: pct(skT, sk), pct_rev: pct(rT, rt) },
    realization: { months: [...new Set(realz.map((r) => r.ym))].sort(), sku_prev_month: rzSkus.size },
    netting: netting ? { rows: netRows.length, months: [...new Set(netRows.map((n) => n.d.slice(0, 7)))].sort(), orders_with_number: netByOrder.size } : null,
    account_fees: { rows: accountRows, note: accountRows ? "строки взаиморасчётов без номера заказа -> pnl_account_daily" : "[ГИПОТЕЗА] сборы уровня кабинета не подключены - в pnl_account_daily нули" },
    views: { days: viewDays.size, last: [...viewDays].sort().pop() || null, note: viewDays.size ? "показы per-SKU из отчёта shows-sales" : "показы не собраны (отчёт shows-sales) - воронка без верха" },
    ads: ads && ads.totals && ads.totals.spend > 0 ? "есть расход" : "нет источника (реклама Маркета не подключена)",
    bad_cells: inp.badCells || 0,
    by_business: byBusiness,
    campaigns_skipped: inp.skippedCampaigns || [],
    orders_rows: rows.length, orders_fake: rows.filter((r) => r.fake).length,
    gaps,
  };
  const blockers: string[] = [];
  if (!realz.length) blockers.push("нет отчёта о реализации (штуки не сверены с УПД-аналогом)");
  if (!netting) blockers.push("нет отчёта по взаиморасчётам (выплаты ЛК не сверены)");
  const closed = periods[0]!;
  if (closed.units.diff != null && closed.units.diff !== 0) blockers.push(`штуки закрытого месяца расходятся с реализацией на ${closed.units.diff}`);
  if (closed.money.diff != null && Math.abs(closed.money.diff) > moneyTol(closed.money.payout_matched)) blockers.push(`деньги закрытого месяца расходятся с выплатами ЛК на ${closed.money.diff} ₽`);
  if (closed.revenue && closed.revenue.status !== "сошлось") blockers.push(`выручка закрытого месяца vs реализация: ${closed.revenue.status}`);
  const cp = cumulative.payments;
  if (cp.orders_with_payments && Math.abs(cp.diff) > moneyTol(cp.payments_actual)) blockers.push(`«к выплате» расходится с фактическими платежами Маркета на ${cp.diff} ₽ (${cp.payout_with_payments ? Math.round((cp.diff / cp.payout_with_payments) * 1000) / 10 : 0}% по ${cp.orders_with_payments} заказам) - формула денег неверна`);
  if (sk && pct(rC, rt) < 90) blockers.push(`СС покрывает ${pct(rC, rt)}% оборота (<90%)`);
  if ((inp.badCells || 0) > 0) blockers.push(`битых ячеек в отчётах: ${inp.badCells}`);
  for (const sc of inp.skippedCampaigns || []) blockers.push(`кампания ${sc.campaign} (кабинет ${sc.business}) не отдаёт данные: ${sc.reason}`);
  return { platform: "ym", generated_at: new Date().toISOString(), today, periods, cumulative, coverage, verdict: blockers.length ? "return" : "go", blockers, rule: "CLAUDE.md §15: цифра готова только после сверки с эталоном, трёх типов периода и отчёта о покрытии" };
}
