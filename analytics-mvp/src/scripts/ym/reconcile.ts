// Этап 4: сверка Маркета по CLAUDE.md §15 -> data-ym/reconcile.json (+ отчёт в лог/step summary).
//   1. Штуки: доставлено по заказам (stats/orders) vs отчёт о реализации (goods-realization).
//   2. Деньги: «к выплате» по заказам (accruals - комиссии) vs выплаты по отчёту взаиморасчётов (united-netting).
//   3. Себестоимость: покрытие SKU/оборота листом СС (sku_cogs.json) и таксономией (sku_taxonomy.json).
// Три типа периода: последний закрытый месяц, его первая половина (1-15), текущий незакрытый месяц.
// Пробелы по SKU (нет СС / нет в таксономии / нет в реализации) - в coverage.gaps, дашборд рисует бейджи.
// Без сети. Запуск: npm run ym:reconcile
import { appendFileSync } from "node:fs";
import { yp, readNdjson, readJson, writeJson, yesterday, monthBounds, pad } from "./common.js";
import { DELIVERED_STATUSES, real, type OrderRow } from "./derive-lib.js";

const r0 = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

interface PeriodCheck {
  kind: "closed_month" | "half_month" | "current_month"; label: string; dateFrom: string; dateTo: string;
  units: { orders_delivered: number; orders_returned: number; realization_sold: number | null; realization_ret: number | null; diff: number | null; status: string };
  money: { accruals: number; fees: number; payout_derived: number; predicted_share: number; netting_paid: number | null; diff: number | null; status: string };
  cogs: { sku_total: number; sku_with_cogs: number; rev_total: number; rev_with_cogs: number; pct_sku: number; pct_rev: number; status: string };
}

function main() {
  const rows = readNdjson<OrderRow>(yp("orders.ndjson"));
  const realz = readNdjson<any>(yp("realization_monthly.ndjson"));
  const netting = readJson<any>(yp("netting_summary.json"), null);
  const cogs = readJson<Record<string, number>>(yp("sku_cogs.json"), {});
  const tax = readJson<Record<string, any>>(yp("sku_taxonomy.json"), {});
  const live = readJson<any>(yp("skus_live_30d.json"), { sku_table: [] });
  const views = readNdjson<any>(yp("sku_views.ndjson"));
  const ads = readJson<any>(yp("ads_30d.json"), null);
  const to = yesterday();
  const now = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 1));
  const curYm = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevYm = `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`;

  const delivered = real(rows).filter((r) => DELIVERED_STATUSES.has(r.status));
  const check = (kind: PeriodCheck["kind"], label: string, dateFrom: string, dateTo: string, ym: string, fullMonth: boolean): PeriodCheck => {
    // штуки: по дате доставки (fin) - как считает реализация
    const d = delivered.filter((r) => r.fin >= dateFrom && r.fin <= dateTo);
    const od = d.reduce((s, r) => s + r.delivered, 0), orr = d.reduce((s, r) => s + r.returned, 0);
    const rz = fullMonth ? realz.filter((r) => r.ym === ym) : [];
    const hasRz = rz.length > 0;
    const rs = hasRz ? rz.reduce((s, r) => s + (r.sold || 0), 0) : null, rr = hasRz ? rz.reduce((s, r) => s + (r.ret || 0), 0) : null;
    const udiff = hasRz ? (od - orr) - (rs! - rr!) : null;
    const ustatus = !fullMonth ? "частичный месяц: отчёта о реализации нет (он помесячный) - сверка только по заказам" : !hasRz ? "нет отчёта о реализации за месяц (не собран / NO_DATA)" : udiff === 0 ? "сошлось" : `расхождение ${udiff} шт: заказы vs реализация (доначисления/поздние возвраты/отчёт за месяц ещё не закрыт)`;
    // деньги
    const acc = d.reduce((s, r) => s + r.accruals, 0), fees = d.reduce((s, r) => s + r.fee_total, 0), pay = d.reduce((s, r) => s + r.payout, 0);
    const predShare = d.length ? pct(d.filter((r) => !r.fee_actual).length, d.length) : 0;
    let paid: number | null = null;
    if (netting && netting.byDate) { paid = 0; for (const [dd, v] of Object.entries<number>(netting.byDate)) if (dd >= dateFrom && dd <= dateTo) paid += v; paid = r0(paid); }
    const mdiff = paid == null ? null : r0(pay - paid);
    const mstatus = paid == null ? "нет отчёта по взаиморасчётам (netting не собран) - выплаты ЛК не сверены" : Math.abs(mdiff!) <= 50 ? "сошлось (допуск округления)" : `расхождение ${mdiff} ₽: к выплате по заказам vs выплаты ЛК (сдвиг даты выплаты относительно доставки, удержания вне заказов, predicted-комиссии ${predShare}%)`;
    // СС по SKU периода (по выручке заказов, дата создания)
    const per = real(rows).filter((r) => r.created >= dateFrom && r.created <= dateTo && r.revenue > 0);
    const bySku = new Map<string, number>(); for (const r of per) bySku.set(r.sku, (bySku.get(r.sku) || 0) + r.revenue);
    let sc = 0, rc = 0, rt = 0; for (const [sku, rev] of bySku) { rt += rev; if ((cogs[sku] || 0) > 0) { sc++; rc += rev; } }
    const cstatus = bySku.size === 0 ? "продаж нет" : sc === bySku.size ? "все SKU периода с СС" : `без СС ${bySku.size - sc} SKU (${100 - pct(rc, rt)}% оборота) - маржа по ним завышена`;
    return {
      kind, label, dateFrom, dateTo,
      units: { orders_delivered: od, orders_returned: orr, realization_sold: rs, realization_ret: rr, diff: udiff, status: ustatus },
      money: { accruals: r0(acc), fees: r0(fees), payout_derived: r0(pay), predicted_share: predShare, netting_paid: paid, diff: mdiff, status: mstatus },
      cogs: { sku_total: bySku.size, sku_with_cogs: sc, rev_total: r0(rt), rev_with_cogs: r0(rc), pct_sku: pct(sc, bySku.size), pct_rev: pct(rc, rt), status: cstatus },
    };
  };
  const pb = monthBounds(prevYm), cb = monthBounds(curYm);
  const periods: PeriodCheck[] = [
    check("closed_month", `закрытый месяц ${prevYm}`, pb.dateFrom, pb.dateTo, prevYm, true),
    check("half_month", `часть месяца ${prevYm}-01..15`, pb.dateFrom, `${prevYm}-15`, prevYm, false),
    check("current_month", `текущий месяц ${curYm} (по ${to})`, cb.dateFrom, to, curYm, false),
  ];

  // покрытие по живому снимку 30 дн + пробелы по SKU
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
  const coverage = {
    window: { dateFrom: live.dateFrom, dateTo: live.dateTo },
    sku_total: sk, cogs: { sku: skC, pct_sku: pct(skC, sk), pct_rev: pct(rC, rt) }, taxonomy: { sku: skT, pct_sku: pct(skT, sk), pct_rev: pct(rT, rt) },
    realization: { months: [...new Set(realz.map((r) => r.ym))].sort(), sku_prev_month: rzSkus.size },
    netting: netting ? { rows: netting.rows, months: Object.keys(netting.byMonth || {}).sort() } : null,
    views: { days: viewDays.size, last: [...viewDays].sort().pop() || null, note: viewDays.size ? "показы per-SKU из отчёта shows-sales" : "показы не собраны (отчёт shows-sales) - воронка без верха" },
    ads: ads && ads.totals && ads.totals.spend > 0 ? "есть расход" : "нет источника (реклама Маркета не подключена)",
    orders_rows: rows.length, orders_fake: rows.filter((r) => r.fake).length,
    gaps,
  };
  const blockers: string[] = [];
  if (!realz.length) blockers.push("нет отчёта о реализации (штуки не сверены с УПД-аналогом)");
  if (!netting) blockers.push("нет отчёта по взаиморасчётам (выплаты ЛК не сверены)");
  if (sk && pct(rC, rt) < 90) blockers.push(`СС покрывает ${pct(rC, rt)}% оборота (<90%)`);
  const out = { platform: "ym", generated_at: new Date().toISOString(), periods, coverage, verdict: blockers.length ? "return" : "go", blockers, rule: "CLAUDE.md §15: цифра готова только после сверки с эталоном, трёх типов периода и отчёта о покрытии" };
  writeJson(yp("reconcile.json"), out);

  const md: string[] = [`## Сверка Маркета по §15 - ${out.verdict.toUpperCase()}`, ""];
  for (const p of periods) md.push(`**${p.label}** (${p.dateFrom}..${p.dateTo})`, `- штуки: доставлено ${p.units.orders_delivered} − возвраты ${p.units.orders_returned} vs реализация ${p.units.realization_sold ?? "—"} − ${p.units.realization_ret ?? "—"} → ${p.units.status}`, `- деньги: начислено ${p.money.accruals}, сборы ${p.money.fees}, к выплате ${p.money.payout_derived} vs выплаты ЛК ${p.money.netting_paid ?? "—"} → ${p.money.status}`, `- СС: ${p.cogs.sku_with_cogs}/${p.cogs.sku_total} SKU, ${p.cogs.pct_rev}% оборота → ${p.cogs.status}`, "");
  md.push(`Покрытие 30 дн: SKU ${sk}, СС ${coverage.cogs.pct_sku}% SKU / ${coverage.cogs.pct_rev}% оборота, таксономия ${coverage.taxonomy.pct_sku}% / ${coverage.taxonomy.pct_rev}%, показы: ${coverage.views.days} дн, реклама: ${coverage.ads}. Пробелов по SKU: ${Object.keys(gaps).length}.`);
  if (blockers.length) md.push("", "Блокеры: " + blockers.join("; "));
  const text = md.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}

main();
