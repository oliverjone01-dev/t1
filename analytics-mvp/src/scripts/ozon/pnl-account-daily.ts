// Дневной ряд сборов УРОВНЯ ЗАКАЗА/КАБИНЕТА (то, что НЕ разносится по SKU) -> data/pnl_account_daily.ndjson.
// Это операции транзакций OZON с НЕ-одним артикулом (0 или >1 distinct sku): реклама, штрафы,
// realFBS, подписки, доставка от покупателя и т.п. Категоризуем по operation_type_name в бакеты:
//   adv (реклама CPC+CPO) | fines (штрафы+гибкий график) | realfbs (realFBS+сервис+страхование)
//   | badge (Бейдж/реклама в сети/ускоренный сбор/Premium флат) | delivery (перечисл. за доставку
//   от покупателя, приход) | other (компенсации/эквайринг/прочее).
// Сумма бакетов = P&L канала − сумма по SKU (единичные) = «чего не хватает» в разрезе по SKU.
// Перетягивает хвост 45 дней (доначисления). Чанки по 28 дней (лимит OZON 1 месяц).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/pnl_account_daily.ndjson";
const FLOOR = "2026-02-01";
const TAIL = 45;
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function yesterday(): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return fmt(d); }
function shiftDays(date: string, n: number): string { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }

// operation_type_name -> бакет
export function bucketOf(name: string): string {
  const n = String(name || "").toLowerCase();
  if (/оплата за клик|оплатой за заказ|продвижени. в поиске/.test(n)) return "adv";
  if (/бейдж|реклама в сети|ускоренный сбор|premium|отзыв/.test(n)) return "badge";
  if (/гибкий график|нерекомендованный слот|превышение индекса ошибок|штраф/.test(n)) return "fines";
  if (/realfbs|сервисный сбор за интеграц|страхован/.test(n)) return "realfbs";
  if (/перечисление за доставку от покупателя/.test(n)) return "delivery";
  return "other";
}

type Row = { d: string; adv: number; fines: number; realfbs: number; badge: number; delivery: number; other: number };

export function aggregateDaily(ops: any[]): Row[] {
  const by: Record<string, Row> = {};
  for (const o of ops) {
    const items = o.items || [];
    const distinct = new Set(items.map((it: any) => String((it && it.sku) || "")).filter((s: string) => s && s !== "0"));
    if (distinct.size === 1) continue; // единичные ops - в pnl-sku-daily, не сюда
    const day = String(o.operation_date || "").slice(0, 10); if (!day) continue;
    const cat = bucketOf(o.operation_type_name || o.operation_type);
    let r = by[day]; if (!r) { r = { d: day, adv: 0, fines: 0, realfbs: 0, badge: 0, delivery: 0, other: 0 }; by[day] = r; }
    (r as any)[cat] += o.amount || 0;
  }
  const out = Object.values(by);
  for (const r of out) { r.adv = Math.round(r.adv); r.fines = Math.round(r.fines); r.realfbs = Math.round(r.realfbs); r.badge = Math.round(r.badge); r.delivery = Math.round(r.delivery); r.other = Math.round(r.other); }
  return out.filter((r) => r.adv || r.fines || r.realfbs || r.badge || r.delivery || r.other);
}

async function fetchChunked(seller: OzonSeller, from: string, to: string): Promise<any[]> {
  const ops: any[] = []; let s = from;
  while (s <= to) { let e = shiftDays(s, 27); if (e > to) e = to; for (const o of await seller.transactions(s, e)) ops.push(o); s = shiftDays(e, 1); }
  return ops;
}
function readExisting(): Row[] {
  if (!existsSync(OUT)) return [];
  const out: Row[] = [];
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) { try { out.push(JSON.parse(l)); } catch { /* skip */ } }
  return out;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-account-daily: OZON_SELLER_* нет - пропуск"); return; }
  const existing = readExisting();
  const to = yesterday();
  let from = existing.length ? shiftDays(to, -(TAIL - 1)) : FLOOR;
  if (from < FLOOR) from = FLOOR;
  if (from > to) { console.log(`pnl-account-daily: перетягивать нечего (${from} > ${to})`); return; }
  const ops = await fetchChunked(new OzonSeller({ clientId, apiKey }), from, to);
  const fresh = aggregateDaily(ops);
  const kept = existing.filter((r) => r.d < from);
  const merged = kept.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`pnl-account-daily: перетянул ${from}..${to} (${fresh.length} дн), всего ${merged.length} строк -> ${OUT}`);
}

if (process.argv[1] && /pnl-account-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-account-daily FAILED:", (e as Error).message); process.exit(0); });
