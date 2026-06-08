// S5: собирает самодостаточный дашборд из двух окон.
// Сейчас источник - фикстуры (живой срез из n8n). После S3 источником станет SQLite.
// Запуск: npm run report

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  compareTotals, compareByLine, cardsToFix, priceDistribution, brandViolations,
} from "../report.js";
import type { SkusPayload } from "../report.js";
import { renderDashboard } from "../dashboard.js";

function load(path: string): SkusPayload {
  return JSON.parse(readFileSync(path, "utf-8")) as SkusPayload;
}

function main() {
  const A = load("fixtures/skus_live_30d.json"); // текущее окно
  const B = load("fixtures/skus_live_prev30d.json"); // окно сравнения

  const model = {
    generatedAt: new Date().toISOString(),
    freshness: A.dateTo,
    windows: {
      cur: { from: A.dateFrom, to: A.dateTo },
      cmp: { from: B.dateFrom, to: B.dateTo },
    },
    totals: compareTotals(A, B),
    byLine: compareByLine(A, B),
    cardsToFix: cardsToFix(A),
    price: priceDistribution(A),
    violations: brandViolations(A).map((s) => ({ name: s.name, line: s.line, rev: s.rev })),
    adByLineReliable: false, // G5: ДРР по линиям ненадёжен
    source: "n8n live fixture",
  };

  mkdirSync("public", { recursive: true });
  writeFileSync("public/data.json", JSON.stringify(model, null, 2));
  writeFileSync("public/dashboard.html", renderDashboard(model));
  console.log("Готово: public/dashboard.html и public/data.json");
  console.log(`Окно: ${model.windows.cur.from}..${model.windows.cur.to} против ${model.windows.cmp.from}..${model.windows.cmp.to}`);
  console.log(`Оборот: ${fmt(model.totals.revenue.cur)} (${pct(model.totals.revenue.pct)})`);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}
function pct(p: number): string {
  return (p >= 0 ? "+" : "") + Math.round(p * 1000) / 10 + "%";
}

main();
