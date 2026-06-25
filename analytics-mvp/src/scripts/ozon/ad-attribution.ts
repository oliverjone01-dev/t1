// Продьюсер per-SKU attribution-отчёта OZON Performance (основная/объединённая карточка).
// Заменяет ad-reports.ts (offer-join, без модели). По окнам p7/p30/p90: запрос отчёта на
// топ-кампанию -> опрос -> скачивание CSV -> parseAttributionCsv -> reports[id]=[skuStats].
// Двухфазно: сначала запрашиваем все UUID (генерятся параллельно у OZON), потом качаем.
// Каталожные кампании («Оплата за заказ») отчёт не отдают (400) - пропускаем. Без сети не
// запускается (нужны OZON_PERF_*). Выход data/ads_reports.json - тот же формат, что ждёт фронт.
import { readFileSync, writeFileSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionCsv, type SkuStat } from "./parse-attribution.js";

const OUT = "data/ads_reports.json";
const FLOOR = "2026-02-01";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function windowFor(days: number): { from: string; to: string } {
  const now = new Date(); const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); y.setUTCDate(y.getUTCDate() - 1);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - (days - 1));
  let from = fmt(f); if (from < FLOOR) from = FLOOR;
  return { from, to: fmt(y) };
}

function topIds(lb: string): string[] {
  let ts: any[] = [];
  try { ts = (JSON.parse(readFileSync("data/ads_periods.json", "utf-8"))[lb] || {}).top_spend || []; } catch { /* */ }
  if (!ts.some((c) => c && c.id)) { try { ts = JSON.parse(readFileSync("data/ads_30d.json", "utf-8")).top_spend || []; } catch { /* */ } }
  return [...new Set(ts.map((c) => String(c.id)).filter(Boolean))];
}

async function reportFor(perf: OzonPerformance, uuid: string): Promise<SkuStat[]> {
  for (let i = 0; i < 40; i++) {
    let st = "";
    try { st = String((await perf.statisticsState(uuid)).state ?? ""); } catch { return []; }
    if (/\b(ok|done|success|ready)\b/i.test(st)) break;
    if (/\b(error|fail)\b/i.test(st)) return [];
    await sleep(6000);
  }
  try { return parseAttributionCsv(await perf.downloadStatistics(uuid)); } catch { return []; }
}

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ad-attribution: OZON_PERF_* нет - пропуск (per-SKU не обновлён)"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });

  const out: Record<string, any> = { generated_at: new Date().toISOString(), source: "direct-ozon (attribution report)" };
  let totalNonEmpty = 0;
  for (const [lb, days] of [["p7", 7], ["p30", 30], ["p90", 90]] as const) {
    const w = windowFor(days);
    const ids = topIds(lb);
    // фаза 1: запрос отчётов (каталожные кампании -> 400 forbidden, пропускаем)
    const jobs: Array<{ id: string; uuid: string }> = [];
    for (const id of ids) {
      try { const uuid = await perf.requestStatistics([id], w.from, w.to); if (uuid) jobs.push({ id, uuid }); }
      catch { /* каталожная/недоступна - пропуск */ }
    }
    // фаза 2: опрос + скачивание + разбор
    const reports: Record<string, SkuStat[]> = {};
    for (const j of jobs) reports[j.id] = await reportFor(perf, j.uuid);
    const ne = Object.values(reports).filter((x) => x.length).length;
    totalNonEmpty += ne;
    out[lb] = { dateFrom: w.from, dateTo: w.to, reports };
    console.log(`${lb} (${w.from}..${w.to}): кампаний ${ids.length}, отчётов ${jobs.length}, с разбивкой ${ne}`);
  }
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`attribution-отчёт: непустых ${totalNonEmpty} -> ${OUT}`);
}

if (process.argv[1] && /ad-attribution\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-attribution FAILED:", (e as Error).message); process.exit(0); });
