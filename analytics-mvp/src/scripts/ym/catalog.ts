// Каталог Маркета -> data-ym/catalog.json: артикул -> {name, marketSku, category, price, stock, business, campaigns}.
// Источники (чтение): offer-mappings по каждому бизнес-кабинету (имя, marketSku, категория, базовая
// цена), offers по кампании (цена с акциями = что видит покупатель), offers/stocks (доступно к заказу).
// НАКОПИТЕЛЬНО: раз увиденный артикул не теряем (аналог data/sku_offer.json у OZON).
// Запуск: npm run ym:catalog
import { loadEnv } from "../../env.js";
import { accounts, resolveTargets, resolveBusinesses, ensureDir, readJson, writeJson, yp, bizName } from "./common.js";

// stock: null - «Маркет остаток НЕ отдал», 0 - «Маркет сказал ноль». Раньше и то и другое было
// нулём, и страница показывала «нет на складе» у 114 артикулов из 148, про которые на самом деле
// ничего не известно. Разница видна пользователю: «нет» и «нет данных» - разные решения.
export interface CatalogItem { name: string; marketSku: string; category: string; price: number | null; basicPrice: number | null; stock: number | null; business: string; campaigns: string[]; archived?: boolean; seen: string }
export interface Catalog { platform: "ym"; generated_at: string; items: Record<string, CatalogItem> }

const OUT = yp("catalog.json");


// Разнесение остатков по каталогу. Вынесено из main() ради теста: правило «не назван - значит
// неизвестно» проверяется на выдуманных данных, без сети.
// stockAt - «артикул|склад» -> доступно (уникальные пары, чтобы общий склад двух кампаний
// не складывался сам с собой). stockSeen - артикулы, которые Маркет вообще назвал.
export function applyStocks(
  items: Record<string, { stock: number | null }>,
  stockAt: Map<string, number>,
  stockSeen: Set<string>,
  stocksOk: boolean,
): { applied: boolean; known: number } {
  // Ни одна кампания не ответила: это отказ API, а не пустой склад. Прошлое значение - лучшее,
  // что у нас есть, стирать его в null означало бы терять данные из-за сетевой ошибки.
  if (!stocksOk) return { applied: false, known: Object.values(items).filter((x) => x.stock != null).length };
  const sum: Record<string, number> = {};
  for (const [k, n] of stockAt) { const id = k.slice(0, k.lastIndexOf("|")); sum[id] = (sum[id] || 0) + n; }
  for (const [id, cur] of Object.entries(items)) {
    // Артикул, которого в ответе нет, - это «неизвестно», а не ноль: Маркет не перечисляет
    // позиции без остатка. Прошлое значение при этом не консервируем: оно протухло бы навсегда.
    cur.stock = stockSeen.has(id) ? (sum[id] ?? 0) : null;
  }
  return { applied: true, known: Object.values(items).filter((x) => x.stock != null).length };
}

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
        const cur = items[o.offerId] || { name: "", marketSku: "", category: "", price: null, basicPrice: null, stock: null, business: b, campaigns: [], seen: now };
        cur.name = o.name || cur.name; cur.marketSku = o.marketSku || cur.marketSku; cur.category = o.category || cur.category;
        cur.basicPrice = o.basicPrice ?? cur.basicPrice; cur.business = b; cur.archived = o.archived; cur.seen = now;
        items[o.offerId] = cur; nMap++;
      }
      console.log(`ym-catalog: кабинет ${b} (${bizName(b)}): offer-mappings ${offers.length}`);
    } catch (e) { console.warn(`::warning::ym-catalog: offer-mappings ${b} не прочитан: ${(e as Error).message.slice(0, 160)}`); }
  }
  // цены и остатки по кампаниям (каждая - своим ключом)
  const stockAt = new Map<string, number>(); // «артикул|склад» -> доступно
  const stockSeen = new Set<string>();       // артикулы, которые Маркет вообще назвал
  let stocksOk = false;                      // хоть одна кампания ответила по остаткам
  for (const { campaign: c, account } of targets) {
    const api = account.api;
    try {
      const offers = await api.campaignOffers(c.id);
      for (const o of offers) {
        const cur = items[o.offerId] || (items[o.offerId] = { name: "", marketSku: "", category: "", price: null, basicPrice: null, stock: null, business: c.businessId, campaigns: [], seen: now });
        if (o.campaignPrice != null) cur.price = o.campaignPrice; else if (o.basicPrice != null && cur.price == null) cur.price = o.basicPrice;
        if (!cur.campaigns.includes(c.id)) cur.campaigns.push(c.id);
      }
      console.log(`ym-catalog: кампания ${c.id}: offers ${offers.length}`);
    } catch (e) { console.warn(`::warning::ym-catalog: offers ${c.id} не прочитаны: ${(e as Error).message.slice(0, 160)}`); }
    try {
      const stocks = await api.stocks(c.id);
      // Ключ - (артикул, склад), а НЕ артикул: один склад обслуживает несколько кампаний кабинета,
      // и суммирование по кампаниям задваивало бы его остаток. Складываем в конце, по всем
      // кампаниям сразу, поэтому здесь только копим уникальные пары.
      for (const s of stocks) stockAt.set(`${s.offerId}|${s.warehouseId}`, s.available);
      for (const s of stocks) stockSeen.add(s.offerId);
      stocksOk = true;
      console.log(`ym-catalog: кампания ${c.id}: остатки по ${new Set(stocks.map((x) => x.offerId)).size} артикулам (${stocks.length} пар склад/артикул)`);
    } catch (e) { console.warn(`::warning::ym-catalog: stocks ${c.id} не прочитаны: ${(e as Error).message.slice(0, 160)}`); }
  }
  // Остатки проставляются ОДИН раз, после обхода всех кампаний.
  const st = applyStocks(items, stockAt, stockSeen, stocksOk);
  if (st.applied) console.log(`ym-catalog: остаток известен у ${st.known} из ${Object.keys(items).length} артикулов, у остальных Маркет его не отдал`);
  else console.warn("::warning::ym-catalog: остатки не прочитаны ни по одной кампании - прошлые значения оставлены как есть");
  const out: Catalog = { platform: "ym", generated_at: now, items };
  writeJson(OUT, out, 0);
  console.log(`ym-catalog: артикулов ${Object.keys(items).length} (из mappings ${nMap}) -> ${OUT}`);
}

// Сеть дёргается ТОЛЬКО при прямом запуске: applyStocks импортируется тестом, и без этой
// проверки импорт функции уходил в кабинет Маркета.
const entry = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (/[\\/]catalog\.ts$/.test(entry)) {
  main().catch((e) => { console.error("ym-catalog FAILED:", (e as Error).message); process.exit(1); });
}
