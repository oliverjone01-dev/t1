// Дневной ряд per-SKU атрибуции (основная/объединённая) для ПРОИЗВОЛЬНОГО периода.
// OZON Performance attribution-отчёт groupBy=DATE -> per-(день, SKU) с колонками модели.
// data/ads_attr_daily.ndjson, строка = {d,id,sku,nm,sp,sold,om,soldM,omM}. Догрузка от
// последнего дня до вчера (самовосстановление). Дашборд агрегирует любой период - так же,
// как продажи/деньги. Двухфазно: запрос DATE-отчётов по кампаниям -> опрос -> скачивание
// (OZON генерит async минутами). Каталожные кампании отчёт не отдают - пропуск. Без сети
// (нет OZON_PERF_*) не запускается.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";

const OUT = "data/ads_attr_daily.ndjson";
const FLOOR = "2026-02-01";
const MAXW = 60; // окно одного отчёта, дней
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function nextDay(date: string): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return fmt(d); }

export interface AttrDailyRec { d: string; id: string; sku: string; nm: string; sp: number; sold: number; om: number; soldM: number; omM: number; }

// Чистое: [from,to] -> окна по MAXW дней (OZON ограничивает длину отчёта).
export function windows(from: string, to: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = from;
  while (s <= to) {
    const e = new Date(s + "T00:00:00Z"); e.setUTCDate(e.getUTCDate() + (MAXW - 1));
    const et = fmt(e) < to ? fmt(e) : to;
    out.push([s, et]); s = nextDay(et);
  }
  return out;
}

// Кампании дашборда (top_spend + сливы по окнам), а не ВСЕ - резко меньше отчётов.
function dashboardCampaignIds(): string[] {
  const ids = new Set<string>();
  try {
    const p = JSON.parse(readFileSync("data/ads_periods.json", "utf-8"));
    for (const lb of ["p7", "p30", "p90"]) for (const k of ["top_spend", "burners"]) for (const c of (p[lb]?.[k] || [])) if (c?.id) ids.add(String(c.id));
  } catch { /* */ }
  if (!ids.size) { try { for (const c of (JSON.parse(readFileSync("data/ads_30d.json", "utf-8")).top_spend || [])) if (c?.id) ids.add(String(c.id)); } catch { /* */ } }
  return [...ids];
}

function lastDate(): string | null {
  if (!existsSync(OUT)) return null;
  let max: string | null = null;
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) {
    try { const d = JSON.parse(l).d; if (d && (!max || d > max)) max = d; } catch { /* битая строка */ }
  }
  return max;
}

async function reportRows(perf: OzonPerformance, uuid: string): Promise<ReturnType<typeof parseAttributionDaily>> {
  for (let i = 0; i < 60; i++) {
    let st = "";
    try { st = String((await perf.statisticsState(uuid)).state ?? ""); } catch { return []; }
    if (/\b(ok|done|success|ready)\b/i.test(st)) break;
    if (/\b(error|fail)\b/i.test(st)) return [];
    await sleep(6000);
  }
  try { return parseAttributionDaily(await perf.downloadStatistics(uuid)); } catch { return []; }
}

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ad-attr-daily: OZON_PERF_* нет - пропуск (атрибуция по дням не обновлена)"); return; }
  const last = lastDate();
  const from = last ? nextDay(last) : FLOOR;
  const to = yesterday();
  if (from > to) { console.log(`ad-attr-daily: ряд уже по ${last} (вчера ${to}) - догружать нечего`); return; }

  const perf = new OzonPerformance({ clientId, clientSecret });
  const ids = dashboardCampaignIds();
  if (!ids.length) { console.warn("ad-attr-daily: нет кампаний дашборда (ads_periods пуст) - пропуск"); return; }
  let total = 0, allDays = new Set<string>();
  for (const [wf, wt] of windows(from, to)) {
    // фаза 1: запрос DATE-отчётов (каталожные -> 400 forbidden, пропуск)
    const jobs: Array<{ id: string; uuid: string }> = [];
    for (const id of ids) {
      try { const uuid = await perf.requestStatistics([id], wf, wt, "DATE"); if (uuid) jobs.push({ id, uuid }); }
      catch { /* каталожная/недоступна */ }
    }
    // фаза 2: опрос + скачивание + разбор; пишем ПО ОКНУ (устойчиво к обрыву)
    const recs: AttrDailyRec[] = [];
    for (const j of jobs) {
      for (const r of await reportRows(perf, j.uuid)) {
        if (r.date < from || r.date > to) continue;
        recs.push({ d: r.date, id: j.id, sku: r.sku, nm: r.name, sp: r.sp, sold: r.sold, om: r.om, soldM: r.soldModel, omM: r.omModel });
      }
    }
    if (recs.length) { appendFileSync(OUT, recs.map((r) => JSON.stringify(r)).join("\n") + "\n"); total += recs.length; recs.forEach((r) => allDays.add(r.d)); }
    console.log(`ad-attr-daily: окно ${wf}..${wt} - кампаний ${ids.length}, отчётов ${jobs.length}, строк ${recs.length}`);
  }
  if (!total) { console.log(`ad-attr-daily: OZON не отдал строк за ${from}..${to}`); return; }
  console.log(`ad-attr-daily: +${total} строк за ${allDays.size} дн (${from}..${to}) -> ${OUT}`);
}

if (process.argv[1] && /ad-attribution-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-attr-daily FAILED:", (e as Error).message); process.exit(0); });
