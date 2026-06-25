// Прямой per-SKU отчёт рекламы БЕЗ n8n. Завершение миграции: раньше разбивку по SKU
// («Основная карточка») отдавал n8n-вебхук {report:id}; n8n Cloud мёртв (квота).
//
// Источник теперь - локальные снимки прямого OZON-сбора (никакой сети, никакого n8n):
//   data/ads_periods.json   - топ-кампании по окнам p7/p30/p90 с {id, off(=offer_id), sp, o, om, drr}
//   data/ads_30d.json       - свежий 30-дневный снимок (фолбэк для p30, если periods отстал по id)
//   data/skus_live_30d.json  - таблица SKU с offer_id -> sku -> name
//
// Для SKU-кампаний OZON именует кампанию по offer_id (DOC_02 §3.2), поэтому off кампании
// джойнится с offer_id товара -> получаем «Основную карточку» с расходом/заказами/выручкой
// кампании. Модель-аплифт «Объединённая карточка (др. SKU)» приходил из attribution-отчёта n8n;
// прямого источника в документированном API нет, поэтому model-поля = 0 (фронт не рисует
// объединённую строку, а не выдумывает её). Каталожные кампании (offer не резолвится) -> пусто,
// фронт честно показывает «разбивка недоступна».
import { readFileSync, writeFileSync } from "node:fs";

export interface OfferInfo { sku: string; name: string; }
export interface SkuStat { sku: string; name: string; sp: number; sold: number; om: number; soldModel: number; omModel: number; drr: number; }
export interface TopCamp { id?: string; off?: string; sp?: number; o?: number; om?: number; drr?: number }

// Чистый джойн: топ-кампании окна + карта offer->sku/name -> reports{campaignId: [SkuStat]}.
export function buildWindowReports(topSpend: TopCamp[], offerMap: Record<string, OfferInfo>): Record<string, SkuStat[]> {
  const reports: Record<string, SkuStat[]> = {};
  for (const c of topSpend) {
    if (!c.id) continue; // ключ кэша - id кампании; без него строку не положить
    const info = c.off ? offerMap[c.off] : undefined;
    if (!info) { reports[String(c.id)] = []; continue; } // каталожная / offer не сматчен -> пусто
    const sp = c.sp || 0, sold = c.o || 0, om = c.om || 0;
    const drr = om ? Math.round((sp / om) * 1000) / 10 : (c.drr || 0);
    // model-поля = 0: прямого attribution-источника нет, объединённую карточку не выдумываем
    reports[String(c.id)] = [{ sku: info.sku, name: info.name, sp, sold, om, soldModel: 0, omModel: 0, drr }];
  }
  return reports;
}

function offerMap(): Record<string, OfferInfo> {
  const m: Record<string, OfferInfo> = {};
  try {
    const live = JSON.parse(readFileSync("data/skus_live_30d.json", "utf-8"));
    for (const r of live.sku_table || []) {
      if (r.offer) m[String(r.offer)] = { sku: String(r.sku), name: String(r.name || "") };
    }
  } catch { /* нет снимка SKU - отчёты будут пустыми, фронт покажет «недоступна» */ }
  return m;
}

function main() {
  const om = offerMap();
  let periods: any = {};
  try { periods = JSON.parse(readFileSync("data/ads_periods.json", "utf-8")); } catch { periods = {}; }
  let ads30: any = null;
  try { ads30 = JSON.parse(readFileSync("data/ads_30d.json", "utf-8")); } catch { ads30 = null; }

  const out: Record<string, any> = { generated_at: new Date().toISOString(), source: "direct-ozon (offer-join)" };
  let nonEmptyTotal = 0;
  for (const lb of ["p7", "p30", "p90"] as const) {
    let p = periods[lb];
    let ts: TopCamp[] = (p && p.top_spend) || [];
    const hasId = ts.some((c) => c && c.id);
    // p30: если periods отстал и без id - берём свежий ads_30d (тот же 30-дневный объём, с id)
    if (lb === "p30" && !hasId && ads30) { ts = ads30.top_spend || []; p = { dateFrom: ads30.dateFrom, dateTo: ads30.dateTo }; }
    const reports = buildWindowReports(ts, om);
    const ne = Object.values(reports).filter((x) => x.length).length;
    nonEmptyTotal += ne;
    out[lb] = { dateFrom: (p && p.dateFrom) || "", dateTo: (p && p.dateTo) || "", reports };
    console.log(`${lb}: кампаний ${ts.length}, с разбивкой ${ne}${(!hasId && lb !== "p30") ? " (нет id в ads_periods - обновится после ночного снимка)" : ""}`);
  }
  writeFileSync("data/ads_reports.json", JSON.stringify(out));
  console.log(`per-SKU отчёт (прямой, без n8n): непустых ${nonEmptyTotal}. -> data/ads_reports.json`);
}

// Запускаем main только при прямом вызове, не при импорте из теста.
if (process.argv[1] && /ad-reports\.ts$/.test(process.argv[1])) main();
