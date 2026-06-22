// Прямой клиент OZON Seller - замена n8n-вебхука gengroup-ozon-pnl-sku (без n8n, без лимита выполнений).
// Агрегирует /v3/finance/transaction/list по SKU (операции с ОДНИМ товаром): начислено, комиссия, к выплате.
// Креды из env: OZON_SELLER_CLIENT_ID, OZON_SELLER_API_KEY (в CI - из GitHub Secrets).
// Запуск: tsx src/scripts/ozon/pnl-sku.ts [dateFrom] [dateTo] [outFile]
import { writeFileSync } from "node:fs";

const CID = process.env.OZON_SELLER_CLIENT_ID || "";
const KEY = process.env.OZON_SELLER_API_KEY || "";
const BASE = "https://api-seller.ozon.ru";
const FLOOR = "2026-02-01";

// Окно последних 30 дней до вчера, нижняя граница - старт аккаунта (как в n8n Set-ноде).
function window30(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); y.setUTCDate(y.getUTCDate() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(y);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - 29);
  let from = fmt(f); if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Agg = { accruals: number; commission: number; amount: number; ops: number };

export async function pnlBySku(dateFrom: string, dateTo: string): Promise<any> {
  if (!CID || !KEY) throw new Error("OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY не заданы (GitHub Secrets)");
  const hdr = { "Client-Id": CID, "Api-Key": KEY, "Content-Type": "application/json" };
  const from = dateFrom + "T00:00:00.000Z", to = dateTo + "T23:59:59.999Z";
  let page = 1, pageCount = 1;
  const bySku: Record<string, Agg> = {};
  let multi = 0, single = 0;
  do {
    let r: any = null;
    for (let a = 0; a < 5; a++) {
      try {
        const res = await fetch(`${BASE}/v3/finance/transaction/list`, {
          method: "POST", headers: hdr,
          body: JSON.stringify({ filter: { date: { from, to }, transaction_type: "all" }, page, page_size: 1000 }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        r = await res.json(); break;
      } catch (e) { if (a === 4) throw e; await sleep(800 * Math.pow(2, a)); }
    }
    const result = (r && r.result) || {};
    const ops = result.operations || [];
    pageCount = result.page_count || 1;
    for (const o of ops) {
      const items = o.items || [];
      if (items.length !== 1) { if (items.length > 1) multi++; continue; } // только операции с одним товаром
      single++;
      const sku = String((items[0] && items[0].sku) || "");
      if (!sku || sku === "0") continue;
      let a = bySku[sku]; if (!a) { a = { accruals: 0, commission: 0, amount: 0, ops: 0 }; bySku[sku] = a; }
      a.accruals += o.accruals_for_sale || 0; a.commission += o.sale_commission || 0; a.amount += o.amount || 0; a.ops++;
    }
    page++; await sleep(250);
  } while (page <= pageCount);
  for (const k in bySku) { bySku[k]!.accruals = Math.round(bySku[k]!.accruals); bySku[k]!.commission = Math.round(bySku[k]!.commission); bySku[k]!.amount = Math.round(bySku[k]!.amount); }
  return { dateFrom, dateTo, skuCount: Object.keys(bySku).length, singleItemOps: single, multiItemOps: multi, bySku };
}

async function main() {
  const argv = process.argv.slice(2);
  const w = window30();
  const dateFrom = argv[0] || w.dateFrom;
  const dateTo = argv[1] || w.dateTo;
  const outFile = argv[2] || "data/pnl_sku_30d.json";
  const out = await pnlBySku(dateFrom, dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`pnl-sku: ${out.skuCount} SKU, single-ops ${out.singleItemOps} (multi ${out.multiItemOps}), ${dateFrom}..${dateTo} -> ${outFile}`);
}

// Запуск как скрипт (не при импорте).
if (process.argv[1] && /pnl-sku\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-sku FAILED:", (e as Error).message); process.exit(1); });
