// Производные файлы контракта из сырого факт-слоя Маркета:
//   data-ym/orders.ndjson + catalog.json (+ sku_views.ndjson от отчёта показов) ->
//   history.ndjson, daily_totals.ndjson, skus_live_30d.json, pnl_30d.json, pnl_sku_30d.json,
//   pnl_daily.ndjson, pnl_sku_daily.ndjson, pnl_account_daily.ndjson, sku_offer.json,
//   ads_30d.json, ads_periods.json, ads_reports.json (заглушки: реклама не подключена).
// Без сети. Запуск: npm run ym:derive [days=30]
import { existsSync } from "node:fs";
import { yp, ensureDir, readNdjson, writeNdjson, writeJson, readJson, FLOOR, yesterday, windowDays, addDays } from "./common.js";
import { buildHistory, buildDailyTotals, buildSkusLive, buildPnl, buildPnlSku, buildPnlDaily, buildPnlSkuDaily, buildAccountDaily, buildSkuOffer, adsStub, type OrderRow } from "./derive-lib.js";

function main() {
  ensureDir();
  const rows = readNdjson<OrderRow>(yp("orders.ndjson"));
  if (!rows.length) { console.error(`ym-derive: ${yp("orders.ndjson")} пуст - сначала npm run ym:orders`); process.exit(1); }
  const catalog = readJson<any>(yp("catalog.json"), { items: {} });
  const to = yesterday();
  const firstOrder = rows.reduce((m, r) => (r.created && r.created < m ? r.created : m), "9999-99-99");
  const floor = firstOrder < FLOOR ? firstOrder : FLOOR;

  // показы/корзина per-SKU по дням из отчёта shows-sales (если собран)
  const views = readNdjson<any>(yp("sku_views.ndjson"));
  const viewsBy = new Map<string, { views: number; cart: number }>();
  const dayViews = new Map<string, { views: number; vsearch: number; pdp: number; cart: number }>();
  for (const v of views) {
    if (v.aggregate) continue; // агрегат за окно - не дневные данные (см. reports.ts shows)
    const k = `${v.date}|${v.sku}`; const cur = viewsBy.get(k) || { views: 0, cart: 0 }; cur.views += v.views || 0; cur.cart += v.cart || 0; viewsBy.set(k, cur);
    const d = dayViews.get(v.date) || { views: 0, vsearch: 0, pdp: 0, cart: 0 }; d.views += v.views || 0; d.vsearch += v.vsearch || 0; d.pdp += v.pdp || 0; d.cart += v.cart || 0; dayViews.set(v.date, d);
  }

  const facts = buildHistory(rows, floor, to, viewsBy);
  writeNdjson(yp("history.ndjson"), facts);
  writeNdjson(yp("daily_totals.ndjson"), buildDailyTotals(facts, floor, to, dayViews.size ? dayViews : undefined));

  const days = Number(process.argv[2] || 30) || 30;
  const w = windowDays(days, to);
  const skuViews = new Map<string, { views: number; cart: number }>();
  for (const v of views) {
    // дневные строки внутри окна; агрегат берём, если его окно совпадает с окном skus_live с точностью до 2 дней
    const inWin = v.aggregate ? (v.date >= addDays(w.dateTo, -2) && v.period_from <= addDays(w.dateFrom, 2)) : (v.date >= w.dateFrom && v.date <= w.dateTo);
    if (inWin) { const c = skuViews.get(v.sku) || { views: 0, cart: 0 }; c.views += v.views || 0; c.cart += v.cart || 0; skuViews.set(v.sku, c); }
  }
  const live = buildSkusLive(rows, facts, catalog, w.dateFrom, w.dateTo, skuViews.size ? skuViews : undefined);
  writeJson(yp("skus_live_30d.json"), live);
  writeJson(yp("pnl_30d.json"), buildPnl(rows, w.dateFrom, w.dateTo), 0);
  writeJson(yp("pnl_sku_30d.json"), buildPnlSku(rows, w.dateFrom, w.dateTo));
  writeNdjson(yp("pnl_daily.ndjson"), buildPnlDaily(rows));
  writeNdjson(yp("pnl_sku_daily.ndjson"), buildPnlSkuDaily(rows));
  const nettingRows = readNdjson<any>(yp("netting.ndjson"));
  writeNdjson(yp("pnl_account_daily.ndjson"), buildAccountDaily(floor, to, nettingRows));
  writeJson(yp("sku_offer.json"), buildSkuOffer(rows, catalog), 0);

  // реклама - заглушки (нет источника); не перезаписываем, если кто-то положил реальный снимок с расходом
  const ads = readJson<any>(yp("ads_30d.json"), null);
  if (!ads || !(ads.totals && ads.totals.spend > 0)) {
    writeJson(yp("ads_30d.json"), adsStub(w.dateFrom, w.dateTo));
    const ap: any = {}; for (const d of [7, 30, 90]) { const ww = windowDays(d, to); ap[`p${d}`] = adsStub(ww.dateFrom, ww.dateTo); }
    writeJson(yp("ads_periods.json"), ap, 0);
    writeJson(yp("ads_reports.json"), { platform: "ym", generated_at: new Date().toISOString(), source: "нет источника (реклама Маркета не подключена)", p7: { reports: {} }, p30: { reports: {} }, p90: { reports: {} } }, 0);
  }
  if (!existsSync(yp("card_groups.json"))) writeJson(yp("card_groups.json"), { generated_note: "объединённых карточек Маркета нет (не импортированы)", source: "none", groups: [] }, 0);

  const st: Record<string, number> = {}; for (const r of rows) st[r.status] = (st[r.status] || 0) + 1;
  console.log(`ym-derive: строк ${rows.length}, статусы ${JSON.stringify(st)}`);
  console.log(`ym-derive: history ${facts.length} строк (${floor}..${to}), skus_live ${w.dateFrom}..${w.dateTo}: SKU ${live.sku_table.length}, выручка ${live.totals.rev}, показов ${live.totals.views}`);
  const p = readJson<any>(yp("pnl_30d.json"), {});
  console.log(`ym-derive: pnl ${w.dateFrom}..${w.dateTo}: начислено ${p.accruals}, к выплате ${p.payout}, заказов ${p.ops}, predicted-строк ${p.predicted_rows}`);
}

main();
