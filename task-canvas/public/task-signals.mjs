export const IMPORTANCE_LABELS=['Не оценена','Низкая','Умеренная','Обычная','Высокая','Критичная'];
export const terminalKind=t=>t?.status==='Готово'?'done':t?.status==='Отменено'?'cancelled':'';
export function metadata(t){return {importance:Number(t.importance)||0,closedAt:t.closedAt||'',archiveKind:t.archiveKind||''}}
export function packedPositions(t){const p=structuredClone(t.positions||{}),m=metadata(t);if(m.importance||m.closedAt||m.archiveKind)p._task=m;return p}
export function trackStatus(before,task,at=new Date().toISOString()){
 const kind=terminalKind(task);if(!kind)return {...task,closedAt:'',archiveKind:''};
 return {...task,closedAt:before?.status===task.status&&before.closedAt?before.closedAt:(task.closedAt&&task.closedAt!==before?.closedAt?task.closedAt:at),archiveKind:before?.status===task.status?(task.archiveKind||''):''};
}
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export function dateShift(d,n){return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export const closedDay=t=>t.closedAt?new Date(Date.parse(t.closedAt)+10800000).toISOString().slice(0,10):'';
export function archiveEligible(task,today){return !!terminalKind(task)&&!!task.closedAt&&closedDay(task)<dateShift(weekStart(today),-7)}
export function lifecycle(before,task,today,at){let next=trackStatus(before,task,at);if(archiveEligible(next,today))next.archiveKind=terminalKind(next);return next}
export function inWeek(task,start){const end=dateShift(start,6);return [task.due,terminalKind(task)?closedDay(task):''].some(d=>d&&d>=start&&d<=end)}
export function temperature(t,editable=false){const n=Number(t.importance)||0,title=`Важность ${n?n+' из 5 — ':''}${IMPORTANCE_LABELS[n]}`;return `<label class="temperature level-${n}" title="${title}" aria-label="${title}"><span class="temperature-bars" aria-hidden="true">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'lit':''}"></i>`).join('')}</span><span class="temperature-number">${n||'—'}<small>/5</small></span>${editable?`<select data-importance-id="${encodeURIComponent(t.id)}" aria-label="Изменить важность задачи">${IMPORTANCE_LABELS.map((s,i)=>`<option value="${i}" ${i===n?'selected':''}>${i?i+' / 5 · ':''}${s}</option>`).join('')}</select>`:''}</label>`}

export function observedTask(task,observed){if(!observed||observed.status!==task.status||!terminalKind(task))return task;return {...task,closedAt:task.closedAt||observed.closedAt||'',archiveKind:task.archiveKind||observed.archiveKind||''}}
export function registryMatch(task,{week='',archive='',hideDone=false}={}){if(week)return inWeek(task,week);if(archive==='all')return true;if(archive)return task.archiveKind===archive;return !task.archiveKind&&(!hideDone||!terminalKind(task))}
