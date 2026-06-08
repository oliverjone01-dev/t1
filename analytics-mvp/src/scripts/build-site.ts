// Собирает страницы сервиса со встроенной историей и клиентским движком.
// Период и сравнение считаются в браузере. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { SkuDaily } from "../types.js";
import { renderTovary, renderOverview, renderFunnel } from "../site.js";

const SNAPSHOT = "data/history.ndjson";

function main() {
  const rows = readFileSync(SNAPSHOT, "utf-8")
    .split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as SkuDaily)
    .filter((r) => r.sku !== "__empty__");

  const skus: Record<string, [string, string]> = {};
  for (const r of rows) if (!skus[r.sku]) skus[r.sku] = [r.name, r.line];

  // факт: [date, sku, rev, units, views, cart, deliv, ret, canc]
  const facts = rows.map((r) => [
    r.date, r.sku, Math.round(r.revenue), r.units, r.views, r.to_cart, r.delivered, r.returns, r.cancellations,
  ]);

  const dates = rows.map((r) => r.date).sort();
  const model = { max: dates[dates.length - 1]!, floor: dates[0]!, skus, facts };

  mkdirSync("public", { recursive: true });
  writeFileSync("public/tovary.html", renderTovary(model));
  writeFileSync("public/obzor.html", renderOverview(model));
  writeFileSync("public/voronka.html", renderFunnel(model));
  console.log(`Готово: obzor.html · tovary.html · voronka.html`);
  console.log(`Фактов ${facts.length} · SKU ${Object.keys(skus).length} · ${model.floor}..${model.max}`);
}

main();
