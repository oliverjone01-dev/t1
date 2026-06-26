// PROBE: структура финансовых операций /v3/finance/transaction/list - чтобы взять реальную
// цену покупки из операций «доставлено клиенту» (accruals_for_sale = что заплатил клиент).
// Дампит операции доставки по заданному SKU/офферу за последние N дней. НЕ в ночном синке.
import { OzonSeller } from "../../connector/ozon-seller.js";

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("probe: OZON_SELLER_* нет - пропуск"); return; }
  const want = (process.argv[2] || "").trim(); // sku или часть оффера/названия
  const days = Number(process.argv[3] || "10");
  const now = new Date(); const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const ops = await new OzonSeller({ clientId, apiKey }).transactions(fmt(from), fmt(to));
  console.log(`probe: ${ops.length} операций за ${fmt(from)}..${fmt(to)}`);

  // Какие типы операций есть (имя -> кол-во)
  const types: Record<string, number> = {};
  for (const o of ops) { const n = o.operation_type_name || o.operation_type || "?"; types[n] = (types[n] || 0) + 1; }
  console.log("типы операций:", JSON.stringify(types, null, 2));

  // Операции доставки покупателю по нужному SKU/офферу
  const isDeliv = (o: any) => /доставка покупателю|доставлено/i.test(String(o.operation_type_name || "")) || String(o.operation_type || "") === "OperationAgentDeliveredToCustomer";
  const match = (o: any) => !want || (o.items || []).some((it: any) => String(it.sku || "").includes(want) || String(it.name || "").toLowerCase().includes(want.toLowerCase()));
  const sample = ops.filter((o) => isDeliv(o) && match(o)).slice(0, 5);
  console.log(`\nдоставки${want ? " по «" + want + "»" : ""}: ${sample.length} (показываю до 5):`);
  for (const o of sample) {
    console.log(JSON.stringify({
      type: o.operation_type, name: o.operation_type_name, date: o.operation_date,
      accruals_for_sale: o.accruals_for_sale, sale_commission: o.sale_commission, amount: o.amount,
      items: o.items, posting: o.posting?.posting_number,
    }, null, 2));
  }
}

main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
