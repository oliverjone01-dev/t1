// Дневной ряд per-SKU атрибуции (основная/объединённая) для ПРОИЗВОЛЬНОГО периода.
// OZON Performance attribution-отчёт groupBy=DATE -> per-(день, SKU) с колонками модели.
// data/ads_attr_daily.ndjson: checkpoint каждой кампании + повтор последних 7 дней.
// CPO исключён; ошибки запроса, статуса, CSV не двигают checkpoint и дают exit 1.
import { readFileSync, existsSync } from "node:fs";
import { attributionReport, supportsSkuReport } from "./attribution-report.js";
import { readRows, writeRows, atomicText, replaceSlice, shiftDay, closedDay, requireCredentials } from "./collector-integrity.js";
import { OzonPerformance } from "../../connector/ozon-performance.js";


const OUT = "data/ads_attr_daily.ndjson";
const FLOOR = "2026-02-01";
const MAXW = 60; // окно одного отчёта, дней
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
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

export async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  requireCredentials(clientId, clientSecret);
  const perf = new OzonPerformance({ clientId, clientSecret });
  const to = closedDay(), recent = [FLOOR, shiftDay(to, -54)].sort().at(-1)!;
  const statePath = "data/ads_attr_state.json";
  const state: Record<string, { through: string; loaded_at: string }> = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  let existing = readRows<AttrDailyRec>(OUT);
  const supported = new Set((await perf.campaigns()).filter(supportsSkuReport).map(c => c.id));
  const spend = new Map<string, number>();
  const daily = readRows("data/ads_daily.ndjson");
  for (const r of daily) if (r.d >= shiftDay(to, -6) && r.d <= to) spend.set(String(r.id), (spend.get(String(r.id)) ?? 0) + r.sp);
  const ids = dashboardCampaignIds().filter(id => supported.has(id)).sort((a,b) => {
    // Сначала активные незакрытые кампании; дальше самые старые checkpoints.
    const sa = state[a]?.through ?? "", sb = state[b]?.through ?? "";
    return Number((spend.get(b) ?? 0) > 0) - Number((spend.get(a) ?? 0) > 0) || sa.localeCompare(sb) || (spend.get(b) ?? 0) - (spend.get(a) ?? 0);
  });
  if (!ids.length) throw new Error("Нет доступных CPC кампаний дашборда");
  const deadline = Date.now() + Number(process.env.ADS_ATTR_BUDGET_MIN || "9") * 60000;
  const failures: string[] = []; let processed = 0;
  for (const id of ids) {
    if (Date.now() >= deadline) break;
    const checkpoint = state[id]?.through;
    const from = checkpoint ? [recent, [shiftDay(checkpoint, 1), shiftDay(to, -6)].sort()[0]!].sort().at(-1)! : recent;
    try {
      const recs: AttrDailyRec[] = [];
      for (const [wf, wt] of windows(from, to)) {
        for (const r of await attributionReport(perf, id, wf, wt, deadline)) {
          if (r.date < wf || r.date > wt || !r.sku) throw new Error("Строка отчёта вне окна/без SKU");
          recs.push({ d: r.date, id, sku: r.sku, nm: r.name, sp: r.sp, sold: r.sold, om: r.om, soldM: r.soldModel, omM: r.omModel });
        }
      }
      const present = new Set(recs.map(r => r.d));
      if (daily.some(r => String(r.id) === id && r.d >= from && r.d <= to && r.sp > 0 && !present.has(r.d))) throw new Error("Неполный отчёт: нет SKU в день с расходом кампании");
      const merged = replaceSlice(existing, recs, r => r.id === id && r.d >= from && r.d <= to, r => `${r.d}|${r.id}|${r.sku}`);
      merged.sort((a,b) => a.d.localeCompare(b.d) || a.id.localeCompare(b.id) || a.sku.localeCompare(b.sku));
      writeRows(OUT, merged, r => `${r.d}|${r.id}|${r.sku}`);
      existing = merged;
      state[id] = { through: to, loaded_at: new Date().toISOString() };
      atomicText(statePath, JSON.stringify(state) + "\n");
      processed++;
    } catch (e) { failures.push(id); console.error(`ad-attr-daily: ${id}: ${(e as Error).message}; checkpoint сохранён`); }
  }
  console.log(`ad-attr-daily: обработано ${processed}/${ids.length}; checkpoints по кампаниям -> ${statePath}`);
  if (failures.length) throw new Error(`Не обновлены кампании: ${failures.join(", ")}`);
  if (ids.some(id => state[id]?.through !== to)) throw new Error("Бюджет исчерпан; остались кампании в очереди, нужен следующий прогон");
}

if (process.argv[1] && /ad-attribution-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-attr-daily FAILED:", (e as Error).message); process.exitCode = 1; });
