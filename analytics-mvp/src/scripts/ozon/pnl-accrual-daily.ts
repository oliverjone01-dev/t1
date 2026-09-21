// Дневной КАНАЛЬНЫЙ P&L и КАБИНЕТНЫЕ сборы из accrual-API - замена мёртвого /v3/finance/transaction/list
// (OZON отключил 08.09.2026). Раньше водопад P&L (pnl_daily) и «Общие расходы» (pnl_account_daily)
// строились из транзакций и застыли на 07.09. Здесь собираем их из postings + accrual/postings + by-day.
//
// Базис (как в pnl-sku-accrual и §15): выручка и сборы ПО ПРОДАЖЕ (комиссия/логистика) - по ДАТЕ ЗАКАЗА;
// сервис/кабинет (эквайринг/хранение ITEM, реклама/штрафы/realfbs/бейдж/доставка покупателя NON_ITEM) -
// по дате начисления (by-day). За период (водопад суммирует диапазон) итог сходится.
//
// Выход:
//   data/pnl_channel_accrual_daily.ndjson  {d, accruals, commission, delivery, fees, payout, ops}
//   data/pnl_account_accrual_daily.ndjson  {d, adv, fines, realfbs, badge, delivery, other}
// build-katya подмешивает их за текущий месяц (даты > последнего дня старого ряда), закрытые берёт из старых.
//
// Запуск: OZON_SELLER_* в env; из analytics-mvp: npx tsx src/scripts/ozon/pnl-accrual-daily.ts [FROM] [TO]
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { bucketMap, type Bucket } from "./accrual-buckets.js";

const OUT_CH = "data/pnl_channel_accrual_daily.ndjson";
const OUT_AC = "data/pnl_account_accrual_daily.ndjson";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Категория кабинетного сбора по ИМЕНИ типа начисления (как bucketOf в pnl-account-daily, но по accrual-типам).
function acctCat(name: string): "adv" | "fines" | "realfbs" | "badge" | "delivery" | "other" {
  const n = String(name || "").toLowerCase();
  if (/payperclick|promotion|stencil|оплата за клик|за заказ|продвижени|реклам/.test(n)) return "adv";
  if (/бейдж|badge|реклама в сети|ускоренный сбор|premium|отзыв|review|stars|звёздн/.test(n)) return "badge";
  if (/гибкий график|нерекомендованный слот|превышение индекса|штраф|fine|defect|утилизац/.test(n)) return "fines";
  if (/realfbs|rfbs|сервисный сбор за интеграц|страхован|insurance/.test(n)) return "realfbs";
  if (/перечисление за доставку от покупател|clientdeliverycharge/.test(n)) return "delivery";
  return "other";
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("pnl-accrual-daily: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const from = process.argv[2] || "2026-02-06";
  const to = process.argv[3] || ymd(new Date(Date.now() - 86400000));
  console.log(`pnl-accrual-daily: ${from}..${to}`);

  let bmap: Record<number, Bucket> = {};
  const nameById: Record<number, string> = {};
  try { const types = await seller.accrualTypes(); bmap = bucketMap(types); for (const t of types) nameById[t.id] = t.name; } catch (e) { console.warn("  accrualTypes нет:", (e as Error).message); }

  // --- КАНАЛЬНЫЙ ряд ---
  const ch: Record<string, { accruals: number; commission: number; delivery: number; fees: number; ops: number }> = {};
  const chD = (d: string) => (ch[d] ||= { accruals: 0, commission: 0, delivery: 0, fees: 0, ops: 0 });

  // выручка по дате заказа (постинги, доставленные - как §15/реализация)
  const posts = await seller.postings(from, to);
  const orderDate: Record<string, string> = {};
  for (const p of posts) {
    if (!p.date) continue; orderDate[p.posting_number] = p.date;
    if (p.status !== "delivered") continue;
    const rev = p.products.reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0);
    const r = chD(p.date); r.accruals += rev; r.ops += 1;
  }
  // комиссия/логистика по продаже - accrual/postings, датируем по дате заказа
  const acc = await seller.accrualPostings(posts.map((p) => p.posting_number).filter(Boolean));
  for (const p of acc) {
    const d = orderDate[p.posting_number]; if (!d) continue; // только доставленные
    for (const a of (p.accruals || [])) {
      const bk = (bmap[Number(a.type_id)] || "other") as Bucket;
      const amt = Number(a?.accrued?.amount ?? a?.accrued ?? a?.amount ?? 0);
      const r = chD(d);
      if (bk === "commission") { r.commission += amt; r.fees += amt; }
      else if (bk === "delivery") { r.delivery += amt; r.fees += amt; }
      else if (bk === "buyerDelivery") { /* компенсируется, в payout не входит */ }
      else if (bk === "ads") { /* реклама - в кабинетном ряду, не тут (иначе задвоение с CPO/CPC) */ }
      else { r.fees += amt; } // прочие сборы по продаже (acquiring/storage тут почти не приходят)
    }
  }

  // --- КАБИНЕТНЫЙ ряд + сервисные сборы канала из by-day (по дате начисления) ---
  const ac: Record<string, { adv: number; fines: number; realfbs: number; badge: number; delivery: number; other: number }> = {};
  const acD = (d: string) => (ac[d] ||= { adv: 0, fines: 0, realfbs: 0, badge: 0, delivery: 0, other: 0 });
  const days: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
  let byDayRecs = 0;
  for (const day of days) {
    let arr: any[] = [];
    try { arr = await seller.accrualByDay(day); } catch { continue; }
    byDayRecs += arr.length;
    for (const a of arr) {
      const d = String(a?.date || day).slice(0, 10);
      // ITEM: эквайринг/хранение (сервис канала) - в fees канала
      for (const sf of (a?.item_fees?.fees || [])) for (const f of (sf?.fees || [])) {
        const bk = (bmap[Number(f.type_id)] || "other") as Bucket;
        if (bk !== "acquiring" && bk !== "storage") continue;
        chD(d).fees += Number(f?.accrued?.amount ?? f?.accrued ?? 0);
      }
      // NON_ITEM: кабинетные сборы -> категории Общих расходов
      const nf = a?.non_item_fee;
      if (nf) {
        const cat = acctCat(nameById[Number(nf.type_id)] || "");
        acD(d)[cat] += Number(nf?.accrued?.amount ?? nf?.accrued ?? 0);
      }
    }
  }

  // payout канала = accruals + fees. Строки.
  const chRows = Object.keys(ch).sort().map((d) => {
    const r = ch[d]!;
    return { d, accruals: Math.round(r.accruals), commission: Math.round(r.commission), delivery: Math.round(r.delivery), fees: Math.round(r.fees), payout: Math.round(r.accruals + r.fees), ops: r.ops };
  });
  const acRows = Object.keys(ac).sort().map((d) => { const r = ac[d]!; return { d, adv: Math.round(r.adv), fines: Math.round(r.fines), realfbs: Math.round(r.realfbs), badge: Math.round(r.badge), delivery: Math.round(r.delivery), other: Math.round(r.other) }; })
    .filter((r) => r.adv || r.fines || r.realfbs || r.badge || r.delivery || r.other);
  writeFileSync(OUT_CH, chRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(OUT_AC, acRows.map((r) => JSON.stringify(r)).join("\n") + "\n");

  // само-сверка по месяцам
  const bm: Record<string, { acc: number; pay: number }> = {};
  for (const r of chRows) { const m = r.d.slice(0, 7); const b = (bm[m] ||= { acc: 0, pay: 0 }); b.acc += r.accruals; b.pay += r.payout; }
  console.log(`  by-day записей ${byDayRecs} | канал строк ${chRows.length} | кабинет строк ${acRows.length}`);
  console.log("  канал по месяцам (Начислено | К выплате):");
  for (const m of Object.keys(bm).sort()) console.log(`    ${m}: ${bm[m].acc.toLocaleString("ru")} | ${bm[m].pay.toLocaleString("ru")}`);
  console.log(`  -> ${OUT_CH}, ${OUT_AC}`);
}

main().catch((e) => { console.error("pnl-accrual-daily FAIL:", e); process.exit(1); });
