// Собирает страницы сервиса со встроенной историей и клиентским движком.
// Период и сравнение считаются в браузере. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { SkuDaily } from "../types.js";
import { renderTovary, renderOverview, renderFunnel, renderCards, renderMoney } from "../site.js";

// Сверенный P&L по закрытым месяцам - из подписанных Актов OZON (DOC_02 §2.2, §7).
const CLOSED = [
  { month: "2026-02", label: "Февраль 2026", realization: 1_200_000, profit: -370_000 },
  { month: "2026-03", label: "Март 2026", realization: 8_970_000, profit: 1_260_000 },
  { month: "2026-04", label: "Апрель 2026", realization: 14_660_000, profit: 3_840_000 },
];

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
  const model = { max: dates[dates.length - 1]!, floor: dates[0]!, skus, facts, closed: CLOSED };

  mkdirSync("public", { recursive: true });
  writeFileSync("public/tovary.html", renderTovary(model));
  writeFileSync("public/obzor.html", renderOverview(model));
  writeFileSync("public/voronka.html", renderFunnel(model));
  writeFileSync("public/cards.html", renderCards(model));
  writeFileSync("public/money.html", renderMoney(model));
  console.log(`Готово: obzor · tovary · voronka · cards · money`);
  console.log(`Фактов ${facts.length} · SKU ${Object.keys(skus).length} · ${model.floor}..${model.max}`);
}

main();
