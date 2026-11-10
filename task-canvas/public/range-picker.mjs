import {periodRange,shiftRange,parseRangeDate,displayRangeDate} from './range-model.mjs?rev=20261110-controls-6';
import {calendarDays,monthStart,shiftMonth} from './calendar-model.mjs?rev=20261110-controls-6';
export function installRangePicker({root,today,getRange,onChange,esc}){
 let month=monthStart(getRange().from||today()),draft={...getRange()},choosingEnd=false;
 root.innerHTML=`<button type="button" id="period-open" class="period-button" aria-haspopup="dialog" aria-expanded="false"><span data-period-label></span><span aria-hidden="true">⌄</span></button><div class="period-shifts" role="group" aria-label="Сдвинуть период"><button type="button" data-period-shift="month:-1" aria-label="На месяц раньше">− мес</button><button type="button" data-period-shift="week:-1" aria-label="На неделю раньше">− нед</button><button type="button" data-period-shift="week:1" aria-label="На неделю позже">+ нед</button><button type="button" data-period-shift="month:1" aria-label="На месяц позже">+ мес</button></div><dialog id="period-dialog" class="period-dialog" aria-labelledby="period-title"><header><div><h3 id="period-title">Период задач</h3><p>По началу и сроку работ</p></div><button type="button" class="icon-button" data-period-close aria-label="Закрыть выбор периода">×</button></header><div class="period-presets">${[['today','Сегодня'],['week','Эта неделя'],['next','Следующая неделя'],['month','Этот месяц'],['all','Всё время']].map(([k,v])=>`<button type="button" data-period-preset="${k}">${v}</button>`).join('')}</div><div class="period-inputs"><label>С<input id="period-from" type="text" inputmode="numeric" placeholder="дд.мм.гггг" autocomplete="off" aria-describedby="period-error"></label><span aria-hidden="true">—</span><label>По<input id="period-to" type="text" inputmode="numeric" placeholder="дд.мм.гггг" autocomplete="off" aria-describedby="period-error"></label></div><div class="period-month-navigation"><button type="button" class="icon-button" data-month-step="-1" aria-label="Предыдущий месяц">←</button><p data-period-instruction aria-live="polite">Выберите начало и конец</p><button type="button" class="icon-button" data-month-step="1" aria-label="Следующий месяц">→</button></div><div class="period-months"></div><p id="period-error" role="alert"></p><footer><button type="button" class="button quiet" data-period-close>Отмена</button><button type="button" class="button primary" data-period-apply>Показать задачи</button></footer></dialog>`;
 const dialog=root.querySelector('dialog'),opener=root.querySelector('#period-open'),input=key=>root.querySelector('#period-'+key);
 function label(){const r=getRange();root.querySelector('[data-period-label]').textContent=r.from?`${displayRangeDate(r.from)} — ${displayRangeDate(r.to)}`:'Всё время';opener.classList.toggle('has-range',!!r.from)}
 function inputs(){for(const k of ['from','to'])input(k).value=displayRangeDate(draft[k]);root.querySelector('#period-error').textContent=''}
 function renderMonths(focusDate){
  root.querySelector('[data-period-instruction]').textContent=choosingEnd?'Теперь выберите конец':'Выберите начало и конец';
  root.querySelector('.period-months').innerHTML=[0,1].map(i=>{
   const date=shiftMonth(month,i);return `<section class="period-month"><h4>${esc(new Intl.DateTimeFormat('ru',{month:'long',year:'numeric'}).format(new Date(date+'T12:00:00')))}</h4><div class="period-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span>${x}</span>`).join('')}</div><div class="period-days">${calendarDays(date,'month').map(d=>d.slice(0,7)!==date.slice(0,7)?'<span></span>':`<button type="button" data-period-day="${d}" class="${d===today()?'is-today ':''}${d===draft.from||d===draft.to?'range-edge ':''}${draft.from&&draft.to&&d>draft.from&&d<draft.to?'in-range':''}" aria-label="${esc(new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')))}" aria-pressed="${d===draft.from||d===draft.to}">${+d.slice(8)}</button>`).join('')}</div></section>`;
  }).join('');
  if(focusDate)root.querySelector(`[data-period-day="${focusDate}"]`)?.focus();
 }
 function close(){dialog.close();opener.setAttribute('aria-expanded','false');opener.focus()}
 function apply(range){onChange(range);label();close()}
 opener.onclick=()=>{draft={...getRange()};month=monthStart(draft.from||today());choosingEnd=false;inputs();renderMonths();dialog.showModal();opener.setAttribute('aria-expanded','true');input('from').focus()};
 dialog.addEventListener('close',()=>opener.setAttribute('aria-expanded','false'));
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-period-close'))return close();
  if(b.dataset.periodShift){const [unit,n]=b.dataset.periodShift.split(':');onChange(shiftRange(getRange(),unit,+n,today()));return label()}
  if(b.dataset.monthStep){month=shiftMonth(month,+b.dataset.monthStep);renderMonths();return}
  if(b.dataset.periodPreset){draft=periodRange(b.dataset.periodPreset,today());choosingEnd=false;month=monthStart(draft.from||today());inputs();renderMonths();if(b.dataset.periodPreset==='all')apply(draft);return}
  if(b.dataset.periodDay){const date=b.dataset.periodDay;if(!choosingEnd){draft={from:date,to:date};choosingEnd=true}else{draft={from:date<draft.from?date:draft.from,to:date<draft.from?draft.from:date};choosingEnd=false}inputs();renderMonths(date);return}
  if(b.hasAttribute('data-period-apply')){
   const from=parseRangeDate(input('from').value),to=parseRangeDate(input('to').value);
   if(!from||!to||from>to){root.querySelector('#period-error').textContent='Укажите обе даты: начало не позже конца.';input(!from?'from':'to').focus();return}apply({from,to});
  }
 });
 dialog.addEventListener('keydown',e=>{
  const date=e.target.dataset.periodDay;if(!date||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const d=new Date(date+'T12:00:00Z'),weekday=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[e.key]));const next=d.toISOString().slice(0,10);
  const shownMonths=matchMedia('(max-width:767px)').matches?1:2;if(next<month||next>=shiftMonth(month,shownMonths))month=monthStart(next);renderMonths(next);
 });
 for(const k of ['from','to'])input(k).addEventListener('change',()=>{const value=parseRangeDate(input(k).value);if(value){draft[k]=value;if(k==='from')month=monthStart(value);renderMonths()}});
 label();return {render:label};
}
