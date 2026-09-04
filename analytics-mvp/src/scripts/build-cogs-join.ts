// Строит sku -> производственная СС (₽/шт) -> data/sku_cogs.json.
// Приоритет источников:
//   1) прямой ключ по SKU из fixtures/cogs_prod_sku.csv (лист «Copy of СС GEN - OZON», С\С произв.);
//   2) нечёткий матч модели таксономии к моделям того же листа (производственная СС);
//   3) последний фолбэк - старый лист fixtures/cogs.csv (С\С общая), чтобы не терять покрытие.
// Печатает отчёт покрытия. sku_cogs.json потребляют все расчёты маржи в build-katya.
import { readFileSync, writeFileSync } from "node:fs";
import { dp, fp, IS_OZON } from "../paths.js";
import { parseTaxonomy, offerIndex } from "../taxonomy.js";
import { parseCogs, parseCogsSku, buildCogsIndex, matchCogs, type CogsRow } from "../cogs.js";

function main() {
  const prodRows = parseCogsSku(readFileSync(fp("cogs_prod_sku.csv"), "utf-8"));
  // OZON: ключ - числовой SKU OZON; Маркет: ключ снимка = артикул (shopSku), поэтому берём колонку offer.
  const skuCost = new Map<string, number>(prodRows.filter((r) => IS_OZON || r.offer).map((r) => [IS_OZON ? r.sku : r.offer, Math.round(r.cost)]));
  // fuzzy-индекс из моделей нового листа (производственная СС), дедуп по имени модели
  const prodModelRows: CogsRow[] = [];
  const seen = new Set<string>();
  for (const r of prodRows) { if (r.model && !seen.has(r.model)) { seen.add(r.model); prodModelRows.push({ model: r.model, cost: r.cost }); } }
  const prodIdx = buildCogsIndex(prodModelRows);
  // старый лист - последний фолбэк
  const oldIdx = buildCogsIndex(parseCogs(readFileSync(fp("cogs.csv"), "utf-8")));
  const tax = parseTaxonomy(readFileSync(fp("taxonomy.csv"), "utf-8"));
  const oi = offerIndex(tax);
  const skus = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));

  const map: Record<string, number> = {};
  let nSku = 0, nDirect = 0, nFuzzyNew = 0, nFuzzyOld = 0, revTotal = 0, revCov = 0;
  const unmatched = new Set<string>();
  for (const s of skus.sku_table) {
    nSku++; revTotal += s.rev; const sk = String(s.sku);
    if (skuCost.has(sk)) { map[sk] = skuCost.get(sk)!; nDirect++; revCov += s.rev; continue; }
    const t = oi.get(s.offer || "");
    const model = t ? t.model : "";
    let m = model ? matchCogs(model, prodIdx) : null;
    if (m) { map[sk] = Math.round(m.cost); nFuzzyNew++; revCov += s.rev; continue; }
    m = model ? matchCogs(model, oldIdx) : null;
    if (m) { map[sk] = Math.round(m.cost); nFuzzyOld++; revCov += s.rev; continue; }
    unmatched.add(model || "(нет в таксономии) " + (s.offer || s.name));
  }

  // ВАЖНО: раньше СС писалась только для SKU из живого снимка 30 дн. Но аналитика/реализация
  // по SKU за период включает и артикулы вне снимка (продавались раньше, малоактивны и т.п.) -
  // по ним СС терялась, хотя в листе она есть. Дозаписываем СС для ВСЕХ артикулов листа с прямым
  // ключом по SKU, чтобы любой реализованный SKU получил свою производственную СС.
  let nExtra = 0;
  for (const [sku, cost] of skuCost) { if (!(sku in map)) { map[sku] = cost; nExtra++; } }

  writeFileSync(dp("sku_cogs.json"), JSON.stringify(map, null, 0));
  const nCov = nDirect + nFuzzyNew + nFuzzyOld;
  console.log(`Плюс ${nExtra} SKU из листа СС вне живого снимка (прямой ключ) - чтобы не терять СС по неактивным артикулам.`);
  console.log(`СС произв.: ${prodRows.length} строк (ключ по SKU), ${prodModelRows.length} моделей для fuzzy.`);
  console.log(`Связка sku->СС: ${nCov}/${nSku} SKU (${Math.round((nCov / nSku) * 100)}%): прямой SKU ${nDirect}, fuzzy(новый лист) ${nFuzzyNew}, fuzzy(старый лист) ${nFuzzyOld}. Покрытие оборота ${Math.round((revCov / revTotal) * 100)}%.`);
  console.log(`Не сматчено: ${unmatched.size}. Примеры: ${[...unmatched].slice(0, 12).join(" | ")}`);
}

main();
