// РАЗВЕДКА: какие типы операций и услуг реально отдаёт /v3/finance/transaction/list за месяц.
// Нужно, чтобы построить блок «Сборы уровня заказа/кабинета» (реклама/штрафы/realFBS/…) из API,
// а не из УПД-файла. Дампит: суммы amount по operation_type_name (все ops и НЕ-единичные ops),
// суммы по именам услуг. НЕ в ночном синке. Запуск: tsx tx-types-probe.ts [YYYY-MM-01] [YYYY-MM-31]
import { OzonSeller } from "../../connector/ozon-seller.js";

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("probe: OZON_SELLER_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-07-01", to = process.argv[3] || "2026-07-31";
  const ops = await new OzonSeller({ clientId, apiKey }).transactions(from, to);
  console.log(`probe ${from}..${to}: ${ops.length} операций`);

  const byType: Record<string, { amt: number; n: number }> = {};
  const byTypeNonSingle: Record<string, { amt: number; n: number }> = {};
  const bySvc: Record<string, number> = {};
  let single = 0, multi = 0, zero = 0;
  for (const o of ops) {
    const tn = String(o.operation_type_name || o.operation_type || "?");
    const amt = o.amount || 0;
    (byType[tn] ||= { amt: 0, n: 0 }); byType[tn]!.amt += amt; byType[tn]!.n++;
    const items = o.items || [];
    const distinct = Array.from(new Set(items.map((it: any) => String((it && it.sku) || "")).filter((s: string) => s && s !== "0")));
    if (distinct.length === 1) single++;
    else {
      if (distinct.length === 0) zero++; else multi++;
      (byTypeNonSingle[tn] ||= { amt: 0, n: 0 }); byTypeNonSingle[tn]!.amt += amt; byTypeNonSingle[tn]!.n++;
    }
    for (const s of (o.services || [])) { const n = String(s.name || "?"); bySvc[n] = (bySvc[n] || 0) + (s.price || 0); }
  }
  console.log(`single-item ops: ${single}, multi: ${multi}, zero-item(order/account-level): ${zero}`);
  const dump = (obj: Record<string, any>, title: string, val: (v: any) => number) => {
    console.log(`\n=== ${title} ===`);
    for (const [k, v] of Object.entries(obj).sort((a, b) => val(a[1]) - val(b[1]))) console.log(`  ${Math.round(val(v)).toString().padStart(12)}  ${k}`);
  };
  dump(byType, "amount по operation_type_name (ВСЕ ops)", (v) => v.amt);
  dump(byTypeNonSingle, "amount по operation_type_name (НЕ единичные: order/account-level)", (v) => v.amt);
  dump(bySvc, "суммы по именам услуг (services[].name)", (v) => v);
}
main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
