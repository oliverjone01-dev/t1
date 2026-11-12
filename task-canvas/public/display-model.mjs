import {QUADRANTS,STATUSES} from './model.mjs?rev=20261111-status-8';
import {dateShift} from './task-signals.mjs?rev=20261111-status-8';
export const DISPLAY_KEY='gengroup.task-canvas.display.v1';
export const CARD_VIEWS=['detailed','compact','rows'];
export function cleanDisplay(value){return {cards:CARD_VIEWS.includes(value?.cards)?value.cards:'detailed',gantt:CARD_VIEWS.includes(value?.gantt)?value.gantt:'compact',group:['none','status','owner','unit','priority','day'].includes(value?.group)?value.group:'none'}}
export function readDisplay(storage){try{return cleanDisplay(JSON.parse(storage.getItem(DISPLAY_KEY)||'{}'))}catch{return cleanDisplay(null)}}
export function dayRange(range,today,delta=0){const day=dateShift(range?.from||today,delta);return {from:day,to:day}}
export function taskSections(tasks,by='none'){
 if(by==='none')return [{label:'',items:tasks}];const groups=new Map();
 for(const task of tasks){const label=by==='day'?task.due||'Без срока':by==='owner'?task.displayOwner||task.owner||'Не назначен':by==='unit'?task.unit||'Без юнита':by==='priority'?QUADRANTS.find(q=>q.id===task.priority)?.title||'Входящие':task.status||'Не указан';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(task)}
 return [...groups].sort(([a],[b])=>by==='status'?STATUSES.indexOf(a)-STATUSES.indexOf(b):a.localeCompare(b,'ru')).map(([label,items])=>({label:by==='day'&&/^\d{4}-/.test(label)?new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(label+'T12:00:00')):label,items}));
}
