// Финансы по SKU за период с РАЗБИВКОЙ комиссии на составляющие (для Excel-выгрузки по артикулам).
// Источник - /v3/finance/transaction/list (реальные деньги, а не витрина). Считает ТОЛЬКО операции
// с ОДНИМ товаром (как pnl-sku.ts) - многотоварные пропускаются (нельзя честно разнести по SKU).
// Разбивка «всего сборов» = начислено - к выплате раскладывается на:
//   sale_commission (комиссия за продажу), delivery (логистика), acquiring (эквайринг),
//   storage (хранение), otherSvc (прочие услуги OZON).
// Креды из env: OZON_SELLER_CLIENT_ID, OZON_SELLER_API_KEY (GitHub Secrets).
// Запуск: tsx src/scripts/ozon/pnl-sku-breakdown.ts <dateFrom> <dateTo> <outFile>
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

type Agg = {
  accruals: number;         // начислено (accruals_for_sale)
  sale_commission: number;  // комиссия за продажу
  delivery: number;         // логистика (доставка + возвратная доставка + услуги «логистика/доставка»)
  acquiring: number;        // эквайринг
  storage: number;          // хранение
  otherSvc: number;         // прочие услуги OZON
  amount: number;           // к выплате
  ops: number;              // число операций (шт. в разрезе доставок)
};

// Классификация услуги по имени. OZON в транзакциях отдаёт машинные коды (англ.), а не рус.
// названия. Логистика: DirectFlow/ReturnFlow/LastMile/Dropoff/HandoverPlace/ReturnsPVZ.
// Эквайринг: Acquiring. Хранение: Storage. Остальное (комиссия бренда, Premium/Stars-подписки,
// рассрочка, обработка отзывов, обработка нестандарта/ВГХ) -> прочие услуги.
function svcBucket(name: string): "delivery" | "acquiring" | "storage" | "other" {
  const n = name.toLowerCase();
  if (/эквайринг|acquiring/.test(n)) return "acquiring";
  if (/хранени|storage/.test(n)) return "storage";
  if (/логист|доставк|logistic|lastmile|last\s*mile|dropoff|handoverplace|returnspvz|deliveryto/.test(n)) return "delivery";
  return "other";
}

// Чистая агрегация (тестируется без сети). Только операции с ОДНИМ товаром.
export function aggregateBreakdown(ops: any[]): { skuCount: number; singleItemOps: number; multiItemOps: number; serviceTotals: Record<string, number>; multiOnlySku: Record<string, number>; bySku: Record<string, Agg> } {
  const bySku: Record<string, Agg> = {};
  const serviceTotals: Record<string, number> = {}; // разведка: какие услуги реально есть (по имени, все ops)
  const multiSku: Record<string, number> = {};      // SKU в многотоварных ops (сколько раз встретился)
  let multi = 0, single = 0;
  for (const o of ops) {
    for (const s of (o.services || [])) { const n = String(s.name || "?"); serviceTotals[n] = (serviceTotals[n] || 0) + (s.price || 0); }
    const items = o.items || [];
    if (items.length !== 1) {
      if (items.length > 1) { multi++; for (const it of items) { const s = String((it && it.sku) || ""); if (s && s !== "0") multiSku[s] = (multiSku[s] || 0) + 1; } }
      continue;
    }
    single++;
    const sku = String((items[0] && items[0].sku) || "");
    if (!sku || sku === "0") continue;
    let a = bySku[sku];
    if (!a) { a = { accruals: 0, sale_commission: 0, delivery: 0, acquiring: 0, storage: 0, otherSvc: 0, amount: 0, ops: 0 }; bySku[sku] = a; }
    a.accruals += o.accruals_for_sale || 0;
    a.sale_commission += o.sale_commission || 0;
    a.delivery += (o.delivery_charge || 0) + (o.return_delivery_charge || 0);
    a.amount += o.amount || 0;
    a.ops++;
    for (const s of (o.services || [])) {
      const price = s.price || 0;
      switch (svcBucket(String(s.name || ""))) {
        case "acquiring": a.acquiring += price; break;
        case "storage": a.storage += price; break;
        case "delivery": a.delivery += price; break;
        default: a.otherSvc += price;
      }
    }
  }
  for (const k in bySku) {
    const a = bySku[k]!;
    a.accruals = Math.round(a.accruals); a.sale_commission = Math.round(a.sale_commission);
    a.delivery = Math.round(a.delivery); a.acquiring = Math.round(a.acquiring);
    a.storage = Math.round(a.storage); a.otherSvc = Math.round(a.otherSvc); a.amount = Math.round(a.amount);
  }
  for (const k in serviceTotals) serviceTotals[k] = Math.round(serviceTotals[k]!);
  // SKU, которые были ТОЛЬКО в многотоварных ops (в single-item их нет -> в финансах по SKU пусто)
  const multiOnlySku: Record<string, number> = {};
  for (const k in multiSku) if (!bySku[k]) multiOnlySku[k] = multiSku[k]!;
  return { skuCount: Object.keys(bySku).length, singleItemOps: single, multiItemOps: multi, serviceTotals, multiOnlySku, bySku };
}

export async function pnlBreakdown(dateFrom: string, dateTo: string): Promise<any> {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) throw new Error("OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY не заданы (GitHub Secrets)");
  const ops = await new OzonSeller({ clientId, apiKey }).transactions(dateFrom, dateTo);
  return { dateFrom, dateTo, ...aggregateBreakdown(ops) };
}

async function main() {
  const argv = process.argv.slice(2);
  const dateFrom = argv[0], dateTo = argv[1], outFile = argv[2];
  if (!dateFrom || !dateTo || !outFile) { console.error("usage: pnl-sku-breakdown.ts <dateFrom> <dateTo> <outFile>"); process.exit(1); }
  const out = await pnlBreakdown(dateFrom, dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`pnl-sku-breakdown: ${out.skuCount} SKU, single-ops ${out.singleItemOps} (multi ${out.multiItemOps}), ${dateFrom}..${dateTo} -> ${outFile}`);
}

if (process.argv[1] && /pnl-sku-breakdown\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("pnl-sku-breakdown FAILED:", (e as Error).message); process.exit(1); });
