import {ordered} from './order.mjs?rev=20261110-priority-3';
import {localDate,shiftDate,statusGroup} from './model.mjs?rev=20261110-priority-3';
export function monthStart(date){return date.slice(0,7)+'-01'}
export function shiftMonth(date,n){const d=new Date(date+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+n);return localDate(d)}
export function weekStart(date){const day=new Date(date+'T12:00:00').getDay();return shiftDate(date,-((day+6)%7))}
export function calendarDays(anchor,view){
 const start=view==='day'?anchor:view==='week'?weekStart(anchor):weekStart(monthStart(anchor));
 return Array.from({length:view==='day'?1:view==='week'?7:42},(_,i)=>shiftDate(start,i));
}
export function movePeriod(date,view,n){return view==='day'?shiftDate(date,n):view==='week'?shiftDate(date,7*n):shiftMonth(date,n*(view==='months'?12:1))}
export function dayTasks(tasks,date,today=date){return ordered(tasks.filter(t=>t.due===date),'time',today)}
export function monthSummary(tasks,month,today){const items=tasks.filter(t=>t.due?.startsWith(month));return {total:items.length,active:items.filter(t=>!statusGroup(t)).length,overdue:items.filter(t=>!statusGroup(t)&&t.due<today).length,done:items.filter(t=>t.status==='Готово').length}}
