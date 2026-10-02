// Вкладка «Отчет» Яндекс Маркета - ежемесячный отчёт руководителю, аналог OZON (report-page.ts).
// Спека: knowledge/semantic/metrics/ym-monthly-report.yaml (ответы 01.10.2026: «1а 2а 3а 4а 5а»,
// эталон «да», общие расходы «2а», неполный месяц «3 да»).
//
// Все деньги вкладки - из функции accAgg блока «Аналитика по артикулам (за выбранный период)» на
// «Деньгах» Маркета: страница отчёта несёт код и данные «Денег» целиком (pageJs + svodJs), поэтому
// ИТОГО отчёта за месяц равно ИТОГО блока за те же даты - это одна функция, а не копия (К9).
// Общие функции отчёта (периоды «месяц к месяцу», разложения отклонений, форматы, выгрузка в Excel)
// берутся из клиентского кода OZON-отчёта REPORT_JS по имени, а не копируются: правка там - правка
// здесь. Файл OZON-отчёта эта вкладка не меняет.
import { readFileSync } from "node:fs";
import { REPORT_JS } from "../report-page.js";
import { KEEP_OZON } from "../../paths.js";
import { FLOOR } from "./common.js";
import { accFeeKey, accLedgerFullTo, accNetKind, accNetReady, nettingCancelled, type AccNettingRow } from "./derive-lib.js";

type Ctx = {
  dp: (f: string) => string;
  maxD: string;
  catOf: (sku: string) => string;
  skuName: Record<string, string>;
  // Клиентский код вкладки «Маркетинг» Маркета (promoYm().js): из него берётся pmRow - ДРР считается
  // той же функцией, что на «Маркетинге» (ответ 2а 01.10), а не второй формулой.
  promoJs: string;
};

const readNd = (p: string): any[] => {
  try { return readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00Z") + n * 86400000).toISOString().slice(0, 10);

// Функции и переменные OZON-отчёта, которые не зависят от данных OZON. rpPeriods читает MAXD - на
// странице Маркета ему подставляется последний день реестра (см. reportJsYm), а не дата заказов.
export const RP_SHARED = [
  "RP_MON", "RP_MON_R", "rpEnd", "rpPrevYm", "rpDm", "rpName", "rpPeriods", "rpN", "rpPct", "rpPctTxt", "rpDTxt", "rpSh",
  "rpTopFilt", "rpTop", "rpList", "rpUnitsPrice", "rpVolRate", "rpTurnCard", "rpWhyTurn", "rpRth", "rpRtd",
  "RP_LOW_VIEWS", "RP_DEAD_DAYS", "RP_DROP_DAYS", "rpDays",
  "RPX_CRC", "rpxCrc", "rpxZip", "rpxEsc", "rpxCell", "rpxCol", "rpxSheet", "rpxTable", "rpxLines",
];

// Достаёт из клиентского кода объявление верхнего уровня по имени: «function имя(...){...}» (по
// скобкам) или строку «var имя=...». Не нашлось - сборка падает: значит, OZON-отчёт переименовал
// функцию, и молча собрать отчёт Маркета без неё нельзя.
export function pickJs(src: string, names: string[], from = "REPORT_JS OZON-отчёта"): string {
  // Код OZON-отчёта написан так: объявление верхнего уровня начинается с начала строки, тело идёт
  // строками с отступом, закрывающая скобка - с начала строки. По этому и режем, без разбора строк
  // и регулярных выражений внутри тела. Скобки куска сверяются - если не сошлись, сборка падает.
  const lines = src.split("\n"), out: string[] = [];
  for (const n of names) {
    const i = lines.findIndex((l) => l.startsWith(`function ${n}(`) || new RegExp(`^var (.*[ ,])?${n}=`).test(l));
    if (i < 0) throw new Error(`report-ym: в ${from} нет «${n}» - источник поменялся, отчёт Маркета без неё не собрать`);
    let j = i + 1;
    while (j < lines.length && (lines[j] === "" || /^[\s}]/.test(lines[j]!))) j++;
    const chunk = lines.slice(i, j).join("\n").replace(/\n+$/, "");
    const bal = (chunk.match(/\{/g) || []).length - (chunk.match(/\}/g) || []).length;
    if (bal !== 0) throw new Error(`report-ym: «${n}» вырезалась с несбалансированными скобками (${bal})`);
    if (!out.includes(chunk)) out.push(chunk);
  }
  return out.join("\n");
}

const isCancelled = (st: string) => /^CANCELLED/i.test(String(st || ""));

// Списания баллами за кампании кабинета без заказа из отчёта по баллам (ответ «2а» 02.10): только
// «Скидка за участие в совместных акциях», без номера заказа, не отменённые, по границу реестра; пара
// кабинет/месяц, где такие строки уже есть в реестре платежей, не берётся (защита от задвоения).
// Вынесено для теста (G5 ФЕНИКСА iter2, мутанты M13 и M21).
export function campaignPoints(net: AccNettingRow[], bonuses: any[], to: string): Array<{ d: string; b: string; svc: string; a: number }> {
  const netCamp = new Set<string>();
  for (const r of net) if ((!r.order || !String(r.order).trim()) && accNetKind(r.type || "", String(r.src || "")) === "fee" && accFeeKey(r.service || "", String(r.src || "")) === "cofin") netCamp.add(`${r.business}/${String(r.d).slice(0, 7)}`);
  const out: Array<{ d: string; b: string; svc: string; a: number }> = [];
  for (const r of bonuses) {
    const d = String(r.d || ""), b = String(r.business || ""), src = String(r.src || "");
    if (!d || d > to || (r.order && String(r.order).trim()) || nettingCancelled(r)) continue;
    if (!/скидка за участие в совместных акциях/i.test(src) || netCamp.has(`${b}/${d.slice(0, 7)}`)) continue;
    out.push({ d, b, svc: String(r.service || "").trim() || "кампания без названия", a: Number(r.amount) || 0 });
  }
  return out;
}
export function reportDataYm(ctx: Ctx) {
  const { dp, maxD } = ctx;
  const acc = readNd(dp("pnl_sku_netting_daily.ndjson"));
  // Последний ПОЛНЫЙ день реестра (вариант «а» 02.10): общая функция с блоком ACC на «Деньгах» -
  // отчёт за месяц равен блоку за те же даты, и оба не берут день, сборы которого ещё дорастают.
  const { to, lastBy, feeBy } = accLedgerFullTo(acc);
  // Баллы Маркета по дням: начислено баллами (points) и списано баллами (cofin). В «Начислено» и
  // «К выплате» не входят (решение Кати 28.09.2026) - строка справочно.
  const ptsDay: Record<string, number[]> = {};
  let accFrom = "";
  for (const r of acc) {
    const d = String(r.d || ""); if (!d || d > to) continue;
    if (!accFrom || d < accFrom) accFrom = d;
    const a = (ptsDay[d] ||= [0, 0]); a[0]! += Number(r.points) || 0; a[1]! += Number(r.cofin) || 0;
  }
  // Показы, заходы в карточку и корзины по артикулу по месяцам. Отчёт показов Маркета собирается с
  // 31.08.2026; первая неделя пришла одной свёрнутой строкой (aggregate, дата 06.09, period_from
  // 31.08). Её суммируем (ответ 4а): месяц строки - по дате строки, поэтому день 31.08 попадает в
  // сентябрь - он один из 30, помечается на странице.
  const views: Record<string, { nm: string; cat: string; m: Record<string, number[]> }> = {};
  let viewsFrom = "", aggFrom = "", aggTo = "";
  for (const r of readNd(dp("sku_views.ndjson"))) {
    const d = String(r.date || ""), sk = String(r.sku || ""); if (!d || !sk || d > maxD) continue;
    const f = String(r.period_from || d); if (!viewsFrom || f < viewsFrom) viewsFrom = f;
    if (r.aggregate) { if (!aggFrom || f < aggFrom) aggFrom = f; if (d > aggTo) aggTo = d; }
    const v = Number(r.views) || 0, pdp = Number(r.pdp) || 0, cart = Number(r.cart) || 0;
    if (!v && !pdp && !cart) continue;
    const e = (views[sk] ||= { nm: String(ctx.skuName[sk] || r.name || sk).slice(0, 70), cat: ctx.catOf(sk) || "Прочее", m: {} });
    const a = (e.m[d.slice(0, 7)] ||= [0, 0, 0]); a[0]! += v; a[1]! += pdp; a[2]! += cart;
  }
  // Даты заказов по артикулу (кроме отменённых и строк услуг-доставки) - «последний заказ» для
  // непродаваемых. Выгрузка заказов Маркета идёт с 01.01.2026: заказа раньше в данных нет.
  const ordD: Record<string, string[]> = {};
  let ordFrom = "";
  for (const r of readNd(dp("orders.ndjson"))) {
    if (r.service || isCancelled(r.status)) continue;
    const sk = String(r.sku || ""), d = String(r.created || ""); if (!sk || !d) continue;
    if (!ordFrom || d < ordFrom) ordFrom = d;
    (ordD[sk] ||= []).push(d);
  }
  for (const sk in ordD) ordD[sk] = [...new Set(ordD[sk])].sort();
  // Отменённые заказы по артикулу (даты) - причина «заказ был, но отменён» у непродаваемых (ответ 3а).
  const ordC: Record<string, string[]> = {};
  for (const r of readNd(dp("orders.ndjson"))) {
    if (r.service || !isCancelled(r.status)) continue;
    const sk = String(r.sku || ""), d = String(r.created || ""); if (sk && d) (ordC[sk] ||= []).push(d);
  }
  for (const sk in ordC) ordC[sk] = ordC[sk]!.sort();
  // Услуги Маркета по дням (ответ 1а): те же проводки и та же классификация, что у блока «Аналитика
  // по артикулам» (accNetKind/accFeeKey из derive-lib): проводки с заказом, пары (кабинет, месяц),
  // собранные по реестру. [день, поле блока, услуга, сумма]. Сумма услуг поля = колонка блока (до
  // построчного округления блока) - это проверяет страница. Списание баллами (cofin) - отдельно, по
  // услуге, за которую списано, справкой (ответ «да» 01.10).
  // Проводки без заказа (уровень кабинета) - по типу: удержания, премия, взнос продавца.
  const net = readNd(dp("netting.ndjson")) as AccNettingRow[];
  const ready = accNetReady(net);
  const svcK: Record<string, number> = {}, genK: Record<string, number[]> = {};
  for (const r of net) {
    const d = String(r.d || ""), b = String(r.business || ""), src = String(r.src || ""), a = Number(r.amount) || 0;
    if (!d || d > to) continue;
    if (nettingCancelled(r)) continue; // заказ отменён, проводки не будет (ответ «1а» 02.10)
    if (!r.order || !String(r.order).trim()) {
      if (r.src === undefined) continue; // старая схема: тип неизвестен, не угадываем (как сверка на «Деньгах»)
      const g = (genK[d] ||= [0, 0, 0]);
      if (/^прем/i.test(src)) g[1]! += a; else if (/внесено продавц/i.test(src)) g[2]! += a; else g[0]! += a;
      continue;
    }
    if (!ready(b, d)) continue;
    const kind = accNetKind(r.type || "", src);
    if (kind === "pay" || kind === "back" || kind === "points") continue;
    // Проводка вида «прочее» (компенсация за потерянный заказ и т.п.) - не услуга: в поле service
    // Маркет кладёт название товара. Подпись - тип операции (src), товар в скобках (H2 ФЕНИКСА).
    const svcName = String(r.service || "").trim();
    // Товар в подписи не нужен (просьба пользователя 02.10): строка - вид операции.
    const svc = kind === "other" ? (src.trim() || "прочая проводка") : svcName || "без названия услуги";
    const f = kind === "fee" ? accFeeKey(r.service || "", src) : "otherSvc";
    // Списание баллами: поле - по самой услуге (без источника), чтобы баллы встали под свою группу.
    const k = f === "cofin" ? `${d}|cofin:${accFeeKey(r.service || "", "")}|${svc}` : `${d}|${f}|${svc}`;
    svcK[k] = (svcK[k] || 0) + a;
  }
  // Списания баллами за кампании кабинета (буст с оплатой за показы, полки) без номера заказа (ответ
  // «2а» 02.10). В отчёт о платежах они не входят, поэтому их нет в реестре; есть в отчёте по баллам
  // Маркета (bonuses_monthly.ndjson, сверено с выгрузкой кабинета до копейки). Справкой, группа
  // «Продвижение» (и буст, и полки - продвижение). Пара кабинет/месяц, где такие строки уже есть в
  // реестре, отсюда не берётся - чтобы не задвоить, если Маркет начнёт отдавать их в платежах.
  const camp = campaignPoints(net, readNd(dp("bonuses_monthly.ndjson")), to);
  const campN = camp.length;
  for (const c of camp) {
    const k = `${c.d}|cofin:promo|${c.svc} (кампания)`;
    svcK[k] = (svcK[k] || 0) + c.a;
    (ptsDay[c.d] ||= [0, 0])[1]! += c.a;
  }
  // Баллы по дням - после кампаний: «списано за услуги» включает и их, как сумма услуг справки.
  const pts = Object.keys(ptsDay).sort().map((d) => [d, Math.round(ptsDay[d]![0]!), Math.round(ptsDay[d]![1]!)]);
  const svc = Object.keys(svcK).sort().map((k) => { const [d, f, n] = k.split("|"); return [d, f, n, Math.round(svcK[k]! * 100) / 100]; });
  const gen = Object.keys(genK).sort().map((d) => [d, ...genK[d]!.map((x) => Math.round(x * 100) / 100)]);
  // ДРР как на «Маркетинге» (ответ 2а): pmRow вкладки «Маркетинг» по своду заказов, по месяцу ЗАКАЗА и
  // кабинету. Считается здесь, при сборке, той же функцией - на страницу едут только итоги месяцев.
  // Сбой выреза pmRow роняет сборку (H1 ФЕНИКСА): раньше try/catch молча давал «нет данных». Без
  // свода заказов вкладка «Маркетинг» сама пустая (promoJs = "") - тогда и ДРР нет, это не сбой.
  let drr: any[] = [];
  let svod: any = null;
  try { svod = JSON.parse(readFileSync(dp("svod_orders.json"), "utf-8")); } catch { svod = null; }
  if (svod && (svod.months || []).length && ctx.promoJs) {
    const pmRow = new Function(`${pickJs(ctx.promoJs, ["PM_ART", "pmRow"], "promoYm().js «Маркетинга»")};return pmRow;`)();
    drr = (svod.months || []).filter((m: any) => m.rows && m.rows.length).map((m: any) => {
      const x = pmRow(m);
      if (!x || !x.ym || !Number.isFinite(Number(x.spend)) || !Number.isFinite(Number(x.base))) throw new Error(`report-ym: pmRow «Маркетинга» вернул не то на ${m.ym}/${m.business}: ${JSON.stringify(x)}`);
      return { ym: x.ym, b: String(x.business), sm: Math.round(x.sm), sp: Math.round(x.sp), oh: Math.round(x.oh), spend: Math.round(x.spend), base: Math.round(x.base), settled: x.settled, partial: x.partial };
    });
  }
  // Кабинеты и их линии - из PM_NAMES вкладки «Маркетинг», а не литералами (H3 ФЕНИКСА).
  const cab: { mir: string; fur: string } = { mir: "", fur: "" };
  if (ctx.promoJs) {
    const names = new Function(`${pickJs(ctx.promoJs, ["PM_NAMES"], "promoYm().js «Маркетинга»")};return PM_NAMES;`)() as Record<string, string>;
    for (const [b, n] of Object.entries(names)) { if (/зеркал/i.test(n)) cab.mir = b; else if (/мебел/i.test(n)) cab.fur = b; }
    if (!cab.mir || !cab.fur) throw new Error(`report-ym: в PM_NAMES «Маркетинга» не нашлись кабинеты зеркал и мебели: ${JSON.stringify(names)}`);
  }
  console.log(`report-ym: кампаний баллами из отчёта по баллам ${campN} строк; реестр полный по ${to} (последний день ${JSON.stringify(lastBy)}, со сборами ${JSON.stringify(feeBy)}), показы ${Object.keys(views).length} SKU с ${viewsFrom || "-"}, заказы по ${Object.keys(ordD).length} SKU с ${ordFrom || "-"}`);
  // Первый полный месяц реестра - с него идут серые ретро-колонки (месяц, начатый не с 1-го, неполный).
  const full = !accFrom ? "" : accFrom.slice(8) === "01" ? accFrom.slice(0, 7) + "-01" : addDays(accFrom.slice(0, 7) + "-01", 32).slice(0, 7) + "-01";
  return { to, maxD, accFrom, full, floor: FLOOR.slice(0, 7), lastBy, pts, views, viewsFrom, aggFrom, aggTo, ord: ordD, ordC, ordFrom, svc, gen, drr, cab };
}

export const REPORT_YM_CSS = `<style>
#periods,#range-panel{display:none!important}
.rp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.rp-card{background:var(--bg-2,#12151c);border:1px solid var(--bd,#232a36);border-radius:10px;padding:12px 14px}
.rp-card h4{margin:0 0 6px;font-size:13px;color:var(--ink-2)}
.rp-big{font-size:22px;font-weight:800}
.rp-up{color:var(--up,#3ddc97)}.rp-dn{color:var(--dn,#ff5a5f)}.rp-mute{color:var(--ink-3,#7d8a99)}
.rp-why{margin:0;padding-left:18px}.rp-why li{margin:3px 0}
#rp-cost th,#rp-cost td,#rp-ads th,#rp-ads td,.rp-dead th,.rp-dead td,#rp-why2 th,#rp-why2 td{white-space:nowrap}
#rp-why2 td.rp-txt{white-space:normal;min-width:260px}.rp-dead td.rp-txt{white-space:normal;min-width:180px;max-width:260px}
.rp-sub td:first-child{padding-left:22px;color:var(--ink-2)}
.rp-sub td{color:var(--ink-3,#7d8a99)!important;font-weight:400}
.rp-main td{font-weight:800;color:#A78BFA}
.rp-main td.rp-txt,.rp-main td.rp-arts{font-weight:400;color:var(--ink-1)}
#rp-why2 .rp-txt,#rp-why2 .rp-arts{white-space:normal;width:340px;min-width:340px;max-width:340px}
.rp-par{cursor:pointer}.rp-par td:first-child::before{content:'▸ ';color:var(--ink-3,#7d8a99)}.rp-par.rp-open td:first-child::before{content:'▾ '}
.rp-warn{color:#E5B567}
.rp-retro,th.rp-retro{color:#8A8F98}
.rp-art,.rp-art b{color:#8A8F98}
@media (max-width:900px){.rp-cards{grid-template-columns:1fr}}
</style>`;

export const REPORT_YM_BODY = `${REPORT_YM_CSS}
<section class="card"><div class="card-h"><div><div class="card-title">Ежемесячный отчёт Яндекс Маркета</div><div class="card-sub" id="rp-sub"></div></div>
<div style="display:flex;gap:8px;align-items:center"><select id="rp-month" style="background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd,#232a36);border-radius:7px;padding:4px 8px"></select>
<button id="rp-xlsx" title="Скачать отчёт за выбранный месяц файлом Excel: все блоки на одном листе" style="background:transparent;color:#22D3EE;border:1px solid #22D3EE;border-radius:7px;padding:4px 10px;cursor:pointer;font-weight:600;white-space:nowrap">⬇ Выгрузить в Excel</button></div></div>
<div id="rp-flags" class="kt-note"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">1. Оборот за месяц</div><div class="card-sub">Оборот = «Начислено»: платёж покупателя за товар и доставку минус возвраты, по дате транзакции в отчёте по взаиморасчётам Маркета - ИТОГО блока «Аналитика по артикулам (за выбранный период)» на «Деньгах» за те же даты. Баллов Маркета в «Начислено» нет (их нет и в отчёте о платежах). Штуки = продано − возвраты. Мебель - всё, кроме зеркал.</div></div></div>
<div class="rp-cards" id="rp-turn"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">2. Причины роста или падения</div><div class="card-sub">Оборот раскладывается на «штуки» (сколько продано за вычетом возвратов) и «цену» (начислено на 1 шт). Каждая статья расхода - на «объём» (изменился оборот при прежней доле статьи) и «ставку» (изменилась доля статьи от оборота). Сумма двух частей = отклонение. Ниже - артикулы с наибольшим вкладом в отклонение (топ-3 - часть суммы). Это разложение цифр, а не доказанная причина. Серые колонки - прошлые полные месяцы для истории.</div></div></div>
<div id="rp-why"></div>
<div class="kt-scroll" style="margin-top:10px"><table class="kt-table" id="rp-why2"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">3. Затраты площадки и полная аналитика</div><div class="card-sub">Статьи - услуги Маркета из отчёта по взаиморасчётам, сгруппированные так же, как колонки блока «Аналитика по артикулам (за выбранный период)» на «Деньгах»: итог группы = колонка блока, строки до «Чистой прибыли по артикулам» = его ИТОГО. «Затраты площадки» = «Всего сборов» (Начислено − К выплате). Ниже - проводки кабинета без артикула (удержания и премия): в таблице «Денег» их нет, в «Подлежит перечислению» отчёта о платежах они есть, поэтому вычитаются из чистой прибыли отдельной строкой. Внизу справочно - баллы Маркета и взнос продавца: в оборот, сборы и прибыль не входят. Доля = статья / Начислено. Серые колонки - прошлые полные месяцы.</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-cost"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">4. Баллы Маркета (справочно)</div><div class="card-sub">Баллы в оборот, сборы и прибыль не входят: аналитика - по деньгам, как отчёт о платежах. Начислено - баллы Маркета за скидки покупателям; списано - оплата услуг Маркета баллами, по услугам (раскрывается по клику).</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-pts"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">5. Реклама</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-ads"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">6. Топ-5 непродаваемых: зеркала и мебель</div><div class="card-sub">Товар показывался в отчётном месяце, но не получил ни одного заказа (кроме отменённых) за 60 дней до конца периода. Порядок - по показам за месяц. Причина и действие - по правилу ниже таблиц, пороги как у ${KEEP_OZON} [ГИПОТЕЗА].</div></div></div>
<div id="rp-dead"></div></section>`;

// Клиентский код. Работает поверх кода «Денег» Маркета (accAgg, ACC, ACC_DOC, ACC_FB, ACC_NAME, fmtRu,
// esc) и общих функций OZON-отчёта (RP_SHARED). Интерполяция одна: сторож слова «OZON» от platformize.
export function reportJsYm(): string {
  // Общие функции живут в своей области видимости: там MAXD = последний день реестра (REPY.to),
  // а не дата последнего заказа - иначе сентябрь считался бы по 30.09, которого в реестре ещё нет.
  const names = RP_SHARED;
  const shared = `(function(){var MAXD=REPY.to;\n${pickJs(REPORT_JS, names)}\n`
    + names.map((n) => `window.${n}=${n};`).join("") + `})();\n`;
  return shared + REPORT_YM_JS;
}

export const REPORT_YM_JS = `
// Поля строки accAgg: второй столбец в основных полях, первый (как начислил Маркет) - acc1…cogs1, ship - наша перевозка.
var RPY_F=['sold','ret','units','pay','dlv','accruals','commission','delivery','acquiring','storage','cofin','promo','otherSvc','amount','got','back','cogs','cgot','csold','cback','cret',
  'ship','acc1','pay1','dlv1','amount1','units1','sold1','ret1','cogs1'];
// Группы статей - поля блока «Аналитика по артикулам» под названиями Маркета (ответ 1а 01.10). Внутри
// группы - услуги из отчёта по взаиморасчётам. [поле блока, ключ отчёта, подпись группы].
var RPY_G=[['commission','mcom','Размещение товарных предложений'],['delivery','mdel','Доставка'],['acquiring','macq','Перевод и приём платежа'],
  ['storage','msto','Хранение'],['promo','mpromo','Продвижение'],['otherSvc','moth','Штрафы и прочие услуги']];
// Месяцы, где есть проводки и есть прошлый месяц для сравнения; не позже последнего дня реестра.
function rpyMonths(){var s={};for(var i=0;i<ACC.length;i++)s[String(ACC[i][0]).slice(0,7)]=1;
  return Object.keys(s).filter(function(m){return m+'-01'<=REPY.to;}).sort().reverse().filter(function(m,i,a){return a.indexOf(rpPrevYm(m))>=0;});}
function rpyIn(d,per){return d>=per.from&&d<=per.to;}
// Строки блока «Аналитика по артикулам» за период -> строки по артикулу (поля OZON-отчёта off/nm/acc
// для общих функций разложения) и итоги: всего, зеркала, мебель, группы мебели. Те же суммы, что
// ИТОГО блока на «Деньгах»: accAgg одна, итог - сложение её строк.
function rpyCalc(per){
  var list=accAgg(per),rows={},g={mir:{acc:0,units:0,promo:0},fur:{acc:0,units:0,promo:0}},fcat={};
  var T={fee:0,gp:0,adm:0,tax:0,np:0};RPY_F.forEach(function(f){T[f]=0;});
  list.forEach(function(x){
    RPY_F.forEach(function(f){T[f]+=x[f]||0;});T.fee+=x.fee;T.gp+=x.gp;T.adm+=x.adm;T.tax+=x.tax;T.np+=x.np;
    var k=x.cat==='Зеркала'?'mir':'fur';g[k].acc+=x.accruals;g[k].units+=x.units;g[k].promo+=-x.promo;
    if(k==='fur'){var c=fcat[x.cat]||(fcat[x.cat]={acc:0,units:0});c.acc+=x.accruals;c.units+=x.units;}
    var o=Object.assign({},x,{off:x.sku,nm:(typeof ACC_NAME!=='undefined'&&ACC_NAME[x.sku])||x.sku,acc:x.accruals});
    RPY_G.forEach(function(G){o[G[1]]=-(x[G[0]]||0);});rows[x.sku]=o;});
  // Услуги Маркета (расход положительным) и списание баллами по услугам - за дни окна.
  var svc={},svcSum={},pts={};
  REPY.svc.forEach(function(r){if(!rpyIn(r[0],per))return;var f=r[1],k=f+'|'+r[2];
    if(f.indexOf('cofin:')===0)pts[k]=(pts[k]||0)-r[3];else{svc[k]=(svc[k]||0)-r[3];svcSum[f]=(svcSum[f]||0)-r[3];}});
  // Проводки кабинета без заказа: удержания, премия, взнос продавца (его собственные деньги, не расход).
  var acct=0,prem=0,seller=0;REPY.gen.forEach(function(r){if(!rpyIn(r[0],per))return;acct+=r[1];prem+=r[2];seller+=r[3];});
  var pt=0,pc=0;REPY.pts.forEach(function(r){if(!rpyIn(r[0],per))return;pt+=r[1];pc+=r[2];});
  var nRows=0;for(var i=0;i<ACC.length;i++)if(rpyIn(ACC[i][0],per))nRows++;
  var grand=null;
  if(list.length){grand=Object.assign(T,{acc:T.accruals,svc:svc,svcSum:svcSum,pts:pts,acct:acct,prem:prem,seller:seller,gen:acct+prem,netAll:T.np+acct+prem,
    ptsIn:pt,ptsOut:-pc,saldo:pt+pc,n:list.length});RPY_G.forEach(function(G){grand[G[1]]=-T[G[0]];});}
  // Инварианты. Строки ACC округлены до рубля по (день, артикул): тождество и разбивка по услугам
  // расходятся на рубли - до 1,5 ₽ и 0,5 ₽ на строку соответственно; флаг услуг - от 0,5 ₽ × строк окна, но
  // не выше 100 ₽ (H4 ФЕНИКСА: шум в сентябре до 45 ₽, а порог «строк окна» пропускал -100 ₽ группы).
  var idn=grand?grand.accruals-grand.fee-grand.amount:0,svBad=[];
  if(grand)RPY_G.forEach(function(G){var d=(svcSum[G[0]]||0)-grand[G[1]];if(Math.abs(d)>Math.max(2,Math.min(0.5*nRows,100)))svBad.push(G[2]+' '+rpN(d)+' ₽');});
  return {rows:rows,g:g,fcat:fcat,grand:grand,idn:idn,svBad:svBad,
    bad:!!grand&&Math.abs(g.mir.acc+g.fur.acc-grand.acc)>1,badId:!!grand&&Math.abs(idn)>nRows*1.5};
}
function rpyVal(t,k){if(!t)return null;return t[k]||0;}
function rpyRetro(P){var out=[],m=P.pym,guard=0,df=REPY.full;
  while(guard++<36){m=rpPrevYm(m);if(!df||m+'-01'<df)break;var per={from:m+'-01',to:rpEnd(m)};out.unshift({ym:m,per:per,calc:rpyCalc(per)});}
  return out;}
// Строки полной аналитики: группы и услуги Маркета (по тем месяцам, что на экране). {k, l, fn, inc, top,
// bold, sub, svc}. fn(t) - значение по итогу периода t; одна функция на ретро, прошлый и отчётный месяц.
function rpyLines(calcs){
  var key=function(k){return function(t){return rpyVal(t,k);};};
  var pct=function(v){return String(Math.round(v*1000)/10).replace('.',',')+'%';};
  // Два столбца (решение 02.10): «Начислил Маркет» - как в отчёте о платежах, по дню платежа, справочно;
  // «Начислено» - по заказам, по которым Маркет провёл сбор за продажу, от него считается всё ниже.
  var L=[{k:'acc1',l:'Начислил Маркет (справочно)',t:'за оформление, как в отчёте о платежах, по дню платежа',fn:key('acc1'),inc:1,top:1,noSh:1},
    {k:'acc',l:'Начислено',t:'по заказам, по которым Маркет провёл сбор за продажу; от этой строки считается всё ниже',fn:key('acc'),inc:1,top:1,bold:1,main:1},
    {k:'pay',l:'в т.ч. оплатил клиент за товар',fn:key('pay'),inc:1,top:1,sub:1},{k:'dlv',l:'в т.ч. доставка покупателя',fn:key('dlv'),inc:1,top:1,sub:1}];
  RPY_G.forEach(function(G){
    var names={};calcs.forEach(function(c){var t=c&&c.grand;if(!t)return;for(var k in t.svc)if(k.indexOf(G[0]+'|')===0)names[k]=1;});
    var any=Object.keys(names).length||calcs.some(function(c){return c&&c.grand&&Math.round(c.grand[G[1]]);});
    if(!any)return;
    L.push({k:G[1],l:G[2],fn:key(G[1]),inc:0,top:1});
    Object.keys(names).sort().forEach(function(k){L.push({k:k,l:k.split('|')[1],fn:function(t){return t?(t.svc[k]||0):null;},inc:0,sub:1,svc:1});});});
  L.push({k:'fee',l:'Всего сборов = затраты площадки',fn:key('fee'),inc:0,top:1,bold:1,main:1},{k:'amount',l:'К выплате',fn:key('amount'),inc:1,top:1,bold:1,main:1},
    {k:'amount1',l:'К выплате Маркета (справочно)',t:'«Начислил Маркет» − те же сборы',fn:key('amount1'),inc:1,sub:1,noSh:1},
    {k:'cogs',l:'С\\\\С произв.',fn:key('cogs'),inc:0,top:1},{k:'ship',l:'Наша доставка',t:'ведомость перевозчика, по этим же заказам',fn:function(t){if(!t||(typeof ACC_R!=='undefined'&&!ACC_R))return null;return Math.round(t.ship||0)?t.ship:null;},inc:0,top:1},{k:'gp',l:'Валовая прибыль',fn:key('gp'),inc:1,top:1},
    {k:'adm',l:'АДМ '+pct(ACC_RATE.adm)+' от К выплате',fn:key('adm'),inc:0},{k:'tax',l:'Налоги '+pct(ACC_RATE.tax)+' от «Начислено»',fn:key('tax'),inc:0},
    {k:'np',l:'Чистая прибыль по артикулам',t:'= ИТОГО блока «Аналитика по артикулам» на «Деньгах»',fn:key('np'),inc:1,top:1,bold:1,main:1},
    {k:'gen',l:'Общие расходы кабинета',t:'проводки без артикула: удержания и премия',fn:key('gen'),inc:1},{k:'acct',l:'в т.ч. удержания без заказа',fn:key('acct'),inc:1,sub:1},{k:'prem',l:'в т.ч. премия Маркета',fn:key('prem'),inc:1,sub:1},
    {k:'netAll',l:'Чистая прибыль с общими расходами',fn:key('netAll'),inc:1,bold:1,main:1});
  return L;
}
// Справка по баллам (ответ «да» 01.10, решение 4: аналитика - по деньгам, баллы пока справочно).
// Блок 4 «Баллы Маркета» (просьба пользователя 02.10: баллы - отдельным блоком, основные строки -
// начислено, списано, сальдо; списания по услугам свёрнуты под «списано»).
function rpyPtsLines(calcs){
  var L=[{k:'ptsIn',l:'Начислено баллами за скидки покупателям',fn:function(t){return rpyVal(t,'ptsIn');},inc:1,bold:1,main:1},
    {k:'ptsOut',l:'Списано за услуги',t:'«Скидка за участие в совместных акциях»',fn:function(t){return rpyVal(t,'ptsOut');},inc:0,bold:1,main:1}];
  var names={};calcs.forEach(function(c){var t=c&&c.grand;if(!t)return;for(var k in t.pts)names[k]=1;});
  Object.keys(names).sort().forEach(function(k){L.push({k:k,l:'в т.ч. '+k.split('|')[1],fn:function(t){return t?(t.pts[k]||0):null;},inc:0,sub:1});});
  L.push({k:'saldo',l:'Сальдо баллов',t:'начислено − списано',fn:function(t){return rpyVal(t,'saldo');},inc:1,bold:1,main:1});
  return L;
}
// Строки «в т.ч.» сворачиваются под свою строку (просьба пользователя 02.10). Состояние - на странице.
var RPY_OPEN={};
function rpyRows(lines,row3){var h='',par=null;
  lines.forEach(function(L,i){
    if(!L.sub){par=L.k;var kids=i+1<lines.length&&!!lines[i+1].sub;h+=row3(L,false,kids?{par:L.k}:null);}
    else h+=row3(L,false,par?{kid:par}:null);});
  return h;}
function rpyFold(el){[].forEach.call(el.querySelectorAll('tr.rp-par'),function(tr){tr.onclick=function(){
  var k=tr.getAttribute('data-p');RPY_OPEN[k]=!RPY_OPEN[k];tr.classList.toggle('rp-open',!!RPY_OPEN[k]);
  [].forEach.call(el.querySelectorAll('tr.rp-kid'),function(r){if(r.getAttribute('data-g')===k)r.style.display=RPY_OPEN[k]?'':'none';});};});}
function rpyTurnCard(){return rpTurnCard.apply(null,arguments).replace('реализовано ','продано за вычетом возвратов ');}
function rpyRender(){
  var sel=document.getElementById('rp-month');var ym=sel.value;var P=rpPeriods(ym);
  var cur=rpyCalc(P.cur),prev=rpyCalc(P.prev);var gc=cur.grand,gp=prev.grand;var R=rpyRetro(P);
  var lag=rpDays(REPY.to,REPY.maxD);
  document.getElementById('rp-sub').innerHTML='Отчётный месяц: <b>'+rpName(ym)+'</b> ('+rpDm(P.cur.from)+'-'+rpDm(P.cur.to)+') против '+rpName(P.pym)+' ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'). Реестр Маркета по '+rpDm(REPY.to)+'.'+REPY.to.slice(0,4)+(lag>0?', заказы по '+rpDm(REPY.maxD)+' (реестр отстаёт на '+lag+' дн)':'')+'.';
  var fl=[];
  if(P.partial)fl.push('<b class="rp-warn">⚠ Месяц неполный:</b> реестр по '+rpDm(P.cur.to)+', сравнение с теми же числами прошлого месяца ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'), а не с целым месяцем. Удержания и премия кабинета обычно приходят в последние дни месяца - до них строка «Общие расходы» неполная.');
  if(REPY.full&&P.prev.from<REPY.full)fl.push('<b class="rp-warn">⚠ База сравнения неполная:</b> реестр за '+rpName(P.pym)+' начинается с '+rpDm(REPY.accFrom)+' - отклонения к этому месяцу завышены.');
  var fbIn=(typeof ACC_FB!=='undefined'?ACC_FB:[]).filter(function(p){var m=p.split('/')[1];return m===P.ym||m===P.pym;});
  if(fbIn.length)fl.push('<b class="rp-warn">⚠ По выгрузке заказов, а не по реестру:</b> '+fbIn.join(', ')+' - штуки и платёж этих месяцев с отчётом о платежах могут не совпасть.');
  if(cur.bad||prev.bad)fl.push('<b class="rp-dn">⚠ Ошибка сборки: зеркала + мебель не равны ИТОГО «Начислено».</b> Цифры блока 1 не использовать.');
  if(cur.badId||prev.badId)fl.push('<b class="rp-dn">⚠ Ошибка сборки: Начислено − Всего сборов не равно К выплате</b> (расхождение '+rpN(cur.badId?cur.idn:prev.idn)+' ₽ больше построчного округления).');
  else if(Math.round(cur.idn)||Math.round(prev.idn))fl.push('<span class="rp-mute">Начислено − Всего сборов расходится с «К выплате» на '+rpN(prev.idn)+' ₽ и '+rpN(cur.idn)+' ₽ - построчное округление до рубля, как в подсказке блока на «Деньгах».</span>');
  // Статус платежа не собран (G1 ФЕНИКСА iter2): отменённые заказы там посчитаны продажей и возвратом.
  var nsN=(typeof ACC_NOST!=='undefined'?ACC_NOST:[]).filter(function(p){var m=p.split('/')[1];return m===P.ym||m===P.pym;});
  var nsO=(typeof ACC_NOST_OLD!=='undefined'?ACC_NOST_OLD:[]).filter(function(p){var m=p.split('/')[1];return m===P.ym||m===P.pym;});
  if(nsN.length)fl.push('<b class="rp-warn">⚠ Статус платежа не собран:</b> '+nsN.join(', ')+' - заказы, которые оплатили и отменили, в справочном столбце «Начислил Маркет» посчитаны продажей и возвратом; основа расчёта от статуса не зависит - у отменённого заказа нет сбора за продажу. Бот перезаберёт эти месяцы (схема реестра 5).');
  if(nsO.length)fl.push('<b class="rp-warn">⚠ Статус платежа не собирается:</b> '+nsO.join(', ')+' - месяцы до '+REPY.floor+' бот не перезабирает; отменённые заказы там посчитаны продажей и возвратом в «Начислил Маркет» (справочно).');
  if(typeof ACC_R!=='undefined'&&!ACC_R)fl.push('<b class="rp-warn">⚠ Снимок собран до второго столбца:</b> «Начислено» и всё ниже - как начислил Маркет, наша доставка не вычтена (нет данных). Обновится после ближайшего снимка Маркета.');
  var svB=cur.svBad.concat(prev.svBad);
  if(svB.length)fl.push('<b class="rp-dn">⚠ Услуги Маркета не сложились в колонку блока:</b> '+svB.join(', ')+'. Строки услуг в блоках 2-3 не использовать.');
  document.getElementById('rp-flags').innerHTML=fl.join('<br>')||'<span class="rp-mute">Пометок по данным нет.</span>';
  if(!gc||!gp){['rp-turn','rp-why','rp-why2','rp-cost','rp-pts','rp-ads','rp-dead'].forEach(function(id){document.getElementById(id).innerHTML='<div class="kt-note">нет данных за период</div>';});return;}
  var calcs=R.map(function(r){return r.calc;}).concat([prev,cur]);
  var LINES=rpyLines(calcs);
  // === 1. Оборот ===
  document.getElementById('rp-turn').innerHTML=rpyTurnCard('Всего',gp.acc,gc.acc,gp.units,gc.units)+rpyTurnCard('Зеркала',prev.g.mir.acc,cur.g.mir.acc,prev.g.mir.units,cur.g.mir.units)+rpyTurnCard('Мебель',prev.g.fur.acc,cur.g.fur.acc,prev.g.fur.units,cur.g.fur.units);
  // === 2. Причины ===
  var fc={};for(var c1 in cur.fcat)fc[c1]=1;for(var c0 in prev.fcat)fc[c0]=1;
  var fl2=Object.keys(fc).map(function(c){var a1=(cur.fcat[c]||{}).acc||0,a0=(prev.fcat[c]||{}).acc||0;return {c:c,d:a1-a0};}).filter(function(o){return Math.round(o.d);}).sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
  var furExtra=fl2.length?'по группам мебели: '+fl2.map(function(o){return o.c+' '+(o.d>0?'+':'')+fmtRu(Math.round(o.d));}).join(', '):'';
  var mir=function(c){return c==='Зеркала';},fur=function(c){return c!=='Зеркала';},all=function(){return true;};
  document.getElementById('rp-why').innerHTML=
    rpWhyTurn('Оборот всего',gp.acc,gp.units,gc.acc,gc.units,cur,prev,all,'зеркала '+rpDTxt(cur.g.mir.acc-prev.g.mir.acc,true)+' ₽, мебель '+rpDTxt(cur.g.fur.acc-prev.g.fur.acc,true)+' ₽')
    +rpWhyTurn('Зеркала',prev.g.mir.acc,prev.g.mir.units,cur.g.mir.acc,cur.g.mir.units,cur,prev,mir,'')
    +rpWhyTurn('Мебель',prev.g.fur.acc,prev.g.fur.units,cur.g.fur.acc,cur.g.fur.units,cur,prev,fur,furExtra);
  // Блок 2 - только прошлый и отчётный месяц (просьба пользователя 02.10: ретро-месяцы - в блоке 3).
  var h2='<thead><tr><th>Статья</th><th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">%</th><th class="rp-txt">За счёт чего</th><th class="rp-arts">Артикулы с наибольшим вкладом</th></tr></thead><tbody>';
  // Оформление как в блоке 3: основные строки фиолетовым жирным, «в т.ч.» серым и свёрнуто под своей строкой.
  var tr2=function(L,v0,v1,txt,pct,G){var d=v1-v0,isArt=function(x){return x.indexOf('class="rp-art"')>=0;},why=txt.filter(function(x){return !isArt(x);}),arts=txt.filter(isArt);var cls=(L.sub?'rp-sub':'')+(L.main?' rp-main':'')+(G&&G.par?' rp-par'+(RPY_OPEN[G.par]?' rp-open':''):'')+(G&&G.kid?' rp-kid':'');
    var at=(G&&G.par?' data-p="'+G.par+'"':'')+(G&&G.kid?' data-g="'+G.kid+'"'+(RPY_OPEN[G.kid]?'':' style="display:none"'):'');
    return '<tr'+(cls?' class="'+cls.trim()+'"':'')+at+'><td'+(L.t?' title="'+L.t+'"':'')+'>'+L.l+'</td><td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(d,L.inc?true:false)+'</td><td class="r">'+rpPctTxt(pct?pct(v1,v0):rpPct(v1,v0),L.inc?true:false)+'</td><td class="rp-txt">'+(why.join('<br>')||'<span class="rp-mute">'+(Math.round(d)?'—':'не изменилось')+'</span>')+'</td><td class="rp-arts">'+arts.join('<br>')+'</td></tr>';};
  var upA=rpUnitsPrice(gp.acc,gp.units,gc.acc,gc.units),tA=[];
  // Простыми словами, без формул (просьба пользователя 02.10). Сумма двух частей = отклонение.
  if(upA){tA.push((gc.units>=gp.units?'больше':'меньше')+' штук ('+rpN(gp.units)+' → '+rpN(gc.units)+'): '+rpDTxt(upA.vol,true)+' ₽');
    tA.push((upA.p1>=upA.p0?'выше':'ниже')+' цена за 1 шт ('+rpN(upA.p0)+' → '+rpN(upA.p1)+' ₽): '+rpDTxt(upA.price,true)+' ₽');}
  tA.push('зеркала '+rpDTxt(cur.g.mir.acc-prev.g.mir.acc,true)+' ₽, мебель '+rpDTxt(cur.g.fur.acc-prev.g.fur.acc,true)+' ₽');
  var aPl=rpTopFilt(cur,prev,'acc',1,3,all),aMi=rpTopFilt(cur,prev,'acc',-1,3,all);
  if(aPl.length)tA.push(rpTop('выросло сильнее всего',aPl));if(aMi.length)tA.push(rpTop('снизилось сильнее всего',aMi));
  var tU=['зеркала '+rpN(prev.g.mir.units)+' → '+rpN(cur.g.mir.units)+' шт ('+rpDTxt(cur.g.mir.units-prev.g.mir.units,true)+'), мебель '+rpN(prev.g.fur.units)+' → '+rpN(cur.g.fur.units)+' шт ('+rpDTxt(cur.g.fur.units-prev.g.fur.units,true)+')'];
  var uPl=rpTopFilt(cur,prev,'units',1,3,all),uMi=rpTopFilt(cur,prev,'units',-1,3,all);
  if(uPl.length)tU.push(rpTop('выросло сильнее всего, шт',uPl));if(uMi.length)tU.push(rpTop('снизилось сильнее всего, шт',uMi));
  var E2=[[LINES.filter(function(L){return L.k==='acc';})[0],gp.acc,gc.acc,tA],[{k:'units',l:'Продано за вычетом возвратов, шт',fn:function(t){return rpyVal(t,'units');},inc:1},gp.units,gc.units,tU,function(c,p){return p?(c-p)/Math.abs(p)*100:null;}]];
  LINES.forEach(function(L){if(L.k==='acc'||L.k==='pay'||L.k==='dlv'||L.k==='acc1'||L.k==='amount1')return; // справочный первый столбец - только в полной аналитике
    var v0=L.fn(gp),v1=L.fn(gc),d=v1-v0,txt=[];
    var vr=rpVolRate(v0,gp.acc,v1,gc.acc);
    var inc=L.inc?true:false;
    if(vr&&Math.round(d)&&L.k!=='gen'&&L.k!=='netAll'&&L.k!=='acct'&&L.k!=='prem'){
      txt.push('из-за '+(gc.acc>=gp.acc?'роста':'падения')+' оборота: '+rpDTxt(vr.vol,inc)+' ₽');
      txt.push('из-за изменения доли в обороте ('+rpSh(vr.r0,1)+' → '+rpSh(vr.r1,1)+'): '+rpDTxt(vr.rate,inc)+' ₽');}
    var dk=function(k){var X=LINES.filter(function(x){return x.k===k;})[0];return X?X.fn(gc)-X.fn(gp):0;};
    if(Math.round(d)&&L.k==='gen')txt.push('удержания без заказа: '+rpDTxt(dk('acct'),true)+' ₽; премия Маркета: '+rpDTxt(dk('prem'),true)+' ₽');
    if(Math.round(d)&&L.k==='netAll')txt.push('чистая по артикулам: '+rpDTxt(dk('np'),true)+' ₽; общие расходы кабинета: '+rpDTxt(dk('gen'),true)+' ₽');
    if(L.top){var pl=rpTopFilt(cur,prev,L.k,1,3,all),mi=rpTopFilt(cur,prev,L.k,-1,3,all);
      if(pl.length)txt.push(rpTop('выросло сильнее всего',pl));if(mi.length)txt.push(rpTop('снизилось сильнее всего',mi));}
    E2.push([L,v0,v1,txt]);});
  var par2=null;E2.forEach(function(e,i){var L=e[0],G=null;
    if(!L.sub){par2=L.k;if(i+1<E2.length&&E2[i+1][0].sub)G={par:L.k};}else if(par2)G={kid:par2};
    h2+=tr2(L,e[1],e[2],e[3],e[4],G);});
  document.getElementById('rp-why2').innerHTML=h2+'</tbody>';rpyFold(document.getElementById('rp-why2'));
  // === 3. Затраты площадки и полная аналитика ===
  var h3='<thead><tr><th>Статья</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">Отклонение, %</th><th class="r">Доля от начисл., было</th><th class="r">Доля, стало</th></tr></thead><tbody>';
  var row3=function(L,noSh,G){var v0=L.fn(gp),v1=L.fn(gc),nd=v0==null||v1==null,rpNd=function(v){return v==null?'<span class="rp-mute">нет данных</span>':rpN(v);},inc=L.inc?true:false,pc=noSh?(v0?(v1-v0)/Math.abs(v0)*100:null):rpPct(v1,v0);
    var cls=(L.sub?'rp-sub':'')+(L.main?' rp-main':'')+(G&&G.par?' rp-par'+(RPY_OPEN[G.par]?' rp-open':''):'')+(G&&G.kid?' rp-kid':'');
    var at=(G&&G.par?' data-p="'+G.par+'"':'')+(G&&G.kid?' data-g="'+G.kid+'"'+(RPY_OPEN[G.kid]?'':' style="display:none"'):'');
    return '<tr'+(cls?' class="'+cls.trim()+'"':'')+at+(L.bold&&!L.main?' style="font-weight:800"':'')+'><td'+(L.t?' title="'+L.t+'"':'')+'>'+L.l+'</td>'+rpRtd(R.map(function(r){return r.calc.grand?L.fn(r.calc.grand):null;}))+'<td class="r">'+rpNd(v0)+'</td><td class="r">'+rpNd(v1)+'</td>'+(nd?'<td class="r"></td><td class="r"></td><td class="r"></td><td class="r"></td>':'<td class="r">'+rpDTxt(v1-v0,inc)+'</td><td class="r">'+rpPctTxt(pc,inc)+'</td><td class="r">'+(noSh||L.noSh?'':rpSh(v0,gp.acc))+'</td><td class="r">'+(noSh||L.noSh?'':rpSh(v1,gc.acc))+'</td>')+'</tr>';};
  h3+=rpyRows(LINES,row3);
  h3+=row3({l:'Продано за вычетом возвратов, шт',fn:function(t){return t.units;},inc:1},true);
  var rf1=function(v){return String(Math.round(v*10)/10).replace('.',',');};
  var rent=function(t){return t&&t.amount?t.netAll/t.amount*100:null;};var rp=rent(gp),rc=rent(gc);
  h3+='<tr><td title="чистая прибыль с общими расходами / К выплате">Рентабельность</td>'+rpRtd(R.map(function(r){return rent(r.calc.grand);}),function(v){return rf1(v)+'%';})+'<td class="r">'+(rp==null?'—':rf1(rp)+'%')+'</td><td class="r">'+(rc==null?'—':rf1(rc)+'%')+'</td><td class="r">'+((rp==null||rc==null)?'—':((rc-rp>0?'+':'')+rf1(rc-rp)+' п.'))+'</td><td></td><td></td><td></td></tr>';
  document.getElementById('rp-cost').innerHTML=h3+'</tbody>';rpyFold(document.getElementById('rp-cost'));
  // === 4. Баллы Маркета (справочно) ===
  var h4='<thead><tr><th>Статья</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">Отклонение, %</th><th class="r">Доля от начисл., было</th><th class="r">Доля, стало</th></tr></thead><tbody>';
  h4+=rpyRows(rpyPtsLines(calcs),row3);
  document.getElementById('rp-pts').innerHTML=h4+'</tbody>';rpyFold(document.getElementById('rp-pts'));
  // === 5. Реклама ===
  rpyAds(P,cur,prev,R);
  // === 6. Непродаваемые ===
  rpyDead(P,cur);
}
// === 5. Реклама: расход по отчёту по взаиморасчётам (просьба пользователя 02.10: раздел ДРР «как на
// вкладке «Маркетинг»» и пояснения убраны; ДРР по-прежнему считается при сборке - REPY.drr) ===
function rpyAds(P,cur,prev,R){
  var calcs=R.map(function(r){return r.calc;}).concat([prev,cur]);
  var h='<thead><tr><th>Показатель</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(P.ym)+'</th><th class="r">Отклонение</th><th class="r">%</th></tr></thead><tbody>';
  // vals - значения по колонкам (ретро..., прошлый, отчётный); null - «нет данных», не 0.
  // o: {sub, main, par/kid - свёртка «в т.ч.» как в блоках 2-4}.
  var row=function(l,vals,o){var n=vals.length,v0=vals[n-2],v1=vals[n-1],d=(v0==null||v1==null)?null:v1-v0;
    var cell=function(v){return v==null?'<span class="rp-mute">нет данных</span>':rpN(v);};
    var cls=(o.sub?'rp-sub':'')+(o.main?' rp-main':'')+(o.par?' rp-par'+(RPY_OPEN[o.par]?' rp-open':''):'')+(o.kid?' rp-kid':'');
    var at=(o.par?' data-p="'+o.par+'"':'')+(o.kid?' data-g="'+o.kid+'"'+(RPY_OPEN[o.kid]?'':' style="display:none"'):'');
    return '<tr'+(cls?' class="'+cls.trim()+'"':'')+at+'><td>'+l+'</td>'+vals.slice(0,n-2).map(function(v){return '<td class="r rp-retro">'+cell(v)+'</td>';}).join('')+'<td class="r">'+cell(v0)+'</td><td class="r">'+cell(v1)+'</td><td class="r">'+(d==null?'—':rpDTxt(d,false))+'</td><td class="r">'+(d==null?'—':rpPctTxt(rpPct(v1,v0),false))+'</td></tr>';};
  h+=row('Продвижение деньгами',calcs.map(function(c){return c.grand?c.grand.mpromo:null;}),{main:1,par:'ad1'});
  h+=row('в т.ч. зеркала',calcs.map(function(c){return c.grand?c.g.mir.promo:null;}),{sub:1,kid:'ad1'});
  h+=row('в т.ч. мебель',calcs.map(function(c){return c.grand?c.g.fur.promo:null;}),{sub:1,kid:'ad1'});
  h+=row('Продвижение баллами (справочно)',calcs.map(function(c){var t=c.grand;if(!t)return null;var s=0;for(var k in t.pts)if(k.indexOf('cofin:promo|')===0)s+=t.pts[k];return s;}),{});
  document.getElementById('rp-ads').innerHTML=h+'</tbody>';rpyFold(document.getElementById('rp-ads'));
}
// === 5. Непродаваемые (ответ 4а: правила и пороги OZON [ГИПОТЕЗА]; 3а 01.10: отменённые заказы) ===
function rpyAddD(d,n){return new Date(Date.parse(d+'T00:00Z')+n*86400000).toISOString().slice(0,10);}
function rpyDead(P,cur){
  var to=P.cur.to,ym=P.ym,start=rpyAddD(to,-(RP_DEAD_DAYS-1)),el=document.getElementById('rp-dead');
  if(!REPY.viewsFrom||REPY.viewsFrom>P.cur.to){el.innerHTML='<div class="kt-note">Показов по товарам за '+rpName(ym)+' нет: отчёт показов Маркета собирается с '+(REPY.viewsFrom?rpDm(REPY.viewsFrom)+'.'+REPY.viewsFrom.slice(0,4):'—')+'.</div>';return;}
  var last=function(sk){var a=REPY.ord[sk]||[],l='';for(var i=0;i<a.length;i++){if(a[i]>to)break;l=a[i];}return l;};
  var canc=function(sk){return (REPY.ordC[sk]||[]).filter(function(d){return d>=start&&d<=to;}).length;};
  var grp={mir:[],fur:[]},ctrs={mir:[],fur:[]};
  for(var sk in REPY.views){var e=REPY.views[sk],m=e.m[ym];if(!m||!m[0])continue;var g=(e.cat==='Зеркала')?'mir':'fur';
    if(m[0]>=RP_LOW_VIEWS)ctrs[g].push(m[1]/m[0]);
    var lo=last(sk);if(lo&&lo>=start)continue;
    grp[g].push({sk:sk,nm:e.nm,v:m[0],pdp:m[1],cart:m[2],last:lo||null,canc:canc(sk)});}
  var med=function(a){if(!a.length)return null;a=a.slice().sort(function(x,y){return x-y;});var k=Math.floor(a.length/2);return a.length%2?a[k]:(a[k-1]+a[k])/2;};
  var pc=function(v){return (Math.round(v*1000)/10).toString().replace('.',',')+'%';};
  var html='';
  [['mir','Зеркала'],['fur','Мебель']].forEach(function(G){var k=G[0],arr=grp[k].sort(function(a,b){return b.v-a.v;}),top=arr.slice(0,5),mc=med(ctrs[k]);
    var h='<h4 style="margin:12px 0 6px">'+G[1]+' <span class="rp-mute" style="font-weight:400">- всего товаров с показами и без заказов '+RP_DEAD_DAYS+' дн: '+arr.length+'; медиана доли заходов в группе '+(mc==null?'—':pc(mc))+'</span></h4>';
    if(!top.length){html+=h+'<div class="kt-note">нет таких товаров</div>';return;}
    h+='<div class="kt-scroll"><table class="kt-table rp-dead"><thead><tr><th>Артикул</th><th>Название</th><th class="r">Показы</th><th class="r">Заходы в карточку</th><th class="r">Корзины</th><th class="r">Отменённых заказов за '+RP_DEAD_DAYS+' дн</th><th>Последний заказ</th><th class="r">Хранение Маркета за месяц, ₽</th><th>Причина</th><th>Действие</th></tr></thead><tbody>';
    top.forEach(function(x){
      var r=cur.rows[x.sk],sto=r?-r.storage:0;
      var days=x.last?rpDays(x.last,to):rpDays(REPY.ordFrom,to),ctr=x.v?x.pdp/x.v:0,why,act;
      var lastTxt=x.last?days+' дн без заказов':'заказов не было с '+rpDm(REPY.ordFrom)+'.'+REPY.ordFrom.slice(0,4);
      if(days>=RP_DROP_DAYS&&sto>0){why='нет заказов: '+lastTxt+', Маркет берёт за хранение';act='Снятие с площадки';}
      else if(x.canc){why='заказы были, но все отменены: '+x.canc+' за '+RP_DEAD_DAYS+' дн';act='Разобрать причины отмен: срок доставки, наличие, цена';}
      else if(x.v<RP_LOW_VIEWS){why='карточку почти не показывают: '+x.v+' показов за месяц';act='Перезалив карточки';}
      else if(mc!=null&&ctr<mc/2){why='показы есть, в карточку не заходят: '+pc(ctr)+' при медиане группы '+pc(mc);act='Перезалив карточки (фото, заголовок)';}
      else if(!x.cart){why='заходят ('+x.pdp+'), но не кладут в корзину';act='Выкуп (первые отзывы, позиция) или проверка цены';}
      else {why='кладут в корзину ('+x.cart+'), но не заказывают';act='Выкуп или проверка цены и срока доставки';}
      if(days>=RP_DROP_DAYS&&sto<=0&&act!=='Снятие с площадки'&&!x.canc)act+='; если не поможет - снятие с площадки ('+lastTxt+')';
      h+='<tr><td><b>'+x.sk+'</b></td><td title="'+String(x.nm).replace(/"/g,'&quot;')+'" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(x.nm)+'</td><td class="r">'+fmtRu(x.v)+'</td><td class="r">'+fmtRu(x.pdp)+' ('+pc(ctr)+')</td><td class="r">'+fmtRu(x.cart)+'</td><td class="r">'+(x.canc||'—')+'</td><td>'+(x.last?rpDm(x.last)+'.'+x.last.slice(0,4)+' ('+days+' дн)':'не было с '+rpDm(REPY.ordFrom)+'.'+REPY.ordFrom.slice(0,4))+'</td><td class="r">'+(Math.round(sto)?fmtRu(Math.round(sto)):'—')+'</td><td class="rp-txt">'+why+'</td><td class="rp-txt"><b>'+act+'</b></td></tr>';});
    html+=h+'</tbody></table></div>';});
  var agg=REPY.aggFrom&&REPY.aggTo.slice(0,7)===ym&&REPY.aggFrom.slice(0,7)!==ym;
  html+='<div class="kt-note" style="margin-top:8px">Правило [ГИПОТЕЗА], пороги как у ${KEEP_OZON}: 1) нет заказов '+RP_DROP_DAYS+'+ дн и Маркет берёт за хранение - снятие с площадки; 2) заказы за '+RP_DEAD_DAYS+' дн были, но все отменены - разобрать причины отмен (ответ 3а 01.10); 3) меньше '+RP_LOW_VIEWS+' показов за месяц - перезалив карточки; 4) доля заходов в карточку меньше половины медианы группы - перезалив (фото, заголовок); 5) заходят, но корзин нет - выкуп или проверка цены; 6) корзины есть, заказов нет - выкуп или проверка цены и срока доставки. Хранение - статья «Хранение» по артикулу за месяц. '
    +'<span class="rp-warn">Возраст карточки не проверяется:</span> отчёт показов Маркета собирается с '+rpDm(REPY.viewsFrom)+'.'+REPY.viewsFrom.slice(0,4)+', дату появления карточки по нему не узнать, поэтому новая карточка без заказов тоже попадёт в список. Заказы - выгрузка с '+rpDm(REPY.ordFrom)+'.'+REPY.ordFrom.slice(0,4)+'.'
    +(agg?' Первая неделя показов ('+rpDm(REPY.aggFrom)+'-'+rpDm(REPY.aggTo)+') пришла одной строкой и отнесена к '+RP_MON_R[+ym.slice(5,7)]+' целиком, включая '+rpDm(REPY.aggFrom)+'.':'')+'</div>';
  el.innerHTML=html;
}
// Выгрузка в Excel: тот же лист, что у OZON (общие rpx*), таблицы снимаются с отрисованной страницы.
function rpyExport(){
  var ym=document.getElementById('rp-month').value;var P=rpPeriods(ym);
  var head=[[{s:'Ежемесячный отчёт Яндекс Маркета: '+rpName(ym),b:1}],[document.getElementById('rp-sub').innerText],[]];
  var s1=head.concat([[{s:'1. Оборот за месяц',b:1}],[{s:'Группа',b:1},{s:rpName(P.pym)+' ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'), ₽',b:1},{s:rpName(ym)+' ('+rpDm(P.cur.from)+'-'+rpDm(P.cur.to)+'), ₽',b:1},{s:'Отклонение, ₽',b:1},{s:'Отклонение, %',b:1},{s:'Шт, было',b:1},{s:'Шт, стало',b:1}]]);
  var cur=rpyCalc(P.cur),prev=rpyCalc(P.prev);
  if(cur.grand&&prev.grand){[['Всего',prev.grand.acc,cur.grand.acc,prev.grand.units,cur.grand.units],['Зеркала',prev.g.mir.acc,cur.g.mir.acc,prev.g.mir.units,cur.g.mir.units],['Мебель',prev.g.fur.acc,cur.g.fur.acc,prev.g.fur.units,cur.g.fur.units]].forEach(function(r){
    var pc=rpPct(r[2],r[1]);s1.push([r[0],Math.round(r[1]),Math.round(r[2]),Math.round(r[2]-r[1]),pc==null?'':(Math.round(pc*10)/10).toString().replace('.',',')+'%',r[3],r[4]]);});}
  s1=s1.concat([[]],[[{s:'Пометки по данным',b:1}]],rpxLines(document.getElementById('rp-flags')));
  var s2=[[{s:'2. Причины роста или падения: оборот',b:1}]].concat(rpxLines(document.getElementById('rp-why')),[[]],[[{s:'По каждой статье',b:1}]],rpxTable(document.getElementById('rp-why2')));
  var s3=[[{s:'3. Затраты площадки и полная аналитика',b:1}]].concat(rpxTable(document.getElementById('rp-cost')));
  var s4b=[[{s:'4. Баллы Маркета (справочно)',b:1}]].concat(rpxTable(document.getElementById('rp-pts')));
  var s4=[[{s:'5. Реклама',b:1}]].concat(rpxTable(document.getElementById('rp-ads')));
  var s5=[[{s:'6. Топ-5 непродаваемых',b:1}]];
  [].forEach.call(document.getElementById('rp-dead').children,function(ch){if(ch.tagName==='H4')s5.push([{s:ch.innerText,b:1}]);else if(ch.querySelector&&ch.querySelector('table'))s5=s5.concat(rpxTable(ch.querySelector('table')),[[]]);else s5=s5.concat(rpxLines(ch));});
  var one=s1.concat([[],[]],s2,[[],[]],s3,[[],[]],s4b,[[],[]],s4,[[],[]],s5);
  var ns='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  var files=[['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook '+ns+'><sheets><sheet name="Отчет" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml',rpxSheet(one,[48,18,18,18,18,18,18,18,18,18,18,60])]];
  var blob=rpxZip(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='YM_otchet_'+ym+(P.partial?'_po_'+P.cur.to:'')+'.xlsx';
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
}
var rpyInited=false;
function rpyInit(){if(rpyInited)return;rpyInited=true;var sel=document.getElementById('rp-month');var ms=rpyMonths();
  sel.innerHTML=ms.map(function(m){return '<option value="'+m+'">'+rpName(m)+'</option>';}).join('');
  // По умолчанию - прошлый календарный месяц от даты просмотра (как rpInit в REPORT_JS).
  var t=new Date(),pm=rpPrevYm(t.toISOString().slice(0,7));sel.value=(ms.indexOf(pm)>=0)?pm:ms[0];
  sel.onchange=rpyRender;var xb=document.getElementById('rp-xlsx');if(xb)xb.onclick=rpyExport;}
function render(){rpyInit();rpyRender();}
`;
