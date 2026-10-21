// Догрузка дыр и повтор последних 7 дней. Сбой не меняет данные/checkpoint.
import { OzonSeller } from "../../connector/ozon-seller.js";
import { collectDaily, requireCredentials } from "./collector-integrity.js";

export async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  requireCredentials(clientId, apiKey);
  const seller = new OzonSeller({ clientId, apiKey });
  await collectDaily({
    path: "data/sku_views.ndjson", floor: "2026-02-06",
    date: (r: any) => r.date, key: (r: any) => `${r.date}|${r.sku}`,
    load: async day => seller.skuViewsDay(day),
  });
}

if (process.argv[1] && /sku-views\.ts$/.test(process.argv[1])) main().catch(e => { console.error("sku-views FAILED:", e.message); process.exitCode = 1; });
