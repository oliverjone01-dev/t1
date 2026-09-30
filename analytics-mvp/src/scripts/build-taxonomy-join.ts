// Строит sku -> {offer, category, sub, line, model} и отчёт покрытия.
// sku->offer: живой срез (skus_live_30d sku_table), для OZON ещё все заказы (orders_daily)
// и справочник sku_offer.json - иначе выпадали SKU, которых нет в срезе 30 дней (тесты п.5, 30.09).
// offer->модель из таксономии.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dp, fp, IS_OZON } from "../paths.js";
import { parseTaxonomy, offerIndex, TaxRow } from "../taxonomy.js";

// Кириллические х/Х в артикуле (GGTP-20-2х2) -> латиница, как в таксономии.
const normOffer = (s: string): string => s.trim().replace(/[хХ]/g, "x");

function main() {
  const tax = parseTaxonomy(readFileSync(fp("taxonomy.csv"), "utf-8"));
  const oi = offerIndex(tax);
  const skus = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));

  // Кандидаты артикулов на SKU в порядке приоритета: срез, заказы (свежие раньше), справочник.
  const cand = new Map<string, string[]>();
  const add = (sku: string, offer: string) => {
    if (!offer) return;
    const l = cand.get(sku) || [];
    if (!l.includes(offer)) l.push(offer);
    cand.set(sku, l);
  };
  for (const s of skus.sku_table) add(String(s.sku), s.offer || "");
  if (IS_OZON) {
    if (existsSync(dp("orders_daily.ndjson"))) {
      const rows = readFileSync(dp("orders_daily.ndjson"), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      rows.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
      for (const o of rows) add(String(o.sku), o.offer || "");
    }
    if (existsSync(dp("sku_offer.json"))) {
      for (const [sku, offer] of Object.entries(JSON.parse(readFileSync(dp("sku_offer.json"), "utf-8")) as Record<string, string>)) add(sku, offer);
    }
  }

  const map: Record<string, { offer: string; category: string; sub: string; line: string; model: string }> = {};
  for (const [sku, offers] of cand) {
    let hit: [string, TaxRow] | null = null;
    for (const o of offers) {
      const t = oi.get(o) || oi.get(normOffer(o));
      if (t) { hit = [o, t]; break; }
    }
    if (hit) map[sku] = { offer: hit[0], category: hit[1].category, sub: hit[1].sub, line: hit[1].line, model: hit[1].model };
  }

  let matched = 0, total = 0, revMatched = 0, revTotal = 0;
  for (const s of skus.sku_table) {
    total++; revTotal += s.rev;
    if (map[String(s.sku)]) { matched++; revMatched += s.rev; }
  }

  writeFileSync(dp("sku_taxonomy.json"), JSON.stringify(map, null, 0));
  console.log(`Таксономия: ${tax.length} моделей, ${oi.size} артикулов.`);
  console.log(`Размечено SKU: ${Object.keys(map).length} из ${cand.size} известных.`);
  console.log(`Живой срез: ${matched}/${total} SKU (${Math.round((matched / total) * 100)}%), покрытие оборота ${Math.round((revMatched / revTotal) * 100)}%.`);
  const byCat: Record<string, number> = {};
  for (const v of Object.values(map)) byCat[v.category] = (byCat[v.category] || 0) + 1;
  console.log("По категориям:", JSON.stringify(byCat));
}

main();
