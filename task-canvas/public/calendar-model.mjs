import {overlapsRange} from './task-dates.mjs?rev=20261110-progress-5';
import {ordered} from './order.mjs?rev=20261110-progress-5';
import {localDate,shiftDate,statusGroup} from './model.mjs?rev=20261110-progress-5';
export function monthStart(date){return date.slice(0,7)+'-01'}
export function shiftMonth(date,n){const d=new Date(date+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+n);return localDate(d)}
export function weekStart(date){const day=new Date(date+'T12:00:00').getDay();return shiftDate(date,-((day+6)%7))}
export function calendarDays(anchor,view){
 const start=view==='day'?anchor:view==='week'?weekStart(anchor):weekStart(monthStart(anchor));
 return Array.from({length:view==='day'?1:view==='week'?7:42},(_,i)=>shiftDate(start,i));
}
export function movePeriod(date,view,n){return view==='day'?shiftDate(date,n):view==='week'?shiftDate(date,7*n):shiftMonth(date,n*(view==='months'?12:1))}
export function dayTasks(tasks,date,today=date){return ordered(tasks.filter(t=>overlapsRange(t,date,date)),'time',today)}
export function monthSummary(tasks,month,today){const items=tasks.filter(t=>overlapsRange(t,month+'-01',shiftDate(shiftMonth(month+'-01',1),-1)));return {total:items.length,active:items.filter(t=>!statusGroup(t)).length,overdue:items.filter(t=>!statusGroup(t)&&t.due<today).length,done:items.filter(t=>t.status==='Готово').length}}
// A long selected range is paged, never silently truncated.
export function rangePage(range,page=0,size=42){
 if(!range.from||!range.to)return {days:[],page:0,pages:0,total:0};
 const total=Math.max(0,Math.round((Date.parse(range.to+'T12:00:00Z')-Date.parse(range.from+'T12:00:00Z'))/86400000)+1),pages=Math.ceil(total/size),current=Math.max(0,Math.min(Math.floor(page),pages-1));
 return {days:Array.from({length:Math.max(0,Math.min(size,total-current*size))},(_,i)=>shiftDate(range.from,current*size+i)),page:current,pages,total};
}
