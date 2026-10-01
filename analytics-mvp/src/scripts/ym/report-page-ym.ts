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

type Ctx = {
  dp: (f: string) => string;
  maxD: string;
  catOf: (sku: string) => string;
  skuName: Record<string, string>;
  gmvOf: (d: string) => number; // заказанный оборот дня (знаменатель ДРР, как на «Маркетинге»)
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
  "RP_LOW_VIEWS", "rpDays",
  "RPX_CRC", "rpxCrc", "rpxZip", "rpxEsc", "rpxCell", "rpxCol", "rpxSheet", "rpxTable", "rpxLines",
];

// Достаёт из клиентского кода объявление верхнего уровня по имени: «function имя(...){...}» (по
// скобкам) или строку «var имя=...». Не нашлось - сборка падает: значит, OZON-отчёт переименовал
// функцию, и молча собрать отчёт Маркета без неё нельзя.
export function pickJs(src: string, names: string[]): string {
  // Код OZON-отчёта написан так: объявление верхнего уровня начинается с начала строки, тело идёт
  // строками с отступом, закрывающая скобка - с начала строки. По этому и режем, без разбора строк
  // и регулярных выражений внутри тела. Скобки куска сверяются - если не сошлись, сборка падает.
  const lines = src.split("\n"), out: string[] = [];
  for (const n of names) {
    const i = lines.findIndex((l) => l.startsWith(`function ${n}(`) || new RegExp(`^var (.*[ ,])?${n}=`).test(l));
    if (i < 0) throw new Error(`report-ym: в REPORT_JS нет «${n}» - OZON-отчёт поменялся, отчёт Маркета без неё не собрать`);
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

export function reportDataYm(ctx: Ctx) {
  const { dp, maxD } = ctx;
  const acc = readNd(dp("pnl_sku_netting_daily.ndjson"));
  // Последний день реестра: самый ранний из «последних дней» кабинетов, у которых были проводки за
  // 30 дней. Отчёт не может идти дальше кабинета, который ещё не догнал (реестр отстаёт на день).
  const lastBy: Record<string, string> = {};
  let gMax = "";
  for (const r of acc) { const d = String(r.d || ""), b = String(r.business || ""); if (d > (lastBy[b] || "")) lastBy[b] = d; if (d > gMax) gMax = d; }
  const live = Object.values(lastBy).filter((d) => d >= addDays(gMax, -30));
  const to = live.length ? live.sort()[0]! : gMax;
  // Баллы Маркета по дням: начислено баллами (points) и списано баллами (cofin). В «Начислено» и
  // «К выплате» не входят (решение Кати 28.09.2026) - строка справочно.
  const ptsDay: Record<string, number[]> = {};
  let accFrom = "";
  for (const r of acc) {
    const d = String(r.d || ""); if (!d || d > to) continue;
    if (!accFrom || d < accFrom) accFrom = d;
    const a = (ptsDay[d] ||= [0, 0]); a[0]! += Number(r.points) || 0; a[1]! += Number(r.cofin) || 0;
  }
  const pts = Object.keys(ptsDay).sort().map((d) => [d, Math.round(ptsDay[d]![0]!), Math.round(ptsDay[d]![1]!)]);
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
  // Заказанный оборот по дням (знаменатель ДРР).
  const gmv: any[] = [];
  for (let d = accFrom || to; d && d <= to; d = addDays(d, 1)) gmv.push([d, Math.round(ctx.gmvOf(d))]);
  console.log(`report-ym: реестр по ${to} (кабинеты ${JSON.stringify(lastBy)}), показы ${Object.keys(views).length} SKU с ${viewsFrom || "-"}, заказы по ${Object.keys(ordD).length} SKU с ${ordFrom || "-"}`);
  // Первый полный месяц реестра - с него идут серые ретро-колонки (месяц, начатый не с 1-го, неполный).
  const full = !accFrom ? "" : accFrom.slice(8) === "01" ? accFrom.slice(0, 7) + "-01" : addDays(accFrom.slice(0, 7) + "-01", 32).slice(0, 7) + "-01";
  return { to, full, lastBy, pts, views, viewsFrom, aggFrom, aggTo, ord: ordD, ordFrom, gmv };
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
<section class="card"><div class="card-h"><div><div class="card-title">3. Затраты площадки и полная аналитика</div><div class="card-sub">Строки до «Чистой прибыли по артикулам» = столбцы ИТОГО блока «Аналитика по артикулам (за выбранный период)» на «Деньгах». «Затраты площадки» = «Всего сборов» (Начислено − К выплате). Ниже - проводки кабинета без артикула (удержания и премия из отчёта по взаиморасчётам): на «Деньгах» их нет в таблице, но они входят в «Подлежит перечислению» отчёта о платежах, поэтому вычитаются из чистой прибыли отдельной строкой. Доля = статья / Начислено. Серые колонки - прошлые полные месяцы.</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-cost"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">4. Реклама: расход и ДРР</div><div class="card-sub">Расход = статья «Продвижение» (буст продаж, полки, товарные баннеры) из отчёта по взаиморасчётам, по дате транзакции. ДРР = расход / весь заказанный оборот магазина за те же даты (по дате заказа, как на «Маркетинге»). Выручки рекламных заказов и окупаемости нет: статистика рекламы Маркета не подключена. Серые колонки - прошлые полные месяцы.</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-ads"></table></div>
<div id="rp-ads-note" class="kt-note" style="margin-top:8px"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">5. Топ-5 непродаваемых: зеркала и мебель</div><div class="card-sub">Товар показывался в отчётном месяце, но не получил ни одного заказа (кроме отменённых) за 60 дней до конца периода. Порядок - по показам за месяц. Причина и действие - по правилу ниже таблиц, пороги как у ${KEEP_OZON} [ГИПОТЕЗА].</div></div></div>
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
var RPY_F=['sold','ret','units','pay','dlv','accruals','commission','delivery','acquiring','storage','cofin','promo','otherSvc','amount','got','back','cogs'];
// Месяцы, где есть проводки и есть прошлый месяц для сравнения; не позже последнего дня реестра.
function rpyMonths(){var s={};for(var i=0;i<ACC.length;i++)s[String(ACC[i][0]).slice(0,7)]=1;
  return Object.keys(s).filter(function(m){return m+'-01'<=REPY.to;}).sort().reverse().filter(function(m,i,a){return a.indexOf(rpPrevYm(m))>=0;});}
// Строки блока «Аналитика по артикулам» за период -> строки по артикулу (поля OZON-отчёта off/nm/acc
// для общих функций разложения) и итоги: всего, зеркала, мебель, группы мебели. Те же суммы, что
// ИТОГО блока на «Деньгах»: accAgg одна, итог - сложение её строк.
function rpyCalc(per){
  var list=accAgg(per),rows={},g={mir:{acc:0,units:0},fur:{acc:0,units:0}},fcat={};
  var T={fee:0,gp:0,adm:0,tax:0,np:0};RPY_F.forEach(function(f){T[f]=0;});
  list.forEach(function(x){
    RPY_F.forEach(function(f){T[f]+=x[f]||0;});T.fee+=x.fee;T.gp+=x.gp;T.adm+=x.adm;T.tax+=x.tax;T.np+=x.np;
    var k=x.cat==='Зеркала'?'mir':'fur';g[k].acc+=x.accruals;g[k].units+=x.units;
    if(k==='fur'){var c=fcat[x.cat]||(fcat[x.cat]={acc:0,units:0});c.acc+=x.accruals;c.units+=x.units;}
    rows[x.sku]=Object.assign({},x,{off:x.sku,nm:(typeof ACC_NAME!=='undefined'&&ACC_NAME[x.sku])||x.sku,acc:x.accruals,feeAll:x.fee,mpromo:-x.promo,mcom:-x.commission,mdel:-x.delivery,macq:-x.acquiring,msto:-x.storage,moth:-x.otherSvc});});
  // Проводки кабинета без артикула (удержания, премия) - по дням из ACC_DOC, как сверка на «Деньгах».
  var acct=0,prem=0;(typeof ACC_DOC!=='undefined'?ACC_DOC:[]).forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;acct+=r[7]||0;prem+=r[8]||0;});
  var pt=0,pc=0;REPY.pts.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;pt+=r[1];pc+=r[2];});
  var gmv=0;REPY.gmv.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;gmv+=r[1];});
  var grand=list.length?Object.assign(T,{acc:T.accruals,acct:acct,prem:prem,gen:acct+prem,netAll:T.np+acct+prem,ptsIn:pt,ptsOut:pc,gmv:gmv,n:list.length,
    mcom:-T.commission,mdel:-T.delivery,macq:-T.acquiring,msto:-T.storage,mpromo:-T.promo,moth:-T.otherSvc}):null;
  // Инварианты: зеркала + мебель = ИТОГО «Начислено»; Начислено − Всего сборов = К выплате (тождество блока).
  // Строки ACC округлены до рубля по (день, артикул), поэтому тождество расходится на рубли: до 1,5 ₽ на
  // строку (три поля по 0,5) - округление, как в подсказке блока на «Деньгах»; больше - ошибка сборки.
  var nRows=0;for(var i=0;i<ACC.length;i++)if(ACC[i][0]>=per.from&&ACC[i][0]<=per.to)nRows++;
  var idn=grand?grand.accruals-grand.fee-grand.amount:0;
  var bad=grand&&Math.abs(g.mir.acc+g.fur.acc-grand.acc)>1,badId=grand&&Math.abs(idn)>nRows*1.5;
  return {rows:rows,g:g,fcat:fcat,grand:grand,bad:bad,badId:badId,idn:idn,
    mir:rpyGrp(list,true),fur:rpyGrp(list,false)};
}
function rpyGrp(list,mir){var s={promo:0,acc:0};list.forEach(function(x){if((x.cat==='Зеркала')!==mir)return;s.promo+=-x.promo;s.acc+=x.accruals;});return s;}
// Статьи полной аналитики. [ключ, подпись, +1 доход / -1 расход, топ артикулов, жирная строка].
var RPY_LINES=[
  ['acc','Начислено (оборот)',1,1,1],['pay','в т.ч. оплатил клиент за товар',1,1,0,1],['dlv','в т.ч. доставка покупателя',1,1,0,1],
  ['mcom','Комиссия',-1,1],['mdel','Доставка',-1,1],['macq','Эквайринг',-1,1],['msto','Хранение',-1,1],['mpromo','Продвижение (реклама)',-1,1],['moth','Прочие услуги',-1,1],
  ['fee','Всего сборов = затраты площадки',-1,1,1],['amount','К выплате',1,1,1],['cogs','С\\\\С произв.',-1,1],['gp','Валовая прибыль',1,1],
  ['adm','АДМ 30% от К выплате',-1,0],['tax','Налоги 15% от «Начислено»',-1,0],['np','Чистая прибыль по артикулам (= блок на «Деньгах»)',1,1,1],
  ['gen','Общие расходы кабинета (без артикула)',1,0],['acct','в т.ч. удержания без заказа',1,0,0,1],['prem','в т.ч. премия',1,0,0,1],
  ['netAll','Чистая прибыль с общими расходами',1,0,1]];
function rpyVal(t,k){if(!t)return null;return t[k]||0;}
function rpyRetro(P){var out=[],m=P.pym,guard=0,df=REPY.full;
  while(guard++<36){m=rpPrevYm(m);if(!df||m+'-01'<df)break;var per={from:m+'-01',to:rpEnd(m)};out.unshift({ym:m,per:per,calc:rpyCalc(per)});}
  return out;}
function rpyRender(){
  var sel=document.getElementById('rp-month');var ym=sel.value;var P=rpPeriods(ym);
  var cur=rpyCalc(P.cur),prev=rpyCalc(P.prev);var gc=cur.grand,gp=prev.grand;var R=rpyRetro(P);
  document.getElementById('rp-sub').innerHTML='Отчётный месяц: <b>'+rpName(ym)+'</b> ('+rpDm(P.cur.from)+'-'+rpDm(P.cur.to)+') против '+rpName(P.pym)+' ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'). Реестр Маркета по '+rpDm(REPY.to)+'.'+REPY.to.slice(0,4)+'.';
  var fl=[];
  if(P.partial)fl.push('<b class="rp-warn">⚠ Месяц неполный:</b> реестр по '+rpDm(P.cur.to)+' (приходит с отставанием на день), сравнение с теми же числами прошлого месяца ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'), а не с целым месяцем. Удержания и премия кабинета обычно приходят в последние дни месяца - до них строка «Общие расходы» неполная.');
  var fbIn=(typeof ACC_FB!=='undefined'?ACC_FB:[]).filter(function(p){var m=p.split('/')[1];return m===P.ym||m===P.pym;});
  if(fbIn.length)fl.push('<b class="rp-warn">⚠ По выгрузке заказов, а не по реестру:</b> '+fbIn.join(', ')+' - штуки и платёж этих месяцев с отчётом о платежах могут не совпасть.');
  if(cur.bad||prev.bad)fl.push('<b class="rp-dn">⚠ Ошибка сборки: зеркала + мебель не равны ИТОГО «Начислено».</b> Цифры блока 1 не использовать.');
  if(cur.badId||prev.badId)fl.push('<b class="rp-dn">⚠ Ошибка сборки: Начислено − Всего сборов не равно К выплате</b> (расхождение '+rpN(cur.badId?cur.idn:prev.idn)+' ₽ больше построчного округления).');
  else if(Math.round(cur.idn)||Math.round(prev.idn))fl.push('<span class="rp-mute">Начислено − Всего сборов расходится с «К выплате» на '+rpN(prev.idn)+' ₽ и '+rpN(cur.idn)+' ₽ - построчное округление до рубля, как в подсказке блока на «Деньгах».</span>');
  document.getElementById('rp-flags').innerHTML=fl.join('<br>')||'<span class="rp-mute">Пометок по данным нет.</span>';
  if(!gc||!gp){['rp-turn','rp-why','rp-why2','rp-cost','rp-ads','rp-dead'].forEach(function(id){document.getElementById(id).innerHTML='<div class="kt-note">нет данных за период</div>';});return;}
  // === 1. Оборот ===
  document.getElementById('rp-turn').innerHTML=rpTurnCard('Всего',gp.acc,gc.acc,gp.units,gc.units)+rpTurnCard('Зеркала',prev.g.mir.acc,cur.g.mir.acc,prev.g.mir.units,cur.g.mir.units)+rpTurnCard('Мебель',prev.g.fur.acc,cur.g.fur.acc,prev.g.fur.units,cur.g.fur.units);
  // === 2. Причины ===
  var fc={};for(var c1 in cur.fcat)fc[c1]=1;for(var c0 in prev.fcat)fc[c0]=1;
  var fl2=Object.keys(fc).map(function(c){var a1=(cur.fcat[c]||{}).acc||0,a0=(prev.fcat[c]||{}).acc||0;return {c:c,d:a1-a0};}).filter(function(o){return Math.round(o.d);}).sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
  var furExtra=fl2.length?'по группам мебели: '+fl2.map(function(o){return o.c+' '+(o.d>0?'+':'')+fmtRu(Math.round(o.d));}).join(', '):'';
  var mir=function(c){return c==='Зеркала';},fur=function(c){return c!=='Зеркала';},all=function(){return true;};
  document.getElementById('rp-why').innerHTML=
    rpWhyTurn('Оборот всего',gp.acc,gp.units,gc.acc,gc.units,cur,prev,all,'зеркала '+rpDTxt(cur.g.mir.acc-prev.g.mir.acc,true)+' ₽, мебель '+rpDTxt(cur.g.fur.acc-prev.g.fur.acc,true)+' ₽')
    +rpWhyTurn('Зеркала',prev.g.mir.acc,prev.g.mir.units,cur.g.mir.acc,cur.g.mir.units,cur,prev,mir,'')
    +rpWhyTurn('Мебель',prev.g.fur.acc,prev.g.fur.units,cur.g.fur.acc,cur.g.fur.units,cur,prev,fur,furExtra);
  var h2='<thead><tr><th>Статья</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">%</th><th>За счёт чего</th></tr></thead><tbody>';
  var tr2=function(lbl,vals,v0,v1,txt,inc,pct){var d=v1-v0;return '<tr><td>'+lbl+'</td>'+rpRtd(vals)+'<td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(d,inc)+'</td><td class="r">'+rpPctTxt(pct?pct(v1,v0):rpPct(v1,v0),inc)+'</td><td class="rp-txt">'+(txt.join('<br>')||'<span class="rp-mute">без изменений</span>')+'</td></tr>';};
  var upA=rpUnitsPrice(gp.acc,gp.units,gc.acc,gc.units),tA=[];
  if(upA)tA.push('штуки: '+rpN(gp.units)+' → '+rpN(gc.units)+' шт × прежняя цена '+rpN(upA.p0)+' ₽ = '+rpDTxt(upA.vol,true)+' ₽; цена (начислено на 1 шт): '+rpN(upA.p0)+' → '+rpN(upA.p1)+' ₽ × '+rpN(gc.units)+' шт = '+rpDTxt(upA.price,true)+' ₽; вместе '+rpDTxt(upA.vol+upA.price,true)+' ₽');
  tA.push('зеркала '+rpDTxt(cur.g.mir.acc-prev.g.mir.acc,true)+' ₽, мебель '+rpDTxt(cur.g.fur.acc-prev.g.fur.acc,true)+' ₽');
  var aPl=rpTopFilt(cur,prev,'acc',1,3,all),aMi=rpTopFilt(cur,prev,'acc',-1,3,all);
  if(aPl.length)tA.push(rpTop('выросло сильнее всего',aPl));if(aMi.length)tA.push(rpTop('снизилось сильнее всего',aMi));
  var tU=['зеркала '+rpN(prev.g.mir.units)+' → '+rpN(cur.g.mir.units)+' шт ('+rpDTxt(cur.g.mir.units-prev.g.mir.units,true)+'), мебель '+rpN(prev.g.fur.units)+' → '+rpN(cur.g.fur.units)+' шт ('+rpDTxt(cur.g.fur.units-prev.g.fur.units,true)+')'];
  var uPl=rpTopFilt(cur,prev,'units',1,3,all),uMi=rpTopFilt(cur,prev,'units',-1,3,all);
  if(uPl.length)tU.push(rpTop('выросло сильнее всего, шт',uPl));if(uMi.length)tU.push(rpTop('снизилось сильнее всего, шт',uMi));
  h2+=tr2('Начислено (оборот), ₽',R.map(function(r){return rpyVal(r.calc.grand,'acc');}),gp.acc,gc.acc,tA,true)
    +tr2('Продано за вычетом возвратов, шт',R.map(function(r){return rpyVal(r.calc.grand,'units');}),gp.units,gc.units,tU,true,function(c,p){return p?(c-p)/Math.abs(p)*100:null;});
  RPY_LINES.forEach(function(L){var k=L[0],inc=L[2]>0;if(k==='acc'||L[5])return;
    var v0=rpyVal(gp,k),v1=rpyVal(gc,k),d=v1-v0,txt=[];
    var vr=rpVolRate(v0,gp.acc,v1,gc.acc);
    if(vr&&Math.round(d)&&k!=='gen'&&k!=='netAll')txt.push('объём: Начислено '+(gc.acc>=gp.acc?'выросло':'упало')+' на '+fmtRu(Math.round(Math.abs(gc.acc-gp.acc)))+' ₽ × прежняя доля статьи '+rpSh(vr.r0,1)+' = '+rpDTxt(vr.vol,null)+' ₽; ставка: доля '+rpSh(vr.r0,1)+' → '+rpSh(vr.r1,1)+' × Начислено '+rpN(gc.acc)+' ₽ = '+rpDTxt(vr.rate,null)+' ₽; вместе '+rpDTxt(vr.vol+vr.rate,null)+' ₽');
    if(L[3]){var pl=rpTopFilt(cur,prev,k,1,3,all),mi=rpTopFilt(cur,prev,k,-1,3,all);
      if(pl.length)txt.push(rpTop('выросло сильнее всего',pl));if(mi.length)txt.push(rpTop('снизилось сильнее всего',mi));}
    if(k==='gen')txt.push('удержания '+rpN(gp.acct)+' → '+rpN(gc.acct)+' ₽, премия '+rpN(gp.prem)+' → '+rpN(gc.prem)+' ₽');
    h2+='<tr><td>'+L[1]+'</td>'+rpRtd(R.map(function(r){return rpyVal(r.calc.grand,k);}))+'<td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(d,inc)+'</td><td class="r">'+rpPctTxt(rpPct(v1,v0),inc)+'</td><td class="rp-txt">'+(txt.join('<br>')||'<span class="rp-mute">без изменений</span>')+'</td></tr>';});
  document.getElementById('rp-why2').innerHTML=h2+'</tbody>';
  // === 3. Затраты площадки и полная аналитика ===
  var h3='<thead><tr><th>Статья</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">Отклонение, %</th><th class="r">Доля от начисл., было</th><th class="r">Доля, стало</th></tr></thead><tbody>';
  var row3=function(lbl,fn,inc,sub,strong,noSh){var v0=fn(gp),v1=fn(gc),pc=noSh?(v0?(v1-v0)/Math.abs(v0)*100:null):rpPct(v1,v0);return '<tr'+(sub?' class="rp-sub"':'')+(strong?' style="font-weight:800"':'')+'><td>'+lbl+'</td>'+rpRtd(R.map(function(r){return r.calc.grand?fn(r.calc.grand):null;}))+'<td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(v1-v0,inc)+'</td><td class="r">'+rpPctTxt(pc,inc)+'</td><td class="r">'+(noSh?'':rpSh(v0,gp.acc))+'</td><td class="r">'+(noSh?'':rpSh(v1,gc.acc))+'</td></tr>';};
  RPY_LINES.forEach(function(L){var k=L[0];h3+=row3(L[1],function(t){return rpyVal(t,k);},L[2]>0,!!L[5],!!L[4]);});
  h3+=row3('Продано за вычетом возвратов, шт',function(t){return t.units;},true,false,false,true);
  h3+=row3('Баллы Маркета: начислено баллами (справочно, в оборот не входят)',function(t){return t.ptsIn;},true,true,false);
  h3+=row3('Баллы Маркета: списано (софинансирование скидок, справочно)',function(t){return -t.ptsOut;},false,true,false);
  var rf1=function(v){return String(Math.round(v*10)/10).replace('.',',');};
  var rent=function(t){return t&&t.amount?t.netAll/t.amount*100:null;};var rp=rent(gp),rc=rent(gc);
  h3+='<tr><td>Рентабельность (чистая с общими расходами / К выплате)</td>'+rpRtd(R.map(function(r){return rent(r.calc.grand);}),function(v){return rf1(v)+'%';})+'<td class="r">'+(rp==null?'—':rf1(rp)+'%')+'</td><td class="r">'+(rc==null?'—':rf1(rc)+'%')+'</td><td class="r">'+((rp==null||rc==null)?'—':((rc-rp>0?'+':'')+rf1(rc-rp)+' п.'))+'</td><td></td><td></td><td></td></tr>';
  document.getElementById('rp-cost').innerHTML=h3+'</tbody>';
  // === 4. Реклама ===
  rpyAds(P,cur,prev,R);
  // === 5. Непродаваемые ===
  rpyDead(P,cur);
}
function rpyAds(P,cur,prev,R){
  var h='<thead><tr><th>Показатель</th>'+rpRth(R)+'<th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(P.ym)+'</th><th class="r">Отклонение</th><th class="r">%</th></tr></thead><tbody>';
  var rf=function(v){return String(Math.round(v*100)/100).replace('.',',');};
  // fn(c) - значение по расчёту месяца c (rpyCalc); null - «нет данных», не 0.
  var row=function(l,fn,inc,sub,fmt){var v0=fn(prev),v1=fn(cur),f=fmt||rpN,d=(v0==null||v1==null)?null:v1-v0;
    return '<tr'+(sub?' class="rp-sub"':'')+'><td>'+l+'</td>'+rpRtd(R.map(function(r){return fn(r.calc);}),f)+'<td class="r">'+(v0==null?'<span class="rp-mute">нет данных</span>':f(v0))+'</td><td class="r">'+(v1==null?'<span class="rp-mute">нет данных</span>':f(v1))+'</td><td class="r">'+(d==null?'—':(fmt?((d>0?'+':'')+rf(d)):rpDTxt(d,inc)))+'</td><td class="r">'+(d==null?'—':rpPctTxt(fmt?(v0?(v1-v0)/Math.abs(v0)*100:null):rpPct(v1,v0),inc))+'</td></tr>';};
  var g=function(c){return c.grand;};
  h+=row('Расход на продвижение всего (отчёт по взаиморасчётам)',function(c){return g(c)?g(c).mpromo:null;},false,false);
  h+=row('зеркала',function(c){return g(c)?c.mir.promo:null;},false,true);
  h+=row('мебель',function(c){return g(c)?c.fur.promo:null;},false,true);
  h+=row('Заказанный оборот магазина (по дате заказа)',function(c){return g(c)?g(c).gmv:null;},true,false);
  h+=row('ДРР к заказанному обороту, %',function(c){return (g(c)&&g(c).gmv)?g(c).mpromo/g(c).gmv*100:null;},false,false,rf);
  h+=row('Доля продвижения от «Начислено», %',function(c){return (g(c)&&g(c).acc)?g(c).mpromo/g(c).acc*100:null;},false,true,rf);
  h+=row('Выручка рекламных заказов',function(){return null;},true,false);
  h+=row('Окупаемость, ₽ на 1 ₽',function(){return null;},true,false,rf);
  document.getElementById('rp-ads').innerHTML=h+'</tbody>';
  document.getElementById('rp-ads-note').innerHTML='Выручку рекламных заказов и окупаемость не считаем: статистика рекламы Маркета не подключена (нет данных, а не 0). Зеркала и мебель - по артикулу проводки «Продвижение». ДРР сравнивает расход по дате транзакции с заказами по дате заказа - базисы разные, на коротком окне это даёт сдвиг.';
}
// === 5. Непродаваемые (ответ 4а: правила и пороги OZON [ГИПОТЕЗА]) ===
var RPY_DEAD_DAYS=60,RPY_DROP_DAYS=90;
function rpyAddD(d,n){return new Date(Date.parse(d+'T00:00Z')+n*86400000).toISOString().slice(0,10);}
function rpyDead(P,cur){
  var to=P.cur.to,ym=P.ym,start=rpyAddD(to,-(RPY_DEAD_DAYS-1)),el=document.getElementById('rp-dead');
  if(!REPY.viewsFrom||REPY.viewsFrom>P.cur.to){el.innerHTML='<div class="kt-note">Показов по товарам за '+rpName(ym)+' нет: отчёт показов Маркета собирается с '+(REPY.viewsFrom?rpDm(REPY.viewsFrom)+'.'+REPY.viewsFrom.slice(0,4):'—')+'.</div>';return;}
  var last=function(sk){var a=REPY.ord[sk]||[],l='';for(var i=0;i<a.length;i++){if(a[i]>to)break;l=a[i];}return l;};
  var grp={mir:[],fur:[]},ctrs={mir:[],fur:[]};
  for(var sk in REPY.views){var e=REPY.views[sk],m=e.m[ym];if(!m||!m[0])continue;var g=(e.cat==='Зеркала')?'mir':'fur';
    if(m[0]>=RP_LOW_VIEWS)ctrs[g].push(m[1]/m[0]);
    var lo=last(sk);if(lo&&lo>=start)continue;
    grp[g].push({sk:sk,nm:e.nm,v:m[0],pdp:m[1],cart:m[2],last:lo||null});}
  var med=function(a){if(!a.length)return null;a=a.slice().sort(function(x,y){return x-y;});var k=Math.floor(a.length/2);return a.length%2?a[k]:(a[k-1]+a[k])/2;};
  var pc=function(v){return (Math.round(v*1000)/10).toString().replace('.',',')+'%';};
  var html='';
  [['mir','Зеркала'],['fur','Мебель']].forEach(function(G){var k=G[0],arr=grp[k].sort(function(a,b){return b.v-a.v;}),top=arr.slice(0,5),mc=med(ctrs[k]);
    var h='<h4 style="margin:12px 0 6px">'+G[1]+' <span class="rp-mute" style="font-weight:400">- всего товаров с показами и без заказов '+RPY_DEAD_DAYS+' дн: '+arr.length+'; медиана доли заходов в группе '+(mc==null?'—':pc(mc))+'</span></h4>';
    if(!top.length){html+=h+'<div class="kt-note">нет таких товаров</div>';return;}
    h+='<div class="kt-scroll"><table class="kt-table rp-dead"><thead><tr><th>Артикул</th><th>Название</th><th class="r">Показы</th><th class="r">Заходы в карточку</th><th class="r">Корзины</th><th>Последний заказ</th><th class="r">Хранение Маркета за месяц, ₽</th><th>Причина</th><th>Действие</th></tr></thead><tbody>';
    top.forEach(function(x){
      var r=cur.rows[x.sk],sto=r?-r.storage:0;
      var days=x.last?rpDays(x.last,to):null,ctr=x.v?x.pdp/x.v:0,why,act;
      if(days==null)days=rpDays(REPY.ordFrom,to); // заказов не было с начала выгрузки - не меньше этого
      if(days>=RPY_DROP_DAYS&&sto>0){why='нет заказов '+days+' дн, Маркет берёт за хранение';act='Снятие с площадки';}
      else if(x.v<RP_LOW_VIEWS){why='карточку почти не показывают: '+x.v+' показов за месяц';act='Перезалив карточки';}
      else if(mc!=null&&ctr<mc/2){why='показы есть, в карточку не заходят: '+pc(ctr)+' при медиане группы '+pc(mc);act='Перезалив карточки (фото, заголовок)';}
      else if(!x.cart){why='заходят ('+x.pdp+'), но не кладут в корзину';act='Выкуп (первые отзывы, позиция) или проверка цены';}
      else {why='кладут в корзину ('+x.cart+'), но не заказывают';act='Выкуп или проверка цены и срока доставки';}
      if(days>=RPY_DROP_DAYS&&sto<=0&&act!=='Снятие с площадки')act+='; если не поможет - снятие с площадки ('+(x.last?days+' дн без заказов':'заказов не было с '+rpDm(REPY.ordFrom)+'.'+REPY.ordFrom.slice(0,4))+')';
      h+='<tr><td><b>'+x.sk+'</b></td><td title="'+String(x.nm).replace(/"/g,'&quot;')+'" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(x.nm)+'</td><td class="r">'+fmtRu(x.v)+'</td><td class="r">'+fmtRu(x.pdp)+' ('+pc(ctr)+')</td><td class="r">'+fmtRu(x.cart)+'</td><td>'+(x.last?rpDm(x.last)+'.'+x.last.slice(0,4)+' ('+days+' дн)':'не было с '+rpDm(REPY.ordFrom)+'.'+REPY.ordFrom.slice(0,4))+'</td><td class="r">'+(Math.round(sto)?fmtRu(Math.round(sto)):'—')+'</td><td class="rp-txt">'+why+'</td><td class="rp-txt"><b>'+act+'</b></td></tr>';});
    html+=h+'</tbody></table></div>';});
  var agg=REPY.aggFrom&&REPY.aggTo.slice(0,7)===ym&&REPY.aggFrom.slice(0,7)!==ym;
  html+='<div class="kt-note" style="margin-top:8px">Правило [ГИПОТЕЗА], пороги как у ${KEEP_OZON}: 1) нет заказов '+RPY_DROP_DAYS+'+ дн и Маркет берёт за хранение - снятие с площадки; 2) меньше '+RP_LOW_VIEWS+' показов за месяц - перезалив карточки; 3) доля заходов в карточку меньше половины медианы группы - перезалив (фото, заголовок); 4) заходят, но корзин нет - выкуп или проверка цены; 5) корзины есть, заказов нет - выкуп или проверка цены и срока доставки. Хранение - статья «Хранение» по артикулу за месяц. '
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
  var s4=[[{s:'4. Реклама: расход и ДРР',b:1}]].concat(rpxTable(document.getElementById('rp-ads')),[[]],rpxLines(document.getElementById('rp-ads-note')));
  var s5=[[{s:'5. Топ-5 непродаваемых',b:1}]];
  [].forEach.call(document.getElementById('rp-dead').children,function(ch){if(ch.tagName==='H4')s5.push([{s:ch.innerText,b:1}]);else if(ch.querySelector&&ch.querySelector('table'))s5=s5.concat(rpxTable(ch.querySelector('table')),[[]]);else s5=s5.concat(rpxLines(ch));});
  var one=s1.concat([[],[]],s2,[[],[]],s3,[[],[]],s4,[[],[]],s5);
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
