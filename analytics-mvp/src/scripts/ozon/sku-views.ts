// Прямой per-SKU дневной ряд показов/воронки OZON -> data/sku_views.ndjson.
// Заменяет мёртвый n8n-ingest (после удаления n8n файл замораживался на 18.06, из-за чего
// «Воронка по категориям» пуста за свежие периоды). Один запрос analytics(dimension=sku) на день
// с полными метриками (+показы в поиске/посещения карточки). Догрузка от последнего дня до вчера
// (самовосстановление). Без OZON_SELLER_* не запускается.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/sku_views.ndjson";
const FLOOR = "2026-02-06"; // раньше аккаунт не работал
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function nextDay(date: string): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return fmt(d); }
function eachDay(from: string, to: string): string[] { const out: string[] = []; let s = from; while (s <= to) { out.push(s); s = nextDay(s); } return out; }

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
  if (!clientId || !apiKey) { console.warn("sku-views: OZON_SELLER_* нет - пропуск (per-SKU показы не обновлены)"); return; }
  const last = lastDate();
  const from = last ? nextDay(last) : FLOOR;
  const to = yesterday();
  if (from > to) { console.log(`sku-views: ряд уже по ${last} (вчера ${to}) - догружать нечего`); return; }

  const seller = new OzonSeller({ clientId, apiKey });
  let total = 0; const days = eachDay(from, to);
  for (const day of days) {
    let rows: any[] = [];
    try { rows = await seller.skuViewsDay(day); } catch (e) { console.warn(`sku-views: ${day} - ${(e as Error).message}`); continue; }
    // только строки с активностью (как n8n) - чтобы не раздувать пустыми
    const keep = rows.filter((r) => (r.views || 0) > 0 || (r.cart || 0) > 0 || (r.units || 0) > 0 || (r.ret || 0) > 0 || (r.canc || 0) > 0);
    if (keep.length) { appendFileSync(OUT, keep.map((r) => JSON.stringify(r)).join("\n") + "\n"); total += keep.length; }
  }
  if (!total) { console.log(`sku-views: OZON не отдал строк за ${from}..${to} (аналитика отстаёт?)`); return; }
  console.log(`sku-views: +${total} строк за ${days.length} дн (${from}..${to}) -> ${OUT}`);
}

if (process.argv[1] && /sku-views\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("sku-views FAILED:", (e as Error).message); process.exit(0); });
