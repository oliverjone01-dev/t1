// Рекламный расход CPC ПО SKU по дням -> data/ads_sku_daily.ndjson (НАКОПИТЕЛЬНО).
// Источник: OZON Performance attribution-отчёт (per-SKU, groupBy=DATE), генерится async ~2 мин на
// кампанию и только по одной за раз - за один прогон всех не успеть. Поэтому НАКАПЛИВАЕМ: состояние
// (какая кампания когда собрана) в data/ads_sku_state.json; каждый прогон добираем в первую очередь
// НЕ собранные кампании (по убыванию расхода), затем обновляем самые «протухшие». Уже собранные
// кампании НЕ теряются между прогонами. Ночной синк добирает по чуть-чуть, dispatch (большой бюджет) -
// пачкой. Строка = {d, cid, sku, sp, om}. Окно - последние WINDOW дней. Ошибка даёт exit 1, старые строки сохраняются.
import { readFileSync, existsSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { attributionReport, supportsSkuReport } from "./attribution-report.js";
import { windows } from "./ad-attribution-daily.js";
import { readRows, atomicText, writeRows, replaceSlice, requireCredentials, closedDay, validateRows } from "./collector-integrity.js";

const OUT = "data/ads_sku_daily.ndjson";
const STATE = "data/ads_sku_state.json";
const FLOOR = "2026-02-01";
const WINDOW = 62; // скользящее окно, дней (свежие месяцы для контроля рекламы)
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function today(): string { return fmt(new Date()); }
function shiftDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }

type Row = { d: string; cid: string; sku: string; sp: number; om: number; ca: number }; // ca = добавления в корзину (реклама)

export async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  requireCredentials(clientId, clientSecret);
  const perf = new OzonPerformance({ clientId, clientSecret });

  const to = closedDay();
  let from = shiftDays(to, -(WINDOW - 1)); if (from < FLOOR) from = FLOOR;

  const camps = await perf.campaigns();
  const stats = await perf.dailyStats(camps.map((c) => c.id), from, to);
  const spendByCamp: Record<string, number> = {};
  for (const r of stats) { const id = String((r as any).id || ""); spendByCamp[id] = (spendByCamp[id] || 0) + ((r as any).spent || 0); }
  const supported = new Set(camps.filter(supportsSkuReport).map(c => c.id));
  const unsupportedSpend = Object.entries(spendByCamp).filter(([id]) => !supported.has(id)).reduce((s, [,v]) => s + v, 0);
  const totalSpend = Object.entries(spendByCamp).filter(([id]) => supported.has(id)).reduce((s, [,v]) => s + v, 0);
  const ranked = Object.keys(spendByCamp).filter((id) => spendByCamp[id]! > 0 && supported.has(id));

  const state: Record<string, string> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const existing = readRows<Row>(OUT);
  const failures: string[] = [];
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
    try {
      const rows = [];
      for (const [wf, wt] of windows(from, to)) {
        const part = await attributionReport(perf, cid, wf, wt, START + BUDGET_MS);
        if (part.some(r => r.date < wf || r.date > wt || !r.sku)) throw new Error("Ответ вне окна/без SKU");
        rows.push(...part);
      }
      const recs = rows.filter(r => r.sku && r.date >= from && r.date <= to).map(r => ({ d: r.date, cid, sku: String(r.sku), sp: Math.round(r.sp), om: Math.round(r.om), ca: Math.round(r.toCart) }));
      validateRows(recs, r => `${r.d}|${r.cid}|${r.sku}`);
      const present = new Set(recs.map(r => r.d));
      if (stats.some(r => r.id === cid && r.spent > 0 && !present.has(r.date))) throw new Error("Неполный отчёт: нет SKU в день с расходом кампании");
      replaceSlice(existing, recs, r => r.cid === cid && r.d >= from && r.d <= to);
      fresh.push(...recs); processed.add(cid); state[cid] = today();
    } catch (e) { failures.push(cid); console.error(`ad-sku-daily: ${cid}: ${(e as Error).message}; прошлые строки сохранены`); }
  }
  const kept = existing.filter(r => !(processed.has(r.cid) && r.d >= from && r.d <= to));
  const merged = kept.concat(fresh).sort((a, b) => a.d.localeCompare(b.d) || a.cid.localeCompare(b.cid) || a.sku.localeCompare(b.sku));
  writeRows(OUT, merged, r => `${r.d}|${r.cid}|${r.sku}`);
  atomicText(STATE, JSON.stringify(state) + "\n");

  // Покрытие: доля расхода по ВСЕМ уже собранным кампаниям (не только этого прогона).
  const inWindow = merged.filter(r => r.d >= from && r.d <= to);
  const collectedCids = new Set(inWindow.map((r) => r.cid));
  const collectedDays = new Set(inWindow.map(r => `${r.d}|${r.cid}`));
  const covered = stats.filter(r => supported.has(r.id) && collectedDays.has(`${r.date}|${r.id}`)).reduce((s,r) => s+r.spent, 0);
  const covPct = totalSpend ? Math.round(covered / totalSpend * 100) : 0;
  const spTotal = inWindow.reduce((s, r) => s + r.sp, 0);
  console.log(`ad-sku-daily: CPO без SKU API: расход ${Math.round(unsupportedSpend)} ₽, исключён из покрытия CPC`);
  console.log(`ad-sku-daily: окно ${from}..${to}; за прогон +${processed.size} кампаний; собрано ${collectedCids.size}/${ranked.length} кампаний, покрыто расхода ${covPct}%; расход по SKU ${Math.round(spTotal).toLocaleString("ru-RU")} ₽, строк ${merged.length}${budgetHit ? " (бюджет исчерпан, продолжим в следующий прогон)" : " (все кампании собраны)"}`);
  if (failures.length) throw new Error(`Не обновлены кампании: ${failures.join(", ")}`);
}

if (process.argv[1] && /ad-sku-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ad-sku-daily FAILED:", (e as Error).message); process.exitCode = 1; });
