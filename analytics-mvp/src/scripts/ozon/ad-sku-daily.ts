// Рекламный расход ПО SKU по дням (все кампании CPC+CPO) -> data/ads_sku_daily.ndjson.
// Источник: OZON Performance. Attribution-отчёт (per-SKU, groupBy=DATE) генерится async и ТОЛЬКО
// по одной кампании за раз, поэтому: сперва быстрый dailyStats (расход по кампаниям, сверка суммы),
// кампании ранжируем по расходу и с нулевым пропускаем; затем per-SKU отчёты по одной кампании в
// порядке убывания расхода (с бюджетом времени - недобранное догрузит следующий прогон). Окно ~60
// дней (свежие месяцы для контроля рекламы); хвост 45 дн. Строка {d, sku, sp, om}. Без Perf - пропуск.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";

const OUT = "data/ads_sku_daily.ndjson";
const FLOOR = "2026-02-01";
const TAIL = 45;            // перетяжка хвоста при обновлении
const BACKFILL_DAYS = 60;   // первый бэкфилл: последние N дней (окно одного отчёта у OZON ≤ ~60)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function shiftDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }

type Row = { d: string; sku: string; sp: number; om: number };

function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) { try { out.push(JSON.parse(l)); } catch { /* skip */ } }
  return out;
}
async function reportRows(perf: OzonPerformance, uuid: string): Promise<ReturnType<typeof parseAttributionDaily>> {
  for (let i = 0; i < 60; i++) {
    let st = ""; try { st = String((await perf.statisticsState(uuid)).state ?? ""); } catch { return []; }
    if (/\b(ok|done|success|ready)\b/i.test(st)) break;
    if (/\b(error|fail)\b/i.test(st)) return [];
    await sleep(5000);
  }
  try { return parseAttributionDaily(await perf.downloadStatistics(uuid)); } catch { return []; }
}

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ad-sku-daily: OZON_PERF_* нет - пропуск"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });

  const existing = readExisting();
  const to = yesterday();
  let from = existing.length ? shiftDays(to, -(TAIL - 1)) : shiftDays(to, -(BACKFILL_DAYS - 1));
  if (from < FLOOR) from = FLOOR;
  if (from > to) { console.log(`ad-sku-daily: догружать нечего (${from} > ${to})`); return; }

  const camps = await perf.campaigns();
  // Быстрый расход по кампаниям за окно (без async): ранжируем и пропускаем нулевые.
  const stats = await perf.dailyStats(camps.map((c) => c.id), from, to);
  const spendByCamp: Record<string, number> = {};
  for (const r of stats) { const id = String((r as any).id || ""); spendByCamp[id] = (spendByCamp[id] || 0) + ((r as any).spent || 0); }
  const totalSpend = Object.values(spendByCamp).reduce((s, v) => s + v, 0);
  const ranked = Object.keys(spendByCamp).filter((id) => spendByCamp[id]! > 0).sort((a, b) => spendByCamp[b]! - spendByCamp[a]!);
  console.log(`ad-sku-daily: окно ${from}..${to}, кампаний с расходом ${ranked.length}, суммарный расход ${Math.round(totalSpend).toLocaleString("ru-RU")} ₽`);

  const budgetMin = Number(process.env.ADS_SKU_BUDGET_MIN || "9");
  const START = Date.now(), BUDGET_MS = budgetMin * 60 * 1000;
  const agg: Record<string, Row> = {};
  let done = 0, covered = 0, budgetHit = false;
  for (const id of ranked) {
    if (Date.now() - START > BUDGET_MS) { budgetHit = true; break; }
    let uuid = ""; try { uuid = await perf.requestStatistics([id], from, to, "DATE"); } catch { continue; }
    if (!uuid) continue;
    const rows = await reportRows(perf, uuid);
    if (rows.length) { done++; covered += spendByCamp[id] || 0; }
    for (const r of rows) {
      if (!r.sku || r.date < from || r.date > to) continue;
      const k = r.date + "|" + r.sku; const a = agg[k] || (agg[k] = { d: r.date, sku: String(r.sku), sp: 0, om: 0 });
      a.sp += r.sp || 0; a.om += r.om || 0;
    }
  }
  const fresh = Object.values(agg).map((r) => ({ d: r.d, sku: r.sku, sp: Math.round(r.sp), om: Math.round(r.om) }));
  const kept = existing.filter((r) => r.d < from);
  const merged = kept.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const spTotal = fresh.reduce((s, r) => s + r.sp, 0);
  const covPct = totalSpend ? Math.round(covered / totalSpend * 100) : 0;
  console.log(`ad-sku-daily: отчётов ${done}/${ranked.length}, покрыто расхода ${covPct}%, расход по SKU ${spTotal.toLocaleString("ru-RU")} ₽; всего ${merged.length} строк -> ${OUT}${budgetHit ? " (бюджет исчерпан, догрузим в следующий прогон)" : ""}`);
}

if (process.argv[1] && /ad-sku-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-sku-daily FAILED:", (e as Error).message); process.exit(0); });
