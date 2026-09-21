// Данные по ЗАКАЗУ (posting) для блока «Аналитика по заказам» -> data/orders_daily.ndjson.
// Backbone - OZON: постинги (выручка/штуки/дата/статус) + accrual/postings (сборы по бакетам).
// Реклама (CPO) и доставка (ведомость) досыпаются в build-katya по номеру заказа отдельно.
//
// Запуск: OZON_SELLER_* в env; из analytics-mvp: npx tsx src/scripts/ozon/orders-daily.ts [FROM] [TO]
// FROM/TO - YYYY-MM-DD (по дате заказа). По умолчанию с 2026-05-01 по вчера.
//
// Строка: {order, d, status, sku, offer, units, revenue, commission, delivery, acquiring, storage,
//          buyer_delivery, ads, other, payout}. Знак сборов - как отдаёт OZON (fee < 0).
// payout = revenue + Σ(все начисления). §15-сверку (Σ по заказам = P&L) делаем на этапе сборки блока.
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { bucketMap, type Bucket } from "./accrual-buckets.js";

const OUT = "data/orders_daily.ndjson";

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("orders-daily: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const from = process.argv[2] || "2026-05-01";
  const to = process.argv[3] || ymd(new Date(Date.now() - 86400000));
  console.log(`orders-daily: постинги ${from}..${to}`);

  const posts = await seller.postings(from, to);
  console.log(`  постингов: ${posts.length}`);

  // типы начислений -> бакеты
  let bmap: Record<number, Bucket> = {};
  try { bmap = bucketMap(await seller.accrualTypes()); } catch (e) { console.warn("  accrualTypes нет:", (e as Error).message); }

  // начисления по постингам (батчами внутри accrualPostings)
  const nums = posts.map((p) => p.posting_number).filter(Boolean);
  const acc = await seller.accrualPostings(nums);
  console.log(`  постингов с начислениями: ${acc.length}`);
  const accByOrder: Record<string, Record<Bucket, number>> = {};
  const zero = (): Record<Bucket, number> => ({ commission: 0, acquiring: 0, storage: 0, delivery: 0, buyerDelivery: 0, ads: 0, partner: 0, other: 0 });
  const nameById: Record<number, string> = {};
  try { for (const t of await seller.accrualTypes()) nameById[t.id] = t.name; } catch { /* имена не критичны */ }
  const byType: Record<number, { name: string; bucket: string; sum: number; n: number }> = {};
  const rfbsSet = new Set<string>();   // постинги с realFBS-начислениями -> схема доставки rFBS
  const logiSet = new Set<string>();   // постинги со сбором «Логистика» (type 32) -> OZON везёт (FBO/FBS)
  for (const p of acc) {
    const b = (accByOrder[p.posting_number] ||= zero());
    for (const a of (p.accruals || [])) {
      const tid = Number(a.type_id);
      const bk = (bmap[tid] || "other") as Bucket;
      const amt = Number(a?.accrued?.amount ?? a?.accrued ?? a?.amount ?? 0);
      b[bk] += amt;
      const nm = nameById[tid] || String(tid);
      if (/rfbs|realfbs/i.test(nm)) rfbsSet.add(p.posting_number);
      if (tid === 32 || /^logistic$|логистик/i.test(nm)) logiSet.add(p.posting_number);
      const rec = (byType[tid] ||= { name: nm, bucket: bk, sum: 0, n: 0 });
      rec.sum += amt; rec.n += 1;
    }
  }
  // ПРОБ: разбивка начислений по заказу по ТИПУ (с бакетом) - убедиться, что в «other» нет
  // замаскированного эквайринга/хранения. Пишем отдельным файлом.
  const typesArr = Object.entries(byType).map(([tid, v]) => ({ type_id: Number(tid), ...v, sum: Math.round(v.sum) })).sort((a, b) => a.sum - b.sum);
  writeFileSync("data/orders_accrual_types.json", JSON.stringify(typesArr, null, 1));
  console.log(`  типов начислений по заказам: ${typesArr.length} -> data/orders_accrual_types.json`);

  // ВОЗВРАТЫ. У постинга нет статуса «возврат» (после возврата он остаётся delivered), а возврат
  // выручки в начислениях по постингу отсутствует (ClientReturn=0). Поэтому берём отдельный эндпоинт
  // возвратов и вычитаем возвращённую выручку. ВАЖНО: вычитаем ТОЛЬКО выручку - сборы, которые не
  // возвращаются (реклама/подписки/сервис/партнёр), уже правильно стоят в начислениях по постингу и
  // остаются как реальный убыток; комиссия/эквайринг/доставка покупателя по возвращённому заказу уже
  // занулены самим OZON (charge+refund) в accrual/postings, повторно их не трогаем.
  const retByPosting: Record<string, number> = {};
  try {
    const rets = await seller.returns(from, to);
    for (const r of rets) {
      if (!r.posting_number) continue;
      retByPosting[r.posting_number] = (retByPosting[r.posting_number] || 0) + (r.price || 0) * (r.qty || 0);
    }
    console.log(`  возвраты: ${rets.length} строк по ${Object.keys(retByPosting).length} постингам, выручка возвратов ${Math.round(Object.values(retByPosting).reduce((a, v) => a + v, 0)).toLocaleString("ru")}`);
  } catch (e) { console.warn("  возвраты не собраны:", (e as Error).message); }

  const rows: any[] = [];
  for (const p of posts) {
    if (!p.posting_number || !p.date) continue;
    const units = p.products.reduce((s, x) => s + (x.qty || 0), 0);
    const grossRev = p.products.reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0);
    // Возвращённая выручка по этому постингу (по цене постинга, а не отчёта - чтобы зануляла gross).
    const returned = Math.min(grossRev, Math.round(retByPosting[p.posting_number] || 0));
    const revenue = grossRev - returned; // выручка НЕТТО после возврата
    const top = p.products.slice().sort((a, x) => (x.price * x.qty) - (a.price * a.qty))[0] || { sku: "", offer: "" };
    const b = accByOrder[p.posting_number] || zero();
    // Схема доставки: rFBS (доставка силами продавца - есть realFBS-начисления) > FBO/FBS (склад/логистика
    // OZON). Если явных признаков нет - берём источник постинга (FBO/FBS из эндпоинта).
    const scheme = rfbsSet.has(p.posting_number) ? "rFBS" : (logiSet.has(p.posting_number) ? ((p as any).src || "FBS") : ((p as any).src || ""));
    const feesSum = b.commission + b.acquiring + b.storage + b.delivery + b.ads + b.partner + b.other; // buyerDelivery компенсируется, в payout не входит
    rows.push({
      order: p.posting_number, d: p.date, status: p.status, scheme,
      sku: top.sku, offer: top.offer, units, revenue: Math.round(revenue), returned: Math.round(returned),
      commission: Math.round(b.commission), delivery: Math.round(b.delivery), acquiring: Math.round(b.acquiring),
      storage: Math.round(b.storage), buyer_delivery: Math.round(b.buyerDelivery), ads: Math.round(b.ads),
      partner: Math.round(b.partner), other: Math.round(b.other), payout: Math.round(revenue + feesSum),
    });
  }
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // само-сверка
  const T = rows.reduce((a, r) => ({ rev: a.rev + r.revenue, com: a.com + r.commission, pay: a.pay + r.payout, u: a.u + r.units }), { rev: 0, com: 0, pay: 0, u: 0 });
  console.log(`  заказов: ${rows.length} | штук: ${T.u} | выручка: ${T.rev.toLocaleString("ru")} | комиссия: ${T.com.toLocaleString("ru")} | к выплате: ${T.pay.toLocaleString("ru")}`);
  console.log(`  записано: ${OUT}`);
}

main().catch((e) => { console.error("orders-daily FAIL:", e); process.exit(1); });
