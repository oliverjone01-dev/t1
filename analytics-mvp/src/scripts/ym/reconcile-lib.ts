// Чистая логика сверки Маркета по CLAUDE.md §15 (без файлов, тестируется). ФЕНИКС G1/G2/G7/G13:
//  - штуки: delivered в строках УЖЕ нетто (count − returned), поэтому сравниваем нетто с нетто реализации;
//  - деньги: по КЛЮЧУ ЗАКАЗА (netting.order ↔ orders.order), а не по датам выплат; плюс кумулятив с начала данных;
//  - выручка: начислено vs realization.amount закрытого месяца + подбор состава типов цен;
//  - «текущий месяц» - от сегодняшней даты, не от вчера.
import { DELIVERED_STATUSES, feeSourceSplit, real, type OrderRow } from "./derive-lib.js";

export interface RealizationRow { ym: string; sku: string; sold: number; ret: number; amount?: number }
export interface NettingRow { d: string; order?: string; shop_order?: string; sku?: string; service?: string; type?: string; amount: number }
export interface ReconInput {
  rows: OrderRow[]; realization: RealizationRow[]; netting: NettingRow[] | null;
  cogs: Record<string, number>; tax: Record<string, any>; live: { dateFrom?: string; dateTo?: string; sku_table: any[] };
  views: Array<{ date: string }>; ads: any; badCells?: number;
  realizationState?: { by_month?: Record<string, { shops_sold?: string[]; shops_with_rows?: string[]; shops_no_data?: string[]; shops_pending?: string[] }> } | null;
  skippedCampaigns?: Array<{ campaign: string; business: string; reason: string }>;
}

// Человеческие имена кабинетов: в блокере «1023124» ничего не говорит, «зеркала» - говорит.
const BIZ_NAME: Record<string, string> = { "1023124": "кабинет зеркал (1023124)", "74986385": "кабинет мебели (74986385)" };
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
  // Покрытие отчёта о реализации по месяцам. Недобранный отчёт - это ПРОБЕЛ, а не расхождение:
  // живой факт 2026-09, закрытый месяц 2026-08 - отчёт был выпущен лишь по части магазинов, в нём
  // лежало 26 шт против 151 доставленной, и сверка объявляла «расхождение 125 шт», хотя сравнивать
  // было не с чем. Ниже такой месяц честно помечается недобранным, а не расходящимся.
  const realzCov = inp.realizationState?.by_month || {};
  const realizationCoverage = (ym: string, d: OrderRow[]) => {
    const sold = new Set(d.filter((r) => r.delivered > 0).map((r) => r.campaign));
    const cov = realzCov[ym];
    // Состояние бэкфилла ещё не писалось (снимок собран старой версией) - покрытие НЕИЗВЕСТНО.
    // Это не то же самое, что «ноль магазинов»: неизвестность нельзя выдавать за факт.
    if (!cov) return { known: false, shops_sold: sold.size, shops_with_rows: null, shops_missing: [] as string[], complete: false };
    const withRows = new Set(cov.shops_with_rows || []);
    // Состояние говорит «ни один магазин не дал строк», а строки за месяц в файле ЕСТЬ. Значит
    // состояние потеряло разбивку (собрано версией без поля from), а не магазины ничего не дали.
    // «0 из 7» - проверяемо ложное утверждение: выдавать его за факт нельзя.
    if (!withRows.size && realz.some((r) => r.ym === ym)) {
      return { known: false, shops_sold: sold.size, shops_with_rows: null, shops_missing: [] as string[], complete: false,
        note: `строки за ${ym} есть, но разбивка по магазинам не сохранена (снимок собран до появления поля from) - покрытие неизвестно, а не нулевое` };
    }
    const missing = [...sold].filter((c) => !withRows.has(c)).sort();
    return { known: true, shops_sold: sold.size, shops_with_rows: [...sold].filter((c) => withRows.has(c)).length, shops_missing: missing, complete: sold.size > 0 && missing.length === 0 };
  };
  const yesterday = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  const curYm = today.slice(0, 7);
  const prevD = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1));
  const prevYm = `${prevD.getUTCFullYear()}-${pad(prevD.getUTCMonth() + 1)}`;

  const delivered = real(rows).filter((r) => DELIVERED_STATUSES.has(r.status));
  const netRows = netting || [];
  const netByOrder = new Map<string, number>();
  // Реестр раскладываем на начисления и удержания ОТДЕЛЬНО. Без этого разложения сверка денег
  // выглядит проверкой сборов, хотя ею не является: payout = начислено − сборы, сборы взяты из этого
  // же реестра, поэтому в разности payout − реестр член со сборами сокращается тождественно и
  // остаётся только «начислено по заказам vs начислено по реестру». Разложение делает это явным.
  const ledgerAccr = new Map<string, number>();  // Начисление/Возврат: деньги за товар
  const ledgerHold = new Map<string, number>();  // всё остальное: удержания кабинета, знак как у сборов
  const IS_ACCR = (t: string) => t === "Начисление" || t === "Возврат";
  let nettingAccount = 0;
  for (const n of netRows) {
    const o = String(n.order || "").trim();
    if (!o) { nettingAccount += n.amount; continue; }
    netByOrder.set(o, (netByOrder.get(o) || 0) + n.amount);
    if (IS_ACCR(String(n.type || ""))) ledgerAccr.set(o, (ledgerAccr.get(o) || 0) + n.amount);
    else ledgerHold.set(o, (ledgerHold.get(o) || 0) - n.amount);
  }

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
    const diff0 = netting ? r0(payMatched - net) : null;
    const status = !netting ? "нет отчёта по взаиморасчётам (netting не собран) - выплаты ЛК не сверены"
      : orders.size === 0 ? "доставленных заказов нет"
      : matched === 0 ? "в отчёте взаиморасчётов нет номеров этих заказов (колонка order пуста? см. _probe/united-netting.json)"
      : keyTrusted === false ? keyCheck.status
      : Math.abs(diff0!) <= moneyTol(payMatched) ? `сошлось по ${matched}/${orders.size} заказам (допуск ${r0(moneyTol(payMatched))} ₽)`
      : `расхождение ${diff0} ₽ по ${matched}/${orders.size} сопоставленным заказам (predicted-комиссии, удержания вне позиций)${keyTrusted === null ? "; " + keyCheck.status : ""}`;
    // Что эта сверка проверяет на самом деле. Раскладываем разность на две ноги: начисления и сборы.
    // Там, где сборы взяты из реестра (а это ВСЕ сопоставленные заказы: заказ, попавший в реестр,
    // получает fee_source="netting"), нога сборов равна нулю ТОЖДЕСТВЕННО, и разность целиком
    // объясняется начислениями. Значит ошибку разнесения сборов по позициям эта сверка не поймает,
    // и говорить «деньги сошлись с кабинетом» по ней нельзя.
    let accrOrd = 0, accrLed = 0, feeDer = 0, feeLed = 0, fromLedger = 0;
    const allocOff: Array<{ order: string; derived: number; ledger: number; diff: number }> = [];
    for (const [o] of orders) {
      if (!netByOrder.has(o)) continue;
      const rs = d.filter((r) => r.order === o);
      const a = rs.reduce((x, r) => x + r.accruals, 0), f = rs.reduce((x, r) => x + r.fee_total, 0);
      const h = ledgerHold.get(o) || 0;
      accrOrd += a; accrLed += ledgerAccr.get(o) || 0; feeDer += f; feeLed += h;
      if (rs.some((r) => r.fee_source === "netting")) {
        fromLedger++;
        // Инвариант разнесения: сумма разнесённых по позициям сборов обязана сойтись с удержаниями
        // реестра по этому заказу. Тождеством это НЕ является - разнесение идёт долями по
        // начислениям и может потерять деньги (нулевые начисления, отфильтрованные позиции).
        if (Math.abs(f - h) > 1) allocOff.push({ order: o, derived: r0(f), ledger: r0(h), diff: r0(f - h) });
      }
    }
    const alloc = {
      orders_from_ledger: fromLedger, orders_off: allocOff.length,
      off_amount: r0(allocOff.reduce((x, o) => x + Math.abs(o.diff), 0)),
      off_orders: allocOff.slice(0, 5),
      status: !fromLedger ? "сборов из реестра нет - разносить нечего"
        : allocOff.length ? `РАЗНЕСЕНИЕ ТЕРЯЕТ ДЕНЬГИ: у ${allocOff.length}/${fromLedger} заказов сумма сборов по позициям не равна удержаниям реестра`
        : `разнесение сходится по всем ${fromLedger} заказам (сборы по позициям = удержания реестра)`,
    };
    const legs = {
      accruals_orders: r0(accrOrd), accruals_ledger: r0(accrLed), accruals_diff: r0(accrOrd - accrLed),
      fees_derived: r0(feeDer), fees_ledger: r0(feeLed), fees_diff: r0(feeDer - feeLed),
      orders_fees_from_ledger: fromLedger,
      covers: fromLedger === matched && matched > 0
        ? "сверяет ТОЛЬКО начисления: сборы у всех сопоставленных заказов взяты из этого же реестра, в разности они сокращаются тождественно"
        : `сверяет начисления; нога сборов независима лишь у ${matched - fromLedger}/${matched} заказов (у остальных сборы взяты из этого же реестра)`,
      allocation: alloc,
    };
    // Разность и её ноги обязаны быть ОДНИМ числом: округляли их порознь, и на живых данных
    // 2026-09-07 страница показывала −4820 рядом с −4819. Расхождение в рубль между двумя числами,
    // равными по построению, читатель тратит время на объяснение, которого нет.
    // Округляем КАЖДУЮ ногу один раз, а разность складываем из округлённых ног. Иначе нога сборов
    // печатается как 0, будучи −0.5 внутри, и разность уезжает на рубль от суммы своих же слагаемых.
    const diffFromLegs = legs.accruals_diff - legs.fees_diff;
    return { payout_derived: r0(pay), payout_matched: r0(payMatched), netting_by_order: netting ? r0(net) : null, orders_total: orders.size, orders_matched: matched, diff: netting ? diffFromLegs : null, key_check: keyCheck, legs, status };
  };

  const check = (kind: "closed_month" | "half_month" | "current_month", label: string, dateFrom: string, dateTo: string, ym: string, fullMonth: boolean) => {
    const d = delivered.filter((r) => r.fin >= dateFrom && r.fin <= dateTo);
    const odNet = d.reduce((s, r) => s + r.delivered, 0), orr = d.reduce((s, r) => s + r.returned, 0);
    const rz = fullMonth ? realz.filter((r) => r.ym === ym) : [];
    const hasRz = rz.length > 0;
    const rs = hasRz ? rz.reduce((s, r) => s + (r.sold || 0), 0) : null, rr = hasRz ? rz.reduce((s, r) => s + (r.ret || 0), 0) : null;
    const rzNet = hasRz ? rs! - rr! : null;
    const rcov = realizationCoverage(ym, d);
    const rzUsable = hasRz && rcov.complete;
    const udiff = rzUsable ? odNet - rzNet! : null; // нетто vs нетто (G1: delivered уже count − returned)
    const ustatus = !fullMonth ? "частичный месяц: отчёт о реализации помесячный - сверка только по заказам"
      : !hasRz ? "нет отчёта о реализации за месяц (не собран / NO_DATA)"
      : !rcov.known ? "покрытие отчёта о реализации НЕИЗВЕСТНО (состояние бэкфилла не записано) - сверка штук не проводится до следующего синка"
      : !rcov.complete ? `ОТЧЁТ ДОБРАН ЧАСТИЧНО: строки есть по ${rcov.shops_with_rows}/${rcov.shops_sold} магазинов с продажами, не хватает ${rcov.shops_missing.join(", ")} - сверка штук невозможна, это пробел выгрузки, а не расхождение`
      : udiff === 0 ? "сошлось" : `расхождение ${udiff} шт: заказы vs реализация (доначисления, поздние возвраты, месяц ещё не закрыт)`;
    const acc = d.reduce((s, r) => s + r.accruals, 0), fees = d.reduce((s, r) => s + r.fee_total, 0);
    const predShare = d.length ? pct(d.filter((r) => !r.fee_actual).length, d.length) : 0;
    const money = { ...moneyCheck(d), accruals: r0(acc), fees: r0(fees), predicted_share: predShare, payments: paymentsCheck(d, kind) };
    // выручка vs реализация (G7): начислено за доставленные vs amount отчёта; подбор состава типов цен
    let revenue: any = null;
    if (fullMonth && rzUsable && rz.some((r) => r.amount != null)) {
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
      units: { orders_delivered_net: odNet, orders_returned: orr, realization_sold: rs, realization_ret: rr, realization_net: rzNet, diff: udiff, coverage: rcov, status: ustatus },
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
  // «Сборы уровня кабинета» имели ДВА значения в одном отчёте: 452 405 ₽ здесь (все строки реестра
  // без номера заказа) и 342 784 ₽ в pnl_account_daily (только внутри окна дашборда, с 2026-02-01).
  // Разницу давали две проводки от 2026-01-31 - до нижней границы. Одна величина под одним именем
  // с двумя значениями - это не округление, это невозможность сверить.
  const accFloor = real(rows).map((r) => r.created).sort()[0] || "";
  const accIn = netRows.filter((n) => !String(n.order || "").trim() && (!accFloor || n.d >= accFloor)).reduce((a, n) => a + n.amount, 0);
  const cumulative = {
    ...cumM,
    netting_account: netting ? r0(nettingAccount) : null,
    netting_account_in_window: netting ? r0(accIn) : null,
    netting_account_note: netting && Math.abs(nettingAccount - accIn) > 1
      ? `${r0(nettingAccount)} ₽ всего по реестру, из них ${r0(accIn)} ₽ попадает в окно дашборда (с ${accFloor}); разница ${r0(nettingAccount - accIn)} ₽ - проводки до нижней границы, в pnl_account_daily их нет`
      : "все строки реестра без номера заказа попадают в окно дашборда",
    status: cumM.status, payments: paymentsCheck(cumD, "cum"),
  };

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
    // Покрытие ЗА ВЕСЬ ПЕРИОД, а не только за живое окно 30 дней. Бейдж считался по окну, а страницы
    // показывают февраль-сентябрь: живой факт 2026-09-07 - бейдж «таксономия 95.6% оборота» при
    // 43.1% оборота всего периода без таксономии и 11.4% без СС. CLAUDE.md §15 прямо требует СС для
    // ВСЕХ артикулов листа, а не только для живого снимка: неактивные, но реализованные теряют СС.
    all_period: (() => {
      const rev = new Map<string, number>();
      for (const r of real(rows)) rev.set(r.sku, (rev.get(r.sku) || 0) + r.revenue);
      const tot = [...rev.values()].reduce((a, b) => a + b, 0);
      const has = (m: Record<string, any>) => [...rev].filter(([s]) => m[s] !== undefined);
      const c = has(cogs), t = has(tax);
      const sum = (xs: Array<[string, number]>) => xs.reduce((a, [, v]) => a + v, 0);
      return {
        dateFrom: [...real(rows)].map((r) => r.created).sort()[0] || null,
        dateTo: [...real(rows)].map((r) => r.created).sort().pop() || null,
        sku_total: rev.size, rev_total: r0(tot),
        cogs: { sku: c.length, pct_sku: pct(c.length, rev.size), pct_rev: pct(sum(c), tot), rev_without: r0(tot - sum(c)) },
        taxonomy: { sku: t.length, pct_sku: pct(t.length, rev.size), pct_rev: pct(sum(t), tot), rev_without: r0(tot - sum(t)) },
      };
    })(),
    realization: { months: [...new Set(realz.map((r) => r.ym))].sort(), sku_prev_month: rzSkus.size, prev_month_coverage: realizationCoverage(prevYm, delivered.filter((r) => r.fin >= pb.dateFrom && r.fin <= pb.dateTo)) },
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
    // ФЕНИКС P0: «откуда сборы» было в снимке, но не на страницах. Пока ledger покрывает не весь
    // оборот, маржа и «к выплате» по непокрытой части ЗАВЫШЕНЫ, и величина завышения видна из
    // разрыва ставок. Показываем деньгами, а не заказами.
    fee_source: (() => {
      const f = feeSourceSplit(real(rows));
      const total = f.accruals_from_netting + f.accruals_from_commissions;
      const pct_order = pct(f.accruals_from_commissions, total);
      const months_order = Object.entries(f.by_month)
        .filter(([, b]) => b.accruals_order > 0 && b.accruals_order >= b.accruals_netting)
        .map(([m]) => m).sort();
      return {
        ...f, accruals_total: r0(total), pct_accruals_from_commissions: pct_order,
        months_mostly_commissions: months_order,
        gaps_named: f.gaps.map((g) => `${BIZ_NAME[g.business] || g.business} за ${g.ym} (${r0(g.accruals)} ₽, ${g.orders} зак.)`),
        note: pct_order > 0
          ? `сборы из взаиморасчётов у ${f.orders_from_netting} заказов (${r0(f.accruals_from_netting)} ₽, ставка ${f.rate_netting}%), из комиссий заказа у ${f.orders_from_commissions} (${r0(f.accruals_from_commissions)} ₽, ставка ${f.rate_order}%) - на второй части маржа завышена`
          : "все сборы из взаиморасчётов кабинета",
      };
    })(),
    account_fees: { rows: accountRows, note: accountRows ? "строки взаиморасчётов без номера заказа -> pnl_account_daily" : "[ГИПОТЕЗА] сборы уровня кабинета не подключены - в pnl_account_daily нули" },
    views: { days: viewDays.size, last: [...viewDays].sort().pop() || null, note: viewDays.size ? "показы per-SKU из отчёта shows-sales" : "показы не собраны (отчёт shows-sales) - воронка без верха" },
    // «Нет источника» было ложью: рекламного КАБИНЕТА нет, а расход на продвижение кабинет удерживает
    // и он лежит в реестре. Соседняя вкладка при этом показывала эти же деньги строкой «Продвижение».
    ads: ads && ads.promo_from_netting > 0
      ? `буст из реестра ${r0(ads.promo_from_netting)} ₽ за 30 дн (кабинета кампаний у Маркета в API нет: ДРР и CPO не считаются)`
      : ads && ads.totals && ads.totals.spend > 0 ? "есть расход" : "нет источника (реклама Маркета не подключена)",
    bad_cells: inp.badCells || 0,
    by_business: byBusiness,
    campaigns_skipped: inp.skippedCampaigns || [],
    orders_rows: rows.length, orders_fake: rows.filter((r) => r.fake).length,
    gaps,
  };
  const blockers: string[] = [];
  if (!realz.length) blockers.push("нет отчёта о реализации (штуки не сверены с УПД-аналогом)");
  if (!netting) blockers.push("нет отчёта по взаиморасчётам (выплаты ЛК не сверены)");
  // Порог 20% оборота: ниже него перекос маржи тонет в допуске, выше - «к выплате» на странице
  // читается как факт, хотя по большей части оборота это комиссия за продажу без прочих удержаний.
  const fs = (coverage as any).fee_source;
  // Порог по доле оборота ЛИБО наличие адресного пробела: 16% диффузно - это «кабинет зеркал за три
  // месяца», и молчать об этом нельзя только потому, что доля не дотянула до порога.
  if (fs && (fs.pct_accruals_from_commissions > 20 || fs.gaps_named.length)) {
    blockers.push(`сборы у ${fs.pct_accruals_from_commissions}% оборота взяты из комиссий заказа, а не из взаиморасчётов (ставка ${fs.rate_order}% против ${fs.rate_netting}% там, где ledger есть) - маржа и «к выплате» по этой части завышены. Не собран реестр: ${fs.gaps_named.join("; ")}`);
  }
  const closed = periods[0]!;
  const cc = (closed.units as any).coverage;
  if (cc && cc.shops_sold > 0 && !cc.known) blockers.push(`покрытие отчёта о реализации за ${prevYm} неизвестно (состояние бэкфилла не записано) - штуки и выручка закрытого месяца не сверены`);
  else if (cc && cc.shops_sold > 0 && !cc.complete) blockers.push(`отчёт о реализации за ${prevYm} добран частично: ${cc.shops_with_rows}/${cc.shops_sold} магазинов с продажами, не хватает ${cc.shops_missing.join(", ")} - штуки и выручка закрытого месяца не сверены`);
  else if (closed.units.diff != null && closed.units.diff !== 0) blockers.push(`штуки закрытого месяца расходятся с реализацией на ${closed.units.diff}`);
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
