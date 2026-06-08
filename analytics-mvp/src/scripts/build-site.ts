// Собирает страницу "Товары" из дневной истории. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { SkuDaily } from "../types.js";
import { addDays } from "../period.js";
import { safeDiv, delta } from "../util/num.js";
import {
  windowRows, aggBySku, skuViews, abcXyzMatrix, bcgByLine, monthlyOrdersByLine, skuDailySeries,
} from "../marts.js";
import { renderTovary } from "../site.js";

const SNAPSHOT = "data/history.ndjson";

function load(): SkuDaily[] {
  return readFileSync(SNAPSHOT, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as SkuDaily);
}

function totals(rows: SkuDaily[]) {
  const t = { revenue: 0, units: 0, views: 0, returns: 0 };
  const skus = new Set<string>();
  for (const r of rows) {
    t.revenue += r.revenue; t.units += r.units; t.views += r.views; t.returns += r.returns;
    if (r.units > 0) skus.add(r.sku);
  }
  return { ...t, skuCount: skus.size };
}

function kpi(cur: number, cmp: number, goodUp: boolean) {
  return { cur: Math.round(cur * 10) / 10, pct: delta(cur, cmp).pct, goodUp };
}

function main() {
  const rows = load().filter((r) => r.sku !== "__empty__");
  const maxDate = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0]!.date);
  const cur = { from: addDays(maxDate, -29), to: maxDate };
  const cmp = { from: addDays(maxDate, -59), to: addDays(maxDate, -30) };

  const curRows = windowRows(rows, cur.from, cur.to);
  const cmpRows = windowRows(rows, cmp.from, cmp.to);
  const tc = totals(curRows), tp = totals(cmpRows);

  const views = skuViews(rows, cur.from, cur.to);
  const totalRev = views.reduce((s, v) => s + v.revenue, 0) || 1;

  // группировка по линии с вложенными SKU и дневным трендом
  const lineMap = new Map<string, typeof views>();
  for (const v of views) {
    const arr = lineMap.get(v.line) ?? [];
    arr.push(v);
    lineMap.set(v.line, arr);
  }
  const lines = [...lineMap.entries()]
    .map(([line, skus]) => {
      const revenue = skus.reduce((s, v) => s + v.revenue, 0);
      const units = skus.reduce((s, v) => s + v.units, 0);
      return {
        line,
        revenue: Math.round(revenue),
        units,
        revShare: Math.round((revenue / totalRev) * 1000) / 10,
        skus: skus.map((v) => ({
          sku: v.key, name: v.name, abc: v.abc, xyz: v.xyz, cv: v.cv,
          revenue: Math.round(v.revenue), units: v.units, convOrd: v.convOrd, aov: v.aov, revShare: v.revShare,
          series: skuDailySeries(curRows, v.key, cur.from, cur.to).map((d) => d.units),
        })),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const model = {
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    freshness: maxDate,
    windows: { cur, cmp },
    kpis: {
      revenue: kpi(tc.revenue, tp.revenue, true),
      units: kpi(tc.units, tp.units, true),
      cr_order: kpi(Math.round(safeDiv(tc.units, tc.views) * 1000) / 10, Math.round(safeDiv(tp.units, tp.views) * 1000) / 10, true),
      aov: kpi(Math.round(safeDiv(tc.revenue, tc.units)), Math.round(safeDiv(tp.revenue, tp.units)), true),
      returns: kpi(tc.returns, tp.returns, false),
      skuCount: kpi(tc.skuCount, tp.skuCount, true),
    },
    matrix: abcXyzMatrix(views),
    bcg: bcgByLine(curRows, cmpRows),
    heatmap: monthlyOrdersByLine(rows),
    lines,
  };

  mkdirSync("public", { recursive: true });
  writeFileSync("public/tovary.html", renderTovary(model));
  console.log(`Готово: public/tovary.html`);
  console.log(`Окно ${cur.from}..${cur.to} · линий ${lines.length} · SKU ${views.length} · оборот ${Math.round(tc.revenue).toLocaleString("ru-RU")} ₽ (${(model.kpis.revenue.pct * 100).toFixed(1)}%)`);
}

main();
