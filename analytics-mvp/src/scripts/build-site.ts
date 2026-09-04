// Собирает страницы сервиса со встроенной историей и клиентским движком.
// Период и сравнение считаются в браузере. Запуск: npm run build:site
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dp, op, OUT_DIR, IS_OZON, platformize } from "../paths.js";
import type { SkuDaily } from "../types.js";
import { renderTovary, renderOverview, renderFunnel, renderCards, renderMoney, renderAssistant, staticPage } from "../site.js";

const ru = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const mln = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + " М" : ru(n));
const kpiC = (lab: string, val: string) => `<div class="card kpi"><div class="lab">${lab}</div><div class="val num">${val}</div></div>`;

// VIOLUR - это столы GENGLASS, открыто продаются на OZON (решение Ивана), не маскируем.
// Маскируется только VALONTI (перегородки, не для МП). Маска применяется к финальному
// HTML при записи - покрывает и DATA, и видимый текст. Источники в data/ не трогаются.
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
const writePage = (path: string, html: string) => writeFileSync(path, platformize(sanitize(html)));

const fixLine = (l: string) => (l === "VIOLUR (перегородки)" ? "VIOLUR (столы)" : l);

// Плашка «фиксированный снимок» для статичных страниц (TZ v2 1.9)
const snapNote = (from: string, to: string) =>
  `<div class="card" style="border-color:#3a3a40"><b>Фиксированный снимок 30 дней</b> (${from}..${to}) - период на этой странице не переключается. Интерактивный период - на страницах Обзор / Товары / Воронка / Карточки / Деньги.</div>`;

// Маркетинг и цена: индекс цены + ДРР канала + доли линий. Снимок 30 дней.
function buildMarketing(): string {
  const skus = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));
  const ads = JSON.parse(readFileSync(dp("ads_30d.json"), "utf-8"));
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
  const roas = ads.totals.spend ? (ads.totals.adRevenue / ads.totals.spend).toFixed(1) : "0.0"; // без расхода (Маркет: реклама не подключена) - не NaN
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
  const ads = JSON.parse(readFileSync(dp("ads_30d.json"), "utf-8"));
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

// Конкуренты: лист дашборда поверх снимков пилота (data/competitors/competitors_YYYY-MM-DD.json).
// Все поля - публичные с карточки OZON (цена/база/рейтинг/отзывы/наличие/остаток), это [ДАННЫЕ].
// Заказы/выручку конкурента OZON не отдаёт - на странице их НЕТ (решение Ивана).
// Лист переживает «пустой прогон»: если снимков нет или анти-бот всё срезал - показываем
// честный страж-баннер, а не пустую/выдуманную таблицу.
const COMP_DIR = dp("competitors");
const COMP_FILL_MIN = 0.6; // порог заполненности: ниже - считаем прогон подозрительным (анти-бот)

function listCompetitorSnaps(): string[] {
  try {
    return readdirSync(COMP_DIR)
      .filter((f) => /^competitors_\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
  } catch { return []; }
}

const compDate = (f: string) => f.slice("competitors_".length, "competitors_".length + 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// Пустое состояние: пилот ещё не дал живых данных. Объясняем, не выдумываем.
function competitorsEmpty(reason: string): string {
  return `
  <div class="card" style="border-color:#3a3a40"><b>Лист «Конкуренты»</b> - снимки публичных карточек OZON (цена / база / рейтинг / отзывы / наличие). Заказы и выручку конкурента OZON не отдаёт, поэтому их здесь нет - только факт с карточки.</div>
  <div class="card" style="border-color:#F2B544;background:#2a2414">
    <b style="color:#F2B544">Данных пока нет.</b> ${reason}
    <div class="note" style="margin-top:8px">Лист наполнится, как только пилот отработает там, где открыт <code>ozon.ru</code> (локально с домашнего IP или из Actions). Запуск: <code>npx tsx src/scripts/competitors/pilot.ts --out data/competitors</code>, затем <code>npm run build:site</code>. Из дата-центра (в т.ч. GitHub Actions) OZON часто режет сбор анти-ботом - если соберётся 0 карточек, нужен резидентный прокси или платный API.</div>
  </div>
  <div class="card">
    <b>Что покажет лист, когда данные появятся</b>
    <div class="note" style="margin-top:8px">по каждому конкуренту (из <code>input.json</code>, ${(() => { try { return JSON.parse(readFileSync("src/scripts/competitors/input.json", "utf-8")).items.length; } catch { return "?"; } })()} позиций): текущая цена и база, рейтинг, число отзывов, наличие и остаток - в паре с нашим товаром GG. При ежедневном прогоне рядом с ценой встанет дельта к прошлому снимку (история цен конкурента во времени). Сверху - страж заполненности: если живых карточек меньше ${Math.round(COMP_FILL_MIN * 100)}%, лист краснеет «возможен анти-бот», а не делает вид, что цены просто не изменились.</div>
  </div>`;
}

function buildCompetitors(refDate: string): string {
  const files = listCompetitorSnaps();
  if (!files.length) return competitorsEmpty("Пилот ещё ни разу не сохранил снимок в <code>data/competitors/</code>.");

  const latestFile = files[files.length - 1]!;
  const snap = JSON.parse(readFileSync(`${COMP_DIR}/${latestFile}`, "utf-8"));
  const rows: any[] = Array.isArray(snap.rows) ? snap.rows : [];
  const snapDate: string = snap.date || compDate(latestFile);
  const total = rows.length || Number(snap.total) || 0;
  const ok = Number(snap.ok) || rows.filter((r) => r.ok).length;
  const blocked = Number(snap.blocked) || rows.filter((r) => r.blocked).length;
  const fill = total ? ok / total : 0;
  const fillPct = Math.round(fill * 100);

  if (ok === 0) {
    return competitorsEmpty(`Последний прогон (${snapDate}) собрал <b>0 из ${total}</b> карточек - похоже, OZON срезал сбор анти-ботом по IP дата-центра.`);
  }

  // дельта цены к предыдущему снимку (история цен) - если он есть
  let prevDate = "";
  const prevPrice = new Map<string, number>();
  if (files.length > 1) {
    try {
      const prevFile = files[files.length - 2]!;
      const prev = JSON.parse(readFileSync(`${COMP_DIR}/${prevFile}`, "utf-8"));
      prevDate = prev.date || compDate(prevFile);
      for (const r of (prev.rows || [])) if (r.price != null) prevPrice.set(String(r.sku), r.price);
    } catch { /* нет предыдущего - дельты не будет */ }
  }

  const age = daysBetween(snapDate, refDate);
  const ageNote = age <= 1 ? "свежий" : `снимку ${age} дн.`;
  const guard = fill < COMP_FILL_MIN;
  const guardBar = `
  <div class="card" style="border-color:${guard ? "#FF5A5F;background:#2a1414" : "#34D399"}">
    <b style="color:${guard ? "#FF5A5F" : "#34D399"}">${guard ? "Данные неполные" : "Данные собраны"}:</b>
    живых карточек <b>${ok} из ${total}</b> (${fillPct}%)${blocked ? `, заблокировано ${blocked}` : ""}.
    ${guard ? `Это ниже порога ${Math.round(COMP_FILL_MIN * 100)}% - часть цен могла не загрузиться (анти-бот OZON). Решения по неполному срезу - с осторожностью.` : "Срез репрезентативен."}
    <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;border:1px solid var(--line);margin-top:8px">
      <span style="width:${fillPct}%;background:${guard ? "#FF5A5F" : "#34D399"};display:block;height:100%"></span>
      <span style="width:${100 - fillPct}%;background:#3a3a40;display:block;height:100%"></span>
    </div>
  </div>`;

  const qPill = (q: string) => {
    const c = /горяч/i.test(q) ? "Z" : /тёпл|тепл/i.test(q) ? "Y" : "C";
    return q ? `<span class="pill b-${c}">${q}</span>` : "";
  };
  const na = '<span class="na">н/д</span>';
  const rub = (v: any) => (v == null ? na : ru(v) + " ₽");
  const priceCell = (r: any) => {
    if (r.price == null) return na;
    const pp = prevPrice.get(String(r.sku));
    let delta = "";
    if (pp != null && pp !== r.price) {
      // конкурент поднял цену = мы относительно дешевле = хорошо для GG (зелёный);
      // срезал цену = подвинул нас = плохо (красный). Цвет = выгода нам, стрелка = движение цены.
      const up = r.price > pp;
      delta = ` <span class="${up ? "up" : "down"}" title="к ${prevDate}: было ${ru(pp)} ₽">${up ? "▲" : "▼"} ${ru(Math.abs(r.price - pp))}</span>`;
    }
    return `${ru(r.price)} ₽${delta}`;
  };
  const avail = (r: any) => (r.available == null ? na : r.available ? '<span class="up">в наличии</span>' : '<span class="down">нет</span>');

  // сортировка: сначала собранные карточки, внутри - «горячие» конкуренты выше
  const sorted = [...rows].sort((a, b) => Number(b.ok) - Number(a.ok) || (/горяч/i.test(b.qualification || "") ? 1 : 0) - (/горяч/i.test(a.qualification || "") ? 1 : 0));
  const body = sorted.map((r) => {
    const cName = String(r.competitor_name || r.title || r.sku).slice(0, 64);
    const fail = !r.ok ? ` <span class="pill b-Z" title="${(r.error || "не собрано").replace(/"/g, "")}">не собрано</span>` : "";
    return `<tr>
      <td><a class="lnk" target="_blank" rel="noopener" href="https://www.ozon.ru/product/${r.sku}">${cName}</a>${fail}<div class="sub">${r.seller || ""}</div></td>
      <td>${r.gg_product || ""}</td>
      <td>${qPill(r.qualification || "")}</td>
      <td class="r num">${priceCell(r)}</td>
      <td class="r num">${rub(r.priceBase)}</td>
      <td class="r num">${r.rating == null ? na : r.rating}</td>
      <td class="r num">${r.reviews == null ? na : ru(r.reviews)}</td>
      <td class="r num">${r.stock == null ? na : ru(r.stock)}</td>
      <td class="r">${avail(r)}</td>
    </tr>`;
  }).join("");

  const deltaNote = prevDate
    ? `Дельта цены - к снимку ${prevDate}: <span class="up">▲ зелёный</span> = конкурент поднял цену (мы относительно дешевле), <span class="down">▼ красный</span> = срезал (подвинул нас). Чем чаще прогон, тем полнее история цен конкурентов.`
    : `Дельта цены появится со второго снимка (нужен повторный прогон пилота).`;

  return `
  <div class="card" style="border-color:#3a3a40"><b>Снимок публичных карточек OZON · ${snapDate}</b> <span class="pill b-A">[ДАННЫЕ]</span> <span class="sub">${ageNote}</span>. Цена / база / рейтинг / отзывы / наличие - факт с карточки. Заказы и выручку конкурента OZON не отдаёт - их здесь нет (решение Ивана).</div>
  ${guardBar}
  <h2>Конкуренты GG · ${ok}/${total} карточек</h2>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr>
    <th>Конкурент (продавец)</th><th>Наш товар GG</th><th>Кв.</th>
    <th class="r">Цена ₽</th><th class="r">База ₽</th><th class="r">Рейтинг</th><th class="r">Отзывы</th><th class="r">Остаток</th><th class="r">Наличие</th>
  </tr></thead><tbody>${body}</tbody></table></div></div>
  <div class="note">&#8599; - публичная карточка OZON. «Кв.» - квалификация конкурента из <code>input.json</code> (горячий / тёплый). ${deltaNote} Остаток OZON показывает редко, поэтому часто «н/д». ${blocked ? `Заблокировано анти-ботом: ${blocked}.` : ""}</div>`;
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
// Для не-OZON платформы (Маркет) OZON-фолбэк не годится: без файла честно «нет данных».
const CLOSED_NONE: { updated: string; months: typeof CLOSED_FALLBACK.months } = { updated: "1970-01-01", months: [] };
function readClosed(): { updated: string; months: typeof CLOSED_FALLBACK.months } {
  try {
    const c = JSON.parse(readFileSync(dp("closed_pnl.json"), "utf-8"));
    if (Array.isArray(c.months) && c.months.length) return c;
    return IS_OZON ? CLOSED_FALLBACK : CLOSED_NONE;
  } catch { return IS_OZON ? CLOSED_FALLBACK : CLOSED_NONE; }
}

const SNAPSHOT = dp("history.ndjson");

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
    const t = JSON.parse(readFileSync(dp("sku_taxonomy.json"), "utf-8")) as Record<string, { category: string; sub: string; line: string; model: string }>;
    for (const [sku, v] of Object.entries(t)) tax[sku] = [v.category, v.sub, v.line, v.model];
  } catch { tax = {}; }

  // факт: [date, sku, rev, units, views, cart, deliv, ret, canc]
  const facts = rows.map((r) => [
    r.date, r.sku, Math.round(r.revenue), r.units, r.views, r.to_cart, r.delivered, r.returns, r.cancellations,
  ]);

  // себестоимость: sku -> С\С (где сматчено)
  let cogs: Record<string, number> = {};
  try { cogs = JSON.parse(readFileSync(dp("sku_cogs.json"), "utf-8")); } catch { cogs = {}; }

  // операционный P&L по транзакциям (снимок 30 дней, реальные сборы OZON)
  let opnl: unknown = {};
  try { opnl = JSON.parse(readFileSync(dp("pnl_30d.json"), "utf-8")); } catch { opnl = {}; }

  // per-SKU транзакции (снимок 30 дней): sku -> {accruals, commission, amount}
  let txsku: Record<string, { accruals: number; commission: number; amount: number }> = {};
  try { txsku = JSON.parse(readFileSync(dp("pnl_sku_30d.json"), "utf-8")).bySku || {}; } catch { txsku = {}; }

  // реклама (снимок 30 дней) - для ассистента
  let ads: unknown = {};
  try { ads = JSON.parse(readFileSync(dp("ads_30d.json"), "utf-8")); } catch { ads = {}; }

  // снимок живых SKU: артикулы для ссылок в кабинет + OOS-сигнал (TZ v2 1.6/1.7)
  const offers: Record<string, string> = {};
  let oos: Array<{ sku: string; offer: string; name: string; line: string; units: number }> = [];
  try {
    const live = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));
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
    lastLabel: closedData.months.length ? closedData.months[closedData.months.length - 1]!.label : "нет данных (Акты площадки не подключены)",
    staleDays,
    stale: staleDays > 45,
  };

  const model = {
    max: maxDate, floor: dates[0]!, skus, facts, closed: closedData.months,
    closedMeta, tax, cogs, opnl, txsku, ads, offers, oos, fresh,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  // чистим страницы-сироты прошлых сборок (FENIX H1)
  for (const orphan of ["dashboard.html", "styleguide.html", "data.json"]) {
    try { rmSync(op(orphan)); } catch { /* нет файла - ок */ }
  }
  // index = редирект на канонический obzor.html (TZ v2 1.12): один тяжёлый файл вместо дубля
  writePage(op("index.html"), `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=obzor.html"><title>GENGLASS · аналитика OZON</title>
<style>body{margin:0;background:#0A0A0B;color:#8A8A90;font:14px/1.5 "SF Pro Display",-apple-system,sans-serif;display:grid;place-items:center;height:100vh}a{color:#FF4438}</style>
</head><body><div>Открываю обзор... <a href="obzor.html">перейти вручную</a></div></body></html>`);
  writePage(op("tovary.html"), renderTovary(model));
  writePage(op("obzor.html"), renderOverview(model));
  writePage(op("voronka.html"), renderFunnel(model));
  writePage(op("cards.html"), renderCards(model));
  writePage(op("money.html"), renderMoney(model));
  writePage(op("assistant.html"), renderAssistant(model));

  const footMkt = `ДРР канала - <b>[ДАННЫЕ]</b>, надёжен. ДРР по линиям - ориентир (G5). Индекс цены - снимок OZON. Реклама/цены не в дневной истории, поэтому страница - снимок за 30 дней, без интерактивного периода.`;
  writePage(op("marketing.html"), staticPage("Маркетинг и цена", "снимок рекламы и цен за 30 дней", buildMarketing(), footMkt));
  writePage(op("campaigns.html"), staticPage("Кампании", "снимок рекламы за 30 дней", buildCampaigns(), footMkt));

  const footComp = `Все поля - <b>[ДАННЫЕ]</b> с публичной карточки OZON (цена / база / рейтинг / отзывы / наличие). Заказы и выручку конкурента OZON не отдаёт - не оцениваем. Лист - снимок последнего прогона пилота; страж заполненности краснеет, если анти-бот срезал сбор.`;
  const compSnaps = listCompetitorSnaps();
  const compLabel = compSnaps.length ? `снимок конкурентов ${compDate(compSnaps[compSnaps.length - 1]!)}` : "конкуренты - данных пока нет";
  writePage(op("competitors.html"), staticPage("Конкуренты", compLabel, buildCompetitors(maxDate), footComp));

  console.log(`Готово: obzor · tovary · voronka · cards · money · marketing · campaigns · competitors (+index-redirect)`);
  console.log(`Фактов ${facts.length} · SKU ${Object.keys(skus).length} · ${model.floor}..${model.max} · OOS ${oos.length} · закрытые Акты до ${closedMeta.lastLabel}${closedMeta.stale ? " (УСТАРЕЛИ)" : ""}`);
}

main();
