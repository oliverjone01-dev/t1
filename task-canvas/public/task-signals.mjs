import {overlapsRange} from './task-dates.mjs?rev=20261110-progress-5';
export const IMPORTANCE_LABELS=['Не оценена','Низкая','Умеренная','Обычная','Высокая','Критичная'];
export const terminalKind=t=>t?.status==='Готово'?'done':t?.status==='Отменено'?'cancelled':'';
export function metadata(t){return {...(t.start?{start:t.start}:{}),importance:Number(t.importance)||0,progress:Number(t.progress??(t.status==='Готово'?100:0)),workStarted:!!t.workStarted,closedAt:t.closedAt||'',archiveKind:t.archiveKind||''}}
export function packedPositions(t){const p=structuredClone(t.positions||{}),m=metadata(t);if(m.start||m.importance||m.closedAt||m.archiveKind||m.progress||m.workStarted)p._task=m;return p}
export function trackStatus(before,task,at=new Date().toISOString()){
 task={...task,workStarted:!!task.workStarted||['В работе','Приостановлено'].includes(task.status)||Number(task.progress)>0};
 const kind=terminalKind(task);if(!kind)return {...task,closedAt:'',archiveKind:''};
 return {...task,...(task.status==='Готово'?{progress:100}:{}),closedAt:before?.status===task.status&&before.closedAt?before.closedAt:(task.closedAt&&task.closedAt!==before?.closedAt?task.closedAt:at),archiveKind:before?.status===task.status?(task.archiveKind||''):''};
}
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export function dateShift(d,n){return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export const closedDay=t=>t.closedAt?new Date(Date.parse(t.closedAt)+10800000).toISOString().slice(0,10):'';
export function archiveEligible(task,today){return !!terminalKind(task)&&!!task.closedAt&&closedDay(task)<dateShift(weekStart(today),-7)}
export function lifecycle(before,task,today,at){let next=trackStatus(before,task,at);if(archiveEligible(next,today))next.archiveKind=terminalKind(next);return next}
export function inWeek(task,start){const end=dateShift(start,6);return !!(task.start&&task.due&&task.start<=end&&task.due>=start)||[task.due,task.due?'':task.start,terminalKind(task)?closedDay(task):''].some(d=>d&&d>=start&&d<=end)}
export function temperature(t,editable=false){const n=Number(t.importance)||0,title=`Срочность ${n?n+' из 5 · ':''}${IMPORTANCE_LABELS[n]}`,body=`<span class="temperature-bars" aria-hidden="true">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'lit':''}"></i>`).join('')}</span><span class="temperature-number">${n||'—'}<small>/5</small></span>`;return editable?`<button type="button" class="temperature level-${n}" title="${title}" data-quick-field="importance" data-quick-id="${encodeURIComponent(t.id)}" aria-label="${title}" aria-haspopup="dialog">${body}</button>`:`<span class="temperature level-${n}" title="${title}" aria-label="${title}">${body}</span>`}


export function observedTask(task,observed){if(!observed||observed.status!==task.status||!terminalKind(task))return task;return {...task,closedAt:task.closedAt||observed.closedAt||'',archiveKind:task.archiveKind||observed.archiveKind||''}}
export function registryMatch(task,{week='',from='',to='',archive='',hideDone=false}={}){if(!overlapsRange(task,from,to))return false;if(archive.startsWith('status:'))return (task.status||'Не указан')===archive.slice(7);if(week)return inWeek(task,week);if(archive==='all')return true;if(archive)return task.archiveKind===archive;return !task.archiveKind&&(!hideDone||!terminalKind(task))}
