// МИГРАЦИЯ финансов по SKU с мёртвого /v3/finance/transaction/list на /v1/finance/accrual/*.
// OZON отключил transaction/list 08.09.2026 -> pnl_sku_daily застыл на 07.09. Собираем ту же схему
// из accrual-API: постинги (выручка/штуки по SKU) + accrual/postings (сборы по SKU по type_id).
//
// ВАЖНО: пишем в ПАРАЛЛЕЛЬНЫЙ файл data/pnl_sku_accrual_daily.ndjson (старый не трогаем), чтобы
// сначала сверить со старым за закрытые месяцы (§15) и только потом переключать дашборд.
// Базис - по дате заказа (posting), как в блоке заказов. Эквайринг/хранение в accrual/postings
// не приходят (кабинетный уровень, accrual/by-day) - тут 0; добор by-day - отдельным шагом.
//
// Запуск: OZON_SELLER_* в env; npx tsx src/scripts/ozon/pnl-sku-accrual-daily.ts [FROM] [TO]
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { bucketMap, type Bucket } from "./accrual-buckets.js";

const OUT = "data/pnl_sku_accrual_daily.ndjson";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-sku-accrual: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const from = process.argv[2] || "2026-02-06";
  const to = process.argv[3] || ymd(new Date(Date.now() - 86400000));
  console.log(`pnl-sku-accrual: ${from}..${to}`);

  const posts = await seller.postings(from, to);
  console.log(`  постингов: ${posts.length}`);
  const orderDate: Record<string, string> = {};
  // (sku,date) -> {revenue, units, commission, delivery, acquiring, storage, otherSvc}
  const rows: Record<string, any> = {};
  const key = (sku: string, d: string) => sku + "|" + d;
  const ensure = (sku: string, d: string) => (rows[key(sku, d)] ||= { d, sku, accruals: 0, commission: 0, delivery: 0, acquiring: 0, storage: 0, otherSvc: 0, amount: 0 });
  for (const p of posts) {
    if (!p.date) continue;
    if (p.status !== "delivered") continue; // тот же базис, что старый pnl и блок по артикулам - реализация
    orderDate[p.posting_number] = p.date;
    for (const it of p.products) {
      if (!it.sku) continue;
      const r = ensure(String(it.sku), p.date);
      r.accruals += (it.price || 0) * (it.qty || 0); // «Начислено» = выручка (цена×кол-во)
    }
  }
  let bmap: Record<number, Bucket> = {};
  try { bmap = bucketMap(await seller.accrualTypes()); } catch { /* */ }
  const acc = await seller.accrualPostings(posts.map((p) => p.posting_number));
  console.log(`  постингов с начислениями: ${acc.length}`);
  for (const p of acc) {
    const d = orderDate[p.posting_number]; if (!d) continue; // только доставленные; единый базис - дата заказа
    for (const a of (p.accruals || [])) {
      const sku = String(a.sku ?? ""); if (!sku) continue;
      // Сборы и выручка - на ОДНОМ базисе (дата заказа), чтобы «К выплате» в текущем месяце не
      // разъезжался. Файл используется гибридом только для текущего месяца; закрытые месяцы берутся
      // из старого pnl (accrual_date-сверка закрытых месяцев уже подтвердила совпадение до рубля).
      const bk = (bmap[Number(a.type_id)] || "other") as Bucket;
      const amt = Number(a?.accrued?.amount ?? a?.accrued ?? a?.amount ?? 0);
      const r = ensure(sku, d);
      if (bk === "commission") r.commission += amt;
      else if (bk === "delivery") r.delivery += amt;
      else if (bk === "acquiring") r.acquiring += amt;
      else if (bk === "storage") r.storage += amt;
      else if (bk === "buyerDelivery") { /* компенсируется, в amount не входит */ }
      else r.otherSvc += amt; // ads/other -> прочие услуги
    }
  }
  const out = Object.values(rows).map((r: any) => {
    r.amount = Math.round(r.accruals + r.commission + r.delivery + r.acquiring + r.storage + r.otherSvc);
    for (const k of ["accruals", "commission", "delivery", "acquiring", "storage", "otherSvc"]) r[k] = Math.round(r[k]);
    return r;
  }).filter((r: any) => r.accruals || r.commission || r.amount);
  writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // само-сверка по месяцам
  const bm: Record<string, any> = {};
  for (const r of out) { const m = r.d.slice(0, 7); const b = (bm[m] ||= { acc: 0, com: 0, amt: 0 }); b.acc += r.accruals; b.com += r.commission; b.amt += r.amount; }
  console.log("  по месяцам (Начислено | Комиссия | К выплате):");
  for (const m of Object.keys(bm).sort()) console.log(`    ${m}: ${bm[m].acc.toLocaleString("ru")} | ${bm[m].com.toLocaleString("ru")} | ${bm[m].amt.toLocaleString("ru")}`);
  console.log(`  строк: ${out.length} -> ${OUT}`);
}

main().catch((e) => { console.error("pnl-sku-accrual FAIL:", e); process.exit(1); });
