import {QUADRANTS,STATUSES,shiftDate,weekEnd,validateBoard,statusGroup} from './model.mjs?rev=20261120-dnd-21';
import {shiftSchedule,dayDistance} from './gantt-model.mjs?rev=20261120-dnd-21';
// Pure rules of the «Куда перенести» dock: which targets exist today and what a drop on them writes.
const monthEnd=today=>{const d=new Date(`${today.slice(0,7)}-01T12:00:00`);d.setMonth(d.getMonth()+1);d.setDate(0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const DOCK_STATUSES=['В работе','В ожидании','Приостановлено','Готово','Отменено'];
export function dockTargets(today){
 const dates=[['Сегодня',today],['Завтра',shiftDate(today,1)],['До конца недели',weekEnd(today)],['До конца месяца',monthEnd(today)]];
 const seen=new Set(),due=[];
 for(const [label,value] of dates){if(seen.has(value))continue;seen.add(value);due.push({field:'due',value,label})}
 due.push({field:'due',value:'',label:'Без срока'});
 return [
  {id:'due',title:'Срок',targets:due},
  {id:'priority',title:'Приоритет',targets:[...QUADRANTS.map(q=>({field:'priority',value:q.id,label:q.title})),{field:'priority',value:'',label:'Входящие'}]},
  {id:'status',title:'Статус',targets:DOCK_STATUSES.map(s=>({field:'status',value:s,label:s}))},
 ];
}
// One drop = one change for every dragged task. Only the target field (and what keeps it valid) is written;
// a view's remembered card position for that field is dropped so the card lands in its new group.
export const DROP_FIELDS=['due','priority','status','importance','unit','owner'];
// Only an explicit dock drop brings a closed task back to work (as a matrix quadrant does) and the toast says so.
// A calendar cell or a list row keeps the status, as before: moving a finished task's date must not reopen it.
export const reopens=(t,{field,value,reopen})=>!!reopen&&!!statusGroup(t)&&(field==='priority'||field==='due'&&!!value);
function applyField(t,patch){
 if(reopens(t,patch))t={...t,status:'В работе'};
 const {field,value}=patch,positions={...(t.positions||{})};
 // A calendar drop carries the day the card was taken from: the whole period moves by that distance,
 // so a five-day task grabbed on Wednesday and dropped on Tuesday moves one day, not to end on Tuesday.
 if(field==='due'&&patch.from&&t.due&&value){const delta=dayDistance(patch.from,value);if(!delta)return t;return applyField(t,{field:'due',value:shiftDate(t.due,delta)})}
 if(field==='due'){if((t.due||'')===(value||''))return t;delete positions.time;return {...shiftSchedule(t,value||''),dueNote:'',positions}}
 if(field==='priority'){const v=value||null;if((t.priority||null)===v)return t;delete positions.priority;return {...t,priority:v,positions}}
 if(field==='owner'){if((t.owner||'')===(value||''))return t;delete positions.owners;return {...t,owner:value||'',ownerNote:'',positions}}
 if(field==='importance'){const v=Number(value)||0;if((Number(t.importance)||0)===v)return t;return {...t,importance:v}}
 if((t[field]||'')===(value||''))return t;return {...t,[field]:value||''};
}
// Several fields in one step (a week cell inside a priority section sets the date and the priority together).
export function applyFields(tasks,ids,patches){
 if(!patches?.length||patches.some(p=>!DROP_FIELDS.includes(p?.field)))throw new Error('Неизвестная цель переноса.');
 const set=new Set(ids);
 if(!tasks.some(t=>set.has(t.id)))throw new Error('Задачи уже убраны с доски.');
 return validateBoard(tasks.map(t=>set.has(t.id)?patches.reduce(applyField,t):t));
}
export const applyDock=(tasks,ids,target)=>applyFields(tasks,ids,[{...target,reopen:true}]);
// What a drop into a grouped section sets. Owner sections are left out: their key may be a directory id.
export function sectionTarget(key){
 if(!key||key==='all')return null;
 if(QUADRANTS.some(q=>q.id===key))return {field:'priority',value:key};
 if(key==='inbox')return {field:'priority',value:''};
 if(key.startsWith('status:')){const name={done:'Готово',cancelled:'Отменено'}[key.slice(7)]||key.slice(7);return STATUSES.includes(name)?{field:'status',value:name==='Не указан'?'':name}:null}
 if(key.startsWith('importance:')){const n=Number(key.slice(11));return Number.isInteger(n)&&n>=0&&n<=5?{field:'importance',value:n}:null}
 if(key.startsWith('unit:'))return {field:'unit',value:key.slice(5)==='__none'?'':key.slice(5)};
 if(key.startsWith('day:')){const d=key.slice(4);return d==='__none'?{field:'due',value:''}:/^\d{4}-\d{2}-\d{2}$/.test(d)?{field:'due',value:d}:null}
 return null;
}
// Conflict guard for field drops: a field someone changed during the drag is not overwritten silently.
export function assertFieldsUnchanged(current,base,ids,patches){
 for(const id of ids){const a=base.find(t=>t.id===id),b=current.find(t=>t.id===id);
  if(!a||!b)throw new Error('Задача удалена во время переноса. Обновите выбор и повторите.');
  for(const {field} of patches){const keys=field==='due'?['due','start']:[field];if(keys.some(k=>JSON.stringify(a[k]??'')!==JSON.stringify(b[k]??'')))throw new Error('Это поле уже изменили на другом устройстве. Проверьте новые данные и повторите перенос.')}}
}
export function dockSummary(target,count){
 const what=target.field==='due'?(target.value?`Срок: ${target.label.toLowerCase()}`:'Срок снят'):target.field==='priority'?`Приоритет: ${target.label}`:`Статус: ${target.label}`;
 return count>1?`${what} · задач: ${count}`:what;
}
