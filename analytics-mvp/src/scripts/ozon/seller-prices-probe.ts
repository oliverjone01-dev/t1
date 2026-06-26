// PROBE: разведка полей цены /v5/product/info/prices. Цена с витрины показывает цену продавца
// (до акций OZON), а не реальную цену клиента -> нужно увидеть, в каком поле фактическая цена.
// Дампит price-объект для заданного оффера (или первых 3). НЕ в ночном синке.
import { OzonSeller } from "../../connector/ozon-seller.js";

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("probe: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const want = (process.argv[2] || "").trim(); // оффер для поиска (напр. GGT-35-1-3-100-180)
  let items: any[] = [];
  try { items = await seller.pricesRaw(); } catch (e) { console.error("probe pricesRaw FAILED:", (e as Error).message); return; }
  console.log(`probe: получено ${items.length} элементов прайса`);
  const pick = want ? items.filter((it) => String(it.offer_id || "").includes(want)) : items.slice(0, 3);
  if (!pick.length && want) { console.log(`probe: оффер ${want} не найден; показываю первые 3`); pick.push(...items.slice(0, 3)); }
  for (const it of pick) {
    console.log(`\n=== offer ${it.offer_id} (sku ${it.product_id ?? it.sku ?? "?"}) ===`);
    console.log("price-объект:", JSON.stringify(it.price ?? {}, null, 2));
    console.log("price_indexes:", JSON.stringify(it.price_indexes ?? {}, null, 2));
  }
}

main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
