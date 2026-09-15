// Производные файлы контракта из сырого факт-слоя Маркета:
//   data-ym/orders.ndjson + catalog.json (+ sku_views.ndjson от отчёта показов) ->
//   history.ndjson, daily_totals.ndjson, skus_live_30d.json, pnl_30d.json, pnl_sku_30d.json,
//   pnl_daily.ndjson, pnl_sku_daily.ndjson, pnl_account_daily.ndjson, sku_offer.json,
//   ads_30d.json, ads_periods.json, ads_reports.json (заглушки: реклама не подключена).
// Без сети. Запуск: npm run ym:derive [days=30]
import { existsSync } from "node:fs";
import { yp, ensureDir, readNdjson, writeNdjson, writeJson, readJson, FLOOR, yesterday, windowDays, addDays } from "./common.js";
import { buildHistory, buildDailyTotals, buildSkusLive, buildPnl, buildPnlSku, buildPnlDaily, buildPnlSkuDaily, buildAccountDaily, buildSkuOffer, adsStub, promoFromNetting, applyNettingFees, buildSvod, isNettingFee, isPointsPaid, type OrderRow } from "./derive-lib.js";

function main() {
  ensureDir();
  let rows = readNdjson<OrderRow>(yp("orders.ndjson"));
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
  // Сборы берём из ledger'а кабинета (§15: источник денег - кабинет). Комиссии заказа остаются
  // запасным источником для заказов, которых в ledger'е ещё нет.
  const netAll = readNdjson<any>(yp("netting.ndjson"));
  const fee = applyNettingFees(rows, netAll);
  rows = fee.rows;
  console.log(`ym-derive: сборы из взаиморасчётов у ${fee.orders_from_netting} заказов, из комиссий заказа у ${fee.orders_from_commissions}`);
  if (Object.keys(fee.unmapped).length) console.warn(`::warning::услуги без группы сборов: ${JSON.stringify(fee.unmapped)}`);
  writeJson(yp("fee_source.json"), { at: new Date().toISOString(), ...fee, rows: undefined });
  writeJson(yp("pnl_30d.json"), buildPnl(rows, w.dateFrom, w.dateTo), 0);
  writeJson(yp("pnl_sku_30d.json"), buildPnlSku(rows, w.dateFrom, w.dateTo));
  writeNdjson(yp("pnl_daily.ndjson"), buildPnlDaily(rows));
  writeNdjson(yp("pnl_sku_daily.ndjson"), buildPnlSkuDaily(rows));
  const nettingRows = netAll;
  writeNdjson(yp("pnl_account_daily.ndjson"), buildAccountDaily(floor, to, nettingRows));
  writeJson(yp("sku_offer.json"), buildSkuOffer(rows, catalog), 0);

  // Свод по дате заказа (методика v4): отдельный базис, отдельная витрина. Считается по СЫРЫМ
  // строкам заказов (до подмены сборов реестром): свод берёт услуги из реестра сам, по своим
  // правилам разнесения, и второй источник тех же услуг дал бы двойной счёт.
  const cogsMap = readJson<Record<string, number>>(yp("sku_cogs.json"), {});
  const svod = buildSvod(readNdjson<OrderRow>(yp("orders.ndjson")), netAll, cogsMap, to);
  // Проверка правила «Списание = баллы» считается на сборке: держать её числом в тексте
  // страницы значит показывать вчерашнюю цифру после сегодняшнего обновления реестра.
  const SPLIT_B = "74986385", SPLIT_M = "2026-07";
  let splitMoney = 0, splitPoints = 0;
  for (const n of netAll as any[]) {
    if (String(n.business) !== SPLIT_B || String(n.d || "").slice(0, 7) !== SPLIT_M) continue;
    if (!isNettingFee(String(n.type || ""), n.src)) continue;
    const v = -(Number(n.amount) || 0);
    if (isPointsPaid(String(n.type || ""), n.src)) splitPoints += v; else splitMoney += v;
  }
  writeJson(yp("svod_orders.json"), { platform: "ym", generated_at: new Date().toISOString(),
    basis: "период по дате оформления заказа; только статус DELIVERED; штуки - доставленные минус возвращённые",
    split_check: { business: SPLIT_B, ym: SPLIT_M, money: Math.round(splitMoney), points: Math.round(splitPoints),
      act_money: 557250.2, act_points: 2350590.89 },
    months: svod });
  console.log(`ym-derive: свод по дате заказа - ${svod.length} пар (кабинет, месяц)`);
  // Тождество внутри самого API: платёж покупателя по своду (он уже включает доставку) должен
  // сойтись с суммой фактических платежей заказа. Оно ловит ровно тот класс дефекта, из-за
  // которого свод недосчитывал 576 279 ₽: цену за штуку складывали без умножения на count.
  // Считаем ПОПАРНО по (кабинет, месяц): в общей сумме отклонение одной пары тонет. Допуск 0,1%
  // пары - на построчное округление r2 его хватает с запасом, а два заказа с доставкой за счёт
  // Маркета (2 000 ₽ и 599 ₽) он ловил.
  {
    const ordersAll = readNdjson<OrderRow>(yp("orders.ndjson"));
    const monthOf = new Map<string, string>();
    for (const r of ordersAll) if (!r.service && r.status === "DELIVERED" && r.created) monthOf.set(r.order, `${r.business}|${r.created.slice(0, 7)}`);
    const pay = new Map<string, number>();
    for (const r of ordersAll) { const k = monthOf.get(r.order); if (k) pay.set(k, (pay.get(k) || 0) + ((r.paid_by_type || {}).PAYMENT || 0)); }
    const got = new Map<string, number>();
    for (const m of svod) for (const r of m.rows) { const k = `${m.business}|${m.ym}`; got.set(k, (got.get(k) || 0) + r.buyer_pay); }
    const bad: string[] = []; let sumPay = 0, sumGot = 0;
    for (const [k, want] of pay) {
      const have = got.get(k) || 0; sumPay += want; sumGot += have;
      const d = Math.abs(have - want);
      if (d > Math.max(1, Math.abs(want) * 0.001)) bad.push(`${k}: свод ${Math.round(have)} против платежей ${Math.round(want)} (${Math.round(d)} ₽)`);
    }
    if (bad.length) console.warn(`::warning::свод: платёж покупателя не сходится с фактическими платежами заказа в ${bad.length} парах (кабинет, месяц): ${bad.join("; ")}. Проверить разнесение цен по позициям`);
    else console.log(`ym-derive: свод сходится с платежами заказов по всем ${pay.size} парам - ${Math.round(sumGot)} ₽ против ${Math.round(sumPay)} ₽`);
  }

  // реклама - заглушки (нет источника); не перезаписываем, если кто-то положил реальный снимок с расходом
  const ads = readJson<any>(yp("ads_30d.json"), null);
  if (!ads || !(ads.totals && ads.totals.spend > 0) || ads.promo_from_netting !== undefined) {
    writeJson(yp("ads_30d.json"), adsStub(w.dateFrom, w.dateTo, promoFromNetting(netAll, w.dateFrom, w.dateTo)));
    const ap: any = {}; for (const d of [7, 30, 90]) { const ww = windowDays(d, to); ap[`p${d}`] = adsStub(ww.dateFrom, ww.dateTo, promoFromNetting(netAll, ww.dateFrom, ww.dateTo)); }
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
