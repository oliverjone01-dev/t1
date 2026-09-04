// Рекламный расход ПО SKU по дням (все кампании CPC+CPO) -> data/ads_sku_daily.ndjson (НАКОПИТЕЛЬНО).
// Источник: OZON Performance attribution-отчёт (per-SKU, groupBy=DATE), генерится async ~2 мин на
// кампанию и только по одной за раз - за один прогон всех не успеть. Поэтому НАКАПЛИВАЕМ: состояние
// (какая кампания когда собрана) в data/ads_sku_state.json; каждый прогон добираем в первую очередь
// НЕ собранные кампании (по убыванию расхода), затем обновляем самые «протухшие». Уже собранные
// кампании НЕ теряются между прогонами. Ночной синк добирает по чуть-чуть, dispatch (большой бюджет) -
// пачкой. Строка = {d, cid, sku, sp, om}. Окно - последние WINDOW дней. Без OZON_PERF_* - пропуск.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";

const OUT = "data/ads_sku_daily.ndjson";
const STATE = "data/ads_sku_state.json";
const FLOOR = "2026-02-01";
const WINDOW = 62; // скользящее окно, дней (свежие месяцы для контроля рекламы)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function today(): string { return fmt(new Date()); }
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function shiftDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }

type Row = { d: string; cid: string; sku: string; sp: number; om: number; ca: number }; // ca = добавления в корзину (реклама)

function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) { try { const r = JSON.parse(l); if (r && r.cid != null) out.push(r); } catch { /* skip */ } }
  return out;
}
function readState(): Record<string, string> { try { return JSON.parse(readFileSync(STATE, "utf-8")); } catch { return {}; } }

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

  const to = yesterday();
  let from = shiftDays(to, -(WINDOW - 1)); if (from < FLOOR) from = FLOOR;

  const camps = await perf.campaigns();
  const stats = await perf.dailyStats(camps.map((c) => c.id), from, to);
  const spendByCamp: Record<string, number> = {};
  for (const r of stats) { const id = String((r as any).id || ""); spendByCamp[id] = (spendByCamp[id] || 0) + ((r as any).spent || 0); }
  const totalSpend = Object.values(spendByCamp).reduce((s, v) => s + v, 0);
  const ranked = Object.keys(spendByCamp).filter((id) => spendByCamp[id]! > 0);

  const state = readState();
  // Порядок: сначала НЕ собранные (по убыванию расхода), затем собранные - самые протухшие первыми.
  const order = ranked.slice().sort((a, b) => {
    const sa = state[a], sb = state[b];
    if (!sa && sb) return -1; if (sa && !sb) return 1;
    if (!sa && !sb) return spendByCamp[b]! - spendByCamp[a]!;
    return sa! < sb! ? -1 : sa! > sb! ? 1 : 0;
  });

  const budgetMin = Number(process.env.ADS_SKU_BUDGET_MIN || "9");
  const START = Date.now(), BUDGET_MS = budgetMin * 60 * 1000;
  const fresh: Row[] = []; const processed = new Set<string>(); let budgetHit = false;
  for (const cid of order) {
    if (Date.now() - START > BUDGET_MS) { budgetHit = true; break; }
    let uuid = ""; try { uuid = await perf.requestStatistics([cid], from, to, "DATE"); } catch { state[cid] = today(); processed.add(cid); continue; }
    if (!uuid) continue;
    const rows = await reportRows(perf, uuid);
    processed.add(cid); state[cid] = today();
    for (const r of rows) {
      if (!r.sku || r.date < from || r.date > to) continue;
      fresh.push({ d: r.date, cid, sku: String(r.sku), sp: Math.round(r.sp || 0), om: Math.round(r.om || 0), ca: Math.round((r as any).toCart || 0) });
    }
  }
  // Накопление: сохраняем всё, КРОМЕ строк собранных сейчас кампаний в окне (их заменяем свежими).
  const existing = readExisting();
  const kept = existing.filter((r) => r.d >= FLOOR && !(processed.has(r.cid) && r.d >= from && r.d <= to));
  const merged = kept.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(STATE, JSON.stringify(state, null, 0) + "\n");

  // Покрытие: доля расхода по ВСЕМ уже собранным кампаниям (не только этого прогона).
  const collectedCids = new Set(merged.map((r) => r.cid));
  const covered = ranked.filter((id) => collectedCids.has(id)).reduce((s, id) => s + spendByCamp[id]!, 0);
  const covPct = totalSpend ? Math.round(covered / totalSpend * 100) : 0;
  const spTotal = merged.reduce((s, r) => s + r.sp, 0);
  console.log(`ad-sku-daily: окно ${from}..${to}; за прогон +${processed.size} кампаний; собрано ${collectedCids.size}/${ranked.length} кампаний, покрыто расхода ${covPct}%; расход по SKU ${Math.round(spTotal).toLocaleString("ru-RU")} ₽, строк ${merged.length}${budgetHit ? " (бюджет исчерпан, продолжим в следующий прогон)" : " (все кампании собраны)"}`);
}

if (process.argv[1] && /ad-sku-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-sku-daily FAILED:", (e as Error).message); process.exit(0); });
