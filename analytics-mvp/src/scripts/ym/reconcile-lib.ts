// Чистая логика сверки Маркета по CLAUDE.md §15 (без файлов, тестируется). ФЕНИКС G1/G2/G7/G13:
//  - штуки: delivered в строках УЖЕ нетто (count − returned), поэтому сравниваем нетто с нетто реализации;
//  - деньги: по КЛЮЧУ ЗАКАЗА (netting.order ↔ orders.order), а не по датам выплат; плюс кумулятив с начала данных;
//  - выручка: начислено vs realization.amount закрытого месяца + подбор состава типов цен;
//  - «текущий месяц» - от сегодняшней даты, не от вчера.
import { DELIVERED_STATUSES, real, type OrderRow } from "./derive-lib.js";

export interface RealizationRow { ym: string; sku: string; sold: number; ret: number; amount?: number }
export interface NettingRow { d: string; order?: string; shop_order?: string; sku?: string; service?: string; type?: string; amount: number }
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

  // Проверка, что ORDER_ID отчёта и id заказа из stats/orders - ОДИН И ТОТ ЖЕ ключ. Живая находка
  // 2026-09-04: по одному id наш заказ показывал начисление 3500 ₽, а отчёт - 43 797 ₽ по тому же
  // артикулу; медианное отношение по всем заказам 13.5x. Такое расхождение не объясняется ни ценами,
  // ни комиссиями, поэтому сначала подтверждаем ключ: у строки отчёта есть SHOP_ORDER_ID (наш внешний
  // номер), у заказа - partnerOrderId. Если они массово не совпадают, id разные, и сверка денег по
  // номеру заказа НЕДОСТОВЕРНА - показывать её расхождение в рублях нельзя, это выдуманная цифра.
  const shopOf = new Map<string, string>();
  for (const r of real(rows)) { const so = String(r.shop_order || "").trim(); if (so) shopOf.set(r.order, so); }
  let keyChecked = 0, keyAgree = 0;
  for (const n of netRows) {
    const o = String(n.order || "").trim(), so = String(n.shop_order || "").trim();
    if (!o || !so || !shopOf.has(o)) continue;
    keyChecked++; if (shopOf.get(o) === so) keyAgree++;
  }
  const keyPct = pct(keyAgree, keyChecked);
  const keyTrusted = keyChecked === 0 ? null : keyPct >= 90;
  const keyCheck = {
    checked: keyChecked, agree: keyAgree, pct: keyPct, trusted: keyTrusted,
    status: keyChecked === 0
      ? "[ГИПОТЕЗА] ключ заказа не проверен: в отчёте или в заказах нет внешнего номера (SHOP_ORDER_ID / partnerOrderId) - сверку денег по номеру заказа считать предварительной"
      : keyTrusted ? `ключ заказа подтверждён: SHOP_ORDER_ID совпал с partnerOrderId у ${keyAgree}/${keyChecked} строк (${keyPct}%)`
      : `КЛЮЧ ЗАКАЗА НЕ ПОДТВЕРЖДЁН: SHOP_ORDER_ID совпал лишь у ${keyAgree}/${keyChecked} строк (${keyPct}%) - ORDER_ID отчёта и id заказа это РАЗНЫЕ номера, сверка денег по заказу недостоверна`,
  };

  // Сверка с ФАКТИЧЕСКИМИ выплатами Маркета из самого stats/orders (блок payments заказа).
  // Это эталон денег, не зависящий от доступа к финансовым отчётам ЛК: если расчётное «к выплате»
  // расходится с тем, что Маркет реально заплатил по тем же заказам, цифра дашборда неверна.
  // Блок payments в stats/orders - это только ПОКУПАТЕЛЬСКАЯ нога выплаты: деньги из оплаты
  // покупателя. Софинансирование Маркета (subsidies; в ценах позиции тип MARKETPLACE) приходит
  // отдельной выплатой и в payments не попадает. Проверено на живых данных: на 594 расчитанных
  // заказах (доставка до 2026-06-30) тождество accruals − subsidy == Σ payments держится у 99.7%
  // заказов, суммарное отклонение 0.37%. Поэтому эталон здесь - buyer_leg, а не полное «к выплате»:
  // сравнение payout с payments завышало расхождение на всю ногу софинансирования (~39%).
  // Что эта сверка НЕ покрывает: сборы Маркета и ногу софинансирования - для них нужен
  // отчёт по взаиморасчётам (united-netting), сейчас 403 по правам ключа.
  const paymentsCheck = (d: OrderRow[], label: string) => {
    const withPay = d.filter((r) => r.paid !== 0);
    const allOrders = new Set(d.map((r) => r.order));
    // Сверяем ПОЗАКАЗНО: агрегат прячет единичные кривые заказы за общей суммой, а доля несошедшихся
    // заказов сразу отличает сломанную формулу (расходятся все) от краевых случаев (расходятся 2-3).
    const per = new Map<string, { accr: number; sub: number; paid: number }>();
    for (const r of withPay) { const a = per.get(r.order) || { accr: 0, sub: 0, paid: 0 }; a.accr += r.accruals; a.sub += r.subsidy; a.paid += r.paid; per.set(r.order, a); }
    let accruals = 0, subsidy = 0, paid = 0, off = 0, offAmount = 0;
    const offOrders: Array<{ order: string; expected: number; actual: number; diff: number }> = [];
    for (const [o, a] of per) {
      const exp = a.accr - a.sub; const dlt = a.paid - exp;
      accruals += a.accr; subsidy += a.sub; paid += a.paid;
      if (Math.abs(dlt) > moneyTol(exp)) { off++; offAmount += dlt; if (offOrders.length < 20) offOrders.push({ order: o, expected: r0(exp), actual: r0(a.paid), diff: r0(dlt) }); }
    }
    const buyerLeg = accruals - subsidy;
    const payout = withPay.reduce((s, r) => s + r.payout, 0);
    const diff = r0(buyerLeg - paid);
    const cov = pct(per.size, allOrders.size);
    const offPct = pct(off, per.size);
    const byType: Record<string, number> = {};
    for (const r of withPay) for (const [k, v] of Object.entries(r.paid_by_type || {})) byType[k] = r0((byType[k] || 0) + v);
    const status = !per.size ? "в заказах нет платежей (Маркет ещё не выплатил за период)"
      : off === 0 ? `сошлось позаказно: все ${per.size} заказов с платежами (покупательская нога)`
      : offPct <= 2 ? `сошлось по ${per.size - off}/${per.size} заказам (${100 - offPct}%); не сошлись ${off} на ${r0(offAmount)} ₽ - краевые случаи (частичная доставка, полный возврат с софинансированием), см. off_orders`
      : `РАСХОЖДЕНИЕ у ${off}/${per.size} заказов (${offPct}%) на ${r0(offAmount)} ₽: покупательская нога (начислено − софинансирование) ${r0(buyerLeg)} vs фактические платежи Маркета ${r0(paid)}${label === "cum" ? "" : "; для незакрытого периода часть платежей могла не прийти"}`;
    return {
      buyer_leg_derived: r0(buyerLeg), payments_actual: r0(paid), diff,
      accruals: r0(accruals), subsidy_leg: r0(subsidy), payout_full: r0(payout),
      orders_with_payments: per.size, orders_total: allOrders.size, coverage_pct: cov,
      orders_matched: per.size - off, orders_off: off, orders_off_pct: offPct, off_amount: r0(offAmount), off_orders: offOrders,
      by_type: byType, status,
      covers: "сверяет цены, возвраты и состав заказов; сборы Маркета и нога софинансирования этой сверкой не покрыты (нужен united-netting)",
    };
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
      : keyTrusted === false ? keyCheck.status
      : Math.abs(diff!) <= moneyTol(payMatched) ? `сошлось по ${matched}/${orders.size} заказам (допуск ${r0(moneyTol(payMatched))} ₽)`
      : `расхождение ${diff} ₽ по ${matched}/${orders.size} сопоставленным заказам (predicted-комиссии, удержания вне позиций)${keyTrusted === null ? "; " + keyCheck.status : ""}`;
    return { payout_derived: r0(pay), payout_matched: r0(payMatched), netting_by_order: netting ? r0(net) : null, orders_total: orders.size, orders_matched: matched, diff, key_check: keyCheck, status };
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
    netting_key: keyCheck,
    netting: netting ? { rows: netRows.length, months: [...new Set(netRows.map((n) => n.d.slice(0, 7)))].sort(), orders_with_number: netByOrder.size } : null,
    // Позиции-услуги (доставка, подъём) и совпадения SKU внутри заказа. Если у заказа две позиции с
    // одним SKU и вторая НЕ распознана как услуга, значит список услуг неполон и деньги/штуки по этому
    // заказу считаются неверно - это должно быть видно, а не тонуть.
    items: (() => {
      const rs = real(rows);
      const svc = rs.filter((r) => r.service).length;
      const byOrder: Record<string, Record<string, number>> = {};
      for (const r of rs) ((byOrder[r.order] ||= {})[r.sku] = (byOrder[r.order]![r.sku] || 0) + 1);
      let dupUnknown = 0;
      for (const [o, m] of Object.entries(byOrder)) for (const [sku, n] of Object.entries(m)) {
        if (n < 2) continue;
        const group = rs.filter((r) => r.order === o && r.sku === sku);
        if (group.filter((r) => r.service).length < n - 1) dupUnknown++;
      }
      return {
        rows: rs.length, service_rows: svc, dup_sku_unrecognized: dupUnknown,
        note: dupUnknown ? `в ${dupUnknown} заказах SKU повторяется, но вторая позиция не распознана как услуга - проверить SERVICE_NAME в derive-lib` : "позиции-услуги распознаны, дублей SKU без объяснения нет",
      };
    })(),
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
  if (keyTrusted === false) blockers.push(keyCheck.status);
  else if (closed.money.diff != null && Math.abs(closed.money.diff) > moneyTol(closed.money.payout_matched)) blockers.push(`деньги закрытого месяца расходятся с выплатами ЛК на ${closed.money.diff} ₽${keyTrusted === null ? " (ключ заказа не подтверждён - цифра предварительная)" : ""}`);
  if (closed.revenue && closed.revenue.status !== "сошлось") blockers.push(`выручка закрытого месяца vs реализация: ${closed.revenue.status}`);
  const cp = cumulative.payments;
  if (cp.orders_with_payments && cp.orders_off_pct > 2) blockers.push(`покупательская нога не сходится с платежами Маркета у ${cp.orders_off}/${cp.orders_with_payments} заказов (${cp.orders_off_pct}%) на ${cp.off_amount} ₽ - формула денег неверна`);
  if (sk && pct(rC, rt) < 90) blockers.push(`СС покрывает ${pct(rC, rt)}% оборота (<90%)`);
  if ((inp.badCells || 0) > 0) blockers.push(`битых ячеек в отчётах: ${inp.badCells}`);
  for (const sc of inp.skippedCampaigns || []) blockers.push(`кампания ${sc.campaign} (кабинет ${sc.business}) не отдаёт данные: ${sc.reason}`);
  return { platform: "ym", generated_at: new Date().toISOString(), today, periods, cumulative, coverage, verdict: blockers.length ? "return" : "go", blockers, rule: "CLAUDE.md §15: цифра готова только после сверки с эталоном, трёх типов периода и отчёта о покрытии" };
}
