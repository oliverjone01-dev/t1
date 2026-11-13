import {shiftSchedule} from './gantt-model.mjs?rev=20261113-system-13';
import {generateNKeysBetween} from './vendor/fractional-indexing.mjs?rev=20261111-status-8';
import {groupFor,validateBoard,localDate} from './model.mjs?rev=20261111-status-8';
import {ordered,orderKey,reorderTasks} from './order.mjs?rev=20261111-status-8';
export function dateInMonth(due,month){
 const day=Number((due||'').slice(8))||1,last=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
 return month+'-'+String(Math.min(day,last)).padStart(2,'0');
}
export function assertDragUnchanged(current,base,ids,field,targetId=null){
 const mode=field==='due'?'time':field==='owner'?'owners':'priority',fields=field==='priority'?['priority','status']:[field,field==='owner'?'ownerNote':'dueNote',...(field==='due'?['start']:[])];
 for(const id of new Set([...ids,...(targetId?[targetId]:[])])){
  const a=base.find(t=>t.id===id),b=current.find(t=>t.id===id);
  if(!a||!b)throw new Error('Задача удалена во время переноса. Обновите выбор и повторите.');
  if(fields.some(key=>(a[key]||'')!==(b[key]||''))||JSON.stringify(a.positions?.[mode]||null)!==JSON.stringify(b.positions?.[mode]||null))throw new Error('Порядок или выбранное поле изменились на другом устройстве. Проверьте новые данные и повторите перенос.');
 }
}
export function contextTasks(tasks,field,value,today,ownerName=x=>x){
 const selected=tasks.filter(t=>field==='priority'?groupFor(t,'priority',today)===value:field==='owner'?ownerName(t.owner)===ownerName(value):(t.due||'')===value);
 return ordered(selected,field==='due'?'time':field==='owner'?'owners':'priority',today);
}
export function insertion(tasks,ids,target,after,field,value,today,ownerName=x=>x){
 if(!target)return null;
 const rest=contextTasks(tasks,field,value,today,ownerName).filter(t=>!ids.includes(t.id)),index=rest.findIndex(t=>t.id===target);
 if(index<0)throw new Error('Место вставки недоступно.');
 return after?rest[index+1]?.id||null:target;
}
export function moveInContext(tasks,ids,{field,value,before=null},today,ownerName=x=>x){
 if(field==='priority')return reorderTasks(tasks,ids,{id:value},before,today);
 if(!['owner','due'].includes(field))throw new Error('Неизвестное действие переноса.');
 const mode=field==='due'?'time':'owners',moving=ordered(tasks.filter(t=>ids.includes(t.id)),mode,today),rest=contextTasks(tasks,field,value,today,ownerName).filter(t=>!ids.includes(t.id));
 if(!moving.length)throw new Error('Нет задач для переноса.');
 const index=before===null?rest.length:rest.findIndex(t=>t.id===before);if(index<0)throw new Error('Место вставки изменилось.');
 const lo=index?orderKey(rest[index-1],mode,today):null,hi=index<rest.length?orderKey(rest[index],mode,today):null;
 if(lo&&hi&&lo===hi)throw new Error('Порядок здесь одновременно изменился. Выберите соседнее место.');
 const ranks=generateNKeysBetween(lo,hi,moving.length);if(ranks.some(r=>r.length>512))throw new Error('Слишком плотная очередь. Выберите соседнее место.');
 const updates=new Map(moving.map((t,i)=>{const next={...(field==='due'&&t.due&&value?shiftSchedule(t,value):t),[field]:value,positions:structuredClone(t.positions||{})};if((t[field]||'')!==value)next[field==='due'?'dueNote':'ownerNote']='';next.positions[mode]={group:groupFor(next,mode,today),x:24,y:96,order:ranks[i]};return [t.id,next]}));
 return validateBoard(tasks.map(t=>updates.get(t.id)||t));
}
