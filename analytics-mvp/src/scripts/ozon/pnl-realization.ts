// Месячная реализация по SKU (бухгалтерская, основа УПД) -> data/realization_monthly.ndjson.
// Источник: OZON /v2/finance/realization {month, year}. По каждому SKU за месяц:
//   sold = delivery_commission.quantity (реализовано/продано),
//   ret  = return_commission.quantity (возвращено, может быть null).
// «Реализовано с учётом возвратов» = sold - ret. За июль по каналу = 383 (совпадает с УПД).
// Закрытые месяцы стабильны; текущий и предыдущий перетягиваем каждый запуск (доначисления,
// поздние возвраты). Полный бэкфилл от FLOOR, если файла нет. Строки: {ym, sku, sold, ret}.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/realization_monthly.ndjson";
const FLOOR_Y = 2026, FLOOR_M = 2; // с февраля 2026
const REFRESH_TAIL = 2;            // перетягивать последние N месяцев

// Деньги per-SKU из отчёта о реализации (УПД, авторитетно для закрытого месяца):
//   revenue - выручка нетто (delivery.amount - return.amount),
//   commission - комиссия OZON нетто (delivery.standard_fee - return.standard_fee, как положительный сбор),
//   payout - к выплате нетто (delivery.total - return.total).
type Row = { ym: string; sku: string; sold: number; ret: number; revenue: number; commission: number; payout: number };

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

function monthsUpTo(y: number, m: number): Array<{ y: number; m: number }> {
  const out: Array<{ y: number; m: number }> = [];
  let cy = FLOOR_Y, cm = FLOOR_M;
  while (cy < y || (cy === y && cm <= m)) { out.push({ y: cy, m: cm }); cm++; if (cm > 12) { cm = 1; cy++; } }
  return out;
}

// row из отчёта -> {sku, sold, ret, revenue, commission, payout}
export function parseRow(r: any): { sku: string; sold: number; ret: number; revenue: number; commission: number; payout: number } | null {
  const sku = String(r?.item?.sku ?? r?.sku ?? "");
  if (!sku || sku === "0") return null;
  const dc = r?.delivery_commission ?? {}, rc = r?.return_commission ?? {};
  const n = (x: any) => Number(x ?? 0) || 0;
  return {
    sku,
    sold: n(dc.quantity),
    ret: n(rc.quantity),
    revenue: n(dc.amount) - n(rc.amount),               // выручка нетто
    commission: n(dc.standard_fee) - n(rc.standard_fee), // комиссия OZON нетто (как сбор, +)
    payout: n(dc.total) - n(rc.total),                   // к выплате нетто
  };
}

function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) { try { out.push(JSON.parse(l)); } catch { /* skip */ } }
  return out;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-realization: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const now = new Date();
  const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1;
  const all = monthsUpTo(curY, curM);
  const existing = readExisting();
  // Какие месяцы тянем: если файла нет - все; иначе только хвост REFRESH_TAIL.
  const targets = existing.length ? all.slice(-REFRESH_TAIL) : all;
  const targetYms = new Set(targets.map((t) => ym(t.y, t.m)));
  const kept = existing.filter((r) => !targetYms.has(r.ym));

  const fresh: Row[] = [];
  for (const { y, m } of targets) {
    try {
      const rows = await seller.realization(m, y);
      const byS: Record<string, Row> = {};
      for (const r of rows) { const p = parseRow(r); if (!p) continue; const k = p.sku; const cur = byS[k] || (byS[k] = { ym: ym(y, m), sku: k, sold: 0, ret: 0, revenue: 0, commission: 0, payout: 0 }); cur.sold += p.sold; cur.ret += p.ret; cur.revenue += p.revenue; cur.commission += p.commission; cur.payout += p.payout; }
      const monthRows = Object.values(byS);
      for (const r of monthRows) { r.revenue = Math.round(r.revenue); r.commission = Math.round(r.commission); r.payout = Math.round(r.payout); fresh.push(r); }
      const net = monthRows.reduce((s, r) => s + (r.sold - r.ret), 0);
      const rev = monthRows.reduce((s, r) => s + r.revenue, 0), pay = monthRows.reduce((s, r) => s + r.payout, 0);
      console.log(`pnl-realization: ${ym(y, m)} - ${monthRows.length} SKU, реализовано нетто ${net} шт, выручка ${Math.round(rev).toLocaleString("ru-RU")}, к выплате ${Math.round(pay).toLocaleString("ru-RU")}`);
    } catch (e) { console.warn(`pnl-realization: ${ym(y, m)} пропущен - ${(e as Error).message}`); }
  }
  const merged = kept.concat(fresh).sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`pnl-realization: всего ${merged.length} строк (${new Set(merged.map((r) => r.ym)).size} мес) -> ${OUT}`);
}

if (process.argv[1] && /pnl-realization\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-realization FAILED:", (e as Error).message); process.exit(0); });
