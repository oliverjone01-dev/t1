// Дневной ряд рекламы для произвольного периода. Прямой OZON Performance, без n8n.
// dailyStats отдаёт строки ПО ДНЯМ; ads.ts их агрегирует в окно, а здесь копим как есть:
// data/ads_daily.ndjson, строка = {d, id, off, sp, o, om}. Догрузка от последнего дня в файле
// до вчера (самовосстановление). Дашборд (Фаза 1b) агрегирует любой период из этого ряда -
// так же, как уже делает для продаж из history.ndjson.
import { readFileSync, existsSync } from "node:fs";
import { OzonPerformance, type DailyStatRow } from "../../connector/ozon-performance.js";
import { dateWindows } from "./ads.js";
import { readRows, writeRows, replaceSlice, requireCredentials, shiftDay, closedDay } from "./collector-integrity.js";

const OUT = "data/ads_daily.ndjson";
const FLOOR = "2026-02-01"; // пол данных OZON (DOC_02 §4): раньше - нули

// vw = показы, cl = клики, ca = добавления в корзину (0, если OZON не отдаёт).
export interface DailyAdRec { d: string; id: string; off: string; sp: number; o: number; om: number; vw: number; cl: number; ca: number; }

// Чистое (без сети): строки dailyStats -> компактные записи в окне [from,to], с округлением.
export function dailyRecords(rows: DailyStatRow[], from: string, to: string): DailyAdRec[] {
  const out: DailyAdRec[] = [];
  for (const r of rows) {
    if (!r.date || r.date < from || r.date > to) continue;
    out.push({ d: r.date, id: String(r.id), off: r.title || String(r.id), sp: Math.round(r.spent), o: r.orders, om: Math.round(r.ordersMoney), vw: Math.round(r.views || 0), cl: Math.round(r.clicks || 0), ca: Math.round(r.toCart || 0) });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function nextDay(date: string): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return fmt(d); }

function lastDate(): string | null {
  if (!existsSync(OUT)) return null;
  let max: string | null = null;
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) {
    try { const d = JSON.parse(l).d; if (d && (!max || d > max)) max = d; } catch { /* битая строка - пропуск */ }
  }
  return max;
}

// Нужен полный пересбор, если файла нет или последняя строка ещё без новых полей (vw/cl/ca).
function needsBackfill(): boolean {
  if (!existsSync(OUT)) return true;
  const lines = readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean);
  if (!lines.length) return true;
  try { return !("vw" in JSON.parse(lines[lines.length - 1]!)); } catch { return true; }
}

export async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  requireCredentials(clientId, clientSecret);
  const perf = new OzonPerformance({ clientId, clientSecret });
  const ids = (await perf.campaigns()).map((c) => c.id);
  const to = closedDay();

  if (needsBackfill()) {
    // Разовый ПОЛНЫЙ пересбор FLOOR..вчера с показами/кликами/корзиной (иначе исторические дни без них).
    const recs: DailyAdRec[] = [];
    for (const [wf, wt] of dateWindows(FLOOR, to)) {
      const rows = await perf.dailyStats(ids, wf, wt);
      recs.push(...dailyRecords(rows, FLOOR, to));
    }
    recs.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    replaceSlice(readRows<DailyAdRec>(OUT), recs, () => true, r => `${r.d}|${r.id}`);
    writeRows(OUT, recs, r => `${r.d}|${r.id}`);
    console.log(`ads-daily: ПОЛНЫЙ пересбор ${FLOOR}..${to}: ${recs.length} строк (+показы/клики/корзина) -> ${OUT}`);
    return;
  }

  const last = lastDate();
  // Повтор хвоста восстанавливает частичный ответ и поздние поправки Performance.
  const from = last ? [FLOOR, [nextDay(last), shiftDay(to, -6)].sort()[0]!].sort().at(-1)! : FLOOR;
  if (from > to) { console.log(`ads-daily: ряд уже по ${last} (вчера ${to}) - догружать нечего`); return; }
  const recs: DailyAdRec[] = [];
  for (const [wf, wt] of dateWindows(from, to)) {
    const rows = await perf.dailyStats(ids, wf, wt);
    recs.push(...dailyRecords(rows, from, to));
  }
  if (!recs.length) throw new Error(`OZON не отдал строк за ${from}..${to}`);
  const merged = replaceSlice(readRows<DailyAdRec>(OUT), recs, r => r.d >= from && r.d <= to, r => `${r.d}|${r.id}`);
  merged.sort((a,b) => a.d.localeCompare(b.d) || a.id.localeCompare(b.id));
  writeRows(OUT, merged, r => `${r.d}|${r.id}`);
  const days = new Set(recs.map((r) => r.d)).size;
  console.log(`ads-daily: +${recs.length} строк за ${days} дн (${from}..${to}) -> ${OUT}`);
}

if (process.argv[1] && /ads-daily\.ts$/.test(process.argv[1])) main().catch(e => { console.error(e.message); process.exitCode = 1; });
