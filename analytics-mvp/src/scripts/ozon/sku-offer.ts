// Каталожный маппинг SKU -> артикул (offer_id) -> data/sku_offer.json (НАКОПИТЕЛЬНО).
// Источник: OZON Seller /v4/product/info/stocks (visibility=ALL) отдаёт offer_id+sku по всему
// каталогу, включая не продающиеся сейчас позиции. Накапливаем: раз увиденный маппинг НЕ теряем,
// даже если позже товар выпал из каталога, - иначе у старых/архивных SKU в дашборде оставался бы
// числовой SKU вместо артикула. Без OZON_SELLER_* - пропуск (файл не трогаем).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/sku_offer.json";

function readExisting(): Record<string, string> {
  if (!existsSync(OUT)) return {};
  try { return JSON.parse(readFileSync(OUT, "utf-8")); } catch { return {}; }
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("sku-offer: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });

  const map = readExisting();
  const before = Object.keys(map).length;
  let seen = 0, added = 0;
  for (const s of await seller.stocks()) {
    const sk = String(s.sku || ""), off = String(s.offer_id || "");
    if (!sk || sk === "undefined" || !off) continue;
    seen++;
    if (map[sk] !== off) { if (!(sk in map)) added++; map[sk] = off; } // накопление + актуализация артикула
  }
  writeFileSync(OUT, JSON.stringify(map, null, 0) + "\n");
  console.log(`sku-offer: каталог отдал ${seen} SKU с артикулом; в карте было ${before}, добавлено новых ${added}, всего ${Object.keys(map).length}`);
}

if (process.argv[1] && /sku-offer\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("sku-offer FAILED:", (e as Error).message); process.exit(0); });
