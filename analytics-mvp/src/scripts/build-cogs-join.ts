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

// Лист «ЯМ» из таблицы «Copy of СС GEN - OZON»: себестоимость, заведённая под Яндекс Маркет.
// Колонки листа - модель, артикул, С\С произв.; выгрузка лежит в fixtures/cogs_ym_sku.csv.
// Для Маркета это ПЕРВЫЙ источник: лист OZON не знает 39 артикулов из тех, что реально продавались.
type YmCost = { offer: string; cost: number };
function parseYmCogs(text: string): YmCost[] {
  const out: YmCost[] = [];
  for (const line of text.trim().split("\n").slice(1)) {
    const c = line.split(",");
    const offer = (c[0] || "").trim();
    const cost = Number((c[2] || "").trim());
    if (offer && Number.isFinite(cost) && cost > 0) out.push({ offer, cost });
  }
  return out;
}
// Артикул в своде и в листе пишут по-разному: GGTW-03-180-90 против GGTW-03-18090, GGTP-20-1
// против GGTP-20-1x2. Из-за точного сравнения СС по ним числилась пробелом, хотя она есть.
const normOffer = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function main() {
  const prodRows = parseCogsSku(readFileSync(fp("cogs_prod_sku.csv"), "utf-8"));
  const ymRows = IS_OZON ? [] : parseYmCogs(readFileSync(fp("cogs_ym_sku.csv"), "utf-8"));
  // OZON: ключ - числовой SKU OZON; Маркет: ключ снимка = артикул (shopSku), поэтому берём колонку offer.
  const skuCost = new Map<string, number>(prodRows.filter((r) => IS_OZON || r.offer).map((r) => [IS_OZON ? r.sku : r.offer, Math.round(r.cost)]));
  // Лист ЯМ поверх листа OZON: он заведён под эту площадку и точнее там, где артикулы разошлись.
  for (const r of ymRows) skuCost.set(r.offer, Math.round(r.cost));
  // Ручные связки: код в своде и код в листе - РАЗНЫЕ, но товар один. Автоматика такое связать не
  // может и не должна: подставить чужую цену хуже честного пробела. Сюда попадает только то, что
  // подтвердил владелец данных, и живёт связка ЗДЕСЬ, а не в выгрузке листа, - иначе следующее
  // перечитывание таблицы её сотрёт.
  //   GGT-20-1-3-R-120-190-80 ← GGT-20-2-3-R-120-190-80: одна модель VIOLUR Max 120/190 х 80,
  //   различие в одной позиции кода. Подтверждено Катей 18.09.2026: «один товар».
  const ALIAS: Array<[string, string]> = [["GGT-20-1-3-R-120-190-80", "GGT-20-2-3-R-120-190-80"]];
  for (const [to, from] of ALIAS) {
    const v = skuCost.get(from);
    if (v == null) { console.warn(`::warning::связка СС ${to} <- ${from}: исходного артикула нет в листе, связка не сработала`); continue; }
    if (skuCost.has(to)) continue;   // у самого артикула СС уже есть - связка не нужна
    skuCost.set(to, v);
    console.log(`СС произв.: ${to} взята у ${from} (${v} ₽) - ручная связка, один товар`);
  }
  // Запасной индекс по нормализованному артикулу - только для тех, кто не нашёлся точным ключом.
  const normCost = new Map<string, number>();
  for (const [k, v] of skuCost) { const n = normOffer(k); if (!normCost.has(n)) normCost.set(n, v); }
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
  let nSku = 0, nDirect = 0, nNorm = 0, nFuzzyNew = 0, nFuzzyOld = 0, revTotal = 0, revCov = 0;
  const unmatched = new Set<string>();
  for (const s of skus.sku_table) {
    nSku++; revTotal += s.rev; const sk = String(s.sku);
    if (skuCost.has(sk)) { map[sk] = skuCost.get(sk)!; nDirect++; revCov += s.rev; continue; }
    const nk = normCost.get(normOffer(sk));
    if (nk != null) { map[sk] = nk; nNorm++; revCov += s.rev; continue; }
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
  console.log(`СС произв.: ${prodRows.length} строк листа OZON${ymRows.length ? `, ${ymRows.length} строк листа ЯМ (приоритет)` : ""}, ${prodModelRows.length} моделей для fuzzy.`);
  console.log(`Связка sku->СС: ${nCov}/${nSku} SKU (${Math.round((nCov / nSku) * 100)}%): прямой SKU ${nDirect}, по нормализованному артикулу ${nNorm}, fuzzy(новый лист) ${nFuzzyNew}, fuzzy(старый лист) ${nFuzzyOld}. Покрытие оборота ${Math.round((revCov / revTotal) * 100)}%.`);
  console.log(`Не сматчено: ${unmatched.size}. Примеры: ${[...unmatched].slice(0, 12).join(" | ")}`);
}

main();
