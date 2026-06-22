// Прямой клиент OZON Seller - замена n8n-вебхука gengroup-ozon-pnl (канальный P&L).
// Использует connector/OzonSeller.transactions (withRetry). Выход - сырой P&L (как вебхук n8n),
// дальше snapshot-pnl.ts / normalizePnl. Креды из env: OZON_SELLER_CLIENT_ID/API_KEY.
// Запуск: tsx src/scripts/ozon/pnl.ts [dateFrom] [dateTo] [outFile]
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

export async function pnlChannel(dateFrom: string, dateTo: string): Promise<any> {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) throw new Error("OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY не заданы (GitHub Secrets)");
  const ops = await new OzonSeller({ clientId, apiKey }).transactions(dateFrom, dateTo);
  const agg = { accruals: 0, commission: 0, delivery: 0, amount: 0, ops: 0 };
  const svc: Record<string, number> = {};
  for (const o of ops) {
    agg.ops++;
    agg.accruals += o.accruals_for_sale || 0;
    agg.commission += o.sale_commission || 0;
    agg.delivery += (o.delivery_charge || 0) + (o.return_delivery_charge || 0);
    agg.amount += o.amount || 0;
    for (const s of (o.services || [])) { const n = s.name || "прочее"; svc[n] = (svc[n] || 0) + (s.price || 0); }
  }
  const fees = agg.accruals - agg.amount;
  return {
    dateFrom, dateTo, ops: agg.ops,
    accruals: Math.round(agg.accruals), commission: Math.round(agg.commission),
    delivery: Math.round(agg.delivery), services: svc,
    fees: Math.round(fees), payout: Math.round(agg.amount),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const w = window30();
  const dateFrom = argv[0] || w.dateFrom, dateTo = argv[1] || w.dateTo, outFile = argv[2] || "/tmp/pnl_raw.json";
  const out = await pnlChannel(dateFrom, dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`pnl: ops ${out.ops}, начислено ${out.accruals}, к выплате ${out.payout}, ${dateFrom}..${dateTo} -> ${outFile}`);
}

if (process.argv[1] && /pnl\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl FAILED:", (e as Error).message); process.exit(1); });
