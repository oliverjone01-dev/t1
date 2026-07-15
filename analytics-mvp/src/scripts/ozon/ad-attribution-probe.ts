// PROBE: разведка attribution-отчёта OZON Performance (per-SKU «продажи в продвижении» +
// объединённая карточка). Из контейнера OZON закрыт, поэтому запускаем в Actions и смотрим лог.
// Цель: подтвердить эндпоинт/тело/формат ответа, чтобы построить парсер и продьюсер.
// Дампит сырой ответ в лог и data/_attribution_probe.txt. НЕ в ночном синке.
import { readFileSync, writeFileSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("probe: OZON_PERF_* нет - пропуск"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });

  let id = process.argv[2] || "";
  if (!id) {
    try { id = String((JSON.parse(readFileSync("data/ads_30d.json", "utf-8")).top_spend || [])[0]?.id || ""); } catch { /* */ }
  }
  if (!id) { console.error("probe: нет id кампании (data/ads_30d.json пуст и не передан аргументом)"); return; }

  const groupBy = process.argv[3] || "NO_GROUP_BY";
  const now = new Date(); const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - 29);
  console.log(`probe: кампания ${id}, окно ${fmt(from)}..${fmt(to)}, groupBy=${groupBy}`);

  const ids = id.split(",").map((s) => s.trim()).filter(Boolean);
  console.log(`probe: кампаний в запросе - ${ids.length}`);

  // Разведка: сырые строки daily/json (все поля) - ищем выручку CPO, которой нет в orders/ordersMoney.
  try {
    const raw = await perf.dailyStatsRaw(ids, fmt(from), fmt(to));
    console.log(`\n=== daily/json RAW: ${raw.length} строк. Поля первой строки: ===`);
    if (raw[0]) console.log(JSON.stringify(Object.keys(raw[0])));
    let sp = 0, o = 0, om = 0; const extra: Record<string, number> = {};
    for (const r of raw) {
      sp += Number(r.moneySpent) || 0; o += Number(r.orders) || 0; om += Number(r.ordersMoney) || 0;
      for (const k of Object.keys(r)) if (!["id", "title", "date", "views", "clicks", "moneySpent", "orders", "ordersMoney"].includes(k)) { const v = Number(r[k]); if (!isNaN(v)) extra[k] = (extra[k] || 0) + v; }
    }
    console.log(`daily/json СУММЫ: расход=${sp} заказы=${o} выручка(ordersMoney)=${om}`);
    console.log(`daily/json ПРОЧИЕ числовые поля (сумма):`, JSON.stringify(extra));
    if (raw[0]) console.log(`daily/json пример строки:`, JSON.stringify(raw[0]));
  } catch (e) { console.error("probe dailyStatsRaw FAILED:", (e as Error).message); }

  let uuid = "";
  try { uuid = await perf.requestStatistics(ids, fmt(from), fmt(to), groupBy); }
  catch (e) { console.error("probe requestStatistics FAILED:", (e as Error).message); return; }
  console.log("probe: UUID =", uuid || "(пусто)");
  if (!uuid) return;

  let state: any = null, ready = false;
  for (let i = 0; i < 50; i++) {
    try { state = await perf.statisticsState(uuid); } catch (e) { console.error("probe state FAILED:", (e as Error).message); break; }
    const st = String(state.state ?? state.status ?? "");
    if (i % 5 === 0 || /\b(ok|done|success|ready|error|fail)\b/i.test(st)) console.log(`probe state[${i}]: ${st}`);
    if (/\b(ok|done|success|ready)\b/i.test(st)) { ready = true; break; }
    if (/\b(error|fail)\b/i.test(st)) { console.error("probe: отчёт в ошибке:", JSON.stringify(state).slice(0, 300)); break; }
    await sleep(6000); // отчёт OZON генерится минутами
  }
  if (!ready) { console.warn("probe: отчёт не готов за ~5 мин (статус не OK) - скачивание пропущено"); return; }

  try {
    const raw = await perf.downloadStatistics(uuid);
    const head = raw.slice(0, 4).split("").map((ch) => ch.charCodeAt(0));
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // 'PK' - ZIP-архив
    console.log(`probe: report длиной ${raw.length}, первые байты [${head}] ${isZip ? "= ZIP-архив (multi-campaign)" : "= текст/CSV"}`);
    console.log(`Первые 3000 символов:\n----8<----\n${raw.slice(0, 3000)}\n----8<----`);
    writeFileSync("data/_attribution_probe.txt", raw.slice(0, 50000));
    console.log("probe: сырой отчёт сохранён -> data/_attribution_probe.txt");
  } catch (e) { console.error("probe download FAILED:", (e as Error).message); }
}

main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
