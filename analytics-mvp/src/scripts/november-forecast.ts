import {novemberPeriodAttrs} from './november-visibility.js';
import {readFileSync} from 'node:fs';
import {novemberPeriods,novemberGaugePeriods,periodProgress,periodWindow,unitPlan} from './november-periods.js';
import {NOVEMBER_GROWTH} from './november-growth.js';
type Goal = {units:{nov:{mid:number}};turn_mln:{nov:{mid:number}};pay_mln:{nov:{mid:number}}};
export type ForecastInput = {today:string;last:string;covered:Set<string>;units:Map<string,number>;revenue:Map<string,number>};
const fmt=(n:number,d=0)=>n.toLocaleString('ru-RU',{maximumFractionDigits:d});
export function novemberForecast(goal:Goal,input:ForecastInput) {
  if(input.today<'2026-11-01')return null;
  const target={units:goal.units.nov.mid,revenue:goal.turn_mln.nov.mid*1e6,payout:goal.pay_mln.nov.mid*1e6};
  if(Object.values(target).some(v=>!Number.isFinite(v)||v<=0))throw new Error('Invalid November forecast');
  const days=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
  const last=days.filter(d=>d<input.today&&d<=input.last).pop()??'';
  let units=0,revenue=0,complete=true;
  const points=days.map((day,i)=>{
    const closed=!!last&&day<=last;
    const have=closed&&input.covered.has(day);
    if(closed&&!have)complete=false;
    const u=have?(input.units.get(day)??0):null,r=have?(input.revenue.get(day)??0):null;
    if(u!=null&&(!Number.isFinite(u)||u<0))throw new Error('Invalid November units');
    if(r!=null&&(!Number.isFinite(r)||r<0))throw new Error('Invalid November revenue');
    if(have){units+=u!;revenue+=r!;}
    return {day,dailyUnits:u,dailyRevenue:r,units:have&&complete?units:null,revenue:have&&complete?revenue:null,unitsPlan:Math.round(target.units*(i+1)/30),revenuePlan:target.revenue*(i+1)/30};
  });
  const elapsed=last?Number(last.slice(8)):0;
  const expected=days.filter(d=>d<input.today).pop()??'';
  const stale=!!expected&&last<expected;
  return {today:input.today,target,days,points,last,elapsed,expected,stale,complete:!!last&&complete,units:last&&complete?units:null,revenue:last&&complete?revenue:null,
    coveredDays:days.filter(d=>d<=last&&input.covered.has(d)).length};
}
type Forecast=NonNullable<ReturnType<typeof novemberForecast>>;
function graph(f:Forecast,key:'units'|'revenue',title:string){
  f={...f,points:f.points.filter(p=>p.day<=f.expected)};
  if(!f.points.some(p=>p[key]!=null))return `<div class="nf-chart" id="nf-chart-${key}" hidden></div>`;
  const goalKey=key==='units'?'unitsPlan':'revenuePlan',scale=key==='units'?1:1e6;
  const values=f.points.flatMap(p=>p[key]==null?[p[goalKey]/scale]:[p[goalKey]/scale,p[key]!/scale]);
  const max=Math.max(...values)*1.08||1,W=660,H=230,L=55,R=18,T=15,B=28;
  const x=(i:number)=>L+(W-L-R)*i/Math.max(1,f.points.length-1),y=(v:number)=>H-B-v/scale/max*(H-T-B);
  const path=(k:typeof key|typeof goalKey)=>f.points.filter(p=>p[k]!=null).map((p,i)=>`${i?'L':'M'}${x(Number(p.day.slice(8))-1).toFixed(2)},${y(p[k]!).toFixed(2)}`).join(' ');
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}: ноябрь, накопительно"><title>${title}: ноябрь, накопительно. Пунктир — план; сплошная линия — факт закрытых дней.</title>`;
  for(let i=0;i<=4;i++){const v=max*i/4,yy=H-B-v/max*(H-T-B);svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#293744"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${fmt(v,key==='units'?0:1)}</text>`;}
  for(const i of [...new Set([0,...[6,13,20,29].filter(i=>i<f.points.length),Math.max(0,f.points.length-1)])])svg+=`<text x="${x(i)}" y="${H-7}" text-anchor="middle">${String(i+1).padStart(2,'0')}.11</text>`;
  svg+=`<path d="${path(goalKey)}" class="nf-goal"/><path d="${path(key)}" class="nf-fact"/>`;
  for(let i=0;i<f.points.length;i++){const p=f.points[i]!;if(p[key]!=null)svg+=`<circle tabindex="0" cx="${x(i)}" cy="${y(p[key]!)}" r="4" fill="#22d3ee"><title>${p.day}: факт ${fmt(p[key]!/scale,key==='units'?0:2)}, план ${fmt(p[goalKey]/scale,key==='units'?0:2)}</title></circle>`;}
  return `<div class="nf-chart" id="nf-chart-${key}"><h3>${title}</h3>${svg}</svg><div class="nf-legend">━ Факт закрытых дней <span>┄ План</span></div></div>`;
}
export function novemberForecastHtml(f:Forecast, body?:string){
  const initial=novemberWeeklyData(f),initialRow=initial.periods[initial.selected]!;
  const metric=(key:string,label:string)=>{
    const p=key==='units'?initialRow.units:key==='revenue'?initialRow.revenue:null;
    return `<div class="nf-metric" ${p?.fact==null?'hidden':''} data-metric="${key}" data-fact="${p?.fact??''}" data-target="${p?.planToDate??''}"><div class="nf-dial" id="nf-dial-${key}"><div class="g-t">${label}</div><div class="g-none">${p?.fact==null?'нет данных':fmt(p.fact)}</div><p>${p?.ratio==null?'Выполнение не рассчитано':fmt(p.ratio,1)+'% плана закрытых дней недели'}</p></div><p class="nf-caption" id="nf-note-${key}">Только закрытые дни выбранной недели.</p></div>`;
  };
  const weeks=novemberPeriods();
  const weeklyTable=`<div class="tbl-wrap full"><table class="gtbl single"><thead><tr><th>Неделя</th><th>Дней</th><th>Товары, шт.</th><th>Оборот, ₽</th><th>Чистая прибыль, ₽</th></tr></thead><tbody>${weeks.map(w=>`<tr ${novemberPeriodAttrs(w.from,f.today)}><td>${w.label}</td><td>${w.days}</td><td>${fmt(unitPlan(f.target.units,Number(w.from.slice(8)),Number(w.to.slice(8))),0)}</td><td>${fmt(f.target.revenue*w.days/30)}</td><td>${fmt(NOVEMBER_GROWTH.profit*w.days/30,2)}</td></tr>`).join('')}<tr><td>Ноябрь</td><td>30</td><td>${fmt(f.target.units)}</td><td>${fmt(f.target.revenue)}</td><td>${fmt(NOVEMBER_GROWTH.profit)}</td></tr></tbody></table></div><p class="nf-caption">Равномерный ориентир, не прогноз спроса. Рекламный лимит не задан. Прибыль предварительная; недельные суммы показаны с округлением, расчёт использует полную точность.</p>`;
  return `<details class="card tcard nf-plan" open id="november-plan"><summary class="chead"><span class="ctitle">Ноябрь: цель и наше движение</span><span class="chip chip-run">01–30.11.2026</span></summary>
<p class="sub">План роста от 03.11: 450 товаров и 30,6 млн ₽. Факт - по дате заказа, без известных отмен; количество товаров, не уникальных заказов.</p>
<div class="mrow-b nf-weeks" aria-label="Период спидометров">${novemberGaugePeriods().map(w=>`<button type="button" class="mb" data-nov-week="${w.id}" aria-pressed="false">${w.label}</button>`).join('')}</div><p class="nf-caption" id="november-week-state"></p><p class="nf-caption" id="november-week-issues" role="status"></p><p class="nf-caption" id="november-finance-issue" role="status"></p>
<div class="pt-gauges nf-metrics">${metric('units','Заказы магазина')}${metric('revenue','Оборот магазина')}${metric('ads','Расход на рекламу')}${metric('net','Чистая прибыль')}</div>
<details class="fold"><summary>План по неделям</summary>${weeklyTable}</details>
<div class="pt-plaque"><span class="pt-pl-l">Финансовые цели ноября:</span> выплата <span data-metric="payout" data-target="${f.target.payout}">${fmt(f.target.payout/1e6,1)} млн ₽ - сценарный ориентир</span>; чистая прибыль 500 тыс. ₽ и не менее 4,5% выплаты. Следующий рубеж: 900 тыс. ₽ и 8%. Предварительный факт и движение - в разделе 6.</div>
<p class="nf-caption" id="november-coverage">Закрытые данные: ${f.coveredDays}/${f.elapsed} дней${f.last?`, по ${f.last.slice(8)}.11`:'. Ноябрьских данных пока нет'}.${f.last&&!f.complete?' Есть пропуск: накопительный итог и выполнение не рассчитаны.':''}${f.stale?` Срез отстаёт: ожидаются данные по ${f.expected}. Нужный темп до обновления не рассчитан.`:''} Только закрытые дни ноября; неполные дни в выполнение не входят. Свежие заказы могут уменьшиться после отмен.</p>
${(body??'<!-- NOVEMBER_STORE -->').replace('<!-- NOVEMBER_STORE -->',`<details class="pt-sec" id="november-store"><summary class="sec">3. Магазин к цели ноября</summary><div class="pt-two nf-charts">${graph(f,'units','Товары без отмен, шт.')}${graph(f,'revenue','Оборот, млн ₽')}</div></details>`)}
<p class="nf-caption">Переключатель недель и «Весь ноябрь» меняет спидометры; таблица заказов показывает накопительный факт с 01.11 и недели внутри карточки. В недельном режиме шкала показывает выполнение плана закрытых дней недели. В месячном режиме шкала показывает долю полной цели месяца, белая отметка — план на дату; цвет в обоих режимах оценивает темп по закрытым дням. Текущий день исключён. Расход на рекламу показан нейтрально, без лимита и оценки перерасхода. План распределён равномерно на 30 дней, это ориентир темпа, не прогноз спроса. Даты проверки: 12 и 20 ноября. Решения по карточкам и этапы - в разделах 7-8; цели карточек и недельный темп — в разделе 1, контроль CPC относительно октябрьского плана — в разделе 4. Лимит общего CPC + CPO не задан. Октябрь сохранён в истории.</p></details>`;
}
export const novemberForecastCss=`
.nf-plan{border-color:#237082}.nf-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}.nf-metric{background:#17212c;border:1px solid #293744;border-radius:10px;padding:18px;min-width:0}.nf-metric h3,.nf-chart h3{font-size:14px;margin:0 0 12px}.nf-metric strong{display:block;font-size:28px;margin:8px 0}.nf-caption{font-size:12px;color:#9aafbe;line-height:1.6}.nf-track{height:7px;background:#283746;border-radius:5px;overflow:hidden;margin:14px 0 6px}.nf-track span{display:block;height:100%;background:#22d3ee}.nf-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:24px 0}.nf-chart{min-width:0}.nf-chart svg{width:100%;height:auto}.nf-chart text{fill:#9aafbe;font:11px system-ui}.nf-goal{fill:none;stroke:#d4a85a;stroke-width:2;stroke-dasharray:6 4}.nf-fact{fill:none;stroke:#22d3ee;stroke-width:2.5}.nf-legend{font-size:12px;color:#22d3ee}.nf-legend span{color:#d4a85a;margin-left:16px}@media(max-width:1100px){.nf-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.nf-metrics,.nf-charts{grid-template-columns:1fr}.nf-metric strong{font-size:25px}}
`;

export function novemberWeeklyData(f:Forecast,ads:Record<string,number|null>={}){
  const weeks=novemberPeriods(),targets={...f.target,profit:NOVEMBER_GROWTH.profit};
  const units=Object.fromEntries(f.points.map(p=>[p.day,p.dailyUnits])),revenue=Object.fromEntries(f.points.map(p=>[p.day,p.dailyRevenue]));
  const selected=weeks.findIndex(w=>f.today<=w.to);
  return {today:f.today,targets,daily:{units,revenue,ads},selected:selected<0?weeks.length-1:selected,periods:novemberGaugePeriods().map(period=>({period,
    units:periodProgress(period,f.today,units,targets.units,true),revenue:periodProgress(period,f.today,revenue,targets.revenue),ads:periodProgress(period,f.today,ads,null)}))};
}
export function novemberForecastJs(f:Forecast,ads:Record<string,number|null>={}){
  return readFileSync(new URL('./plan-tab/chart.client.js',import.meta.url),'utf8')+`window.NOVEMBER_WEEKLY=${JSON.stringify(novemberWeeklyData(f,ads)).replace(/</g,'\\u003c')};\n(function(){const periodWindow=${periodWindow.toString()};window.NOVEMBER_PERIOD_PROGRESS=${periodProgress.toString()};})();\n`+readFileSync(new URL('./november-visibility.client.js',import.meta.url),'utf8')+readFileSync(new URL('./november-weekly.client.js',import.meta.url),'utf8')+`\n(function(){var f=${JSON.stringify(f)};var end=window.NOVEMBER_CLOSED_DAY||f.expected;f.points=f.points.filter(function(p){return p.day<=end});f.days=f.days.filter(function(d){return d<=end});['units','revenue'].forEach(function(k){var scale=k==='units'?1:1e6,el=document.getElementById('nf-chart-'+k);el.hidden=!f.points.some(function(p){return p[k]!=null});if(el.hidden)return;window.planChart(document.getElementById('nf-chart-'+k),{xs:f.days.map(function(d){return d.slice(8)+'.11'}),w:460,h:220,integer:k==='units',series:[{v:f.points.map(function(p){return p[k+'Plan']/scale}),color:'#22D3EE',dash:'5 4',w:1.6,name:'цель ноября'},{v:f.points.map(function(p){return p[k]==null?null:p[k]/scale}),color:'#F59E0B',w:2.6,area:true,name:'факт с 01.11'}],title:'<div class="ch-h">'+(k==='units'?'Заказы, шт.':'Оборот, млн ₽')+'</div>'});});})();`;
}
