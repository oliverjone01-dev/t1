// Синк заказов Маркета -> data-ym/orders.ndjson (сырой факт-слой: одна строка = позиция заказа).
// Источник: POST /campaigns/{id}/stats/orders (только чтение). Все производные файлы контракта
// (history/daily_totals/skus_live/pnl_*) строит derive.ts из этого файла - один источник, один смысл.
//
// Инкремент: заказы по дате СОЗДАНИЯ от последнего известного дня до вчера + перетяжка хвоста
// (TAIL_DAYS) по дате ОБНОВЛЕНИЯ, чтобы поймать доставки/возвраты/отмены и переход комиссий
// predicted -> actual. Первый прогон - полный бэкфилл от FLOOR. Дедуп по (campaign, order, sku).
// Запуск: npm run ym:orders  (env: YM_API_KEY|YM_DASHBOARD_1, YM_BUSINESS_IDS, YM_CAMPAIGN_IDS, YM_TAIL_DAYS)
import { loadEnv } from "../../env.js";
import { client, resolveCampaigns, ensureDir, readNdjson, writeNdjson, writeJson, yp, FLOOR, yesterday, addDays, campaignSummary } from "./common.js";
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
  const api = client();
  const camps = await resolveCampaigns(api);
  if (!camps.length) { console.error("ym-orders: нет кампаний к обработке"); process.exit(1); }
  console.log(`ym-orders: кампаний ${camps.length}\n${campaignSummary(camps)}`);

  const existing = readNdjson<OrderRow>(OUT);
  const lastCreated = existing.reduce((m, r) => (r.created > m ? r.created : m), "");
  const to = yesterday();
  const fullFrom = lastCreated ? addDays(lastCreated, 1) : FLOOR;
  const tailFrom = addDays(to, -(TAIL_DAYS - 1)) < FLOOR ? FLOOR : addDays(to, -(TAIL_DAYS - 1));
  console.log(`ym-orders: в файле ${existing.length} строк (по ${lastCreated || "-"}); новые с ${fullFrom}, хвост перетяжки с ${tailFrom}`);

  const fresh: OrderRow[] = [];
  let nOrders = 0;
  for (const c of camps) {
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
      // updateFrom может быть не поддержан на этом типе размещения - тогда перетягиваем по дате создания
      console.warn(`::warning::ym-orders ${c.id}: фильтр updateFrom не сработал (${(e as Error).message.slice(0, 120)}) - перетягиваю хвост по дате создания`);
      for (const [wf, wt] of windows(tailFrom, to)) {
        const orders = await api.ordersStats(c.id, { dateFrom: wf, dateTo: wt });
        for (const o of orders) fresh.push(...normalizeOrder(o, c.id, c.businessId));
      }
    }
  }

  // Самодиагностика первого живого прогона (ФЕНИКС G6): форма сырого заказа (ключи/типы, без значений)
  // и принятый формат дат запроса -> data-ym/_probe/orders.json.
  if (api.lastRawOrder) writeJson(yp("_probe/orders.json"), { at: new Date().toISOString(), dateFormatAccepted: api.orderDateFormat, shape: shape(api.lastRawOrder), creationDateSample: String(api.lastRawOrder.creationDate || "").replace(/\d/g, "9") });

  // Дедуп: свежая строка побеждает старую по ключу (campaign, order, sku).
  const key = (r: OrderRow) => `${r.campaign}|${r.order}|${r.sku}`;
  const map = new Map<string, OrderRow>();
  for (const r of existing) map.set(key(r), r);
  let replaced = 0, added = 0;
  for (const r of fresh) { if (map.has(key(r))) replaced++; else added++; map.set(key(r), r); }
  const merged = [...map.values()].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.order < b.order ? -1 : 1));
  writeNdjson(OUT, merged);
  console.log(`ym-orders: заказов прочитано ${nOrders}, строк новых ${added}, обновлено ${replaced}, всего ${merged.length} -> ${OUT}`);
}

main().catch((e) => { console.error("ym-orders FAILED:", (e as Error).message); process.exit(1); });
