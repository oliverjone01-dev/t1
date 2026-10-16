// Карта объединённых карточек из Seller API -> data/card_groups.json, без мака и гугл-таблицы.
//
// Иван 16.10: «данные по объединённым карточкам ты собирал сам, делай». Прежняя карта - разовая
// выгрузка кабинета 23.09 (cabinet-list-by-filter), к 16.10 ей 23 дня: новые карточки (GGT-03-5-1)
// в неё не попали, card-kin.test краснел. Ключ склейки в API тот же: model_info.model_id из
// /v4/product/info/attributes совпадает с card_id кабинета (4681610246 - зеркала GGM-02/GGM-17,
// проба card-groups-probe run 2, 16.10). Список товаров - из прайса: без offer_id метод отвечал 404.
//
// Защита (fail-closed): если API вернул меньше 90 % запрошенных товаров, model_id прочитан меньше чем
// у 90 % или в самом ответе API (без переноса из прежней карты) карточек меньше 20,
// файл не трогаем и выходим с кодом 1 - ночной шаг пишет warning, страница живёт на прежней карте.
// Артикулы прежней карты, которых нет в API (сняты с продажи, в прайсе их нет), остаются в своей
// прежней карточке, даже если всей карточки в API больше нет: история тестов не теряет родню.
// Артикул, который есть в API, всегда стоит там, где его ставит API.
//
// Запуск: npm run cards:api   (без OZON_SELLER_* не стартует)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { modelIdOf, modelCountOf } from "./model-groups.js";

const OUT = "data/card_groups.json";
export const MIN_MODEL_SHARE = 0.9;
export const MIN_GROUPS = 20;

export interface MapGroup { model: string; main: string; skus: Array<{ sku: string; offer: string }>; declared: number }
export interface MapFile { generated_note: string; source: string; imported_at: string; groups: MapGroup[] }

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Товары API (+ прежняя карта) -> новая карта. Чистая функция, без сети. */
export function buildCardMap(items: any[], prev: MapFile | null, today: string, requested = 0):
  { map: MapFile | null; stats: { items: number; requested: number; withModel: number; apiGroups: number; groups: number; carried: number; moved: number; added: number }; why: string } {
  const by = new Map<string, { declared: number; skus: Map<string, string> }>();
  let withModel = 0;
  for (const it of items ?? []) {
    const id = modelIdOf(it), offer = str(it?.offer_id);
    if (!id || !offer) continue;
    withModel += 1;
    const g = by.get(id) ?? { declared: 0, skus: new Map() };
    g.declared = Math.max(g.declared, modelCountOf(it));
    g.skus.set(offer, str(it?.sku));
    by.set(id, g);
  }
  const apiOffers = new Set<string>(); for (const g of by.values()) for (const o of g.skus.keys()) apiOffers.add(o);
  // Порог по карточкам - только по ответу API, до переноса из прежней карты (Codex P1 #486):
  // иначе обрезанный ответ добирается старой картой и проходит защиту со свежей датой.
  const apiGroups = [...by.values()].filter((g) => g.skus.size >= 2).length;
  const prevCard = new Map<string, { card: string; sku: string }>();
  for (const g of prev?.groups ?? []) for (const s of g.skus) prevCard.set(s.offer, { card: str(g.main), sku: str(s.sku) });
  let carried = 0;
  for (const [offer, p] of prevCard) {
    if (apiOffers.has(offer) || !p.card) continue;
    const g = by.get(p.card) ?? { declared: 0, skus: new Map<string, string>() };
    g.skus.set(offer, p.sku); by.set(p.card, g); carried += 1;
  }
  const groups: MapGroup[] = [];
  for (const [id, g] of [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (g.skus.size < 2) continue;
    groups.push({ model: `карточка ${id}`, main: id, declared: g.declared,
      skus: [...g.skus.entries()].map(([offer, sku]) => ({ sku, offer })).sort((a, b) => a.offer.localeCompare(b.offer)) });
  }
  const now = new Map<string, string>(); for (const g of groups) for (const s of g.skus) now.set(s.offer, g.main);
  let moved = 0, added = 0;
  for (const [o, c] of now) { const p = prevCard.get(o); if (!p) added += 1; else if (p.card !== c) moved += 1; }
  const n = items?.length ?? 0;
  const stats = { items: n, requested, withModel, apiGroups, groups: groups.length, carried, moved, added };
  if (!n) return { map: null, stats, why: "API не вернул ни одного товара" };
  if (requested && n < requested * MIN_MODEL_SHARE) return { map: null, stats, why: `API вернул ${n} товаров из ${requested} запрошенных (< ${MIN_MODEL_SHARE * 100} %)` };
  if (withModel / n < MIN_MODEL_SHARE) return { map: null, stats, why: `model_id прочитан у ${withModel} из ${n} (< ${MIN_MODEL_SHARE * 100} %)` };
  if (apiGroups < MIN_GROUPS) return { map: null, stats, why: `карточек в ответе API ${apiGroups} (< ${MIN_GROUPS})` };
  const skuN = groups.reduce((s, g) => s + g.skus.length, 0);
  return {
    map: { generated_note: `карта объединённых карточек из Seller API (${groups.length} карточек, ${skuN} товаров)`, source: "seller-api-model_info", imported_at: today, groups },
    stats, why: "",
  };
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("cards:api: OZON_SELLER_* нет - пропуск (карта карточек не обновлена)"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const offers = (await seller.prices()).map((p) => p.offer_id).filter(Boolean);
  const items = await seller.attributesAll(1000, 0, offers);
  const prev: MapFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : null;
  const { map, stats, why } = buildCardMap(items, prev, new Date().toISOString().slice(0, 10), offers.length);
  console.log(`cards:api: товаров ${stats.items} из ${stats.requested}, с model_id ${stats.withModel}, карточек в API ${stats.apiGroups}, в карте ${stats.groups}; новых в карте ${stats.added}, сменили карточку ${stats.moved}, оставлено из прежней карты ${stats.carried}`);
  if (!map) { console.error(`::error::карта карточек не обновлена: ${why}`); process.exit(1); }
  writeFileSync(OUT, JSON.stringify(map, null, 2) + "\n");
  console.log(`cards:api: ${OUT} записан (${map.imported_at})`);
}

if (process.argv[1] && process.argv[1].endsWith("card-groups-api.ts")) {
  main().catch((e) => { console.error("cards:api:", (e as Error).message); process.exit(1); });
}
