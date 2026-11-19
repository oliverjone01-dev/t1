import {shiftSchedule} from './gantt-model.mjs?rev=20261120-canon-20';
import {shiftDate} from './model.mjs?rev=20261120-canon-20';
// Pure rules for the quick edit menu: deadline shortcuts and a minimal, validated patch.
export function dueShortcuts(today){
 const day=new Date(`${today}T12:00:00`).getDay(),toFriday=(5-day+7)%7||7;
 return [['Сегодня',today],['Завтра',shiftDate(today,1)],['Пятница',shiftDate(today,toFriday)],['Через неделю',shiftDate(today,7)],['Без срока','']];
}
export const QUICK_FIELDS=['title','priority','owner','due','status'];
// Only fields the person actually changed go into the patch; the deadline keeps the start date valid.
export function quickPatch(task,form){
 const next={...task},changed=[];
// Whitespace alone is not an edit: a title or owner with a line break or a double space from the Sheet
 // is written back only when the person really changed the words.
 const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
 const typed=String(form.title??task.title??'');
 if(!norm(typed))throw new Error('Название задачи не может быть пустым.');
 if(norm(typed)!==norm(task.title)){next.title=typed.trim();changed.push('title')}
 const priority=form.priority||null;if((task.priority||null)!==priority){next.priority=priority;changed.push('priority')}
 const owner=String(form.owner??task.owner??'');if(norm(owner)!==norm(task.owner)){next.owner=norm(owner);next.ownerNote='';changed.push('owner')}
 const due=form.due??task.due??'';if(due!==(task.due||'')){Object.assign(next,shiftSchedule(next,due));next.dueNote='';changed.push('due')}
 const status=form.status||task.status||'';if(status!==(task.status||'')&&!(status==='Не указан'&&!task.status)){next.status=status;changed.push('status')}
 if(changed.includes('priority')&&next.positions)next.positions={...next.positions,priority:undefined};
 if(changed.includes('owner')&&next.positions)next.positions={...next.positions,owners:undefined};
 if(changed.includes('due')&&next.positions)next.positions={...next.positions,time:undefined};
 for(const k of ['priority','owners','time'])if(next.positions&&next.positions[k]===undefined)delete next.positions[k];
 return {task:next,changed};
}
// Saving applies only the fields the person changed against the task as it is now. Fields they left alone
// keep whatever a colleague or the Sheet wrote while the menu was open; nothing is written back from the snapshot.
export function applyQuickEdit(current,base,form){
 const {changed}=quickPatch(base,form);
 const own={title:current.title,priority:current.priority||'',owner:current.owner||'',due:current.due||'',status:current.status||'Не указан'};
 for(const k of changed)own[k]=form[k];
 return {task:quickPatch(current,own).task,changed};
}
