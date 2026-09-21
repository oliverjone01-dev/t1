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
  const zero = (): Record<Bucket, number> => ({ commission: 0, acquiring: 0, storage: 0, delivery: 0, buyerDelivery: 0, ads: 0, other: 0 });
  const nameById: Record<number, string> = {};
  try { for (const t of await seller.accrualTypes()) nameById[t.id] = t.name; } catch { /* имена не критичны */ }
  const byType: Record<number, { name: string; bucket: string; sum: number; n: number }> = {};
  for (const p of acc) {
    const b = (accByOrder[p.posting_number] ||= zero());
    for (const a of (p.accruals || [])) {
      const tid = Number(a.type_id);
      const bk = (bmap[tid] || "other") as Bucket;
      const amt = Number(a?.accrued?.amount ?? a?.accrued ?? a?.amount ?? 0);
      b[bk] += amt;
      const rec = (byType[tid] ||= { name: nameById[tid] || String(tid), bucket: bk, sum: 0, n: 0 });
      rec.sum += amt; rec.n += 1;
    }
  }
  // ПРОБ: разбивка начислений по заказу по ТИПУ (с бакетом) - убедиться, что в «other» нет
  // замаскированного эквайринга/хранения. Пишем отдельным файлом.
  const typesArr = Object.entries(byType).map(([tid, v]) => ({ type_id: Number(tid), ...v, sum: Math.round(v.sum) })).sort((a, b) => a.sum - b.sum);
  writeFileSync("data/orders_accrual_types.json", JSON.stringify(typesArr, null, 1));
  console.log(`  типов начислений по заказам: ${typesArr.length} -> data/orders_accrual_types.json`);

  // Сборы уровня ЗАКАЗА (ЭКВАЙРИНГ и ДОСТАВКА ОТ ПОКУПАТЕЛЯ) OZON привязывает к БАЗОВОМУ номеру
  // заказа (без суффикса отправки «-N»), поэтому accrual/postings по суффиксному постингу их почти
  // не отдаёт: эквайринг=0, доставка покупателя ~3%. Проверено по отчёту «Начисления» (эквайринг -
  // 402 строки под базой против 13 под постингом; доставка покупателя +605k под базой). Дозапрашиваем
  // те же начисления по БАЗОВЫМ номерам и берём оттуда ТОЛЬКО эти два бакета (полные), чтобы получать
  // корректные данные ИЗ API без ручных отчётов. Так «убрать последнюю цифру».
  const orderBase = (o: string) => o.replace(/-\d+$/, "");
  const bases = Array.from(new Set(posts.map((p) => orderBase(p.posting_number)).filter(Boolean)));
  let accBaseRaw: Array<{ posting_number: string; accruals: any[] }> = [];
  try { accBaseRaw = await seller.accrualPostings(bases); } catch (e) { console.warn("  accrual по базовым номерам не удался:", (e as Error).message); }
  const accBase: Record<string, { acquiring: number; buyerDelivery: number }> = {};
  for (const p of accBaseRaw) {
    const bkey = orderBase(String(p.posting_number));
    const rec = (accBase[bkey] ||= { acquiring: 0, buyerDelivery: 0 });
    for (const a of (p.accruals || [])) {
      const bk = (bmap[Number(a.type_id)] || "other") as Bucket;
      if (bk !== "acquiring" && bk !== "buyerDelivery") continue;
      rec[bk] += Number(a?.accrued?.amount ?? a?.accrued ?? a?.amount ?? 0);
    }
  }
  const baseUsed: Record<string, number> = {}; // база -> уже присвоено (не задвоить на мультиотправках)
  const acqN = Object.values(accBase).filter((v) => v.acquiring).length;
  console.log(`  базовых номеров: ${bases.length} | из них с эквайрингом: ${acqN} | Σ эквайринг ${Math.round(Object.values(accBase).reduce((s, v) => s + v.acquiring, 0)).toLocaleString("ru")} | Σ дост.покуп ${Math.round(Object.values(accBase).reduce((s, v) => s + v.buyerDelivery, 0)).toLocaleString("ru")}`);

  const rows: any[] = [];
  for (const p of posts) {
    if (!p.posting_number || !p.date) continue;
    const units = p.products.reduce((s, x) => s + (x.qty || 0), 0);
    const revenue = p.products.reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0);
    const top = p.products.slice().sort((a, x) => (x.price * x.qty) - (a.price * a.qty))[0] || { sku: "", offer: "" };
    const b = accByOrder[p.posting_number] || zero();
    // Эквайринг/доставку покупателя берём из БАЗОВОГО запроса (полные), привязываем к базе ОДИН раз
    // (guard), иначе мультиотправки задвоят. Фолбэк на постинговый бакет, если по базе пусто.
    const bkey = orderBase(p.posting_number);
    const bf = (accBase[bkey] && !baseUsed[bkey]) ? accBase[bkey] : { acquiring: 0, buyerDelivery: 0 };
    if (accBase[bkey] && !baseUsed[bkey]) baseUsed[bkey] = 1;
    const acquiring = bf.acquiring || b.acquiring;
    const buyerDeliv = bf.buyerDelivery || b.buyerDelivery;
    const feesSum = b.commission + acquiring + b.storage + b.delivery + b.ads + b.other; // buyerDelivery компенсируется, в payout не входит
    rows.push({
      order: p.posting_number, d: p.date, status: p.status,
      sku: top.sku, offer: top.offer, units, revenue: Math.round(revenue),
      commission: Math.round(b.commission), delivery: Math.round(b.delivery), acquiring: Math.round(acquiring),
      storage: Math.round(b.storage), buyer_delivery: Math.round(buyerDeliv), ads: Math.round(b.ads),
      other: Math.round(b.other), payout: Math.round(revenue + feesSum),
    });
  }
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // само-сверка
  const T = rows.reduce((a, r) => ({ rev: a.rev + r.revenue, com: a.com + r.commission, pay: a.pay + r.payout, u: a.u + r.units }), { rev: 0, com: 0, pay: 0, u: 0 });
  console.log(`  заказов: ${rows.length} | штук: ${T.u} | выручка: ${T.rev.toLocaleString("ru")} | комиссия: ${T.com.toLocaleString("ru")} | к выплате: ${T.pay.toLocaleString("ru")}`);
  console.log(`  записано: ${OUT}`);
}

main().catch((e) => { console.error("orders-daily FAIL:", e); process.exit(1); });
