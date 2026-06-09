// Строит sku -> cost через: sku->offer (живой срез) -> модель (таксономия) ->
// нечёткий матч к себесу. Печатает отчёт покрытия и пишет data/sku_cogs.json.
import { readFileSync, writeFileSync } from "node:fs";
import { parseTaxonomy, offerIndex } from "../taxonomy.js";
import { parseCogs, buildCogsIndex, matchCogs } from "../cogs.js";

function main() {
  const cogs = parseCogs(readFileSync("fixtures/cogs.csv", "utf-8"));
  const idx = buildCogsIndex(cogs);
  const tax = parseTaxonomy(readFileSync("fixtures/taxonomy.csv", "utf-8"));
  const oi = offerIndex(tax);
  const skus = JSON.parse(readFileSync("fixtures/skus_live_30d.json", "utf-8"));

  // кэш матча по имени модели
  const modelCost = new Map<string, number | null>();
  const cost = (taxModel: string): number | null => {
    if (modelCost.has(taxModel)) return modelCost.get(taxModel)!;
    const m = matchCogs(taxModel, idx);
    const v = m ? m.cost : null;
    modelCost.set(taxModel, v);
    return v;
  };

  const map: Record<string, number> = {};
  let nSku = 0, nMatched = 0, revTotal = 0, revMatched = 0;
  const unmatched = new Set<string>();
  for (const s of skus.sku_table) {
    nSku++; revTotal += s.rev;
    const t = oi.get(s.offer || "");
    if (!t) { unmatched.add("(нет в таксономии) " + (s.offer || s.name)); continue; }
    const c = cost(t.model);
    if (c != null) {
      map[String(s.sku)] = Math.round(c);
      nMatched++; revMatched += s.rev;
    } else {
      unmatched.add(t.model);
    }
  }

  writeFileSync("data/sku_cogs.json", JSON.stringify(map, null, 0));
  console.log(`Себес: ${cogs.length} валидных строк, ${idx.rows.length} моделей.`);
  console.log(`Связка sku->себес: ${nMatched}/${nSku} SKU (${Math.round((nMatched / nSku) * 100)}%), покрытие оборота ${Math.round((revMatched / revTotal) * 100)}%.`);
  console.log(`Не сматчено моделей: ${unmatched.size}. Примеры: ${[...unmatched].slice(0, 12).join(" | ")}`);
}

main();
