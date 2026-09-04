// Синк заказов Маркета -> data-ym/orders.ndjson (сырой факт-слой: одна строка = позиция заказа).
// Источник: POST /campaigns/{id}/stats/orders (только чтение). Все производные файлы контракта
// (history/daily_totals/skus_live/pnl_*) строит derive.ts из этого файла - один источник, один смысл.
//
// Инкремент: заказы по дате СОЗДАНИЯ от последнего известного дня до вчера + перетяжка хвоста
// (TAIL_DAYS) по дате ОБНОВЛЕНИЯ, чтобы поймать доставки/возвраты/отмены и переход комиссий
// predicted -> actual. Первый прогон - полный бэкфилл от FLOOR. Дедуп по (campaign, order, sku).
// Запуск: npm run ym:orders  (env: YM_API_KEY|YM_DASHBOARD_1, YM_BUSINESS_IDS, YM_CAMPAIGN_IDS, YM_TAIL_DAYS)
import { loadEnv } from "../../env.js";
import { accounts, resolveTargets, campaignUnavailable, ensureDir, readNdjson, writeNdjson, writeJson, yp, FLOOR, yesterday, addDays, targetSummary } from "./common.js";
import { shape } from "../../connector/ym-partner.js";
import { normalizeOrder, type OrderRow } from "./derive-lib.js";

const OUT = yp("orders.ndjson");
const TAIL_DAYS = Number(process.env.YM_TAIL_DAYS || 45);
const MAXW = 30; // окно одного запроса stats/orders (лимит Маркета на диапазон дат)

function windows(from: string, to: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = from;
  while (s <= to) { const e = addDays(s, MAXW - 1) < to ? addDays(s, MAXW - 1) : to; out.push([s, e]); s = addDays(e, 1); }
  return out;
}

async function main() {
  loadEnv();
  ensureDir();
  const accs = accounts();
  const targets = await resolveTargets(accs);
  if (!targets.length) { console.error("ym-orders: нет кампаний к обработке ни по одному ключу"); process.exit(1); }
  console.log(`ym-orders: ключей ${accs.length}, кампаний ${targets.length}\n${targetSummary(targets)}`);

  // YM_ORDERS_REFETCH=1 - полный пересбор с FLOOR (нужен, когда меняется состав полей строки).
  const refetch = process.env.YM_ORDERS_REFETCH === "1";
  const existing = refetch ? [] : readNdjson<OrderRow>(OUT);
  if (refetch) console.log("ym-orders: YM_ORDERS_REFETCH=1 - полный пересбор истории с " + FLOOR);
  const lastCreated = existing.reduce((m, r) => (r.created > m ? r.created : m), "");
  const to = yesterday();
  const fullFrom = lastCreated ? addDays(lastCreated, 1) : FLOOR;
  const tailFrom = addDays(to, -(TAIL_DAYS - 1)) < FLOOR ? FLOOR : addDays(to, -(TAIL_DAYS - 1));
  console.log(`ym-orders: в файле ${existing.length} строк (по ${lastCreated || "-"}); новые с ${fullFrom}, хвост перетяжки с ${tailFrom}`);

  const fresh: OrderRow[] = [];
  let nOrders = 0;
  const skipped: Array<{ campaign: string; business: string; reason: string }> = [];
  let okCampaigns = 0;
  for (const { campaign: c, account } of targets) {
    const api = account.api;
    try {
    // 1) новые заказы по дате создания
    if (fullFrom <= to) for (const [wf, wt] of windows(fullFrom, to)) {
      const orders = await api.ordersStats(c.id, { dateFrom: wf, dateTo: wt });
      nOrders += orders.length;
      for (const o of orders) fresh.push(...normalizeOrder(o, c.id, c.businessId));
      console.log(`  ${c.id} created ${wf}..${wt}: заказов ${orders.length}`);
    }
    // 2) хвост по дате обновления (статусы/комиссии/возвраты меняются задним числом)
    try {
      for (const [wf, wt] of windows(tailFrom, to)) {
        const orders = await api.ordersStats(c.id, { updateFrom: wf, updateTo: wt });
        nOrders += orders.length;
        for (const o of orders) fresh.push(...normalizeOrder(o, c.id, c.businessId));
        console.log(`  ${c.id} updated ${wf}..${wt}: заказов ${orders.length}`);
      }
    } catch (e) {
      if (campaignUnavailable(e)) throw e; // недоступную кампанию обрабатываем уровнем выше
      // updateFrom может быть не поддержан на этом типе размещения - тогда перетягиваем по дате создания
      console.warn(`::warning::ym-orders ${c.id}: фильтр updateFrom не сработал (${(e as Error).message.slice(0, 120)}) - перетягиваю хвост по дате создания`);
      for (const [wf, wt] of windows(tailFrom, to)) {
        const orders = await api.ordersStats(c.id, { dateFrom: wf, dateTo: wt });
        for (const o of orders) fresh.push(...normalizeOrder(o, c.id, c.businessId));
      }
    }
    okCampaigns++;
    } catch (e) {
      const why = campaignUnavailable(e);
      if (!why) throw e; // настоящая ошибка (сеть, 5xx, битый ответ) - падаем, чтобы не подменить данные тишиной
      console.warn(`::warning::кампания ${c.id} (${c.domain || c.placementType}, кабинет ${c.businessId}) пропущена: ${why}`);
      skipped.push({ campaign: c.id, business: c.businessId, reason: why });
    }
  }
  // Все кампании недоступны - это не «нет продаж», а сломанный доступ: падаем громко.
  if (!okCampaigns) { console.error(`ym-orders: ни одна из ${targets.length} кампаний не отдала заказы (${skipped.map((s) => s.reason).join("; ")})`); process.exit(1); }
  if (skipped.length) writeJson(yp("_probe/skipped_campaigns.json"), { at: new Date().toISOString(), skipped });
  else writeJson(yp("_probe/skipped_campaigns.json"), { at: new Date().toISOString(), skipped: [] });

  // Самодиагностика первого живого прогона (ФЕНИКС G6): форма сырого заказа (ключи/типы, без значений)
  // и принятый формат дат запроса -> data-ym/_probe/orders.json.
  // Справочник типов платежей/субсидий/комиссий за прогон (счётчики и суммы, без номеров заказов):
  // по нему видно, из чего складывается фактическая выплата Маркета.
  const cnt = (m: Record<string, { n: number; sum: number }>, k: string, v: number) => { const a = m[k] || (m[k] = { n: 0, sum: 0 }); a.n++; a.sum = Math.round((a.sum + v) * 100) / 100; };
  const pt: Record<string, { n: number; sum: number }> = {}, sub: Record<string, { n: number; sum: number }> = {}, com: Record<string, { n: number; sum: number }> = {};
  for (const r of fresh) {
    for (const [k, v] of Object.entries(r.paid_by_type || {})) cnt(pt, k, v);
    if (r.subsidy) cnt(sub, "SUBSIDY", r.subsidy);
    for (const [k, v] of Object.entries(r.fees || {})) cnt(com, k, v);
  }
  writeJson(yp("_probe/payment_types.json"), { at: new Date().toISOString(), note: "агрегат за прогон: типы платежей, субсидии и группы сборов (суммы разнесены по позициям)", payments: pt, subsidies: sub, fees: com });

  const pa = targets.map((t) => t.account.api).find((a) => a.lastRawOrder);
  if (pa) writeJson(yp("_probe/orders.json"), { at: new Date().toISOString(), dateFormatAccepted: pa.orderDateFormat, shape: shape(pa.lastRawOrder), creationDateSample: String(pa.lastRawOrder.creationDate || "").replace(/\d/g, "9") });

  // Дедуп: свежая строка побеждает старую по ключу (campaign, order, sku).
  const key = (r: OrderRow) => `${r.campaign}|${r.order}|${r.sku}`;
  const map = new Map<string, OrderRow>();
  for (const r of existing) map.set(key(r), r);
  let replaced = 0, added = 0;
  for (const r of fresh) { if (map.has(key(r))) replaced++; else added++; map.set(key(r), r); }
  const merged = [...map.values()].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.order < b.order ? -1 : 1));
  writeNdjson(OUT, merged);
  console.log(`ym-orders: кампаний ${okCampaigns}/${targets.length} (пропущено ${skipped.length}), заказов прочитано ${nOrders}, строк новых ${added}, обновлено ${replaced}, всего ${merged.length} -> ${OUT}`);
}

main().catch((e) => { console.error("ym-orders FAILED:", (e as Error).message); process.exit(1); });
