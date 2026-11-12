import {QUADRANTS,STATUSES,statusGroup} from './model.mjs?rev=20261111-status-8';
import {dateShift,IMPORTANCE_LABELS,registryMatch} from './task-signals.mjs?rev=20261111-status-8';
export const DISPLAY_KEY='gengroup.task-canvas.display.v1';
export const GROUP_KEY='gengroup.task-canvas.grouping.v1';
export const CARD_VIEWS=['detailed','compact','rows'];
export const GROUPS=[['auto','По виду доски'],['none','Без групп'],['unit','По юнитам'],['owner','По людям'],['importance','По срочности'],['status','По статусам'],['priority','По приоритетам'],['day','По срокам']];
export const validGroup=value=>GROUPS.some(([id])=>id===value);
export const DEFAULT_GROUPS={priority:'auto',owners:'auto',time:'auto',list:'none',calendar:'none',gantt:'auto'};
export function effectiveGroup(mode,value='auto'){return value==='auto'?({priority:'priority',owners:'owner',time:'day',gantt:'unit'}[mode]||'none'):validGroup(value)?value:'none'}
export function readGroups(storage,legacy='none'){let raw={};try{raw=JSON.parse(storage.getItem(GROUP_KEY)||'{}')||{}}catch{};return Object.fromEntries(Object.entries(DEFAULT_GROUPS).map(([mode,fallback])=>[mode,validGroup(raw[mode])?raw[mode]:mode==='list'&&validGroup(legacy)?legacy:fallback]))}
export function cleanDisplay(value){return {cards:CARD_VIEWS.includes(value?.cards)?value.cards:'detailed',gantt:CARD_VIEWS.includes(value?.gantt)?value.gantt:'compact',group:GROUPS.some(([id])=>id===value?.group)?value.group:'none'}}
export function readDisplay(storage){try{return cleanDisplay(JSON.parse(storage.getItem(DISPLAY_KEY)||'{}'))}catch{return cleanDisplay(null)}}
export function dayRange(range,today,delta=0){const day=dateShift(range?.from||today,delta);return {from:day,to:day}}
export function groupDescriptor(task,by){
 if(by==='none'||by==='auto')return {key:'all',label:'',rank:0};
 if(by==='importance'){const n=Number(task.importance)||0;return {key:'importance:'+n,label:n?`${n}/5 · ${IMPORTANCE_LABELS[n]}`:'Срочность не задана',rank:n?5-n:6}}
 if(by==='owner'){const name=task.displayOwner||task.owner||'';return {key:'owner:'+(task.ownerKey||name||'__none'),label:name||'Не назначен',rank:name?0:1}}
 if(by==='unit')return {key:'unit:'+(task.unit||'__none'),label:task.unit||'Без юнита',rank:task.unit?0:1};
 if(by==='day')return {key:'day:'+(task.due||'__none'),label:task.due?new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(task.due+'T12:00:00')):'Без срока',rank:task.due?0:1,order:task.due||''};
 if(by==='priority'){const terminal=statusGroup(task),q=QUADRANTS.find(q=>q.id===task.priority);return {key:terminal||q?.id||'inbox',label:terminal?task.status:q?.title||'Входящие',rank:terminal?(task.status==='Готово'?5:6):q?QUADRANTS.indexOf(q):4}}
 return {key:'status:'+(task.status||'Не указан'),label:task.status||'Не указан',rank:Math.max(0,STATUSES.indexOf(task.status||'Не указан'))};
}
export function taskSections(tasks,by='none'){
 const groups=new Map();for(const task of tasks){const d=groupDescriptor(task,by);if(!groups.has(d.key))groups.set(d.key,{...d,items:[]});groups.get(d.key).items.push(task)}
 return [...groups.values()].sort((a,b)=>a.rank-b.rank||(a.order||a.label).localeCompare(b.order||b.label,'ru',{numeric:true})||a.key.localeCompare(b.key));
}
export const canReorderPresentation=(sort,group)=>sort==='manual'&&group==='none';
export const terminalRegistry=scope=>['done','cancelled','status:Готово','status:Отменено'].includes(scope);
export function reconcileRegistry(archive,hideDone,changed){if(changed==='archive'&&terminalRegistry(archive))hideDone=false;if(changed==='hideDone'&&hideDone&&terminalRegistry(archive))archive='';return {archive,hideDone}}

// The archive scope does not disable an explicitly selected visibility filter.
export const presentationRegistry=(task,options={})=>!(options.hideDone&&statusGroup(task))&&registryMatch(task,options);
