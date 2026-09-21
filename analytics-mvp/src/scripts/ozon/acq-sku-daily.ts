// Эквайринг и хранение ПО SKU/день из accrual/by-day -> data/acq_sku_daily.ndjson.
//
// ЗАЧЕМ. Кабинетные/сервисные сборы (ЭКВАЙРИНГ type 1, ХРАНЕНИЕ) OZON не отдаёт через accrual/postings
// (там только сборы по продаже: комиссия+логистика). Они в accrual/BY-DAY, но ключ записи там -
// unit_number (per-item id), который НЕ сходится с номером постинга. ОДНАКО в by-day каждая ITEM-строка
// несёт SKU (item_fees.fees[].sku). А SKU есть и в заказах, и в таблице по артикулам - поэтому склеиваем
// ПО SKU (не по номеру заказа): агрегируем эквайринг/хранение per (sku, дата), а build-katya разносит их
// по заказам этого SKU (как CPC-рекламу). Чистый API, без ручных отчётов.
//
// Строка: {d, sku, acq, sto} - эквайринг и хранение по SKU за день (знак как у OZON, сбор<0).
// Запуск: OZON_SELLER_* в env; из analytics-mvp: npx tsx src/scripts/ozon/acq-sku-daily.ts [FROM] [TO]
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { bucketMap, type Bucket } from "./accrual-buckets.js";

const OUT = "data/acq_sku_daily.ndjson";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("acq-sku-daily: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const from = process.argv[2] || "2026-05-01";
  const to = process.argv[3] || ymd(new Date(Date.now() - 86400000));
  console.log(`acq-sku-daily: by-day ${from}..${to}`);

  let bmap: Record<number, Bucket> = {};
  try { bmap = bucketMap(await seller.accrualTypes()); } catch (e) { console.warn("  accrualTypes нет:", (e as Error).message); }

  const days: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));

  // (sku, date) -> {acq, sto}
  const agg: Record<string, { d: string; sku: string; acq: number; sto: number }> = {};
  const key = (sku: string, d: string) => sku + "|" + d;
  let recs = 0;
  for (const day of days) {
    let arr: any[] = [];
    try { arr = await seller.accrualByDay(day); } catch { continue; }
    recs += arr.length;
    for (const a of arr) {
      const d = String(a?.date || day).slice(0, 10);
      // ITEM: item_fees.fees[] = [{sku, fees:[{type_id, accrued:{amount}}]}]
      for (const sf of (a?.item_fees?.fees || [])) {
        const sku = String(sf?.sku ?? ""); if (!sku) continue;
        for (const f of (sf?.fees || [])) {
          const bk = (bmap[Number(f?.type_id)] || "other") as Bucket;
          if (bk !== "acquiring" && bk !== "storage") continue;
          const amt = Number(f?.accrued?.amount ?? f?.accrued ?? f?.amount ?? 0);
          const r = (agg[key(sku, d)] ||= { d, sku, acq: 0, sto: 0 });
          if (bk === "acquiring") r.acq += amt; else r.sto += amt;
        }
      }
    }
  }
  const rows = Object.values(agg).map((r) => ({ d: r.d, sku: r.sku, acq: Math.round(r.acq), sto: Math.round(r.sto) }))
    .filter((r) => r.acq || r.sto);
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // само-сверка по месяцам
  const bm: Record<string, { acq: number; sto: number }> = {};
  for (const r of rows) { const m = r.d.slice(0, 7); const b = (bm[m] ||= { acq: 0, sto: 0 }); b.acq += r.acq; b.sto += r.sto; }
  console.log(`  by-day записей ${recs} | строк (sku,день) ${rows.length}`);
  console.log("  по месяцам (эквайринг | хранение):");
  for (const m of Object.keys(bm).sort()) console.log(`    ${m}: ${bm[m].acq.toLocaleString("ru")} | ${bm[m].sto.toLocaleString("ru")}`);
  console.log(`  -> ${OUT}`);
}

main().catch((e) => { console.error("acq-sku-daily FAIL:", e); process.exit(1); });
