// Прямой канальный дневной ряд воронки/тоталов OZON -> data/daily_totals.ndjson.
// Заменяет мёртвый n8n-ingest (после удаления n8n файл замораживался). Дедуплицированные
// дневные итоги OZON (dimension=day) - как в UI: выручка, заказы, показы (всего/в поиске),
// посещения карточки, в корзину, доставлено, возвраты, отмены. Догрузка от последнего дня
// до вчера (самовосстановление). Без OZON_SELLER_* не запускается.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/daily_totals.ndjson";
const FLOOR = "2026-02-01";
const MAXW = 60; // окно одного запроса аналитики, дней
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function nextDay(date: string): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return fmt(d); }

function windows(from: string, to: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = from;
  while (s <= to) {
    const e = new Date(s + "T00:00:00Z"); e.setUTCDate(e.getUTCDate() + (MAXW - 1));
    const et = fmt(e) < to ? fmt(e) : to;
    out.push([s, et]); s = nextDay(et);
  }
  return out;
}

function lastDate(): string | null {
  if (!existsSync(OUT)) return null;
  let max: string | null = null;
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) {
    try { const d = JSON.parse(l).date; if (d && (!max || d > max)) max = d; } catch { /* битая строка */ }
  }
  return max;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("daily-totals: OZON_SELLER_* нет - пропуск (канальный ряд не обновлён)"); return; }
  const last = lastDate();
  const from = last ? nextDay(last) : FLOOR;
  const to = yesterday();
  if (from > to) { console.log(`daily-totals: ряд уже по ${last} (вчера ${to}) - догружать нечего`); return; }

  const seller = new OzonSeller({ clientId, apiKey });
  const recs: any[] = [];
  for (const [wf, wt] of windows(from, to)) {
    const rows = await seller.dayTotals(wf, wt);
    for (const r of rows) if (r.date >= from && r.date <= to) recs.push(r);
  }
  if (!recs.length) { console.log(`daily-totals: OZON не отдал дней за ${from}..${to} (аналитика отстаёт?)`); return; }
  recs.sort((a, b) => (a.date < b.date ? -1 : 1));
  appendFileSync(OUT, recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`daily-totals: +${recs.length} дн (${recs[0].date}..${recs[recs.length - 1].date}) -> ${OUT}`);
}

if (process.argv[1] && /daily-totals\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("daily-totals FAILED:", (e as Error).message); process.exit(0); });
