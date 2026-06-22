// Прямой клиент OZON Seller - замена n8n-вебхука gengroup-ozon-pnl-sku (без n8n).
// Использует connector/OzonSeller (withRetry: 429/5xx, без ретрая невозвратных 4xx - FENIX G4).
// Агрегирует транзакции по SKU (операции с ОДНИМ товаром): начислено, комиссия, к выплате.
// Креды из env: OZON_SELLER_CLIENT_ID, OZON_SELLER_API_KEY (GitHub Secrets).
// Запуск: tsx src/scripts/ozon/pnl-sku.ts [dateFrom] [dateTo] [outFile]
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const FLOOR = "2026-02-01";

function window30(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); y.setUTCDate(y.getUTCDate() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(y);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - 29);
  let from = fmt(f); if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}

type Agg = { accruals: number; commission: number; amount: number; ops: number };

export async function pnlBySku(dateFrom: string, dateTo: string): Promise<any> {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) throw new Error("OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY не заданы (GitHub Secrets)");
  const ops = await new OzonSeller({ clientId, apiKey }).transactions(dateFrom, dateTo);
  const bySku: Record<string, Agg> = {};
  let multi = 0, single = 0;
  for (const o of ops) {
    const items = o.items || [];
    if (items.length !== 1) { if (items.length > 1) multi++; continue; } // только операции с одним товаром (как n8n)
    single++;
    const sku = String((items[0] && items[0].sku) || "");
    if (!sku || sku === "0") continue;
    let a = bySku[sku]; if (!a) { a = { accruals: 0, commission: 0, amount: 0, ops: 0 }; bySku[sku] = a; }
    a.accruals += o.accruals_for_sale || 0; a.commission += o.sale_commission || 0; a.amount += o.amount || 0; a.ops++;
  }
  for (const k in bySku) { bySku[k]!.accruals = Math.round(bySku[k]!.accruals); bySku[k]!.commission = Math.round(bySku[k]!.commission); bySku[k]!.amount = Math.round(bySku[k]!.amount); }
  return { dateFrom, dateTo, skuCount: Object.keys(bySku).length, singleItemOps: single, multiItemOps: multi, bySku };
}

async function main() {
  const argv = process.argv.slice(2);
  const w = window30();
  const dateFrom = argv[0] || w.dateFrom, dateTo = argv[1] || w.dateTo, outFile = argv[2] || "data/pnl_sku_30d.json";
  const out = await pnlBySku(dateFrom, dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`pnl-sku: ${out.skuCount} SKU, single-ops ${out.singleItemOps} (multi ${out.multiItemOps}), ${dateFrom}..${dateTo} -> ${outFile}`);
}

if (process.argv[1] && /pnl-sku\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-sku FAILED:", (e as Error).message); process.exit(1); });
