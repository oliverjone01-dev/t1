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

  const now = new Date(); const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - 29);
  console.log(`probe: кампания ${id}, окно ${fmt(from)}..${fmt(to)}`);

  let uuid = "";
  try { uuid = await perf.requestStatistics([id], fmt(from), fmt(to)); }
  catch (e) { console.error("probe requestStatistics FAILED:", (e as Error).message); return; }
  console.log("probe: UUID =", uuid || "(пусто)");
  if (!uuid) return;

  let state: any = null;
  for (let i = 0; i < 20; i++) {
    try { state = await perf.statisticsState(uuid); } catch (e) { console.error("probe state FAILED:", (e as Error).message); break; }
    const s = JSON.stringify(state).slice(0, 300);
    console.log(`probe state[${i}]:`, s);
    if (/\b(ok|done|success|ready)\b/i.test(JSON.stringify(state.state ?? state.status ?? ""))) break;
    await sleep(3000);
  }

  try {
    const raw = await perf.downloadStatistics(uuid);
    console.log(`probe: report длиной ${raw.length}. Первые 3000 символов:\n----8<----\n${raw.slice(0, 3000)}\n----8<----`);
    writeFileSync("data/_attribution_probe.txt", raw.slice(0, 50000));
    console.log("probe: сырой отчёт сохранён -> data/_attribution_probe.txt");
  } catch (e) { console.error("probe download FAILED:", (e as Error).message); }
}

main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
