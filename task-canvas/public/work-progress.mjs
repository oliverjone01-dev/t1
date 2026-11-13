import {icon} from './icons.mjs?rev=20261113-fix25-14';
const terminal=t=>['Готово','Отменено'].includes(t?.status);
export const progressValue=t=>Number.isInteger(t?.progress)?t.progress:t?.status==='Готово'?100:0;
export const workRunning=t=>t?.status==='В работе';
export const workStarted=t=>!!t?.workStarted||progressValue(t)>0||workRunning(t)||t?.status==='Приостановлено';
export function progressPatch(task,value){
 const progress=Number(value);if(!Number.isInteger(progress)||progress<0||progress>100)throw new Error('Укажите готовность от 0 до 100%.');
 return {...task,progress,workStarted:workStarted(task)||progress>0,...(task.status==='Готово'&&progress<100?{status:'Приостановлено',closedAt:'',archiveKind:''}:{})};
}
export function executionPatch(task,action){
 if(!['play','pause'].includes(action))throw new Error('Неизвестное действие.');
 if(terminal(task))throw new Error('Сначала верните завершённую задачу в работу через статус.');
 if(action==='pause'&&!workStarted(task))return task;
 return {...task,workStarted:true,status:action==='play'?'В работе':'Приостановлено'};
}
export function assertWorkUnchanged(task,base,field='progress'){
 if(!task)throw new Error('Задача удалена. Обновите доску.');
 const fields=field==='progress'?['progress','status']:['status','workStarted'];
 if(fields.some(k=>(task[k]??(k==='workStarted'?false:k==='progress'?progressValue(task):''))!==(base[k]??(k==='workStarted'?false:k==='progress'?progressValue(base):''))))throw new Error('Прогресс или состояние уже изменили. Сначала посмотрите новую версию.');
 return task;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workProgress(task,editable=false){
 const p=progressValue(task),running=workRunning(task),started=workStarted(task),id=encodeURIComponent(task.id),title=esc(task.title),label=`Готовность: ${title}, ${p}%`,body=`<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="progress-track" cx="18" cy="18" r="15"/><circle class="progress-fill" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100-p}"/></svg><small aria-hidden="true"><span>${p}</span><span class="progress-unit">%</span></small>`,ring=editable?`<button type="button" class="work-progress ${running?'is-running':''} ${started?'has-started':''}" data-quick-field="progress" data-quick-id="${id}" aria-haspopup="dialog" aria-label="${label}" title="Готовность · ${p}%">${body}</button>`:`<span class="work-progress ${running?'is-running':''} ${started?'has-started':''}" aria-label="${label}" title="Готовность · ${p}%">${body}</span>`;
 return `<span class="task-execution" data-task-status="${esc(task.status)}">${ring}${editable?`<span class="execution-actions" role="group" aria-label="Работа над задачей: ${title}"><button type="button" data-work-action="play" data-work-id="${id}" aria-label="Запустить: ${title}" title="${terminal(task)?'Сначала верните задачу в работу через статус':running?'Задача выполняется':'Начать работу'}" aria-pressed="${running}" ${terminal(task)?'disabled':''}>${icon('play')}</button><button type="button" data-work-action="pause" data-work-id="${id}" aria-label="Приостановить: ${title}" title="${terminal(task)?'Сначала верните задачу в работу через статус':!started?'Сначала запустите задачу':'Приостановить без сброса прогресса'}" aria-pressed="${task.status==='Приостановлено'}" ${terminal(task)||!started?'disabled':''}>${icon('stop')}</button></span>`:''}</span>`;
}
export function installExecutionControls(host){
 let busy=false;
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-work-action]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();if(!host.canEdit()||busy)return;
  const id=decodeURIComponent(button.dataset.workId),base=host.tasks().find(t=>t.id===id);if(!base)return;const copy=structuredClone(base),basis=host.capture?.();busy=true;button.disabled=true;
  try{const ok=await host.commit(tasks=>{assertWorkUnchanged(tasks.find(t=>t.id===id),copy,'execution');return tasks.map(t=>t.id===id?executionPatch(t,button.dataset.workAction):t)},basis);if(ok!==false)host.toast(button.dataset.workAction==='play'?'Задача запущена':'Задача приостановлена. Прогресс сохранён');}catch(error){host.toast(error.message)}finally{busy=false;if(button.isConnected)button.disabled=false}
 },true);
}
