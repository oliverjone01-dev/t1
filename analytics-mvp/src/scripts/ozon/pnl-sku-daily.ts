// Per-SKU ДНЕВНОЙ ряд финансов OZON с разбивкой сборов -> data/pnl_sku_daily.ndjson.
// Нужен для раздела «Аналитика по SKU» на странице Маркетинг: финансы по артикулу ТОЧНО за
// выбранный период (не снимок). Источник - /v3/finance/transaction/list. Разносим по SKU только
// операции с ОДНИМ РАЗНЫМ артикулом (опт одного SKU - тоже сюда; комплекты из разных SKU - нет,
// как в pnl-sku-breakdown). Сборы: sale_commission / delivery / acquiring / storage / otherSvc.
// Финоперации доначисляются задним числом, поэтому каждый прогон ПЕРЕтягивает хвост TAIL дней и
// заменяет их в файле (старше хвоста - оставляем как есть). Без OZON_SELLER_* не запускается.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/pnl_sku_daily.ndjson";
const FLOOR = "2026-02-01";       // раньше аккаунт не работал
const TAIL = 45;                   // сколько последних дней перетягивать (доначисления задним числом)
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function minusDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return fmt(d); }

function svcBucket(name: string): "delivery" | "acquiring" | "storage" | "other" {
  const n = name.toLowerCase();
  if (/эквайринг|acquiring/.test(n)) return "acquiring";
  if (/хранени|storage/.test(n)) return "storage";
  if (/логист|доставк|logistic|lastmile|last\s*mile|dropoff|handoverplace|returnspvz|deliveryto/.test(n)) return "delivery";
  return "other";
}

type Row = { d: string; sku: string; accruals: number; commission: number; delivery: number; acquiring: number; storage: number; otherSvc: number; amount: number };

// Чистая агрегация ops -> строки (день,sku). Только один РАЗНЫЙ артикул в операции.
export function aggregateDaily(ops: any[]): Row[] {
  const by: Record<string, Row> = {};
  for (const o of ops) {
    const items = o.items || [];
    const distinct = Array.from(new Set(items.map((it: any) => String((it && it.sku) || "")).filter((s: string) => s && s !== "0")));
    if (distinct.length !== 1) continue;
    const sku = distinct[0]!;
    const day = String(o.operation_date || "").slice(0, 10);
    if (!day) continue;
    const key = day + "|" + sku;
    let r = by[key];
    if (!r) { r = { d: day, sku, accruals: 0, commission: 0, delivery: 0, acquiring: 0, storage: 0, otherSvc: 0, amount: 0 }; by[key] = r; }
    r.accruals += o.accruals_for_sale || 0;
    r.commission += o.sale_commission || 0;
    r.delivery += (o.delivery_charge || 0) + (o.return_delivery_charge || 0);
    r.amount += o.amount || 0;
    for (const s of (o.services || [])) {
      const price = s.price || 0;
      switch (svcBucket(String(s.name || ""))) {
        case "acquiring": r.acquiring += price; break;
        case "storage": r.storage += price; break;
        case "delivery": r.delivery += price; break;
        default: r.otherSvc += price;
      }
    }
  }
  const out = Object.values(by);
  for (const r of out) { r.accruals = Math.round(r.accruals); r.commission = Math.round(r.commission); r.delivery = Math.round(r.delivery); r.acquiring = Math.round(r.acquiring); r.storage = Math.round(r.storage); r.otherSvc = Math.round(r.otherSvc); r.amount = Math.round(r.amount); }
  // не пишем полностью нулевые строки
  return out.filter((r) => r.accruals || r.commission || r.delivery || r.acquiring || r.storage || r.otherSvc || r.amount);
}

function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) {
    try { out.push(JSON.parse(l)); } catch { /* битая строка */ }
  }
  return out;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-sku-daily: OZON_SELLER_* нет - пропуск"); return; }
  const existing = readExisting();
  const to = yesterday();
  // перетягиваем хвост: если файла нет - с FLOOR (полный бэкфилл), иначе последние TAIL дней
  let from = existing.length ? minusDays(to, TAIL - 1) : FLOOR;
  if (from < FLOOR) from = FLOOR;
  if (from > to) { console.log(`pnl-sku-daily: перетягивать нечего (${from} > ${to})`); return; }

  const ops = await new OzonSeller({ clientId, apiKey }).transactions(from, to);
  const fresh = aggregateDaily(ops);
  // склейка: старые дни (< from) + свежие (>= from). Дни в [from..to] полностью заменяются свежими.
  const kept = existing.filter((r) => r.d < from);
  const merged = kept.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const days = new Set(fresh.map((r) => r.d)).size;
  console.log(`pnl-sku-daily: перетянул ${from}..${to} (${days} дн, ${fresh.length} строк), в файле всего ${merged.length} строк -> ${OUT}`);
}

if (process.argv[1] && /pnl-sku-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-sku-daily FAILED:", (e as Error).message); process.exit(0); });
