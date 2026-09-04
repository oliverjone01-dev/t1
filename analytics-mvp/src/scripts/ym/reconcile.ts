// Этап 4: сверка Маркета по CLAUDE.md §15 -> data-ym/reconcile.json (+ Summary воркфлоу). Логика - reconcile-lib.ts.
// Без сети. Запуск: npm run ym:reconcile
import { appendFileSync } from "node:fs";
import { yp, readNdjson, readJson, writeJson, today } from "./common.js";
import { buildReconcile } from "./reconcile-lib.js";
import type { OrderRow } from "./derive-lib.js";

function main() {
  const nettingSummary = readJson<any>(yp("netting_summary.json"), null);
  const out = buildReconcile({
    rows: readNdjson<OrderRow>(yp("orders.ndjson")),
    realization: readNdjson<any>(yp("realization_monthly.ndjson")),
    netting: nettingSummary ? readNdjson<any>(yp("netting.ndjson")) : null,
    cogs: readJson<Record<string, number>>(yp("sku_cogs.json"), {}),
    tax: readJson<Record<string, any>>(yp("sku_taxonomy.json"), {}),
    live: readJson<any>(yp("skus_live_30d.json"), { sku_table: [] }),
    views: readNdjson<any>(yp("sku_views.ndjson")),
    ads: readJson<any>(yp("ads_30d.json"), null),
    badCells: readJson<any>(yp("_probe/bad_cells.json"), { total: 0 }).total || 0,
    skippedCampaigns: readJson<any>(yp("_probe/skipped_campaigns.json"), { skipped: [] }).skipped || [],
  }, today());
  writeJson(yp("reconcile.json"), out);

  const md: string[] = [`## Сверка Маркета по §15 - ${out.verdict.toUpperCase()}`, ""];
  for (const p of out.periods) {
    md.push(`**${p.label}** (${p.dateFrom}..${p.dateTo})`,
      `- штуки: доставлено нетто ${p.units.orders_delivered_net} (возвраты ${p.units.orders_returned}) vs реализация нетто ${p.units.realization_net ?? "—"} → ${p.units.status}`,
      `- деньги: к выплате ${p.money.payout_derived} (сопоставлено ${p.money.payout_matched}) vs ЛК по заказам ${p.money.netting_by_order ?? "—"}, заказов ${p.money.orders_matched}/${p.money.orders_total} → ${p.money.status}`,
      `- платежи Маркета (из заказов): ${p.money.payments.payments_actual} vs расчёт ${p.money.payments.payout_with_payments} → ${p.money.payments.status}`);
    if (p.revenue) md.push(`- выручка: начислено ${p.revenue.accruals} vs реализация ${p.revenue.realization_amount} → ${p.revenue.status}`);
    md.push(`- СС: ${p.cogs.sku_with_cogs}/${p.cogs.sku_total} SKU, ${p.cogs.pct_rev}% оборота → ${p.cogs.status}`, "");
  }
  md.push(`**с начала данных**: к выплате ${out.cumulative.payout_derived} vs ЛК по заказам ${out.cumulative.netting_by_order ?? "—"} → ${out.cumulative.status}; сборы уровня кабинета ${out.cumulative.netting_account ?? "—"}`,
    `**платежи Маркета за всю историю**: фактически ${out.cumulative.payments.payments_actual} vs расчёт ${out.cumulative.payments.payout_with_payments} (заказов с платежами ${out.cumulative.payments.orders_with_payments}/${out.cumulative.payments.orders_total}, ${out.cumulative.payments.coverage_pct}%) → ${out.cumulative.payments.status}`,
    `типы платежей: ${JSON.stringify(out.cumulative.payments.by_type)}`);
  const c = out.coverage;
  md.push(`Покрытие 30 дн: SKU ${c.sku_total}, СС ${c.cogs.pct_sku}% SKU / ${c.cogs.pct_rev}% оборота, таксономия ${c.taxonomy.pct_sku}% / ${c.taxonomy.pct_rev}%, показы ${c.views.days} дн, реклама: ${c.ads}, сборы кабинета: ${c.account_fees.note}. Пробелов по SKU: ${Object.keys(c.gaps).length}. Битых ячеек: ${c.bad_cells}.`);
  const bb = (c as any).by_business || {};
  const sk = (c as any).campaigns_skipped || [];
  if (sk.length) md.push(`Пропущенные кампании: ${sk.map((x: any) => `${x.campaign} (${x.reason})`).join("; ")}`);
  if (Object.keys(bb).length) md.push("Кабинеты: " + Object.entries(bb).map(([b, v]: [string, any]) => `${b} - ${v.skus} SKU, ${v.orders} заказов, заказано ${v.revenue} ₽`).join("; "));
  if (out.blockers.length) md.push("", "Блокеры: " + out.blockers.join("; "));
  const text = md.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}

main();
