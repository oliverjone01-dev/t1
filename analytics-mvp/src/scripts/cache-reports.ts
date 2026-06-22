// УСТАРЕЛ (n8n). Кэш per-SKU отчётов рекламы жил на n8n-вебхуке {report:id}; у n8n Cloud
// исчерпана квота, источник мёртв. Прямой порт per-SKU отчёта (async statistics report OZON
// Performance) - отдельная задача после ротации ключей; на дашборде разбивка помечена «на паузе»
// и показывает дату последнего кэша (data/ads_reports.json). Скрипт НЕ запускается в ночном
// синке (ozon-snapshots.yml). Чтобы случайный ручной запуск не молотил мёртвый n8n - выходим
// сразу, если явно не разрешено N8N-обращение (CACHE_REPORTS_ALLOW_N8N=1).
import { writeFileSync } from "node:fs";

if (process.env.CACHE_REPORTS_ALLOW_N8N !== "1") {
  console.warn("cache-reports УСТАРЕЛ: n8n-источник мёртв (квота). per-SKU кэш на паузе до прямого порта. Пропуск.");
  process.exit(0);
}

const BASE = process.env.N8N_WEBHOOK_BASE || "https://gen-group.app.n8n.cloud/webhook";
const FLOOR = "2026-02-01";

function window(days: number): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  y.setUTCDate(y.getUTCDate() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(y);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - (days - 1));
  let from = fmt(f);
  if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hit(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${BASE}/gengroup-ozon-ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`ads: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const out: Record<string, any> = { generated_at: new Date().toISOString() };
  let okTotal = 0, all = 0;
  for (const [label, days] of [["p7", 7], ["p30", 30], ["p90", 90]] as const) {
    const w = window(days);
    let bulk: any;
    try { bulk = await hit({ dateFrom: w.dateFrom, dateTo: w.dateTo }); }
    catch (e) { console.warn(`bulk ${label} failed: ${(e as Error).message}`); out[label] = { ...w, reports: {} }; continue; }
    const ids: string[] = (bulk.top_spend || []).map((c: any) => String(c.id));
    const reports: Record<string, any[]> = {};
    for (const id of ids) {
      all++;
      try {
        const r = await hit({ report: id, dateFrom: w.dateFrom, dateTo: w.dateTo });
        const ss = (r && r.skuStats) || [];
        reports[id] = ss;
        if (ss.length) okTotal++;
      } catch (e) { reports[id] = []; }
      await sleep(1500); // не долбить OZON между отчётами
    }
    out[label] = { dateFrom: w.dateFrom, dateTo: w.dateTo, reports };
    console.log(`${label}: ${ids.length} кампаний, отчётов с данными ${Object.values(reports).filter((x) => x.length).length}`);
  }
  writeFileSync("data/ads_reports.json", JSON.stringify(out));
  console.log(`Кэш отчётов: непустых ${okTotal}/${all}. -> data/ads_reports.json`);
}

main();
