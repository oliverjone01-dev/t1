import {sortTasks} from './productivity-model.mjs?rev=20261109-productivity-1';
import {calendarDays,monthStart,shiftMonth,movePeriod,dayTasks,monthSummary} from './calendar-model.mjs?rev=20261109-productivity-1';
import {QUADRANTS,statusGroup} from './model.mjs?rev=20261109-productivity-1';
import {icon} from './icons.mjs?rev=20261109-productivity-1';
export function installCalendar(host){
 const $=s=>document.querySelector(s),esc=host.esc;
 let view='month',anchor=host.today(),undated=false,peek=null;
 const root=$('#calendar-view');
 const taskWord=n=>n%10===1&&n%100!==11?'задача':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'задачи':'задач';
 const dateText=(date,options)=>new Intl.DateTimeFormat('ru',options).format(new Date(date+'T12:00:00'));
 const taskButton=t=>`<article class="calendar-task-wrap" data-drop-task="${esc(t.id)}"><button class="calendar-task ${statusGroup(t)?'is-terminal':''}" data-calendar-task="${esc(t.id)}" data-priority="${esc(t.priority||'inbox')}" title="${esc(t.title)}"><span class="calendar-task-title">${esc(t.title)}</span><span>${t.avatar?`<img class="inline-avatar" src="${esc(t.avatar)}" alt="" loading="lazy">`:""}${esc(t.owner||'Не назначен')}${view==='months'&&t.due?' · '+t.due.slice(8)+'.'+t.due.slice(5,7):''}${statusGroup(t)?' · '+esc(t.status):''}</span></button>${host.canEdit()?`<button class="planning-grip" data-plan-grip="${esc(t.id)}" aria-label="Переместить в календаре: ${esc(t.title)}" title="Перенос меняет дату и очередь. Пробел и стрелки — с клавиатуры.">${icon('grip')}</button>`:''}</article>`;
 function day(date,full=false){const items=dayTasks(host.visible(),date,host.today()),today=date===host.today(),outside=view==='month'&&date.slice(0,7)!==anchor.slice(0,7);return `<section data-drop-date="${date}" class="calendar-day ${today?'is-today':''} ${outside?'outside-month':''}" aria-label="${esc(dateText(date,{day:'numeric',month:'long',year:'numeric'}))}"><header><button class="calendar-date" data-calendar-day="${date}" aria-label="Открыть день ${date}">${full?esc(dateText(date,{weekday:'short',day:'numeric',month:'short'})):Number(date.slice(8))}${today?'<span>Сегодня</span>':''}</button>${host.canEdit()?`<button class="icon-button calendar-add" data-calendar-add="${date}" aria-label="Новая задача на ${date}">${icon('plus')}</button>`:''}</header><div class="calendar-day-tasks">${items.length?`<button class="calendar-day-count" data-calendar-peek="${date}" aria-label="Задачи на ${date}: ${items.length}">${items.length} ${taskWord(items.length)}</button>`:""}${(full?items:items.slice(0,3)).map(taskButton).join('')}${!items.length&&full?'<p class="calendar-empty-day">Задач на этот день нет</p>':''}${!full&&items.length>3?`<button class="text-button calendar-more" data-calendar-day="${date}">Ещё ${items.length-3}</button>`:''}</div></section>`}
 function render(){
  root.hidden=host.mode()!=='calendar';if(root.hidden)return;
  const tasks=host.visible(),unscheduled=tasks.filter(t=>!t.due),days=calendarDays(anchor,view),title=view==='months'?anchor.slice(0,4):view==='day'?dateText(anchor,{day:'numeric',month:'long',year:'numeric'}):view==='week'?`${dateText(days[0],{day:'numeric',month:'short'})} — ${dateText(days[6],{day:'numeric',month:'short',year:'numeric'})}`:dateText(anchor,{month:'long',year:'numeric'});
  root.innerHTML=`<div class="calendar-toolbar"><div class="calendar-period"><button class="icon-button" data-calendar-step="-1" aria-label="Предыдущий период">←</button><h3 tabindex="-1" aria-live="polite">${esc(title)}</h3><button class="icon-button" data-calendar-step="1" aria-label="Следующий период">→</button><button class="text-button" data-calendar-today>Сегодня</button></div><div class="calendar-views" role="group" aria-label="Масштаб календаря">${[['day','День'],['week','Неделя'],['month','Месяц'],['months','Месяцы']].map(([id,label])=>`<button aria-pressed="${view===id}" data-calendar-view="${id}">${label}</button>`).join('')}</div><button class="text-button calendar-undated" aria-pressed="${undated}" data-calendar-undated>Без срока · ${unscheduled.length}</button></div><div class="calendar-legend"><span>Дата — срок задачи</span><span class="calendar-important">${icon('grid')} Важные задачи</span><span>Фильтры команды и юнита действуют во всех периодах</span></div>${undated?`<section class="calendar-unscheduled" data-drop-date=""><h3>Без срока · ${unscheduled.length}</h3><p>Откройте карточку, чтобы назначить дату.</p><div>${unscheduled.map(taskButton).join('')||'<p>Все задачи в выборке со сроком.</p>'}</div></section>`:''}<div class="calendar-content">${view==='month'&&peek?`<div class="calendar-peek"><div><strong>Задачи выбранного дня</strong><button class="text-button" data-calendar-close-peek>Закрыть</button></div>${day(peek,true)}</div>`:""}${view==='months'?`<div class="calendar-months">${Array.from({length:12},(_,i)=>{const date=shiftMonth(anchor.slice(0,4)+'-01-01',i),summary=monthSummary(tasks,date.slice(0,7),host.today());return `<section class="calendar-month-card" data-drop-month="${date.slice(0,7)}"><button class="calendar-month-header" data-calendar-month="${date}"><strong>${esc(dateText(date,{month:'long'}))}</strong><b>${summary.total}</b><span>${summary.active} активных · ${summary.done} готово</span>${summary.overdue?`<span class="overdue">Просрочено: ${summary.overdue}</span>`:''}<span class="month-density" aria-hidden="true"><i style="width:${Math.round(summary.total/Math.max(1,...Array.from({length:12},(_,j)=>monthSummary(tasks,shiftMonth(anchor.slice(0,4)+'-01-01',j).slice(0,7),host.today()).total))*100)}%"></i></span></button><div class="calendar-month-tasks">${sortTasks(tasks.filter(t=>t.due?.startsWith(date.slice(0,7))),'due',x=>x,host.today()).map(taskButton).join('')||'<span class="calendar-month-empty">Нет задач</span>'}</div></section>`}).join('')}</div>`:`${view==='month'?'<div class="calendar-weekdays" aria-hidden="true">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>'<span>'+d+'</span>').join('')+'</div>':''}<div class="calendar-grid calendar-view-${view}">${days.map(date=>day(date,view!=='month')).join('')}</div>`}</div>`;
 }
 root.onclick=e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.calendarTask){host.openTask(d.calendarTask);return}
  if(d.calendarAdd){host.createOn(d.calendarAdd);return}
  if(d.calendarStep)anchor=movePeriod(anchor,view,Number(d.calendarStep));
  if('calendarToday'in d)anchor=host.today();
  if(d.calendarView)view=d.calendarView;
  if(d.calendarMonth){anchor=d.calendarMonth;view='month'}
  if(d.calendarDay){anchor=d.calendarDay;view='day'}
  if(d.calendarPeek)peek=d.calendarPeek;
  if('calendarClosePeek'in d)peek=null;
  if('calendarUndated'in d)undated=!undated;
  render();
  const selector=d.calendarView?`[data-calendar-view="${view}"]`:d.calendarStep?`[data-calendar-step="${d.calendarStep}"]`:'calendarToday'in d?'[data-calendar-today]':null;
  if(selector)root.querySelector(selector)?.focus({preventScroll:true});
  else if(d.calendarDay||d.calendarMonth)root.querySelector('h3')?.focus({preventScroll:true});
  if(d.calendarDay||d.calendarMonth||d.calendarStep||d.calendarView||d.calendarPeek||'calendarToday'in d)root.scrollTop=0;
 };
 return {render};
}
