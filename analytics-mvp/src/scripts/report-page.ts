// Вкладка «Отчет» OZON - ежемесячный отчёт руководителю (Иван 01.10.2026: «1в 2а 3а 4 5а 6а»).
//
// Все деньги вкладки - из расчёта таблицы «Аналитика по артикулам (за выбранный период)» на «Деньгах»
// (функция skuAnalyticsData в коде страницы «Деньги»): страница отчёта несёт тот же код и те же данные,
// поэтому ИТОГО отчёта за месяц равно ИТОГО таблицы за тот же месяц. Здесь только:
//   1) серверная подготовка данных, которых на «Деньгах» нет (показы по артикулам, реклама из
//      Performance API, выручка заказов «за заказ», типы начислений кабинета);
//   2) клиентский код блоков отчёта (REPORT_JS).
// Решения Ивана 01.10: оборот = «Начислено» по дате начисления (1в); период - месяц к прошлому месяцу,
// незакрытый месяц к равному числу дней прошлого (2а); мебель = всё, кроме зеркал (3а); причины - по
// каждой статье дохода и расхода «за счёт чего» (4); реклама - расход, доход, окупаемость = доход /
// расход и ДРР (5а); топ-5 непродаваемых - показы в месяце и 0 заказов за 60 дней, причина и действие
// по правилу (6а). Спека: knowledge/semantic/metrics/ozon-monthly-report.yaml.
import { readFileSync } from "node:fs";

type Ctx = {
  dp: (f: string) => string;
  maxD: string;
  finCut: string;
  viewRows: any[];
  catOf: (sku: string) => string;
  offerOf: (sku: string) => string;
  skuName: Record<string, string>;
  gmvOf: (d: string) => number; // заказанный оборот дня (как ДРР на «Маркетинге»)
};

const readNd = (p: string): any[] => {
  try { return readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00Z") + n * 86400000).toISOString().slice(0, 10);

// Кампания «за заказ» узнаётся по названию: «Оплата за заказ - все товары» и подобные. Проверено
// 01.10 на ads_daily: расход таких кампаний за июль-сентябрь равен типу начисления Promotion
// (1 185 190 / 1 097 160 / 786 335 против 1 192 279 / 1 097 161 / 786 334), остальных - PayPerClick.
export const isCpoCampaign = (off: string) => /за заказ/i.test(String(off || ""));

export function reportData(ctx: Ctx) {
  const { dp, maxD } = ctx;
  const from = addDays(maxD.slice(0, 7) + "-01", -200).slice(0, 7) + "-01"; // ~6 месяцев назад
  // 1. Показы, заходы в карточку и корзины по артикулу по месяцам (sku_views, все дни, включая дни
  //    без продаж). Только артикулы с показами - для блока «не продаются».
  //    first - первый день с показами за всю историю: товар, который показывается меньше 60 дней
  //    (новая карточка), в «не продаются» не попадает (01.10: PROFIX с показами с 02.09 стоял бы там).
  const first: Record<string, string> = {};
  for (const r of ctx.viewRows) { const sk = String(r.sku || ""), d = String(r.date || ""); if (sk && Number(r.views) > 0 && (!first[sk] || d < first[sk])) first[sk] = d; }
  const views: Record<string, { off: string; nm: string; cat: string; first: string; m: Record<string, number[]> }> = {};
  for (const r of ctx.viewRows) {
    const d = String(r.date || ""); if (d < from || d > maxD) continue;
    const sk = String(r.sku || ""); if (!sk) continue;
    const v = Number(r.views) || 0, pdp = Number(r.pdp) || 0, cart = Number(r.cart) || 0;
    if (!v && !pdp && !cart) continue;
    const e = (views[sk] ||= { off: ctx.offerOf(sk), nm: String(ctx.skuName[sk] || r.name || sk).slice(0, 70), cat: ctx.catOf(sk) || "Прочее", first: first[sk] || d, m: {} });
    const a = (e.m[d.slice(0, 7)] ||= [0, 0, 0]); a[0]! += v; a[1]! += pdp; a[2]! += cart;
  }
  // 2. Реклама из Performance API по дням: [d, расход за клик, выручка заказов за клик, заказы за клик,
  //    расход за заказ]. Выручку «за заказ» API не отдаёт (om = 0 у таких кампаний) - она ниже из выгрузки.
  const adsDay: Record<string, number[]> = {};
  for (const r of readNd(dp("ads_daily.ndjson"))) {
    const d = String(r.d); if (d < from || d > maxD) continue;
    const a = (adsDay[d] ||= [0, 0, 0, 0]);
    if (isCpoCampaign(r.off)) a[3]! += Number(r.sp) || 0;
    else { a[0]! += Number(r.sp) || 0; a[1]! += Number(r.om) || 0; a[2]! += Number(r.o) || 0; }
  }
  const ads = Object.keys(adsDay).sort().map((d) => [d, ...adsDay[d]!.map((x) => Math.round(x))]);
  // 3. «Оплата за заказ»: расход и выручка заказов по дате заказа из ручной выгрузки кабинета
  //    (cpo_orders: номер заказа и списание). Выручка = выручка отправлений заказа без отменённых
  //    (orders_daily). Покрытие = даты выгрузки (cpo_sku_daily); вне их выручки «за заказ» нет.
  const postings: Record<string, any[]> = {};
  for (const r of readNd(dp("orders_daily.ndjson"))) { const o = String(r.order || ""); const k = o.slice(0, o.lastIndexOf("-")); (postings[k] ||= []).push(r); }
  const cpoDay: Record<string, number[]> = {};
  let cpoMiss = 0;
  for (const r of readNd(dp("cpo_orders.ndjson"))) {
    const ps = postings[String(r.order)]; if (!ps || !ps.length) { cpoMiss++; continue; }
    const d = String(ps[0].d);
    const a = (cpoDay[d] ||= [0, 0]); a[0]! += Number(r.sp) || 0;
    for (const p of ps) if (p.status !== "cancelled") a[1]! += Number(p.revenue) || 0;
  }
  const cpo = Object.keys(cpoDay).sort().map((d) => [d, Math.round(cpoDay[d]![0]!), Math.round(cpoDay[d]![1]!)]);
  let cpoFrom = "", cpoTo = "";
  for (const r of readNd(dp("cpo_sku_daily.ndjson"))) { const d = String(r.d); if (!cpoFrom || d < cpoFrom) cpoFrom = d; if (d > cpoTo) cpoTo = d; }
  // 4. Реклама за клик по категориям (ads_attr_daily: расход и выручка заказов по артикулу).
  //    [d, зеркала расход, зеркала выручка, мебель расход, мебель выручка].
  const catDay: Record<string, number[]> = {};
  for (const r of readNd(dp("ads_attr_daily.ndjson"))) {
    const d = String(r.d); if (d < from || d > maxD) continue;
    const mir = ctx.catOf(String(r.sku)) === "Зеркала";
    const a = (catDay[d] ||= [0, 0, 0, 0]);
    a[mir ? 0 : 2]! += Number(r.sp) || 0; a[mir ? 1 : 3]! += Number(r.om) || 0;
  }
  const adsCat = Object.keys(catDay).sort().map((d) => [d, ...catDay[d]!.map((x) => Math.round(x))]);
  // 5. Заказанный оборот по дням (знаменатель ДРР, как на «Маркетинге»).
  const gmv: any[] = [];
  for (let d = from; d <= maxD; d = addDays(d, 1)) gmv.push([d, Math.round(ctx.gmvOf(d))]);
  // 6. Типы начислений кабинета по месяцам (pnl_account_accrual_types.json) - «за счёт чего» у
  //    расходов, не привязанных к артикулу. Только целые месяцы: файл месячный.
  let types: any = {};
  try { types = JSON.parse(readFileSync(dp("pnl_account_accrual_types.json"), "utf-8")); } catch { types = {}; }
  console.log(`report: показы ${Object.keys(views).length} SKU, реклама ${ads.length} дн, «за заказ» по выгрузке ${cpoFrom || "-"}..${cpoTo || "-"} (${cpo.length} дн, без заказа в orders_daily ${cpoMiss}), типов начислений ${Object.keys(types).length}`);
  return { views, ads, cpo, cpoFrom, cpoTo, cpoMiss, adsCat, gmv, types, finCut: ctx.finCut };
}

export const REPORT_CSS = `<style>
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
@media (max-width:900px){.rp-cards{grid-template-columns:1fr}}
</style>`;

export const REPORT_BODY = `${REPORT_CSS}
<section class="card"><div class="card-h"><div><div class="card-title">Ежемесячный отчёт OZON</div><div class="card-sub" id="rp-sub"></div></div>
<select id="rp-month" style="background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd,#232a36);border-radius:7px;padding:4px 8px"></select></div>
<div id="rp-flags" class="kt-note"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">1. Оборот за месяц</div><div class="card-sub">Оборот = «Начислено» по дате начисления OZON (дата реализации), за вычетом возвратов - ИТОГО таблицы «Аналитика по артикулам (за выбранный период)» на «Деньгах» за те же даты. В «Начислено» входят баллы за скидки, которыми OZON доплачивает за покупателя. Мебель - всё, кроме зеркал.</div></div></div>
<div class="rp-cards" id="rp-turn"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">2. Причины роста или падения</div><div class="card-sub">Оборот раскладывается на «штуки» (сколько реализовано) и «цену» (начислено на 1 шт). Каждая статья расхода - на «объём» (изменился оборот при прежней доле статьи) и «ставку» (изменилась доля статьи от оборота). Сумма двух частей = отклонение. Ниже - артикулы с наибольшим вкладом в отклонение. Это разложение цифр, а не доказанная причина.</div></div></div>
<div id="rp-why"></div>
<div class="kt-scroll" style="margin-top:10px"><table class="kt-table" id="rp-why2"></table></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">3. Затраты площадки и полная аналитика</div><div class="card-sub">Строки = столбцы ИТОГО таблицы «Аналитика по артикулам (за выбранный период)» на «Деньгах». «Затраты площадки» = «Всего сборов» (Начислено − К выплате). Доля = статья / Начислено.</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-cost"></table></div>
<div id="rp-types" class="kt-note" style="margin-top:8px"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">4. Реклама: расход, доход, окупаемость</div><div class="card-sub">Расход и выручка рекламных заказов - статистика рекламного кабинета OZON (Performance API) по дате. Окупаемость = выручка рекламных заказов / расход (сколько рублей выручки на 1 ₽ рекламы). ДРР = расход / весь заказанный оборот магазина, как на «Маркетинге». Для сверки - расход по начислениям OZON (дата начисления).</div></div></div>
<div class="kt-scroll"><table class="kt-table" id="rp-ads"></table></div>
<div id="rp-ads-note" class="kt-note" style="margin-top:8px"></div></section>
<section class="card"><div class="card-h"><div><div class="card-title">5. Топ-5 непродаваемых: зеркала и мебель</div><div class="card-sub">Товар показывался в отчётном месяце, но не получил ни одного заказа (кроме отменённых) за 60 дней до конца периода. Порядок - по показам за месяц: чем больше видят и не берут, тем выше. Причина и действие - по правилу ниже таблиц, пороги [ГИПОТЕЗА].</div></div></div>
<div id="rp-dead"></div></section>`;

// Клиентский код. Работает поверх кода страницы «Деньги» (skuAnalyticsData, anDerive, anSum,
// fmtRu, AN_*): страница отчёта несёт его целиком. Без интерполяций сборщика внутри.
export const REPORT_JS = `
var RP_MON=['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
var RP_MON_R=['','января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function rpEnd(ym){var y=+ym.slice(0,4),m=+ym.slice(5,7);return ym+'-'+String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0');}
function rpPrevYm(ym){var y=+ym.slice(0,4),m=+ym.slice(5,7)-1;if(m<1){m=12;y--;}return y+'-'+String(m).padStart(2,'0');}
function rpDm(d){return d.slice(8,10)+'.'+d.slice(5,7);}
function rpName(ym){return RP_MON[+ym.slice(5,7)]+' '+ym.slice(0,4);}
// Периоды: месяц к прошлому месяцу; незакрытый месяц (данные не до последнего дня) - к тому же
// числу дней прошлого месяца (Иван 01.10, «2а»).
function rpPeriods(ym){
  var endM=rpEnd(ym),to=endM>MAXD?MAXD:endM,partial=to<endM;
  var p=rpPrevYm(ym),endP=rpEnd(p),pto=endP;
  if(partial){var dd=p+'-'+to.slice(8,10);pto=dd>endP?endP:dd;}
  return {cur:{from:ym+'-01',to:to},prev:{from:p+'-01',to:pto},partial:partial,ym:ym,pym:p};
}
function rpMonths(){var s={};for(var i=0;i<AN_ACCT.length;i++)s[String(AN_ACCT[i][0]).slice(0,7)]=1;
  return Object.keys(s).filter(function(m){return m+'-01'<=MAXD;}).sort().reverse().filter(function(m,i,a){return a.indexOf(rpPrevYm(m))>=0;});}
function rpN(v){return (v==null||!isFinite(v))?'—':fmtRu(Math.round(v));}
function rpPct(c,p){if(p==null||c==null||Math.abs(p)<1000)return null;return (c-p)/Math.abs(p)*100;}
function rpPctTxt(v,goodUp){if(v==null)return '<span class="rp-mute">нет базы</span>';var good=goodUp==null?null:(goodUp?v>=0:v<=0);var cls=good==null?'':(good?'rp-up':'rp-dn');return '<span class="'+cls+'">'+(v>0?'+':'')+(Math.round(v*10)/10).toString().replace('.',',')+'%</span>';}
function rpDTxt(v,goodUp){var good=goodUp==null?null:(goodUp?v>=0:v<=0);var cls=(good==null||!Math.round(v))?'':(good?'rp-up':'rp-dn');return '<span class="'+cls+'">'+(v>0?'+':'')+fmtRu(Math.round(v))+'</span>';}
function rpSh(v,b){return b?(Math.round(v/b*1000)/10).toString().replace('.',',')+'%':'—';}
// Строки таблицы по артикулам за период -> {sk: x} и итоги по группам «Зеркала» / «Мебель».
function rpCalc(per){
  var D=skuAnalyticsData(per),rows={},g={mir:{acc:0,units:0},fur:{acc:0,units:0}},fcat={};
  (D.cats||[]).forEach(function(c){var k=(c.cat==='Зеркала')?'mir':'fur';g[k].acc+=c.t.acc||0;g[k].units+=c.t.units||0;
    if(k==='fur')fcat[c.cat]={acc:c.t.acc||0,units:c.t.units||0};
    c.arr.forEach(function(x){rows[x.sk]=x;});});
  var gr=D.grand||null;
  // Инвариант: зеркала + мебель = ИТОГО «Начислено» (строка «Общие расходы» начислено не несёт).
  var bad=gr&&Math.abs(g.mir.acc+g.fur.acc-gr.acc)>1;
  return {D:D,rows:rows,g:g,fcat:fcat,grand:gr,bad:bad};
}
function rpTopFilt(cur,prev,key,sign,n,catFn){
  var ks={},out=[];for(var a in cur.rows)ks[a]=1;for(var b in prev.rows)ks[b]=1;
  for(var sk in ks){var xc=cur.rows[sk],xp=prev.rows[sk];var x=xc||xp;if(!catFn(x.cat))continue;var dv=((xc&&xc[key])||0)-((xp&&xp[key])||0);if(!Math.round(dv))continue;out.push({off:x.off||sk,nm:x.nm,d:dv});}
  out.sort(function(a,b){return sign*(b.d-a.d);});return out.filter(function(o){return sign>0?o.d>0:o.d<0;}).slice(0,n);
}
function rpList(arr){return arr.map(function(o){return '<b>'+o.off+'</b> '+(o.d>0?'+':'')+fmtRu(Math.round(o.d));}).join(', ');}
// «Штуки и цена»: Δ = (u1-u0)·p0 + (p1-p0)·u1, сумма частей = Δ (без остатка).
function rpUnitsPrice(a0,u0,a1,u1){
  if(!u0||!u1)return null;var p0=a0/u0,p1=a1/u1;return {p0:p0,p1:p1,vol:(u1-u0)*p0,price:(p1-p0)*u1};
}
// «Объём и ставка» статьи s от оборота A: Δs = ΔA·r0 + Δr·A1.
function rpVolRate(s0,a0,s1,a1){if(!a0||!a1)return null;var r0=s0/a0,r1=s1/a1;return {r0:r0,r1:r1,vol:(a1-a0)*r0,rate:(r1-r0)*a1};}
function rpTurnCard(title,c0,c1,u0,u1){
  var d=c1-c0,pc=rpPct(c1,c0),pu=u0?(u1-u0)/u0*100:null; // штуки: база в единицах, порог 1000 ₽ не для них
  return '<div class="rp-card"><h4>'+title+'</h4><div class="rp-big">'+rpN(c1)+' ₽</div>'
    +'<div>'+rpPctTxt(pc,true)+' к прошлому ('+rpN(c0)+' ₽), '+rpDTxt(d,true)+' ₽</div>'
    +'<div class="rp-mute" style="margin-top:4px">реализовано '+rpN(u1)+' шт против '+rpN(u0)+' ('+(pu==null?'нет базы':(pu>0?'+':'')+Math.round(pu)+'%')+')</div></div>';
}
function rpWhyTurn(title,a0,u0,a1,u1,cur,prev,catFn,extra){
  var d=a1-a0,up=rpUnitsPrice(a0,u0,a1,u1),li=[];
  li.push('<b>'+title+'</b>: '+rpDTxt(d,true)+' ₽ ('+rpPctTxt(rpPct(a1,a0),true)+')');
  if(up){li.push('за счёт штук: '+rpN(u0)+' → '+rpN(u1)+' шт, '+rpDTxt(up.vol,true)+' ₽');
    li.push('за счёт цены (начислено на 1 шт): '+rpN(up.p0)+' → '+rpN(up.p1)+' ₽, '+rpDTxt(up.price,true)+' ₽');}
  else li.push('<span class="rp-mute">штук в одном из месяцев нет - разложить на штуки и цену нельзя</span>');
  if(extra)li.push(extra);
  var plus=rpTopFilt(cur,prev,'acc',1,5,catFn),minus=rpTopFilt(cur,prev,'acc',-1,5,catFn);
  if(plus.length)li.push('больше всего прибавили: '+rpList(plus));
  if(minus.length)li.push('больше всего потеряли: '+rpList(minus));
  return '<div style="margin:8px 0"><ul class="rp-why">'+li.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></div>';
}
// Статьи полной аналитики (столбцы ИТОГО таблицы «Аналитика по артикулам»). sign: +1 доход, -1 расход.
var RP_LINES=[
  ['acc','Начислено (оборот)',1,1],['com','Комиссия',-1,1],['del','Логистика',-1,1],['acq','Эквайринг',-1,1],['sto','Хранение',-1,1],
  ['oth','Прочие',-1,1],['adv','Реклама (разнесена по артикулам)',-1,1],['fees','Всего сборов = затраты площадки',-1,0],['amt','К выплате',1,0],
  ['ship','Наша доставка (перевозчик)',-1,1],['dinc','Доставка покупателя (доход)',1,1],['cc','СС произв.',-1,1],['gp','Валовая прибыль',1,0],
  ['adm','АДМ 30%',-1,0],['tb','Реализовано (база налога)',1,1],['tax','Налоги 15%',-1,0],['net','Чистая прибыль',1,0]];
function rpVal(t,k){if(!t)return null;if(k==='fees'||k==='gp'||k==='adm'||k==='tax'||k==='net')return anDerive(t)[k];return t[k]||0;}
function rpRender(){
  var sel=document.getElementById('rp-month');var ym=sel.value;var P=rpPeriods(ym);
  var cur=rpCalc(P.cur),prev=rpCalc(P.prev);var gc=cur.grand,gp=prev.grand;
  document.getElementById('rp-sub').innerHTML='Отчётный месяц: <b>'+rpName(ym)+'</b> ('+rpDm(P.cur.from)+'-'+rpDm(P.cur.to)+') против '+rpName(P.pym)+' ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'). Данные OZON по '+rpDm(MAXD)+'.'+MAXD.slice(0,4)+'.';
  // Пометки о данных: неполный месяц, смена источника, дыры отчёта о реализации, инварианты.
  var fl=[];
  if(P.partial)fl.push('<b class="rp-warn">⚠ Месяц неполный:</b> данные по '+rpDm(P.cur.to)+', сравнение с теми же числами прошлого месяца ('+rpDm(P.prev.from)+'-'+rpDm(P.prev.to)+'), а не с целым месяцем.');
  if(REP.finCut&&P.prev.from<REP.finCut&&P.cur.to>=REP.finCut)fl.push('<b class="rp-warn">⚠ Источник денег по артикулам сменился с '+rpDm(REP.finCut)+':</b> до этой даты - транзакции OZON (отключены 08.09), после - отчёт о реализации за день плюс сборы по дням. Часть отклонения может дать смена источника.');
  var md=AN_RD_MISS.filter(function(d){return (d>=P.cur.from&&d<=P.cur.to)||(d>=P.prev.from&&d<=P.prev.to);});
  if(md.length)fl.push('<b class="rp-warn">⚠ Нет отчёта о реализации за день</b> за '+md.map(rpDm).join(', ')+': «Начислено» за эти дни не посчитано, сборы стоят.');
  if(cur.bad||prev.bad)fl.push('<b class="rp-dn">⚠ Ошибка сборки: зеркала + мебель не равны ИТОГО «Начислено».</b> Цифры блока 1 не использовать.');
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
  // Каждая статья: отклонение, объём/ставка, главные артикулы и кабинетная часть.
  var acP=prev.D.acct||{},acC=cur.D.acct||{};
  var h2='<thead><tr><th>Статья</th><th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">%</th><th>За счёт чего</th></tr></thead><tbody>';
  RP_LINES.forEach(function(L){var k=L[0],inc=L[2]>0;if(k==='acc')return;
    var v0=rpVal(gp,k),v1=rpVal(gc,k),d=v1-v0;var txt=[];
    var vr=rpVolRate(v0,gp.acc,v1,gc.acc);
    if(vr&&Math.round(d)){txt.push('объём (оборот '+(gc.acc>=gp.acc?'вырос':'упал')+' при доле '+rpSh(vr.r0,1)+'): '+rpDTxt(vr.vol,null)+' ₽; ставка (доля '+rpSh(vr.r0,1)+' → '+rpSh(vr.r1,1)+'): '+rpDTxt(vr.rate,null)+' ₽');}
    if(L[3]){var pl=rpTopFilt(cur,prev,k,1,3,all),mi=rpTopFilt(cur,prev,k,-1,3,all);
      if(pl.length)txt.push('выросло сильнее всего: '+rpList(pl));
      if(mi.length)txt.push('снизилось сильнее всего: '+rpList(mi));
      var ca=(acC[k]||0)-(acP[k]||0);if(Math.round(ca))txt.push('не по артикулам (строка «Общие расходы»): '+(ca>0?'+':'')+fmtRu(Math.round(ca)));}
    if((k==='adv'||k==='oth')&&rpAdsSum(P.prev).cpoCov!==rpAdsSum(P.cur).cpoCov)txt.push('<span class="rp-warn">реклама «за заказ» разнесена по артикулам только за даты ручной выгрузки ('+rpDm(REP.cpoFrom)+'-'+rpDm(REP.cpoTo)+'), вне их она в «Прочих» не по артикулам. Сравнивать рекламу - по строке «Реклама всего» в блоке 3.</span>');
    h2+='<tr><td>'+L[1]+'</td><td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(d,inc)+'</td><td class="r">'+rpPctTxt(rpPct(v1,v0),inc)+'</td><td class="rp-txt">'+(txt.join('<br>')||'<span class="rp-mute">без изменений</span>')+'</td></tr>';});
  document.getElementById('rp-why2').innerHTML=h2+'</tbody>';
  // === 3. Затраты площадки и полная аналитика ===
  var aBp=rpAcctSplit(P.prev),aBc=rpAcctSplit(P.cur);
  var h3='<thead><tr><th>Статья</th><th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(ym)+'</th><th class="r">Отклонение, ₽</th><th class="r">Отклонение, %</th><th class="r">Доля от начисл., было</th><th class="r">Доля, стало</th></tr></thead><tbody>';
  var row3=function(lbl,v0,v1,inc,sub,strong){var st=strong?' style="font-weight:800"':'';return '<tr'+(sub?' class="rp-sub"':'')+st+'><td>'+lbl+'</td><td class="r">'+rpN(v0)+'</td><td class="r">'+rpN(v1)+'</td><td class="r">'+rpDTxt(v1-v0,inc)+'</td><td class="r">'+rpPctTxt(rpPct(v1,v0),inc)+'</td><td class="r">'+rpSh(v0,gp.acc)+'</td><td class="r">'+rpSh(v1,gc.acc)+'</td></tr>';};
  RP_LINES.forEach(function(L){var k=L[0];var v0=rpVal(gp,k),v1=rpVal(gc,k);h3+=row3(L[1],v0,v1,L[2]>0,false,k==='fees'||k==='acc'||k==='net');
    if(k==='del'){h3+=row3('в т.ч. rFBS, сервис, страховка (кабинет)',-aBp.realfbs,-aBc.realfbs,false,true);}
    if(k==='oth'){h3+=row3('в т.ч. реклама, не разнесённая по артикулам',-(aBp.adv+gp.adv),-(aBc.adv+gc.adv),false,true);
      h3+=row3('в т.ч. штрафы и гибкий график',-aBp.fines,-aBc.fines,false,true);h3+=row3('в т.ч. бейдж, отзывы, Premium',-aBp.badge,-aBc.badge,false,true);h3+=row3('в т.ч. прочее кабинета',-aBp.other,-aBc.other,false,true);}
    if(k==='adv'){h3+=row3('Реклама всего (по артикулам + не разнесённая)',-aBp.adv,-aBc.adv,false,true);}
  });
  var rp=anDerive(gp).rent,rc=anDerive(gc).rent;
  var rf1=function(v){return String(Math.round(v*10)/10).replace('.',',');};
  h3+='<tr><td>Рентабельность (чистая / К выплате)</td><td class="r">'+(rp==null?'—':rf1(rp)+'%')+'</td><td class="r">'+(rc==null?'—':rf1(rc)+'%')+'</td><td class="r">'+((rp==null||rc==null)?'—':((rc-rp>0?'+':'')+rf1(rc-rp)+' п.'))+'</td><td></td><td></td><td></td></tr>';
  document.getElementById('rp-cost').innerHTML=h3+'</tbody>';
  // Типы начислений кабинета (только целые месяцы: файл месячный).
  var ty=document.getElementById('rp-types');
  if(!P.partial){var tl=[];for(var tn in REP.types){var t=REP.types[tn];var m1=(t.months||{})[ym]||0,m0=(t.months||{})[P.pym]||0;if(Math.round(m1-m0))tl.push({n:tn,c:t.cat,d:m1-m0,m0:m0,m1:m1});}
    tl.sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
    ty.innerHTML=tl.length?'<b>Расходы кабинета по типам начислений OZON</b> (за целые месяцы, знак минус = списание): '+tl.slice(0,8).map(function(o){return o.n+' '+fmtRu(Math.round(o.m0))+' → '+fmtRu(Math.round(o.m1))+' ('+(o.d>0?'+':'')+fmtRu(Math.round(o.d))+')';}).join('; '):'';}
  else ty.innerHTML='<span class="rp-mute">Типы начислений кабинета показываются только за целые месяцы.</span>';
  // === 4. Реклама ===
  rpAds(P,aBp,aBc);
  // === 5. Непродаваемые ===
  rpDead(P);
}
function rpAcctSplit(per){var a={adv:0,fines:0,realfbs:0,badge:0,delivery:0,other:0};for(var i=0;i<AN_ACCT.length;i++){var r=AN_ACCT[i];if(r[0]<per.from||r[0]>per.to)continue;a.adv+=r[1];a.fines+=r[2];a.realfbs+=r[3];a.badge+=r[4];a.delivery+=r[5];a.other+=r[6];}return a;}
function rpAdsSum(per){
  var s={cpcSp:0,cpcOm:0,cpcO:0,cpoSp:0,cpoApiSp:0,cpoRev:0,gmv:0,mirSp:0,mirOm:0,furSp:0,furOm:0,cpoCov:false};
  REP.ads.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;s.cpcSp+=r[1];s.cpcOm+=r[2];s.cpcO+=r[3];s.cpoApiSp+=r[4];});
  REP.cpo.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;s.cpoSp+=r[1];s.cpoRev+=r[2];});
  REP.gmv.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;s.gmv+=r[1];});
  REP.adsCat.forEach(function(r){if(r[0]<per.from||r[0]>per.to)return;s.mirSp+=r[1];s.mirOm+=r[2];s.furSp+=r[3];s.furOm+=r[4];});
  // Выручка «за заказ» есть, только если период целиком внутри дат ручной выгрузки.
  s.cpoCov=!!(REP.cpoFrom&&per.from>=REP.cpoFrom.slice(0,7)+'-01'&&per.to<=REP.cpoTo);
  return s;
}
function rpRoas(om,sp){return sp?(Math.round(om/sp*100)/100).toString().replace('.',','):'—';}
function rpAds(P,aBp,aBc){
  var a=rpAdsSum(P.prev),b=rpAdsSum(P.cur);
  var h='<thead><tr><th>Показатель</th><th class="r">'+rpName(P.pym)+'</th><th class="r">'+rpName(P.ym)+'</th><th class="r">Отклонение</th><th class="r">%</th></tr></thead><tbody>';
  var row=function(l,v0,v1,inc,sub,fmt){var f=fmt||rpN;var d=(v0==null||v1==null)?null:v1-v0;return '<tr'+(sub?' class="rp-sub"':'')+'><td>'+l+'</td><td class="r">'+(v0==null?'<span class="rp-mute">нет данных</span>':f(v0))+'</td><td class="r">'+(v1==null?'<span class="rp-mute">нет данных</span>':f(v1))+'</td><td class="r">'+(d==null?'—':(fmt?((d>0?'+':'')+String(Math.round(d*100)/100).replace('.',',')):rpDTxt(d,inc)))+'</td><td class="r">'+(d==null?'—':rpPctTxt(fmt?(v0?(v1-v0)/Math.abs(v0)*100:null):rpPct(v1,v0),inc))+'</td></tr>';}; // коэффициенты: порог 1000 ₽ не для них
  var rf=function(v){return String(Math.round(v*100)/100).replace('.',',');};
  var spA=a.cpcSp+a.cpoApiSp,spB=b.cpcSp+b.cpoApiSp;
  h+=row('Расход всего (рекламный кабинет)',spA,spB,false,false);
  h+=row('за клик',a.cpcSp,b.cpcSp,false,true);h+=row('за заказ',a.cpoApiSp,b.cpoApiSp,false,true);
  h+=row('Расход по начислениям OZON (финансы, дата начисления)',-aBp.adv,-aBc.adv,false,true);
  h+=row('Выручка рекламных заказов за клик',a.cpcOm,b.cpcOm,true,false);
  h+=row('Выручка заказов «за заказ»',a.cpoCov?a.cpoRev:null,b.cpoCov?b.cpoRev:null,true,false);
  h+=row('Окупаемость за клик, ₽ на 1 ₽',a.cpcSp?a.cpcOm/a.cpcSp:null,b.cpcSp?b.cpcOm/b.cpcSp:null,true,false,rf);
  h+=row('Окупаемость «за заказ», ₽ на 1 ₽',(a.cpoCov&&a.cpoSp)?a.cpoRev/a.cpoSp:null,(b.cpoCov&&b.cpoSp)?b.cpoRev/b.cpoSp:null,true,false,rf);
  h+=row('Окупаемость всего, ₽ на 1 ₽',(a.cpoCov&&spA)?(a.cpcOm+a.cpoRev)/spA:null,(b.cpoCov&&spB)?(b.cpcOm+b.cpoRev)/spB:null,true,false,rf);
  h+=row('ДРР к заказанному обороту, %',a.gmv?spA/a.gmv*100:null,b.gmv?spB/b.gmv*100:null,false,false,rf);
  h+=row('Зеркала, за клик: расход',a.mirSp,b.mirSp,false,true);h+=row('Зеркала, за клик: выручка',a.mirOm,b.mirOm,true,true);h+=row('Зеркала, за клик: окупаемость',a.mirSp?a.mirOm/a.mirSp:null,b.mirSp?b.mirOm/b.mirSp:null,true,true,rf);
  h+=row('Мебель, за клик: расход',a.furSp,b.furSp,false,true);h+=row('Мебель, за клик: выручка',a.furOm,b.furOm,true,true);h+=row('Мебель, за клик: окупаемость',a.furSp?a.furOm/a.furSp:null,b.furSp?b.furOm/b.furSp:null,true,true,rf);
  document.getElementById('rp-ads').innerHTML=h+'</tbody>';
  var n=[];
  n.push('Выручку заказов «за заказ» рекламный кабинет OZON через API не отдаёт. Она берётся из ручной выгрузки заказов кабинета: есть за '+(REP.cpoFrom?rpDm(REP.cpoFrom)+'.'+REP.cpoFrom.slice(0,4)+'-'+rpDm(REP.cpoTo)+'.'+REP.cpoTo.slice(0,4):'—')+'. Для других месяцев нужна новая выгрузка, до неё окупаемость «за заказ» и общая не считаются.');
  var cov=function(s){return s.cpcSp?Math.round((s.mirSp+s.furSp)/s.cpcSp*100):0;};
  n.push('Зеркала и мебель - только реклама за клик, по артикулам из отчёта атрибуции: разнесено '+cov(a)+'% расхода за клик в прошлом периоде и '+cov(b)+'% в отчётном.');
  document.getElementById('rp-ads-note').innerHTML=n.join('<br>');
}
// === 5. Непродаваемые (Иван 01.10, «6а») ===
// Пороги правила [ГИПОТЕЗА]: мало показов - меньше 300 за месяц; в карточку не заходят - доля заходов
// меньше половины медианы своей группы (зеркала / мебель) за месяц; заходят, но не кладут в корзину -
// корзин 0; кладут, но не заказывают - корзины есть; снятие - 90+ дней без заказов и OZON берёт за
// хранение. Действия: перезалив карточки, выкуп, снятие с площадки.
var RP_LOW_VIEWS=300,RP_DEAD_DAYS=60,RP_DROP_DAYS=90;
function rpDays(a,b){return Math.round((Date.parse(b+'T00:00Z')-Date.parse(a+'T00:00Z'))/86400000);}
function rpDead(P){
  var to=P.cur.to,ym=P.ym,start=ad(to,-(RP_DEAD_DAYS-1));
  // Последний заказ (кроме отменённых) - по SKU и по артикулу: у одного товара бывает несколько SKU
  // (схемы FBO/FBS, перезалив), заказ любого из них - это продажа товара.
  var last={},lastOff={};
  for(var i=0;i<AN_ORDERS.length;i++){var o=AN_ORDERS[i];if(o.st==='cancelled'||o.d>to)continue;var sk=String(o.sk),of=String(o.off||'').toUpperCase();if(!last[sk]||o.d>last[sk])last[sk]=o.d;if(of&&(!lastOff[of]||o.d>lastOff[of]))lastOff[of]=o.d;}
  var grp={mir:[],fur:[]},ctrs={mir:[],fur:[]},fresh={mir:0,fur:0};
  for(var sk2 in REP.views){var e=REP.views[sk2],m=e.m[ym];if(!m||!m[0])continue;var g=(e.cat==='Зеркала')?'mir':'fur';
    if(m[0]>=RP_LOW_VIEWS)ctrs[g].push(m[1]/m[0]);
    var l1=last[sk2]||'',l2=lastOff[String(e.off||'').toUpperCase()]||'',lo=l1>l2?l1:l2;if(lo&&lo>=start)continue;
    if(e.first>start){fresh[g]++;continue;} // показывается меньше 60 дней - новая карточка, не «не продаётся»
    grp[g].push({sk:sk2,off:e.off,nm:e.nm,cat:e.cat,first:e.first,v:m[0],pdp:m[1],cart:m[2],last:lo||null});}
  var med=function(a){if(!a.length)return null;a=a.slice().sort(function(x,y){return x-y;});var k=Math.floor(a.length/2);return a.length%2?a[k]:(a[k-1]+a[k])/2;};
  var html='';
  [['mir','Зеркала'],['fur','Мебель']].forEach(function(G){var k=G[0],arr=grp[k].sort(function(a,b){return b.v-a.v;}),top=arr.slice(0,5),mc=med(ctrs[k]);
    var h='<h4 style="margin:12px 0 6px">'+G[1]+' <span class="rp-mute" style="font-weight:400">- всего товаров с показами и без заказов '+RP_DEAD_DAYS+' дн: '+arr.length+(fresh[k]?' (ещё '+fresh[k]+' новых карточек с показами меньше '+RP_DEAD_DAYS+' дн не считаем)':'')+'; медиана доли заходов в группе '+(mc==null?'—':(Math.round(mc*1000)/10).toString().replace('.',',')+'%')+'</span></h4>';
    if(!top.length){html+=h+'<div class="kt-note">нет таких товаров</div>';return;}
    h+='<div class="kt-scroll"><table class="kt-table rp-dead"><thead><tr><th>Артикул</th><th>Название</th><th class="r">Показы</th><th class="r">Заходы в карточку</th><th class="r">Корзины</th><th>Последний заказ</th><th class="r">Хранение OZON за месяц, ₽</th><th>Причина</th><th>Действие</th></tr></thead><tbody>';
    top.forEach(function(x){
      var sto=-(anSum(AN_STOSKU[x.sk],P.cur.from,P.cur.to,1)[0]||0);
      var days=rpDays(x.last||x.first,to);var ctr=x.v?x.pdp/x.v:0;var why,act;
      if(days>=RP_DROP_DAYS&&sto>0){why='нет заказов '+days+' дн, OZON берёт за хранение';act='Снятие с площадки';}
      else if(x.v<RP_LOW_VIEWS){why='карточку почти не показывают: '+x.v+' показов за месяц';act='Перезалив карточки';}
      else if(mc!=null&&ctr<mc/2){why='показы есть, в карточку не заходят: '+(Math.round(ctr*1000)/10).toString().replace('.',',')+'% при медиане группы '+(Math.round(mc*1000)/10).toString().replace('.',',')+'%';act='Перезалив карточки (фото, заголовок)';}
      else if(!x.cart){why='заходят ('+x.pdp+'), но не кладут в корзину';act='Выкуп (первые отзывы, позиция) или проверка цены';}
      else {why='кладут в корзину ('+x.cart+'), но не заказывают';act='Выкуп или проверка цены и срока доставки';}
      if(days>=RP_DROP_DAYS&&sto<=0&&act!=='Снятие с площадки')act+='; если не поможет - снятие с площадки ('+days+' дн без заказов)';
      h+='<tr><td><b>'+x.off+'</b></td><td title="'+String(x.nm).replace(/"/g,'&quot;')+'" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(x.nm)+'</td><td class="r">'+fmtRu(x.v)+'</td><td class="r">'+fmtRu(x.pdp)+' ('+(Math.round(ctr*1000)/10).toString().replace('.',',')+'%)</td><td class="r">'+fmtRu(x.cart)+'</td><td>'+(x.last?rpDm(x.last)+'.'+x.last.slice(0,4)+' ('+days+' дн)':'не было, показы с '+rpDm(x.first)+'.'+x.first.slice(0,4))+'</td><td class="r">'+(sto?fmtRu(sto):'—')+'</td><td class="rp-txt">'+why+'</td><td class="rp-txt"><b>'+act+'</b></td></tr>';});
    html+=h+'</tbody></table></div>';});
  html+='<div class="kt-note" style="margin-top:8px">Правило [ГИПОТЕЗА], пороги можно поменять: 1) нет заказов '+RP_DROP_DAYS+'+ дн и OZON берёт за хранение - снятие с площадки; 2) меньше '+RP_LOW_VIEWS+' показов за месяц - перезалив карточки; 3) доля заходов в карточку меньше половины медианы группы - перезалив (фото, заголовок); 4) заходят, но корзин нет - выкуп или проверка цены; 5) корзины есть, заказов нет - выкуп или проверка цены и срока доставки. Хранение - по начислениям OZON по артикулу (FBO); у товаров на своём складе (rFBS) его нет. Остатков по этим товарам в данных нет.</div>';
  document.getElementById('rp-dead').innerHTML=html;
}
var rpInited=false;
function rpInit(){if(rpInited)return;rpInited=true;var sel=document.getElementById('rp-month');var ms=rpMonths();
  sel.innerHTML=ms.map(function(m){return '<option value="'+m+'">'+rpName(m)+'</option>';}).join('');
  // По умолчанию - прошлый календарный месяц от даты просмотра (Иван 01.10, «2а»).
  var t=new Date(),pm=rpPrevYm(t.toISOString().slice(0,7));sel.value=(ms.indexOf(pm)>=0)?pm:ms[0];
  sel.onchange=rpRender;}
function render(){rpInit();rpRender();}
`;
