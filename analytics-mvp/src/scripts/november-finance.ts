import {novemberGaugePeriods,periodWindow} from './november-periods.js';
import {readFileSync} from 'node:fs';
import {NOVEMBER_GROWTH} from './november-growth.js';
export function financeWindow(today:string,last:string,covered:string[]){
  const days=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
  const expected=days.filter(d=>d<today).pop()??'';
  const end=days.filter(d=>d<today&&d<=last).pop()??'';
  const required=days.filter(d=>end&&d<=end),missing=required.filter(d=>!covered.includes(d));
  return {days,expected,end,missing,complete:!!end&&!missing.length,stale:!!expected&&end<expected};
}
// Reuses the actual Money-page functions and embedded inputs. No second financial formula.
export function novemberFinancePage(moneyCore:string,maxD:string,covered:string[],builtAt:string){
  const gauge=readFileSync(new URL('./plan-tab/gauge.client.js',import.meta.url),'utf8');
  const gaugeCss=readFileSync(new URL('./plan-tab/plan-tab.css',import.meta.url),'utf8').replaceAll('#pt-plan','#finance-metrics');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GENGLASS · Финансовая цель ноября</title><style>
body{margin:0;padding:16px;background:#17212c;color:#e6eef6;font:14px system-ui}*{box-sizing:border-box}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{padding:14px;border:1px solid #344756;border-radius:10px}.metric strong{font-size:26px;display:block;margin:9px 0}.metric h3{font-size:13px;margin:0}p,small{line-height:1.55;color:#b1c3d0}.track{height:7px;background:#344756;border-radius:5px;overflow:hidden;margin:12px 0}.track i{height:100%;display:block;background:#22d3ee}a{color:#68d4ee}table{border-collapse:collapse;width:100%;font-size:12px}td,th{text-align:left;padding:8px;border-bottom:1px solid #344756}.scroll{overflow:auto}svg{width:100%;height:190px}.warn{color:#f4ce8b}h2{font-size:18px;margin:0 0 12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.metric strong{font-size:24px}}
${gaugeCss}
#finance-metrics{--soft:#232B36;--ink:#e6eef6;--ink2:#b1c3d0;--ink3:#8b9eae}#finance-metrics .metric{padding:10px;text-align:center;background:linear-gradient(180deg,#151b25,#12161f);border-radius:12px}#finance-metrics .gauge{border:0;padding:0;background:none}#finance-metrics svg{height:auto;max-width:240px}body{background:#12161f}
[hidden]{display:none!important}</style></head><body><h2>Предварительный финансовый результат ноября</h2><div id="finance-state" role="status">Расчёт загружается. Если данные не появились, откройте вкладку «Деньги».</div><div id="finance-metrics" class="grid"></div><div id="finance-chart"></div><div id="finance-quality"></div><details><summary>Движение по закрытым дням</summary><div class="scroll"><table><thead><tr><th>По дату</th><th>Выплата, ₽</th><th>Чистая прибыль, ₽</th><th>Ориентир прибыли, ₽</th></tr></thead><tbody id="finance-days"></tbody></table></div></details><p><a href="katya-money.html" target="_top">Открыть подробный расчёт</a></p><script>
${gauge}
const MAXD=${JSON.stringify(maxD)};
${moneyCore}
const NG=${JSON.stringify(NOVEMBER_GROWTH)}, COVERED=${JSON.stringify(covered)}, BUILT_AT=${JSON.stringify(builtAt)};
const financeWindow=${financeWindow.toString()},periodWindow=${periodWindow.toString()},WEEKS=${JSON.stringify(novemberGaugePeriods())};
function sendWeeklyFinance(){if(window.parent!==window&&window.NOVEMBER_FINANCE_WEEKLY)window.parent.postMessage(window.NOVEMBER_FINANCE_WEEKLY,location.origin)}
window.addEventListener('message',function(e){if(e.source===window.parent&&e.origin===location.origin&&e.data&&e.data.type==='ozon-november-weekly-request')sendWeeklyFinance()});
function renderNovemberFinance(now){
  const today=new Date(now+3*3600e3).toISOString().slice(0,10);
  const last=[MAXD,AN_MAXD,AN_RD_TO].sort()[0]||'';
  const covered=COVERED.filter(d=>d>=AN_RD_FROM&&d<=AN_RD_TO&&!AN_RD_MISS.includes(d));
  const w=financeWindow(today,last,covered),fmt=(n,d=0)=>n==null?'нет данных':n.toLocaleString('ru-RU',{maximumFractionDigits:d});
  document.getElementById('finance-state').innerHTML='<p class="warn">По '+(w.end||'нет закрытых данных ноября')+'. '+(w.stale?'Срез отстаёт, ожидается '+w.expected+'. ':'')+(w.missing.length?'Пропущены дни: '+w.missing.join(', ')+'. Итог не рассчитан. ':'')+'Модельный результат, бухгалтерская сверка не завершена. Сборка: '+BUILT_AT+'.</p>';
  let result=null,missingCogs=0,estimate=null,points=[];
  for(const day of w.days){
    if(!w.end||day>w.end||w.missing.some(d=>d<=day))continue;
    const data=skuAnalyticsData({from:'2026-11-01',to:day}),derived=anDerive(data.grand);
    if(!Number.isFinite(derived.net)||!Number.isFinite(data.grand.amt))throw Error('Non-finite finance progress');
    points.push({day,payout:data.grand.amt,net:derived.net});
    if(day===w.end&&w.complete){result={payout:data.grand.amt,net:derived.net,rent:derived.rent};missingCogs=data.miss.length;estimate=data.grand.tbEst;}
  }
  window.NOVEMBER_FINANCE={window:w,result,points,missingCogs,estimate};
  const periods=WEEKS.map(period=>{
    const span=periodWindow(period,today),missing=span.closed.filter(d=>d>last||!covered.includes(d)),complete=span.elapsed>0&&!missing.length;
    let fact=null;
    if(complete){const data=skuAnalyticsData({from:period.from,to:span.through}),derived=anDerive(data.grand);if(!Number.isFinite(derived.net))throw Error('Non-finite weekly profit');fact=derived.net;}
    const goal=NG.profit*period.days/30,planToDate=NG.profit*span.elapsed/30;
    return {...span,missing,complete,fact,goal,planToDate,ratio:fact!==null&&planToDate?fact/planToDate*100:null};
  });
  window.NOVEMBER_FINANCE_WEEKLY={type:'ozon-november-weekly-finance',today,periods};sendWeeklyFinance();
  const card=(key,title,fact,goal,unit)=>{
    const elapsed=w.end?Number(w.end.slice(8)):0,mark=key==='rent'?100:elapsed/30*100,planDate=goal*mark/100;
    return '<article '+(fact==null?'hidden ':'')+'class="metric" data-metric="'+key+'" data-fact="'+(fact==null?'':fact)+'" data-target="'+goal+'">'+window.planGauge({title:title,val:fact,plan:goal,mark:mark,stPct:fact!=null&&planDate>0?fact/planDate*100:null,l1:fmt(fact,unit==='%'?2:0)+(fact==null?'':' '+unit),l2:'Цель: '+fmt(goal,unit==='%'?1:0)+' '+unit,l3:key==='payout'?'Сценарный ориентир, не прогноз':key==='rent'?'Доля прибыли в выплате':'Ориентир к дате: '+fmt(planDate)+' ₽'})+'<small>'+(fact==null?'Выполнение не рассчитано':fmt(fact/goal*100,1)+'% цели, предварительно')+'</small></article>';
  };
  document.getElementById('finance-metrics').innerHTML=card('net','Расчётная чистая прибыль',result?.net??null,NG.profit,'₽')+card('rent','Прибыль / выплата',result?.rent??null,NG.rent,'%')+card('payout','Выплата после удержаний',result?.payout??null,NG.pay_mln.nov.mid*1e6,'₽');
  document.getElementById('finance-quality').innerHTML='<p class="warn">'+(result?'SKU без себестоимости: '+missingCogs+'. Оценочная часть базы налога: '+fmt(estimate)+' ₽. ':'')+'Доставка по ведомости: '+(AN_VED_MAXD||'нет данных')+'. Доход и доставка учитываются вместе по дате начисления; ожидающие начисления расходы не вычитаются отдельно. Полнота всех затрат и бухгалтерская сверка не подтверждены.</p><p>Прибыль и выплата относятся к начислениям и реализациям; их нельзя сравнивать как одну когорту с заказами выше. АДМ: 30% положительных баз по SKU/дням; налог: действующая модель 15% базы реализации. Реклама уже учтена в выплате. Достижение числовой цели не подтверждает окончательную прибыль.</p>';
  document.getElementById('finance-days').innerHTML=points.map(p=>'<tr><td>'+p.day+'</td><td>'+fmt(p.payout)+'</td><td>'+fmt(p.net)+'</td><td>'+fmt(NG.profit*Number(p.day.slice(8))/30)+'</td></tr>').join('');
  const chartEnd=w.expected||'2026-11-01',chartDays=Number(chartEnd.slice(8)),chartGoal=NG.profit*chartDays/30;
  const values=[0,chartGoal,...points.map(p=>p.net)],min=Math.min(...values),max=Math.max(...values),range=max-min||1,x=d=>42+(Number(d.slice(8))-1)*580/Math.max(1,chartDays-1),y=v=>155-(v-min)/range*130;
  const line=points.map((p,i)=>(i?'L':'M')+x(p.day)+','+y(p.net)).join(' ');
  document.getElementById('finance-chart').hidden=!points.length;
  document.getElementById('finance-chart').innerHTML='<svg viewBox="0 0 660 190" role="img" aria-label="Накопительная расчётная прибыль ноября и ориентир"><title>Прибыль ноября. Пунктир - равномерный ориентир, не прогноз.</title><line x1="42" y1="'+y(0)+'" x2="622" y2="'+y(0)+'" stroke="#506675"/><path d="M42,'+y(NG.profit/30)+' L622,'+y(chartGoal)+'" fill="none" stroke="#d4a85a" stroke-dasharray="6 4"/><path d="'+line+'" fill="none" stroke="#22d3ee" stroke-width="2"/>'+points.map(p=>'<circle cx="'+x(p.day)+'" cy="'+y(p.net)+'" r="4" fill="#22d3ee"><title>'+p.day+': '+fmt(p.net)+' ₽</title></circle>').join('')+'<text x="42" y="180" fill="#b1c3d0">01.11</text><text x="590" y="180" fill="#b1c3d0">'+chartEnd.slice(8)+'.11</text><text x="4" y="'+y(0)+'" fill="#b1c3d0">0</text></svg><small>Голубая линия: расчётная прибыль накопительно. Пунктир: ориентир к цели 500 тыс. ₽, равномерно по дням.</small>';
}
try{renderNovemberFinance(Date.now());}catch(error){document.getElementById('finance-state').textContent='Финансовый расчёт недоступен. Откройте вкладку Деньги; цель не считается выполненной.';console.error(error);}
</script></body></html>`;
}
