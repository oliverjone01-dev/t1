// Строит sku -> {offer, category, sub, line, model} и отчёт покрытия.
// sku->offer берём из живого среза (skus_live_30d sku_table), offer->модель из таксономии.
import { readFileSync, writeFileSync } from "node:fs";
import { parseTaxonomy, offerIndex } from "../taxonomy.js";

function main() {
  const tax = parseTaxonomy(readFileSync("fixtures/taxonomy.csv", "utf-8"));
  const oi = offerIndex(tax);
  const skus = JSON.parse(readFileSync("data/skus_live_30d.json", "utf-8"));

  const map: Record<string, { offer: string; category: string; sub: string; line: string; model: string }> = {};
  let matched = 0, total = 0, revMatched = 0, revTotal = 0;
  for (const s of skus.sku_table) {
    total++; revTotal += s.rev;
    const offer = s.offer || "";
    const t = oi.get(offer);
    if (t) {
      matched++; revMatched += s.rev;
      map[String(s.sku)] = { offer, category: t.category, sub: t.sub, line: t.line, model: t.model };
    }
  }

  writeFileSync("data/sku_taxonomy.json", JSON.stringify(map, null, 0));
  console.log(`Таксономия: ${tax.length} моделей, ${oi.size} артикулов.`);
  console.log(`Связка sku->модель: ${matched}/${total} SKU (${Math.round((matched / total) * 100)}%), покрытие оборота ${Math.round((revMatched / revTotal) * 100)}%.`);
  // распределение по категориям
  const byCat: Record<string, number> = {};
  for (const v of Object.values(map)) byCat[v.category] = (byCat[v.category] || 0) + 1;
  console.log("По категориям:", JSON.stringify(byCat));
}

main();
