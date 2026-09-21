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
  { const p0 = posts.find((p) => p.financial_data) || posts[0]; console.log("  DEBUG posting keys:", Object.keys(p0 as any).join(",")); console.log("  DEBUG financial_data:", JSON.stringify((p0 as any).financial_data).slice(0, 700)); }

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

  // Кабинетные/сервисные сборы уровня ЗАКАЗА (ЭКВАЙРИНГ, ХРАНЕНИЕ, доставка от покупателя) OZON НЕ
  // отдаёт через accrual/postings - там только сборы ПО ПРОДАЖЕ (комиссия+логистика по SKU). Они в
  // accrual/BY-DAY (дневной реестр), привязаны к БАЗОВОМУ posting. accrual/postings по 2-частному
  // (базовому) номеру возвращает HTTP 400 (regex требует 3 части) - поэтому источник именно by-day.
  // Схема by-day: {posting, accrued_category:ITEM|NON_ITEM, item_fees:{fees:[{sku,fees:[{type_id,
  // accrued:{amount}}]}]}, non_item_fee:{type_id,accrued:{amount}}}. Эквайринг - type 1 (ITEM, по SKU).
  // Проверено эпизодом ozon-finance-api-migration: by-day acquiring август -143 233 (совпало с отчётом).
  // Берём из by-day ТОЛЬКО эквайринг/хранение/доставку покупателя (комиссию/логистику/рекламу НЕ трогаем,
  // чтобы не задвоить с postings/CPO). Один вызов на день.
  const orderBase = (o: string) => o.replace(/-\d+$/, "");
  const accBase: Record<string, { acquiring: number; storage: number; buyerDelivery: number }> = {};
  const addFee = (rec: { acquiring: number; storage: number; buyerDelivery: number }, f: any) => {
    if (!f) return;
    const bk = (bmap[Number(f.type_id)] || "other") as Bucket;
    if (bk !== "acquiring" && bk !== "storage" && bk !== "buyerDelivery") return;
    rec[bk] += Number(f?.accrued?.amount ?? f?.accrued ?? f?.amount ?? 0);
  };
  const days: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
  // Ключ заказа в записи by-day - поле unit_number (поле posting в этих записях = null). Это БАЗОВЫЙ
  // номер заказа (напр. «26184205-0375»). Сборы уровня SKU - в item_fees.fees[].fees[] (эквайринг type 1);
  // кабинетные NON_ITEM без unit_number (не привязаны к заказу) - пропускаем.
  let byDayRecs = 0;
  for (const day of days) {
    let recs: any[] = [];
    try { recs = await seller.accrualByDay(day); } catch { continue; }
    byDayRecs += recs.length;
    for (const a of recs) {
      const bkey = orderBase(String(a?.unit_number || a?.posting || "")); if (!bkey) continue;
      const rec = (accBase[bkey] ||= { acquiring: 0, storage: 0, buyerDelivery: 0 });
      for (const sf of (a?.item_fees?.fees || [])) for (const f of (sf?.fees || [])) addFee(rec, f);
      if (a?.non_item_fee) addFee(rec, a.non_item_fee);
    }
  }
  const baseUsed: Record<string, number> = {}; // база -> уже присвоено (не задвоить на мультиотправках)
  const sB = (k: "acquiring" | "storage" | "buyerDelivery") => Math.round(Object.values(accBase).reduce((s, v) => s + v[k], 0)).toLocaleString("ru");
  console.log(`  by-day: дней ${days.length}, записей ${byDayRecs} | баз с эквайрингом ${Object.values(accBase).filter((v) => v.acquiring).length} | Σ эквайринг ${sB("acquiring")} | Σ хранение ${sB("storage")} | Σ дост.покуп ${sB("buyerDelivery")}`);
  { const pbases = new Set(posts.map((p) => orderBase(p.posting_number))); const abases = Object.keys(accBase); const overlap = abases.filter((b) => pbases.has(b)).length; console.log(`  DEBUG overlap: accBase ключей ${abases.length}, постинг-баз ${pbases.size}, совпало ${overlap} | примеры accBase: ${abases.slice(0, 3).join(" ")}`); }

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
    const bf = (accBase[bkey] && !baseUsed[bkey]) ? accBase[bkey] : { acquiring: 0, storage: 0, buyerDelivery: 0 };
    if (accBase[bkey] && !baseUsed[bkey]) baseUsed[bkey] = 1;
    const acquiring = bf.acquiring || b.acquiring;   // by-day полнее, чем postings; фолбэк на postings
    const storage = bf.storage || b.storage;
    const buyerDeliv = bf.buyerDelivery || b.buyerDelivery;
    const feesSum = b.commission + acquiring + storage + b.delivery + b.ads + b.other; // buyerDelivery компенсируется, в payout не входит
    rows.push({
      order: p.posting_number, d: p.date, status: p.status,
      sku: top.sku, offer: top.offer, units, revenue: Math.round(revenue),
      commission: Math.round(b.commission), delivery: Math.round(b.delivery), acquiring: Math.round(acquiring),
      storage: Math.round(storage), buyer_delivery: Math.round(buyerDeliv), ads: Math.round(b.ads),
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
