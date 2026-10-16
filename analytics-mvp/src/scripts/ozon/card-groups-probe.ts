// PROBE: где у OZON лежит ключ объединённой карточки. Гугл-таблица заполнялась руками и
// неполная, поэтому карта карточек нужна из API. Ставка на /v4/product/info/attributes и
// model_info.model_id, но форму ответа из контейнера не проверить (OZON закрыт сетевой
// политикой), поэтому проба печатает СЫРЫЕ ключи, а не только разобранный результат.
// НЕ в ночном синке, ничего не пишет в репозиторий.
import { OzonSeller } from "../../connector/ozon-seller.js";
import { itemsToCardGroups, modelIdOf, modelCountOf } from "./model-groups.js";
import { buildCardMap } from "./card-groups-api.js";
import { readFileSync, existsSync } from "node:fs";

const preview = (v: unknown, n = 300): string => {
  const s = JSON.stringify(v);
  return s == null ? "null" : s.length > n ? s.slice(0, n) + "…" : s;
};

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("probe: OZON_SELLER_* нет - пропуск"); return; }
  const seller = new OzonSeller({ clientId, apiKey });
  const want = (process.argv[2] || "").trim();   // оффер для подробного дампа
  const full = /^(1|true|yes|да)$/i.test(process.argv[3] || "");

  let items: any[] = [];
  try {
    // Весь каталог - по списку артикулов из прайса: без него метод отвечал 404 (16.10).
    const offers = full ? (await seller.prices()).map((p) => p.offer_id).filter(Boolean) : [];
    if (full) console.log(`probe: артикулов в прайсе ${offers.length}`);
    items = full ? await seller.attributesAll(1000, 0, offers) : await seller.attributesRaw(100);
  } catch (e) {
    console.error("probe attributes FAILED:", (e as Error).message);
    console.error("Если это 404 или «method not found» - эндпоинт другой, и карту придётся брать не отсюда.");
    return;
  }
  console.log(`probe: получено ${items.length} товаров (${full ? "весь каталог" : "первая страница"})`);
  if (!items.length) return;

  // 1. Форма ответа. Печатаем ключи первого элемента: по ним видно, есть ли model_info вообще.
  console.log("\n=== ключи элемента ===");
  console.log(Object.keys(items[0]).sort().join(", "));
  const modelish = Object.keys(items[0]).filter((k) => /model/i.test(k));
  console.log("ключи со словом model:", modelish.length ? modelish.join(", ") : "НЕТ НИ ОДНОГО");
  for (const k of modelish) console.log(`  ${k} =`, preview(items[0][k]));

  // 2. Насколько поле заполнено. Пустое на 100 % поле бесполезно так же, как отсутствующее.
  const withModel = items.filter((it) => modelIdOf(it)).length;
  const withCount = items.filter((it) => modelCountOf(it) > 0).length;
  console.log(`\nmodel_id прочитан у ${withModel} из ${items.length}; count у ${withCount}`);

  // 3. Что получится картой. Одиночные товары в карту не идут - это не карточки.
  const { groups, stats, warnings } = itemsToCardGroups(items);
  console.log(`\n=== разобранная карта ===`);
  console.log(`групп: ${stats.groups}, товаров с моделью: ${stats.withModel}, с недобором: ${stats.incomplete.length}`);
  for (const w of warnings) console.log("⚠ " + w);
  for (const g of groups.slice(0, 10)) {
    console.log(`  [${g.main}] ${g.model}: ${g.skus.map((s) => s.offer || s.sku).join(", ")}`);
  }
  if (groups.length > 10) console.log(`  ... и ещё ${groups.length - 10}`);
  for (const inc of stats.incomplete.slice(0, 10)) {
    console.log(`  недобор [${inc.model}]: собрано ${inc.have}, OZON обещает ${inc.want}`);
  }

  // 3б. Что запишет ночной cards:api (без записи): сверка с текущей картой data/card_groups.json.
  if (full) {
    const prev = existsSync("data/card_groups.json") ? JSON.parse(readFileSync("data/card_groups.json", "utf-8")) : null;
    const { map, stats, why } = buildCardMap(items, prev, "probe", items.length);
    console.log(`\n=== cards:api (сухой прогон) ===\n${JSON.stringify(stats)} ${why ? "НЕ ЗАПИСАЛ БЫ: " + why : `записал бы ${map!.groups.length} карточек, ${map!.groups.reduce((s, g) => s + g.skus.length, 0)} товаров`}`);
    const pc = new Map<string, string>(); for (const g of prev?.groups ?? []) for (const s of g.skus) pc.set(s.offer, g.main);
    const same = map ? map.groups.flatMap((g) => g.skus.filter((s) => pc.get(s.offer) === g.main)).length : 0;
    console.log(`совпало с прежней картой: ${same} из ${pc.size} артикулов; карточки прежней карты, которых нет в API: ${[...new Set(pc.values())].filter((c) => !map?.groups.some((g) => g.main === c)).join(", ") || "нет"}`);
    for (const g of map?.groups ?? []) if (g.skus.some((s) => s.offer.startsWith("GGT-03-5-1"))) console.log(`  GGT-03-5-1 в карточке ${g.main}: ${g.skus.length} товаров, из них GGT-03-5-1: ${g.skus.filter((s) => s.offer.startsWith("GGT-03-5-1")).length}`);
  }

  // 4. Подробный дамп одного товара: нужен, если model_info не нашёлся и ключ надо искать глазами.
  const pick = want ? items.filter((it) => String(it.offer_id ?? "").includes(want)) : items.slice(0, 1);
  for (const it of pick.slice(0, 2)) {
    console.log(`\n=== товар ${it.offer_id} (sku ${it.sku ?? it.id ?? "?"}) ===`);
    for (const [k, v] of Object.entries(it)) {
      if (k === "attributes") { console.log(`  attributes: ${Array.isArray(v) ? v.length : "?"} шт.`); continue; }
      console.log(`  ${k}:`, preview(v, 200));
    }
    // Атрибуты печатаем отдельным списком: если ключ склейки живёт среди них, он тут и всплывёт.
    for (const a of (it.attributes ?? []).slice(0, 40)) {
      console.log(`    attr ${a.attribute_id ?? a.id}: ${preview(a.values ?? a.value, 120)}`);
    }
  }
}

main().catch((e) => { console.error("probe FAILED:", (e as Error).message); process.exit(0); });
