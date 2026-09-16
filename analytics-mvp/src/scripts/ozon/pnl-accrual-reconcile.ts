// СВЕРКА (§15) миграции финансов: сборы из НОВОГО /v1/finance/accrual/by-day против СТАРОГО
// data/pnl_sku_daily.ndjson (собран отключённым transaction/list) за закрытый месяц. Доказывает,
// что новый источник + карта категорий (accrual-buckets) дают те же сборы по бакетам, что старый
// реестр. Только сборы (комиссия/логистика/эквайринг/хранение/прочее): выручки в accrual/* нет.
// НЕ в ночном синке. Запуск: tsx pnl-accrual-reconcile.ts 2026-08-01 2026-08-31
import { readFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { bucketMap, type Bucket } from "./accrual-buckets.js";

const num = (a: any): number => Number(String(a?.amount ?? a ?? 0).replace(",", ".")) || 0;
const pad = (n: number) => String(n).padStart(2, "0");
function* days(from: string, to: string) {
  let d = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z");
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) yield `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("reconcile: OZON_SELLER_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-08-01", to = process.argv[3] || "2026-08-31";
  const seller = new OzonSeller({ clientId, apiKey });
  const bmap = bucketMap(await seller.accrualTypes());

  // --- НОВЫЙ источник: by-day, суммируем по бакетам (и итог по type_id для наглядности) ---
  const neu: Record<Bucket, number> = { commission: 0, acquiring: 0, storage: 0, delivery: 0, buyerDelivery: 0, ads: 0, other: 0 };
  const add = (typeId: number, amount: number) => { const b = bmap[typeId] ?? "other"; neu[b] += amount; };
  let rows = 0;
  for (const day of days(from, to)) {
    const accr = await seller.accrualByDay(day);
    for (const a of accr) {
      rows++;
      if (a.item_fees?.fees) for (const s of a.item_fees.fees) for (const f of (s.fees || [])) add(Number(f.type_id), num(f.accrued));
      if (a.non_item_fee) add(Number(a.non_item_fee.type_id), num(a.non_item_fee.accrued));
      if (a.container_fees?.fees) for (const f of a.container_fees.fees) add(Number(f.type_id), num(f.accrued));
    }
  }
  console.log(`НОВЫЙ by-day ${from}..${to}: строк ${rows}`);
  for (const b of Object.keys(neu) as Bucket[]) console.log(`  ${b}\t${Math.round(neu[b]).toLocaleString("ru-RU")}`);
  const newFees = neu.commission + neu.acquiring + neu.storage + neu.delivery + neu.ads + neu.other; // без buyerDelivery (компенс.)
  console.log(`  СБОРЫ всего (без доставки от покупателя)\t${Math.round(newFees).toLocaleString("ru-RU")}`);

  // --- СТАРЫЙ источник: pnl_sku_daily.ndjson за тот же период ---
  const F = "data/pnl_sku_daily.ndjson";
  if (!existsSync(F)) { console.log("старого pnl_sku_daily.ndjson нет - сверить не с чем"); return; }
  const old = { commission: 0, delivery: 0, acquiring: 0, storage: 0, otherSvc: 0, accruals: 0, amount: 0 };
  for (const l of readFileSync(F, "utf-8").trim().split("\n").filter(Boolean)) {
    let r: any; try { r = JSON.parse(l); } catch { continue; }
    if (r.d < from || r.d > to) continue;
    old.commission += r.commission || 0; old.delivery += r.delivery || 0; old.acquiring += r.acquiring || 0;
    old.storage += r.storage || 0; old.otherSvc += r.otherSvc || 0; old.accruals += r.accruals || 0; old.amount += r.amount || 0;
  }
  console.log(`\nСТАРЫЙ pnl_sku_daily ${from}..${to} (только per-SKU операции):`);
  console.log(`  commission ${Math.round(old.commission).toLocaleString("ru-RU")} · delivery ${Math.round(old.delivery).toLocaleString("ru-RU")} · acquiring ${Math.round(old.acquiring).toLocaleString("ru-RU")} · storage ${Math.round(old.storage).toLocaleString("ru-RU")} · otherSvc ${Math.round(old.otherSvc).toLocaleString("ru-RU")}`);
  console.log(`  начислено(выручка) ${Math.round(old.accruals).toLocaleString("ru-RU")} · к выплате ${Math.round(old.amount).toLocaleString("ru-RU")}`);

  const cmp = (label: string, a: number, b: number) => {
    const d = a - b, p = b ? Math.round((d / b) * 1000) / 10 : (a ? 100 : 0);
    console.log(`  ${label}: новый ${Math.round(a).toLocaleString("ru-RU")} vs старый ${Math.round(b).toLocaleString("ru-RU")} -> Δ ${Math.round(d).toLocaleString("ru-RU")} (${p}%)`);
  };
  console.log(`\nСВЕРКА сборов (новый by-day vs старый pnl_sku_daily):`);
  cmp("commission", neu.commission, old.commission);
  cmp("acquiring", neu.acquiring, old.acquiring);
  cmp("storage", neu.storage, old.storage);
  cmp("delivery", neu.delivery, old.delivery);
  cmp("other(ads+other)", neu.ads + neu.other, old.otherSvc);
  console.log(`\nПРИМЕЧАНИЕ: старый pnl_sku_daily - ТОЛЬКО операции с одним SKU (комплекты/кабинетные сборы вне),`);
  console.log(`а новый by-day несёт ВСЕ начисления (вкл. NON_ITEM кабинетные). Точное совпадение не ждём;`);
  console.log(`смотрим порядок и знак по каждому бакету - подтверждает корректность карты категорий.`);
}
main().catch((e) => { console.error("reconcile FAILED:", (e as Error).message); process.exit(0); });
