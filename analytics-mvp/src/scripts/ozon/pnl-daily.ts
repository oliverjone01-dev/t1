// Дневной ряд канального P&L для произвольного периода. Прямой OZON Seller, без n8n.
// Транзакции датированы (operation_date) -> бакетим по дню и считаем aggregateChannel на день.
// data/pnl_daily.ndjson, строка = {d, accruals, commission, delivery, fees, payout, ops}.
// Перезаписываем ВЕСЬ ряд от FLOOR до вчера каждый прогон: финансовые операции могут
// до-постироваться задним числом (возвраты/корректировки), поэтому инкремент недостаточен.
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { aggregateChannel } from "./pnl.js";

const OUT = "data/pnl_daily.ndjson";
const FLOOR = "2026-02-01";

export interface DailyPnl { d: string; accruals: number; commission: number; delivery: number; fees: number; payout: number; ops: number; }

// Чистое (без сети): ops с operation_date -> канальный P&L по дням, отсортировано по дате.
export function dailyChannel(ops: any[]): DailyPnl[] {
  const byDay: Record<string, any[]> = {};
  for (const o of ops) {
    const d = String(o.operation_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    (byDay[d] || (byDay[d] = [])).push(o);
  }
  return Object.keys(byDay).sort().map((d) => {
    const a = aggregateChannel(byDay[d]!);
    return { d, accruals: a.accruals, commission: a.commission, delivery: a.delivery, fees: a.fees, payout: a.payout, ops: a.ops };
  });
}

const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }

// OZON /v3/finance/transaction/list разрешает максимум ОДИН МЕСЯЦ за запрос -> режем диапазон
// на календарные месяцы [from..конец месяца], последнее окно обрезаем по to. Чистое, тестируется.
export function monthWindows(from: string, to: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (from > to) return out;
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)), cur = from;
  while (cur <= to) {
    let wEnd = fmt(new Date(Date.UTC(y, m, 0))); // последний день месяца m (1-based)
    if (wEnd > to) wEnd = to;
    out.push([cur, wEnd]);
    m++; if (m > 12) { m = 1; y++; }
    cur = `${y}-${String(m).padStart(2, "0")}-01`;
  }
  return out;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-daily: OZON_SELLER_* нет - пропуск"); return; }
  const to = yesterday();
  const seller = new OzonSeller({ clientId, apiKey });
  const ops: any[] = [];
  for (const [wf, wt] of monthWindows(FLOOR, to)) ops.push(...(await seller.transactions(wf, wt)));
  const rows = dailyChannel(ops);
  if (!rows.length) { console.log(`pnl-daily: OZON не отдал операций за ${FLOOR}..${to}`); return; }
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`pnl-daily: ${rows.length} дн (${rows[0]!.d}..${rows[rows.length - 1]!.d}), операций ${ops.length} -> ${OUT}`);
}

if (process.argv[1] && /pnl-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-daily FAILED:", (e as Error).message); process.exit(1); });
