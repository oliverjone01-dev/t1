// Собирает страницы сервиса со встроенной историей и клиентским движком.
// Период и сравнение считаются в браузере. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import type { SkuDaily } from "../types.js";
import { renderTovary, renderOverview, renderFunnel, renderCards, renderMoney, renderAssistant, staticPage } from "../site.js";

const ru = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const mln = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + " М" : ru(n));
const kpiC = (lab: string, val: string) => `<div class="card kpi"><div class="lab">${lab}</div><div class="val num">${val}</div></div>`;

// VIOLUR - это столы GENGLASS, открыто продаются на OZON (решение Ивана), не маскируем.
// Маскируется только VALONTI (перегородки, не для МП). Маска применяется к финальному
// HTML при записи - покрывает и DATA, и видимый текст. fixtures/data не трогаются.
// Санитайзер финального HTML: маскирует скрытый бренд и чинит ошибочную подпись.
// Один проход покрывает и видимый текст, и сериализованный DATA, и статичные страницы.
const HTML_FIX: Array<[RegExp, string]> = [
  [/VALONTI/gi, "VL-Group"],                       // скрытая линия перегородок - не для МП
  [/VIOLUR \(перегородки\)/gi, "VIOLUR (столы)"],   // VIOLUR это столы, эвристика ошибалась
];
function sanitize(html: string): string {
  let out = html;
  for (const [re, alias] of HTML_FIX) out = out.replace(re, alias);
  return out;
}
const writePage = (path: string, html: string) => writeFileSync(path, sanitize(html));

const fixLine = (l: string) => (l === "VIOLUR (перегородки)" ? "VIOLUR (столы)" : l);

// Плашка «фиксированный снимок» для статичных страниц (TZ v2 1.9)
const snapNote = (from: string, to: string) =>
  `<div class="card" style="border-color:#3a3a40"><b>Фиксированный снимок 30 дней</b> (${from}..${to}) - период на этой странице не переключается. Интерактивный период - на страницах Обзор / Товары / Воронка / Карточки / Деньги.</div>`;

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
  // нарушение позиционирования - только VALONTI (перегородки, не для МП). VIOLUR - легальные столы.
  const violations = skus.sku_table.filter((s: any) => /VALONTI/i.test(s.line) || /VALONTI/i.test(s.name));
  const violBlock = violations.length
    ? `<div class="card" style="border-color:#FF5A5F;background:#2a1414"><b>Нарушение позиционирования:</b> на маркетплейсе ${violations.length} позиций скрытой линии (перегородки не должны продаваться на МП). Список - во внутреннем отчёте.</div>`
    : "";
  return `
  ${snapNote(skus.dateFrom, skus.dateTo)}
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
    <div><h2>Доля выручки по линиям</h2><div class="card" style="padding:0"><div class="tscroll"><table><thead><tr><th>Линия</th><th class="r">Оборот</th><th class="r">Доля</th></tr></thead><tbody>${byLine}</tbody></table></div></div></div>
    <div><h2>ДРР по линиям <span class="pill b-Y">ориентир</span></h2><div class="card" style="padding:0"><div class="tscroll"><table><thead><tr><th>Линия</th><th class="r">Расход</th><th class="r">ДРР</th></tr></thead><tbody>${adsLine}</tbody></table></div></div>
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
  // Высвобождение бюджета: только ТОВАРНЫЕ нулевые кампании. Кампания-агрегатор
  // («Оплата за заказ - все товары», line=прочее) - не товарный слив, исключена (P9/МАРКО).
  const isAggregate = (b: any) => b.line === "прочее";
  const freed = ads.burners.reduce((s: number, b: any) => s + (b.o === 0 && !isAggregate(b) ? b.sp : 0), 0);
  const aggZero = ads.burners.reduce((s: number, b: any) => s + (b.o === 0 && isAggregate(b) ? b.sp : 0), 0);
  return `
  ${snapNote(ads.dateFrom, ads.dateTo)}
  <h2>Срез периода ${ads.dateFrom}..${ads.dateTo}</h2>
  <div class="grid">
    ${kpiC("ДРР канала, %", t.drr + "%")}
    ${kpiC("Расход, ₽", mln(t.spend))}
    ${kpiC("Заказов с рекламы", ru(t.orders))}
    ${kpiC("CPO, ₽", ru(t.cpo))}
    ${kpiC("Активных", t.active + " / " + t.campaigns)}
  </div>
  <h2>Сливы бюджета · кандидаты на отключение</h2>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr><th>Кампания (offer)</th><th>Линия</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody>${burn}</tbody></table></div></div>
  <div class="note">сливы: расход от 3000 ₽ при нуле заказов или ДРР от 40%. Высвобождение бюджета от отключения нулевых <b>товарных</b> кампаний: <b>${mln(freed)} ₽/мес</b> <span class="pill b-Y">[ГИПОТЕЗА]</span>. Это не «возврат денег», а расход, который прекратится. Допущения: спрос не переедет в органику этих SKU; атрибуция OZON last-click не видит ассистирующих касаний; кампании не включат обратно. Кампания-агрегатор «оплата за заказ» (${mln(aggZero)} ₽) в слив не включена - она покрывает весь каталог. Пилот: отключение двух нулевых, замер 14 дней, чекпоинт 23.06.</div>
  <h2>Топ по расходу</h2>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr><th>Кампания</th><th>Линия</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th><th class="r">ROAS</th></tr></thead><tbody>${top}</tbody></table></div></div>`;
}

// Сверенный P&L по закрытым месяцам - из подписанных Актов OZON (DOC_02 §2.2, §7).
// Источник - data/closed_pnl.json (TZ v2 1.5): данные, не код. Fallback на
// последний известный снимок, чтобы сборка не падала без файла.
const CLOSED_FALLBACK = {
  updated: "2026-04-30",
  months: [
    { month: "2026-02", label: "Февраль 2026", realization: 1_200_000, profit: -370_000 },
    { month: "2026-03", label: "Март 2026", realization: 8_970_000, profit: 1_260_000 },
    { month: "2026-04", label: "Апрель 2026", realization: 14_660_000, profit: 3_840_000 },
  ],
};
function readClosed(): { updated: string; months: typeof CLOSED_FALLBACK.months } {
  try {
    const c = JSON.parse(readFileSync("data/closed_pnl.json", "utf-8"));
    if (Array.isArray(c.months) && c.months.length) return c;
    return CLOSED_FALLBACK;
  } catch { return CLOSED_FALLBACK; }
}

const SNAPSHOT = "data/history.ndjson";

function main() {
  const rows = readFileSync(SNAPSHOT, "utf-8")
    .split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as SkuDaily)
    .filter((r) => r.sku !== "__empty__");

  const skus: Record<string, [string, string]> = {};
  for (const r of rows) if (!skus[r.sku]) skus[r.sku] = [r.name, fixLine(r.line)];

  // таксономия: sku -> [category, sub, line, model] (где есть джойн)
  let tax: Record<string, [string, string, string, string]> = {};
  try {
    const t = JSON.parse(readFileSync("data/sku_taxonomy.json", "utf-8")) as Record<string, { category: string; sub: string; line: string; model: string }>;
    for (const [sku, v] of Object.entries(t)) tax[sku] = [v.category, v.sub, v.line, v.model];
  } catch { tax = {}; }

  // факт: [date, sku, rev, units, views, cart, deliv, ret, canc]
  const facts = rows.map((r) => [
    r.date, r.sku, Math.round(r.revenue), r.units, r.views, r.to_cart, r.delivered, r.returns, r.cancellations,
  ]);

  // себестоимость: sku -> С\С (где сматчено)
  let cogs: Record<string, number> = {};
  try { cogs = JSON.parse(readFileSync("data/sku_cogs.json", "utf-8")); } catch { cogs = {}; }

  // операционный P&L по транзакциям (снимок 30 дней, реальные сборы OZON)
  let opnl: unknown = {};
  try { opnl = JSON.parse(readFileSync("fixtures/pnl_30d.json", "utf-8")); } catch { opnl = {}; }

  // per-SKU транзакции (снимок 30 дней): sku -> {accruals, commission, amount}
  let txsku: Record<string, { accruals: number; commission: number; amount: number }> = {};
  try { txsku = JSON.parse(readFileSync("fixtures/pnl_sku_30d.json", "utf-8")).bySku || {}; } catch { txsku = {}; }

  // реклама (снимок 30 дней) - для ассистента
  let ads: unknown = {};
  try { ads = JSON.parse(readFileSync("fixtures/ads_30d.json", "utf-8")); } catch { ads = {}; }

  // снимок живых SKU: артикулы для ссылок в кабинет + OOS-сигнал (TZ v2 1.6/1.7)
  const offers: Record<string, string> = {};
  let oos: Array<{ sku: string; offer: string; name: string; line: string; units: number }> = [];
  try {
    const live = JSON.parse(readFileSync("fixtures/skus_live_30d.json", "utf-8"));
    for (const s of live.sku_table || []) {
      if (s.offer && String(s.offer).trim()) offers[String(s.sku)] = String(s.offer).trim();
    }
    oos = (live.sku_table || [])
      .filter((s: any) => (s.oos === 1 || s.stock === 0) && s.units > 0)
      .map((s: any) => ({ sku: String(s.sku), offer: String(s.offer || ""), name: s.name, line: s.line, units: s.units }));
  } catch { oos = []; }

  const dates = rows.map((r) => r.date).sort();
  const maxDate = dates[dates.length - 1]!;

  // свежесть хвоста: последний день против медианы предыдущих 28 (TZ v2 1.10).
  // jsdom/смоук это не видят - расчёт на сборке, UI показывает плашку.
  const byDay = new Map<string, number>();
  for (const f of facts) byDay.set(f[0] as string, (byDay.get(f[0] as string) || 0) + (f[2] as number));
  const allDays = [...byDay.keys()].sort();
  const prevDays = allDays.slice(-29, -1).map((d) => byDay.get(d) || 0).sort((a, b) => a - b);
  const median = prevDays.length ? prevDays[Math.floor(prevDays.length / 2)]! : 0;
  const lastRev = byDay.get(maxDate) || 0;
  const fresh = { lastDay: maxDate, partial: median > 0 && lastRev < median * 0.4 };

  // закрытые Акты: данные + дата + предупреждение об устаревании (45 дней от хвоста истории)
  const closedData = readClosed();
  const staleDays = Math.round((Date.parse(maxDate) - Date.parse(closedData.updated)) / 86_400_000);
  const closedMeta = {
    updated: closedData.updated,
    lastLabel: closedData.months[closedData.months.length - 1]!.label,
    staleDays,
    stale: staleDays > 45,
  };

  const model = {
    max: maxDate, floor: dates[0]!, skus, facts, closed: closedData.months,
    closedMeta, tax, cogs, opnl, txsku, ads, offers, oos, fresh,
  };

  mkdirSync("public", { recursive: true });
  // чистим страницы-сироты прошлых сборок (FENIX H1)
  for (const orphan of ["dashboard.html", "styleguide.html", "data.json"]) {
    try { rmSync(`public/${orphan}`); } catch { /* нет файла - ок */ }
  }
  // index = редирект на канонический obzor.html (TZ v2 1.12): один тяжёлый файл вместо дубля
  writePage("public/index.html", `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=obzor.html"><title>GENGLASS · аналитика OZON</title>
<style>body{margin:0;background:#0A0A0B;color:#8A8A90;font:14px/1.5 "SF Pro Display",-apple-system,sans-serif;display:grid;place-items:center;height:100vh}a{color:#FF4438}</style>
</head><body><div>Открываю обзор... <a href="obzor.html">перейти вручную</a></div></body></html>`);
  writePage("public/tovary.html", renderTovary(model));
  writePage("public/obzor.html", renderOverview(model));
  writePage("public/voronka.html", renderFunnel(model));
  writePage("public/cards.html", renderCards(model));
  writePage("public/money.html", renderMoney(model));
  writePage("public/assistant.html", renderAssistant(model));

  const footMkt = `ДРР канала - <b>[ДАННЫЕ]</b>, надёжен. ДРР по линиям - ориентир (G5). Индекс цены - снимок OZON. Реклама/цены не в дневной истории, поэтому страница - снимок за 30 дней, без интерактивного периода.`;
  writePage("public/marketing.html", staticPage("Маркетинг и цена", "снимок рекламы и цен за 30 дней", buildMarketing(), footMkt));
  writePage("public/campaigns.html", staticPage("Кампании", "снимок рекламы за 30 дней", buildCampaigns(), footMkt));
  console.log(`Готово: obzor · tovary · voronka · cards · money · marketing · campaigns (+index-redirect)`);
  console.log(`Фактов ${facts.length} · SKU ${Object.keys(skus).length} · ${model.floor}..${model.max} · OOS ${oos.length} · закрытые Акты до ${closedMeta.lastLabel}${closedMeta.stale ? " (УСТАРЕЛИ)" : ""}`);
}

main();
