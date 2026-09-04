// Каталог Маркета -> data-ym/catalog.json: артикул -> {name, marketSku, category, price, stock, business, campaigns}.
// Источники (чтение): offer-mappings по каждому бизнес-кабинету (имя, marketSku, категория, базовая
// цена), offers по кампании (цена с акциями = что видит покупатель), offers/stocks (доступно к заказу).
// НАКОПИТЕЛЬНО: раз увиденный артикул не теряем (аналог data/sku_offer.json у OZON).
// Запуск: npm run ym:catalog
import { loadEnv } from "../../env.js";
import { accounts, resolveTargets, resolveBusinesses, ensureDir, readJson, writeJson, yp, bizName } from "./common.js";

export interface CatalogItem { name: string; marketSku: string; category: string; price: number | null; basicPrice: number | null; stock: number; business: string; campaigns: string[]; archived?: boolean; seen: string }
export interface Catalog { platform: "ym"; generated_at: string; items: Record<string, CatalogItem> }

const OUT = yp("catalog.json");

async function main() {
  loadEnv();
  ensureDir();
  const accs = accounts();
  const prev = readJson<Catalog>(OUT, { platform: "ym", generated_at: "", items: {} });
  const items: Record<string, CatalogItem> = { ...prev.items };
  const now = new Date().toISOString();

  const targets = await resolveTargets(accs);
  const bizList = await resolveBusinesses(accs);
  let nMap = 0;
  for (const { businessId: b, account } of bizList) {
    try {
      const offers = await account.api.offerMappings(b);
      for (const o of offers) {
        if (!o.offerId) continue;
        const cur = items[o.offerId] || { name: "", marketSku: "", category: "", price: null, basicPrice: null, stock: 0, business: b, campaigns: [], seen: now };
        cur.name = o.name || cur.name; cur.marketSku = o.marketSku || cur.marketSku; cur.category = o.category || cur.category;
        cur.basicPrice = o.basicPrice ?? cur.basicPrice; cur.business = b; cur.archived = o.archived; cur.seen = now;
        items[o.offerId] = cur; nMap++;
      }
      console.log(`ym-catalog: кабинет ${b} (${bizName(b)}): offer-mappings ${offers.length}`);
    } catch (e) { console.warn(`::warning::ym-catalog: offer-mappings ${b} не прочитан: ${(e as Error).message.slice(0, 160)}`); }
  }
  // цены и остатки по кампаниям (каждая - своим ключом)
  for (const { campaign: c, account } of targets) {
    const api = account.api;
    try {
      const offers = await api.campaignOffers(c.id);
      for (const o of offers) {
        const cur = items[o.offerId] || (items[o.offerId] = { name: "", marketSku: "", category: "", price: null, basicPrice: null, stock: 0, business: c.businessId, campaigns: [], seen: now });
        if (o.campaignPrice != null) cur.price = o.campaignPrice; else if (o.basicPrice != null && cur.price == null) cur.price = o.basicPrice;
        if (!cur.campaigns.includes(c.id)) cur.campaigns.push(c.id);
      }
      console.log(`ym-catalog: кампания ${c.id}: offers ${offers.length}`);
    } catch (e) { console.warn(`::warning::ym-catalog: offers ${c.id} не прочитаны: ${(e as Error).message.slice(0, 160)}`); }
    try {
      const stocks = await api.stocks(c.id);
      const sum: Record<string, number> = {};
      for (const s of stocks) sum[s.offerId] = (sum[s.offerId] || 0) + s.available;
      for (const [id, n] of Object.entries(sum)) { const cur = items[id]; if (cur) cur.stock = n; }
      console.log(`ym-catalog: кампания ${c.id}: остатки по ${Object.keys(sum).length} артикулам`);
    } catch (e) { console.warn(`::warning::ym-catalog: stocks ${c.id} не прочитаны: ${(e as Error).message.slice(0, 160)}`); }
  }
  const out: Catalog = { platform: "ym", generated_at: now, items };
  writeJson(OUT, out, 0);
  console.log(`ym-catalog: артикулов ${Object.keys(items).length} (из mappings ${nMap}) -> ${OUT}`);
}

main().catch((e) => { console.error("ym-catalog FAILED:", (e as Error).message); process.exit(1); });
