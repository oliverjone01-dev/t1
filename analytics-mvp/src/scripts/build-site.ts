// Собирает страницы сервиса со встроенной историей и клиентским движком.
// Период и сравнение считаются в браузере. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { SkuDaily } from "../types.js";
import { renderTovary, renderOverview, renderFunnel, renderCards, renderMoney, staticPage } from "../site.js";

const ru = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const mln = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + " М" : ru(n));
const kpiC = (lab: string, val: string) => `<div class="card kpi"><div class="lab">${lab}</div><div class="val num">${val}</div></div>`;

// Маркетинг и цена: индекс цены + ДРР канала + доли линий. Снимок 30 дней.
function buildMarketing(): string {
  const skus = JSON.parse(readFileSync("fixtures/skus_live_30d.json", "utf-8"));
  const ads = JSON.parse(readFileSync("fixtures/ads_30d.json", "utf-8"));
  const t = skus.totals;
  let cheaper = 0, even = 0, pricier = 0, noIdx = 0;
  for (const s of skus.sku_table) {
    if (s.pidx == null || s.pidx === 0) noIdx++;
    else if (s.pidx < 1) cheaper++;
    else if (s.pidx > 1) pricier++;
    else even++;
  }
  const tot = cheaper + even + pricier + noIdx || 1;
  const seg = (n: number, c: string) => `<span style="width:${(100 * n) / tot}%;background:${c};display:block;height:100%"></span>`;
  const roas = (ads.totals.adRevenue / ads.totals.spend).toFixed(1);
  const byLine = skus.by_line.slice(0, 8).map((l: any) =>
    `<tr><td>${l.line}</td><td class="r num">${mln(l.rev)}</td><td class="r num">${Math.round((l.rev / t.rev) * 1000) / 10}%</td></tr>`).join("");
  const adsLine = ads.by_line.map((l: any) =>
    `<tr><td>${l.line}</td><td class="r num">${mln(l.sp)}</td><td class="r num ${l.drr > 30 ? "down" : ""}">${l.drr}%</td></tr>`).join("");
  const violations = skus.sku_table.filter((s: any) => /VIOLUR|VALONTI/i.test(s.line) || /VIOLUR|VALONTI/i.test(s.name));
  const violBlock = violations.length
    ? `<div class="card" style="border-color:#FF5A5F;background:#2a1414"><b>Нарушение позиционирования:</b> на маркетплейсе ${violations.length} позиций линии VIOLUR/VALONTI (перегородки/бренд не должны быть на МП).</div>`
    : "";
  return `
  <h2>Срез периода ${skus.dateFrom}..${skus.dateTo}</h2>
  <div class="grid">
    ${kpiC("ДРР канала, %", ads.totals.drr + "%")}
    ${kpiC("Расход рекламы, ₽", mln(ads.totals.spend))}
    ${kpiC("Выручка с рекламы, ₽", mln(ads.totals.adRevenue))}
    ${kpiC("ROAS", roas + "x")}
    ${kpiC("Активных кампаний", ads.totals.active + " / " + ads.totals.campaigns)}
  </div>
  ${violBlock}
  <h2>Позиционирование по цене (SKU против рынка)</h2>
  <div class="card">
    <div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--line)">${seg(cheaper, "#34D399")}${seg(even, "#6AA8FF")}${seg(pricier, "#FF5A5F")}${seg(noIdx, "#3a3a40")}</div>
    <div class="note"><span style="color:#34D399">дешевле рынка: ${cheaper}</span> (можно поднять цену) &nbsp;·&nbsp; вровень: ${even} &nbsp;·&nbsp; <span style="color:#FF5A5F">дороже рынка: ${pricier}</span> (риск проседания) &nbsp;·&nbsp; без индекса: ${noIdx}</div>
  </div>
  <div class="two">
    <div><h2>Доля выручки по линиям</h2><div class="card" style="padding:0"><table><thead><tr><th>Линия</th><th class="r">Оборот</th><th class="r">Доля</th></tr></thead><tbody>${byLine}</tbody></table></div></div>
    <div><h2>ДРР по линиям <span class="pill b-Y">ориентир</span></h2><div class="card" style="padding:0"><table><thead><tr><th>Линия</th><th class="r">Расход</th><th class="r">ДРР</th></tr></thead><tbody>${adsLine}</tbody></table></div>
      <div class="note">ДРР по линиям - ненадёжно (таксономии рекламы и аналитики расходятся, G5). Достоверен только суммарный ДРР канала ${ads.totals.drr}%.</div></div>
  </div>`;
}

// Кампании: расход, ДРР, сливы, топ по расходу. Снимок 30 дней.
function buildCampaigns(): string {
  const ads = JSON.parse(readFileSync("fixtures/ads_30d.json", "utf-8"));
  const t = ads.totals;
  const burn = ads.burners.map((b: any) =>
    `<tr><td>${b.off}</td><td class="sub">${b.line}</td><td class="r num">${ru(b.sp)}</td><td class="r num">${b.o}</td><td class="r num ${b.drr === 0 || b.drr > 40 ? "down" : ""}">${b.drr ? b.drr + "%" : "0 заказов"}</td></tr>`).join("");
  const top = ads.top_spend.map((c: any) =>
    `<tr><td>${c.off}</td><td class="sub">${c.line}</td><td class="r num">${ru(c.sp)}</td><td class="r num">${c.o}</td><td class="r num ${c.drr > 40 ? "down" : c.drr > 0 && c.drr < 20 ? "up" : ""}">${c.drr}%</td><td class="r num">${c.roas}x</td></tr>`).join("");
  const wasted = ads.burners.reduce((s: number, b: any) => s + (b.o === 0 ? b.sp : 0), 0);
  return `
  <h2>Срез периода ${ads.dateFrom}..${ads.dateTo}</h2>
  <div class="grid">
    ${kpiC("ДРР канала, %", t.drr + "%")}
    ${kpiC("Расход, ₽", mln(t.spend))}
    ${kpiC("Заказов с рекламы", ru(t.orders))}
    ${kpiC("CPO, ₽", ru(t.cpo))}
    ${kpiC("Активных", t.active + " / " + t.campaigns)}
  </div>
  <h2>Сливы бюджета · кандидаты на отключение</h2>
  <div class="card" style="padding:0"><table><thead><tr><th>Кампания (offer)</th><th>Линия</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody>${burn}</tbody></table></div>
  <div class="note">сливы: расход от 3000 ₽ при нуле заказов или ДРР от 40%. Потенциал возврата от отключения нулевых: <b>${mln(wasted)} ₽</b> <span class="pill b-Y">[ГИПОТЕЗА]</span> (допущение: спрос не переедет на другие кампании).</div>
  <h2>Топ по расходу</h2>
  <div class="card" style="padding:0"><table><thead><tr><th>Кампания</th><th>Линия</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th><th class="r">ROAS</th></tr></thead><tbody>${top}</tbody></table></div>`;
}

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

  const footMkt = `ДРР канала - <b>[ДАННЫЕ]</b>, надёжен. ДРР по линиям - ориентир (G5). Индекс цены - снимок OZON. Реклама/цены не в дневной истории, поэтому страница - снимок за 30 дней, без интерактивного периода.`;
  writeFileSync("public/marketing.html", staticPage("Маркетинг и цена", "снимок рекламы и цен за 30 дней", buildMarketing(), footMkt));
  writeFileSync("public/campaigns.html", staticPage("Кампании", "снимок рекламы за 30 дней", buildCampaigns(), footMkt));
  console.log(`Готово: obzor · tovary · voronka · cards · money · marketing · campaigns`);
  console.log(`Фактов ${facts.length} · SKU ${Object.keys(skus).length} · ${model.floor}..${model.max}`);
}

main();
