(function(){
'use strict';
var D=window.NOVEMBER_WEEKLY;if(!D)return;
if(/^https?:$/.test(location.protocol)){
  var today=new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
  if(today!==D.today){D.today=today;D.periods=D.periods.map(function(row){var p=row.period;return {period:p,units:window.NOVEMBER_PERIOD_PROGRESS(p,today,D.daily.units,D.targets.units,true),revenue:window.NOVEMBER_PERIOD_PROGRESS(p,today,D.daily.revenue,D.targets.revenue),ads:window.NOVEMBER_PERIOD_PROGRESS(p,today,D.daily.ads,null)}});var current=D.periods.findIndex(function(row){return today<=row.period.to});D.selected=current<0?D.periods.length-1:current;}
}
var selected=D.selected,finance=null,frame=document.getElementById('november-finance-frame');
function fmt(v,n){return v==null?'нет данных':v.toLocaleString('ru-RU',{maximumFractionDigits:n==null?0:n})}
function draw(key,p,goal,title,unit,neutral){
  var month=selected===5;var el=document.getElementById('nf-dial-'+key),card=el.parentElement;card.hidden=p.fact==null;
  var closed=p.elapsed?'Закрыто '+p.elapsed+' из '+p.days.length+' дн. · по '+p.through.slice(8)+'.11':'Закрытых дней периода пока нет';
  var quality=p.missing.length?'Нет полного покрытия: '+p.missing.map(function(d){return d.slice(8)+'.11'}).join(', '):closed;
  el.innerHTML=window.planGauge({title:title,val:p.fact,plan:p.planToDate,mark:100,stPct:p.ratio,neutral:neutral,neutralLabel:p.fact==null?'нет данных':'факт',
    l1:p.fact==null?'нет данных':fmt(p.fact)+(unit||''),
    l2:neutral?'CPC + CPO · без оценки перерасхода':p.elapsed?'План закрытых дней: '+fmt(p.planToDate)+unit:'План закрытых дней ещё не наступил',
    l3:neutral?'Лимит периода не задан':(month?'Цель всего месяца: ':'Цель всей недели: ')+fmt(p.goal)+unit});
  card.classList.add('nf-ready');card.dataset.fact=p.fact==null?'':String(p.fact);card.dataset.target=p.planToDate==null?'':String(p.planToDate);
  document.getElementById('nf-note-'+key).textContent=quality+(key==='net'?' · Предварительная модельная прибыль; бухгалтерская сверка не завершена.':'');
}
function render(){
  var row=D.periods[selected];
  var issues=[['Заказы',row.units],['Оборот',row.revenue],['Реклама',row.ads]];if(finance)issues.push(['Прибыль',finance[selected]]);
  document.getElementById('november-week-issues').textContent=issues.filter(function(x){return x[1].missing.length}).map(function(x){return x[0]+': нет полного покрытия за '+x[1].missing.map(function(d){return d.slice(8)+'.11'}).join(', ')}).join(' · ');
  document.getElementById('november-week-state').textContent=(selected===5?'Весь ноябрь · 01–30.11.':'Неделя '+row.period.label+'.')+(row.units.elapsed?' 100% на шкале = план уже закрытых дней выбранного периода. Полная цель '+(selected===5?'месяца':'недели')+' указана под спидометром.':' Закрытых дней пока нет. План периода: '+fmt(row.units.goal)+' шт., оборот '+fmt(row.revenue.goal)+' ₽, прибыль '+fmt(D.targets.profit*row.period.days/30)+' ₽. Факт появится после закрытия дней.');
  Array.prototype.forEach.call(document.querySelectorAll('[data-nov-week]'),function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.novWeek)===selected))});
  draw('units',row.units,D.targets.units,'Заказы магазина',' шт.',false);
  draw('revenue',row.revenue,D.targets.revenue,'Оборот магазина',' ₽',false);
  draw('ads',row.ads,null,'Расход на рекламу',' ₽',true);
  if(finance){var f=finance[selected];draw('net',f,D.targets.profit,'Чистая прибыль',' ₽',false);}
  else {document.getElementById('nf-dial-net').parentElement.hidden=true;document.getElementById('nf-note-net').textContent='Предварительная прибыль загружается из раздела «Деньги». Если расчёт не появился, откройте финансовый раздел ниже.';}
}
Array.prototype.forEach.call(document.querySelectorAll('[data-nov-week]'),function(b){b.addEventListener('click',function(){if(b.hidden)return;selected=Number(b.dataset.novWeek);render()})});
function receive(event){
  if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;
  var msg=event.data;if(!msg||msg.type!=='ozon-november-weekly-finance'||msg.today!==D.today||!Array.isArray(msg.periods)||msg.periods.length!==D.periods.length)return;
  var safe=msg.periods.every(function(p,i){var expected=D.periods[i].units;return p&&Array.isArray(p.days)&&JSON.stringify(p.days)===JSON.stringify(expected.days)&&Array.isArray(p.missing)&&p.missing.every(function(d){return expected.closed.indexOf(d)>=0})&&p.elapsed===expected.elapsed&&p.through===expected.through&&(p.fact===null||Number.isFinite(p.fact))&&p.goal===D.targets.profit*expected.days.length/30&&p.planToDate===D.targets.profit*expected.elapsed/30&&(p.ratio===null||Number.isFinite(p.ratio))&&((p.fact===null&&p.ratio===null)||(Number.isFinite(p.fact)&&p.missing.length===0&&p.elapsed>0&&p.ratio===p.fact/p.planToDate*100));});
  if(!safe)return;
  finance=msg.periods;document.getElementById('november-finance-issue').textContent='';render();
}
window.addEventListener('message',receive);
function request(){if(frame&&frame.contentWindow&&/^https?:$/.test(location.protocol))frame.contentWindow.postMessage({type:'ozon-november-weekly-request'},location.origin)}
if(frame){frame.addEventListener('load',request);frame.addEventListener('error',function(){document.getElementById('november-finance-issue').textContent='Финансовый расчёт недоступен. Откройте раздел 6; выполнение не рассчитано.'})}
render();request();
if(/^https?:$/.test(location.protocol))setTimeout(function(){if(!finance)document.getElementById('november-finance-issue').textContent='Финансовый расчёт не загрузился. Откройте раздел 6 или обновите страницу; выполнение не рассчитано.'},20000);
})();
