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
    return {day,units:have&&complete?units:null,revenue:have&&complete?revenue:null,unitsPlan:target.units*(i+1)/30,revenuePlan:target.revenue*(i+1)/30};
  });
  const elapsed=last?Number(last.slice(8)):0;
  const expected=days.filter(d=>d<input.today).pop()??'';
  const stale=!!expected&&last<expected;
  return {target,days,points,last,elapsed,expected,stale,complete:!!last&&complete,units:last&&complete?units:null,revenue:last&&complete?revenue:null,
    coveredDays:days.filter(d=>d<=last&&input.covered.has(d)).length};
}
type Forecast=NonNullable<ReturnType<typeof novemberForecast>>;
function graph(f:Forecast,key:'units'|'revenue',title:string){
  const goalKey=key==='units'?'unitsPlan':'revenuePlan',scale=key==='units'?1:1e6;
  const values=f.points.flatMap(p=>p[key]==null?[p[goalKey]/scale]:[p[goalKey]/scale,p[key]!/scale]);
  const max=Math.max(...values)*1.08||1,W=660,H=230,L=55,R=18,T=15,B=28;
  const x=(i:number)=>L+(W-L-R)*i/29,y=(v:number)=>H-B-v/scale/max*(H-T-B);
  const path=(k:typeof key|typeof goalKey)=>f.points.filter(p=>p[k]!=null).map((p,i)=>`${i?'L':'M'}${x(Number(p.day.slice(8))-1).toFixed(2)},${y(p[k]!).toFixed(2)}`).join(' ');
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}: ноябрь, накопительно"><title>${title}: ноябрь, накопительно. Пунктир — план; сплошная линия — факт закрытых дней.</title>`;
  for(let i=0;i<=4;i++){const v=max*i/4,yy=H-B-v/max*(H-T-B);svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#293744"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${fmt(v,key==='units'?0:1)}</text>`;}
  for(const i of [0,6,13,20,29])svg+=`<text x="${x(i)}" y="${H-7}" text-anchor="middle">${String(i+1).padStart(2,'0')}.11</text>`;
  svg+=`<path d="${path(goalKey)}" class="nf-goal"/><path d="${path(key)}" class="nf-fact"/>`;
  for(let i=0;i<f.points.length;i++){const p=f.points[i]!;if(p[key]!=null)svg+=`<circle tabindex="0" cx="${x(i)}" cy="${y(p[key]!)}" r="4" fill="#22d3ee"><title>${p.day}: факт ${fmt(p[key]!/scale,2)}, план ${fmt(p[goalKey]/scale,2)}</title></circle>`;}
  return `<div class="nf-chart"><h3>${title}</h3>${svg}</svg><div class="nf-legend">━ Факт закрытых дней <span>┄ План</span></div></div>`;
}
export function novemberForecastHtml(f:Forecast){
  const metric=(key:'units'|'revenue',label:string)=>{
    const fact=f[key],goal=f.target[key],dateGoal=goal*f.elapsed/30,ratio=fact==null?null:fact/goal*100;
    return `<div class="nf-metric" data-metric="${key}" data-fact="${fact??''}" data-target="${goal}"><h3>${label}</h3><strong>${fact==null?'нет данных':fmt(fact)}${key==='revenue'&&fact!=null?' ₽':''}</strong><div>Цель месяца: ${fmt(goal)}${key==='revenue'?' ₽':' шт.'}</div><div class="nf-track"><span style="width:${ratio==null?0:Math.min(100,ratio)}%"></span></div><div class="nf-caption">${ratio==null?'Выполнение не рассчитано':`${fmt(ratio,1)}% цели месяца`}${f.last?` · по ${f.last.slice(8)}.11`:''}</div>${f.last?`<div class="nf-caption">План к этой дате: ${fmt(dateGoal,1)}${key==='revenue'?' ₽':' шт.'}</div>`:''}${fact!=null&&f.last?`<div class="nf-caption">Отклонение от плана к дате: ${fact-dateGoal>=0?'+':''}${fmt(fact-dateGoal,1)}${key==='revenue'?' ₽':' шт'}. Осталось до цели: ${fmt(Math.max(0,goal-fact))}${key==='revenue'?' ₽':' шт'}.</div>`:''}${fact!=null&&!f.stale&&f.elapsed<30?`<div class="nf-caption">Нужный темп на оставшиеся ${30-f.elapsed} дн.: ${fmt(Math.max(0,goal-fact)/(30-f.elapsed),1)}${key==='revenue'?' ₽/день':' шт./день'}.</div>`:''}</div>`;
  };
  return `<section class="card nf-plan" id="november-plan"><div class="chead"><span class="ctitle">Ноябрь: цель и наше движение</span><span class="chip chip-run">01–30.11.2026</span></div>
<p class="sub">План роста от 03.11: 450 товаров и 30,6 млн ₽. Факт - по дате заказа, без известных отмен; количество товаров, не уникальных заказов.</p>
<div class="nf-metrics">${metric('units','Товары без отмен, шт.')}${metric('revenue','Оборот заказов')}<div class="nf-metric" data-metric="payout" data-target="${f.target.payout}"><h3>Выплата · сценарный ориентир</h3><strong>${fmt(f.target.payout/1e6,1)} млн ₽</strong><p class="nf-caption">Предварительная выплата и прибыль показаны ниже. Окончательный факт - после закрытия ноября. Оборот выплатой не считается.</p></div><div class="nf-metric" data-metric="profit-target" data-target="500000"><h3>Чистая прибыль · первый рубеж</h3><strong>500 тыс. ₽</strong><p class="nf-caption">И не менее 4,5% выплаты. Следующий рубеж: 900 тыс. ₽ и 8%. Факт и ограничения расчёта ниже.</p></div></div>
<p class="nf-caption" id="november-coverage">Закрытые данные: ${f.coveredDays}/${f.elapsed} дней${f.last?`, по ${f.last.slice(8)}.11`:'. Ноябрьских данных пока нет'}.${f.last&&!f.complete?' Есть пропуск: накопительный итог и выполнение не рассчитаны.':''}${f.stale?` Срез отстаёт: ожидаются данные по ${f.expected}. Нужный темп до обновления не рассчитан.`:''} Только закрытые дни ноября; неполные дни в выполнение не входят. Свежие заказы могут уменьшиться после отмен.</p>
<div class="nf-charts">${graph(f,'units','Товары без отмен, шт.')}${graph(f,'revenue','Оборот, млн ₽')}</div>
<p class="nf-caption">План распределён равномерно на 30 дней, это ориентир темпа, не прогноз спроса. Даты проверки: 12 и 20 ноября. Решения по карточкам и этапы - ниже; индивидуальные числовые пороги и бюджеты кампаний не назначены. Октябрь сохранён в истории.</p></section>`;
}
export const novemberForecastCss=`
.nf-plan{border-color:#237082}.nf-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}.nf-metric{background:#17212c;border:1px solid #293744;border-radius:10px;padding:18px;min-width:0}.nf-metric h3,.nf-chart h3{font-size:14px;margin:0 0 12px}.nf-metric strong{display:block;font-size:28px;margin:8px 0}.nf-caption{font-size:12px;color:#9aafbe;line-height:1.6}.nf-track{height:7px;background:#283746;border-radius:5px;overflow:hidden;margin:14px 0 6px}.nf-track span{display:block;height:100%;background:#22d3ee}.nf-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:24px 0}.nf-chart{min-width:0}.nf-chart svg{width:100%;height:auto}.nf-chart text{fill:#9aafbe;font:11px system-ui}.nf-goal{fill:none;stroke:#d4a85a;stroke-width:2;stroke-dasharray:6 4}.nf-fact{fill:none;stroke:#22d3ee;stroke-width:2.5}.nf-legend{font-size:12px;color:#22d3ee}.nf-legend span{color:#d4a85a;margin-left:16px}.pt-nov-archive #pt-gauges{display:none}@media(max-width:1100px){.nf-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.nf-metrics,.nf-charts{grid-template-columns:1fr}.nf-metric strong{font-size:25px}}
`;
