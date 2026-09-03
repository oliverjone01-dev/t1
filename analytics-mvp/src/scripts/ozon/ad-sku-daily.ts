// Рекламный расход ПО SKU по дням (ВСЕ кампании: CPC + CPO) -> data/ads_sku_daily.ndjson.
// Источник: OZON Performance attribution-отчёт (groupBy=DATE) по батчам всех кампаний.
// Отличие от ads_attr_daily (только топ-спенд, для маркетинга): здесь ВСЕ кампании, чтобы
// сумма сходилась с финансовой рекламой (за август 2,31 млн = CPC 1,21 + CPO 1,10). Нужен,
// чтобы завести «Рекламу» отдельной колонкой в «Аналитику по SKU» - как факт, не правилом.
// Строка = {d, sku, sp, om} (расход + выручка от рекламы). Тянет хвост 45 дн, полный бэкфилл
// от FLOOR при пустом файле. Бюджет времени - env ADS_SKU_BUDGET_MIN (отчёты OZON медленные,
// 1 активный за раз; недобранное догрузит следующий прогон). Без OZON_PERF_* - пропуск.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { OzonPerformance, batchCampaigns } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";

const OUT = "data/ads_sku_daily.ndjson";
const FLOOR = "2026-02-01";
const TAIL = 45;
const MAXW = 60; // окно одного отчёта, дней
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function shiftDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }

type Row = { d: string; sku: string; sp: number; om: number };

export function windows(from: string, to: string): Array<[string, string]> {
  const out: Array<[string, string]> = []; let s = from;
  while (s <= to) { let e = shiftDays(s, MAXW - 1); if (e > to) e = to; out.push([s, e]); s = shiftDays(e, 1); }
  return out;
}
function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) { try { out.push(JSON.parse(l)); } catch { /* skip */ } }
  return out;
}
async function reportRows(perf: OzonPerformance, uuid: string): Promise<ReturnType<typeof parseAttributionDaily>> {
  for (let i = 0; i < 80; i++) {
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
  if (!clientId || !clientSecret) { console.warn("ad-sku-daily: OZON_PERF_* нет - пропуск"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });
  const camps = await perf.campaigns();
  const ids = camps.map((c) => c.id);
  if (!ids.length) { console.warn("ad-sku-daily: нет кампаний - пропуск"); return; }

  const existing = readExisting();
  const to = yesterday();
  let from = existing.length ? shiftDays(to, -(TAIL - 1)) : FLOOR;
  if (from < FLOOR) from = FLOOR;
  if (from > to) { console.log(`ad-sku-daily: догружать нечего (${from} > ${to})`); return; }

  const budgetMin = Number(process.env.ADS_SKU_BUDGET_MIN || "9");
  const START = Date.now(), BUDGET_MS = budgetMin * 60 * 1000;
  // Агрегируем расход/выручку по (день, sku) через все батчи кампаний.
  const agg: Record<string, Row> = {};
  let reachedTo = from, budgetHit = false, reports = 0;
  outer:
  for (const [wf, wt] of windows(from, to)) {
    for (const batch of batchCampaigns(ids)) { // по 25 кампаний в один отчёт
      if (Date.now() - START > BUDGET_MS) { budgetHit = true; break outer; }
      let uuid = "";
      try { uuid = await perf.requestStatistics(batch, wf, wt, "DATE"); } catch { continue; }
      if (!uuid) continue;
      reports++;
      const rows = await reportRows(perf, uuid);
      for (const r of rows) {
        if (!r.sku || r.date < wf || r.date > wt) continue;
        const k = r.date + "|" + r.sku; const a = agg[k] || (agg[k] = { d: r.date, sku: String(r.sku), sp: 0, om: 0 });
        a.sp += r.sp || 0; a.om += r.om || 0;
      }
    }
    reachedTo = wt;
    if (budgetHit) break;
  }
  const fresh = Object.values(agg).map((r) => ({ d: r.d, sku: r.sku, sp: Math.round(r.sp), om: Math.round(r.om) }));
  // Перезаписываем перекрытый диапазон [from..reachedTo], старое вне него сохраняем.
  const kept = existing.filter((r) => r.d < from || r.d > reachedTo);
  const merged = kept.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const spTotal = fresh.reduce((s, r) => s + r.sp, 0);
  console.log(`ad-sku-daily: ${reports} отчётов, ${from}..${reachedTo}, свежих строк ${fresh.length}, расход ${spTotal.toLocaleString("ru-RU")} ₽; всего ${merged.length} строк -> ${OUT}${budgetHit ? " (бюджет исчерпан, догрузим в следующий прогон)" : ""}`);
}

if (process.argv[1] && /ad-sku-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-sku-daily FAILED:", (e as Error).message); process.exit(0); });
