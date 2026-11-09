import {shiftSchedule} from './gantt-model.mjs?rev=20261110-priority-3';
import {ordered,orderKey} from './order.mjs?rev=20261110-priority-3';
import {statusGroup, groupFor, localDate, shiftDate, validateBoard, STATUSES, QUADRANTS} from './model.mjs?rev=20261110-priority-3';
import {parseAssignee} from './people.mjs?rev=20261110-priority-3';
import {normalizeQuery} from './ui-model.mjs?rev=20261110-priority-3';

export const FOCUS = [['all','Все задачи'],['today','Сегодня'],['overdue','Просрочено'],['week','Ближайшие 7 дней'],['unassigned','Без ответственного'],['undated','Без срока'],['waiting','В ожидании'],['unread','Новые и изменённые'],['pinned','Избранное']];
export const SORTS = [['manual','Порядок доски'],['due','Ближайший срок'],['priority','Сначала важные'],['importance','Срочность 5 → 1'],['owner','По ответственному'],['title','По названию']];
export function matchesFocus(task, focus, today, pins=[], unread=false) {
  if(focus==='all')return true;
  if(focus==='pinned')return pins.includes(task.id);
  if(focus==='unread')return !!unread;
  if(statusGroup(task))return false;
  return ({today:()=>task.due===today,overdue:()=>!!task.due&&task.due<today,week:()=>!!task.due&&task.due>=today&&task.due<=shiftDate(today,6),unassigned:()=>!task.owner,undated:()=>!task.due,waiting:()=>task.status==='В ожидании'}[focus]||(()=>true))();
}
export function sortTasks(tasks,sort,ownerName=value=>value,today=localDate()) {
  const priority=t=>statusGroup(t)?(t.status==='Готово'?5:6):({do:0,plan:1,delegate:2,later:3}[t.priority]??4);
  const compare=(a,b)=>String(a).localeCompare(String(b),'ru',{numeric:true});
  const rank=(a,b)=>{const mode=sort==='due'?'time':sort==='owner'?'owners':'priority',x=orderKey(a,mode,today),y=orderKey(b,mode,today);return x<y?-1:x>y?1:0};
  return sort==='manual'?['do','plan','delegate','later','inbox','status:done','status:cancelled'].flatMap(group=>ordered(tasks.filter(t=>groupFor(t,'priority','')===group),'priority','')):[...tasks].sort((a,b)=>(sort==='due'?compare(a.due||'9999',b.due||'9999'):sort==='importance'?Number(b.importance||0)-Number(a.importance||0):sort==='priority'?priority(a)-priority(b):sort==='owner'?Number(!a.owner)-Number(!b.owner)||compare(ownerName(a.owner),ownerName(b.owner)):compare(a.title,b.title))||(['due','owner','priority'].includes(sort)?rank(a,b):0)||compare(a.title,b.title)||compare(a.id,b.id));
}
export function cleanView(value={}) {
  value=value||{};
  return {query:String(value.query||'').slice(0,500),unit:String(value.unit||'').slice(0,100),owner:String(value.owner||'').slice(0,100),hideDone:!!value.hideDone,focus:FOCUS.some(([id])=>id===value.focus)?value.focus:'all',sort:SORTS.some(([id])=>id===value.sort)?value.sort:'manual',mode:['priority','owners','time','list','calendar','gantt'].includes(value.mode)?value.mode:'priority'};
}
export function cleanPersonal(value={}) {
  return {version:1,pins:[...new Set(Array.isArray(value?.pins)?value.pins.filter(x=>typeof x==='string'):[])].slice(0,2000),views:(Array.isArray(value?.views)?value.views:[]).filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&v.name.trim()).slice(0,12).map(v=>({id:v.id,name:v.name.trim().slice(0,60),view:cleanView(v.view)}))};
}
export function deadlinePreset(today, preset) {
  if(preset==='clear')return '';
  if(!['today','tomorrow','week'].includes(preset))throw new Error('Неизвестный срок.');
  return shiftDate(today,{today:0,tomorrow:1,week:7}[preset]);
}
export function bulkPatch(values) {
  const patch={};
  for(const key of ['owner','due','status','priority','importance']) {
    if(values[key+'Mode']==='keep'||!values[key+'Mode'])continue;
    patch[key]=values[key+'Mode']==='clear'?'':String(values[key]||'').trim();
    if(values[key+'Mode']==='set'&&!patch[key])throw new Error('Укажите значение для назначения или выберите «Очистить».');
  }
  if('importance' in patch){patch.importance=Number(patch.importance||0);if(!Number.isInteger(patch.importance)||patch.importance<0||patch.importance>5)throw new Error('Выберите срочность от 1 до 5.')}
  if('owner' in patch){const owner=parseAssignee(patch.owner);if(owner===null)throw new Error('Укажите одного ответственного.');patch.owner=owner;}
  if('status' in patch&&!STATUSES.includes(patch.status))throw new Error('Выберите статус.');
  if('priority' in patch&&patch.priority&&!QUADRANTS.some(q=>q.id===patch.priority))throw new Error('Выберите приоритет.');
  if('due' in patch)validateBoard([{id:'date-check',title:'Проверка',due:patch.due}]);
  if(!Object.keys(patch).length)throw new Error('Выберите хотя бы одно изменение.');
  return patch;
}
export function applyBulk(tasks,base,patch) {
  const ids=new Set(base.map(t=>t.id));
  for(const old of base){
    const current=tasks.find(t=>t.id===old.id);
    if(!current)throw new Error('Одна из выбранных задач удалена. Закройте окно и выберите задачи заново.');
    const fields=new Set(Object.keys(patch));
    if('importance' in patch){patch.importance=Number(patch.importance||0);if(!Number.isInteger(patch.importance)||patch.importance<0||patch.importance>5)throw new Error('Выберите срочность от 1 до 5.')}
  if('owner' in patch)fields.add('ownerNote');
    if('due' in patch){fields.add('dueNote');fields.add('start');}
    for(const key of fields)if((current[key]||'')!==(old[key]||'')&&(current[key]||'')!==(patch[key]||''))throw new Error('Выбранные поля изменились на доске. Закройте окно, проверьте новые значения и повторите.');
  }
  return validateBoard(tasks.map(task=>{
    if(!ids.has(task.id))return task;
    const next={...('due' in patch&&patch.due?shiftSchedule(task,patch.due):task),...patch,positions:structuredClone(task.positions||{})};
    for(const [key,mode] of [['owner','owners'],['due','time'],['priority','priority']])if(key in patch&&patch[key]!==task[key])delete next.positions[mode];
    if('owner' in patch&&patch.owner!==task.owner)next.ownerNote='';
    if('due' in patch&&patch.due!==task.due)next.dueNote='';
    return next;
  }));
}
export function parseTaskLines(text,existing=[]) {
  const titles=String(text).split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/,'').trim()).filter(Boolean);
  if(!titles.length)throw new Error('Напишите хотя бы одну задачу, каждую с новой строки.');
  if(titles.length>50)throw new Error('За один раз можно добавить до 50 задач.');
  if(titles.some(t=>t.length>1000))throw new Error('Название задачи не должно быть длиннее 1000 символов.');
  const seen=new Set(existing.map(t=>normalizeQuery(t.title)));
  return titles.map(title=>{const key=normalizeQuery(title),duplicate=seen.has(key);seen.add(key);return {title,duplicate};});
}
export function duplicateValues(task) {
  return {title:task.title,unit:task.unit||'',owner:task.owner||'',description:task.description||'',priority:task.priority||'',importance:Number(task.importance||0),status:'В ожидании',due:'',comment:''};
}
export function taskLink(url,id) {
  const link=new URL(url);link.hash='task='+encodeURIComponent(id);return link.href;
}
export function linkedTask(hash) {
  return new URLSearchParams(String(hash).replace(/^#/, '')).get('task');
}
