import {groupFor,QUADRANTS} from './model.mjs?rev=20261120-dnd-21';
import {dateInMonth,insertion,moveInContext,assertDragUnchanged} from './planning-order.mjs?rev=20261120-dnd-21';
import {applyFields,sectionTarget,assertFieldsUnchanged} from './dock-model.mjs?rev=20261120-dnd-21';
export function installPlanningDrag(host){
 let gesture=null,frame=0,blockedClick=false,committing=false;
 const root=document,live=document.createElement('div');live.className='visually-hidden';live.setAttribute('aria-live','polite');root.body.append(live);
 const describe=(field,value)=>field==='due'?(value?'Срок: '+new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00')):'Без срока'):field==='owner'?'Ответственный: '+(value||'не назначен'):'Квадрат: '+({inbox:'Входящие','status:done':'Готово','status:cancelled':'Отменено'}[value]||QUADRANTS.find(q=>q.id===value)?.title||value);
 function clearTarget(){root.querySelectorAll('.planning-drop,.planning-before,.planning-after').forEach(el=>el.classList.remove('planning-drop','planning-before','planning-after'))}
 const REFUSE_CLOSED='Строки «Готово» и «Отменено» задают статус, а не приоритет. Статус: цель внизу экрана.';
 const dayWord=n=>({one:'день',few:'дня',many:'дней',other:'дня'})[new Intl.PluralRules('ru').select(n)];
 const shiftLabel=(from,to)=>{const n=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);return n?`Срок: на ${Math.abs(n)} ${dayWord(Math.abs(n))} ${n<0?'раньше':'позже'}`:''};
 // The label names only what will change for the dragged card; a section that matches it already is left out.
 const patchLabel=patches=>{const source=gesture&&host.tasks().find(t=>t.id===gesture.id);const real=patches.filter(p=>!source||gesture.ids.length>1||(p.field==='due'&&p.from?source.due&&p.from!==p.value:String(p.field==='priority'?source.priority||'':source[p.field]??'')!==String(p.value??'')));return (real.length?real:patches).map(p=>p.field==='due'&&p.from&&source?.due?shiftLabel(p.from,p.value):p).map(x=>typeof x==='string'?x:patchText(x)).filter(Boolean).join(' · ')||'Без изменений'};
 const patchText=({field,value})=>field==='due'||field==='priority'?describe(field,field==='priority'?(value||'inbox'):value):field==='status'?'Статус: '+(value||'не указан'):field==='importance'?'Срочность: '+(value?value+'/5':'не задана'):'Юнит: '+(value||'без юнита');
 // Where the queue cannot be reordered (groups, or a sort other than the board order), a drop still changes fields:
 // the calendar cell sets the date, the section sets its field, a row lends its date or priority. No queue position.
 function fieldTarget(node){
  const source=host.tasks().find(t=>t.id===gesture.id),patches=[];
  const cell=node.closest('[data-drop-date]'),month=node.closest('[data-drop-month]'),section=node.closest('[data-group-key]'),row=node.closest('[data-drop-task]');
  if(host.mode()==='calendar'){if(cell)patches.push({field:'due',value:cell.dataset.dropDate,...(gesture.origin?{from:gesture.origin}:{})});else if(month&&source)patches.push({field:'due',value:dateInMonth(source.due,month.dataset.dropMonth)})}
  const fromSection=section&&sectionTarget(section.dataset.groupKey);if(fromSection&&!patches.some(p=>p.field===fromSection.field))patches.push(fromSection);
  const task=row&&host.tasks().find(t=>t.id===row.dataset.dropTask);
  if(!patches.length&&task&&!gesture.ids.includes(task.id)){const lent=host.sort()==='due'?{field:'due',value:task.due||''}:sectionTarget(groupFor(task,'priority',host.today()));if(lent?.field==='status')return {el:row,refuse:REFUSE_CLOSED};if(lent)patches.push(lent)}
  if(!patches.length)return null;
  return {el:section||cell||month||row,patches,field:patches[0].field,value:patches[0].value,before:null,taskId:null,after:false};
 }
 function targetAt(node,y,keyboard=false){
  if(!gesture||!node)return null;
  if(host.canReorder&&!host.canReorder())return fieldTarget(node);
  // Another day in the calendar is a date move (period keeps its length); the same day is a queue move.
  if(host.mode()==='calendar'&&gesture.origin){const cell=node.closest('[data-drop-date]');if(cell&&cell.dataset.dropDate!==gesture.origin)return fieldTarget(node)}
  const el=node?.closest('[data-drop-task],[data-drop-date],[data-drop-month]');if(!el||!gesture)return null;
  const task=host.tasks().find(t=>t.id===el.dataset.dropTask),source=host.tasks().find(t=>t.id===gesture.id);if(!source||gesture.ids.includes(task?.id))return null;
  // A row of another priority is a valid place: the task takes that priority and lands next to the row.
  const field=host.mode()==='calendar'?'due':host.sort()==='due'?'due':host.sort()==='owner'?'owner':'priority';
  const value=task?(field==='due'?task.due||'':field==='owner'?host.personName(task.owner):groupFor(task,'priority',host.today())):el.hasAttribute('data-drop-date')?el.dataset.dropDate:dateInMonth(source.due,el.dataset.dropMonth);
  // A closed row lends a status, not a priority: dropping next to «Готово» must not close the task.
  if(field==='priority'&&String(value).startsWith('status:'))return {el,refuse:REFUSE_CLOSED};
  const rect=el.getBoundingClientRect(),after=task&&!keyboard&&y>rect.top+rect.height/2;
  const before=task?insertion(host.tasks(),gesture.ids,task.id,after,field,value,host.today(),host.personName):null;
  return {el,field,value,before,taskId:task?.id||null,after};
 }
 function showTarget(target){
  clearTarget();gesture.target=target;
  if(target?.refuse){if(gesture.ghost.textContent!==target.refuse){gesture.ghost.textContent=target.refuse;live.textContent=target.refuse}return}
  if(target)target.el.classList.add(target.taskId?(target.after?'planning-after':'planning-before'):'planning-drop');
  if(target?.patches)target.label=patchLabel(target.patches);
  const label=target?.patches?target.label:target?describe(target.field,target.value)+(target.taskId?' · '+(target.after?'после: ':'перед: ')+host.tasks().find(t=>t.id===target.taskId)?.title:' · в конец очереди'):'Наведите на задачу, дату или цель внизу экрана. Escape: отменить.';
  if(gesture.ghost.textContent!==label){gesture.ghost.textContent=label;live.textContent=label}
 }
 function point(){if(!gesture?.active||gesture.keyboard)return;const {x,y}=gesture;gesture.ghost.style.left=Math.min(innerWidth-310,Math.max(10,x+18))+'px';gesture.ghost.style.top=Math.max(12,Math.min(innerHeight-100,y+20))+'px';try{showTarget(targetAt(document.elementFromPoint(x,y),y))}catch{showTarget(null)}}
 function autoScroll(){if(!gesture?.active)return;if(!gesture.keyboard){let el=document.elementFromPoint(gesture.x,gesture.y);for(;el&&el!==document.body;el=el.parentElement){const style=getComputedStyle(el);if(!/(auto|scroll)/.test(style.overflowY)||el.scrollHeight<=el.clientHeight)continue;const r=el.getBoundingClientRect(),dy=gesture.y<r.top+34?-10:gesture.y>r.bottom-34?10:0;if(dy){const before=el.scrollTop;el.scrollTop+=dy;if(before!==el.scrollTop){point();break}}} }frame=requestAnimationFrame(autoScroll)}
 function activate(){if(!gesture||gesture.active)return;gesture.active=true;gesture.base=structuredClone(host.tasks());gesture.basis=host.capture();host.start();const ghost=document.createElement('div');ghost.className='planning-ghost';ghost.setAttribute('aria-hidden','true');document.body.append(ghost);gesture.ghost=ghost;gesture.handle.closest('[data-drop-task]')?.classList.add('planning-source');document.body.classList.add('planning-dragging');live.textContent='Перемещение начато. Стрелки выбирают место, Пробел подтверждает, Escape отменяет.';point();frame=requestAnimationFrame(autoScroll)}
 function cancel(){if(!gesture)return;const g=gesture;gesture=null;cancelAnimationFrame(frame);g.ghost?.remove();clearTarget();root.querySelectorAll('.planning-source').forEach(el=>el.classList.remove('planning-source'));document.body.classList.remove('planning-dragging');if(g.active){host.cancel();if(g.keyboard)requestAnimationFrame(()=>root.querySelector(`[data-plan-grip="${CSS.escape(g.id)}"]`)?.focus({preventScroll:true}));}}
 async function finish(){if(!gesture)return;const g=gesture,target=g.target;cancel();if(!g.active)return;if(host.dockRelease?.(g.ids))return;if(!host.canEdit()||g.context!==host.context()){host.toast('Вид изменился. Повторите перенос.');return}blockedClick=true;setTimeout(()=>{blockedClick=false},0);if(!target){host.toast('Перенос отменён: место не выбрано.');return}if(target.refuse){host.toast(target.refuse);return}committing=true;try{
  if(target.patches){const ok=await host.commit(current=>{if(!host.canEdit()||g.context!==host.context())throw Error('Вид изменился. Повторите перенос.');assertFieldsUnchanged(current,g.base,g.ids,target.patches);return applyFields(current,g.ids,target.patches)},g.basis);
   if(ok){const what=target.label||patchLabel(target.patches);host.toast(what+(g.ids.length>1?' · задач: '+g.ids.length:'')+'. Cmd+Z: отменить');live.textContent='Перемещение сохранено.'}return}
  const ok=await host.commit(current=>{if(!host.canEdit()||g.context!==host.context())throw Error('Вид изменился. Повторите перенос.');assertDragUnchanged(current,g.base,g.ids,target.field,target.taskId);return moveInContext(current,g.ids,target,host.today(),host.personName)},g.basis);
  if(ok){const manual=host.mode()==='list'&&host.sort()==='title';if(manual)host.manualOrder();host.toast(describe(target.field,target.value)+' · очередь изменена. '+(manual?'Включён ручной порядок. ':'')+'Доступна отмена.');live.textContent='Перемещение сохранено.';requestAnimationFrame(()=>root.querySelector(`[data-plan-grip="${CSS.escape(g.id)}"]`)?.focus({preventScroll:true}));}
 }catch(error){host.toast(error.message);live.textContent=error.message}finally{committing=false}}
 root.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-plan-grip]');if(!handle||e.button!==0||!host.canEdit()||gesture||committing)return;const id=handle.dataset.planGrip;gesture={context:host.context(),id,ids:host.selection().includes(id)?host.selection():[id],handle,origin:handle.closest('[data-drop-date]')?.dataset.dropDate||'',pointerId:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false};handle.setPointerCapture(e.pointerId);e.preventDefault()});
 root.addEventListener('pointermove',e=>{if(!gesture||gesture.keyboard||gesture.pointerId!==e.pointerId)return;gesture.x=e.clientX;gesture.y=e.clientY;if(!gesture.active&&Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>6)activate();if(gesture.active){e.preventDefault();point()}},{passive:false});
 root.addEventListener('pointerup',e=>{if(gesture&&!gesture.keyboard&&gesture.pointerId===e.pointerId)finish()});root.addEventListener('pointercancel',cancel);
 root.addEventListener('click',e=>{if(blockedClick){e.preventDefault();e.stopImmediatePropagation()}},true);
 root.addEventListener('keydown',e=>{
  const handle=e.target.closest('[data-plan-grip]');
  if(!gesture&&!committing&&handle&&[' ','Enter'].includes(e.key)&&host.canEdit()){e.preventDefault();e.stopImmediatePropagation();const id=handle.dataset.planGrip;gesture={context:host.context(),id,ids:host.selection().includes(id)?host.selection():[id],handle,keyboard:true,active:false};activate();gesture.ghost.style.left='50%';gesture.ghost.style.bottom='24px';gesture.ghost.style.transform='translateX(-50%)';showTarget(null);return}
  if(!gesture?.active)return;
  if(e.key==='Escape'||e.key==='Tab'){cancel();live.textContent='Перенос отменён.';if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation()}return}
  if(!gesture.keyboard)return;
  if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();finish();return}
  if(!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopImmediatePropagation();
  const targets=[...root.querySelectorAll(host.mode()==='calendar'?'#calendar-view [data-drop-task],#calendar-view [data-drop-date],#calendar-view [data-drop-month]':'#task-list [data-drop-task]')].filter(el=>el.getClientRects().length&&!gesture.ids.includes(el.dataset.dropTask));
  const origin=(gesture.target?.el||gesture.handle.closest('[data-drop-task]')).getBoundingClientRect(),vertical=['ArrowUp','ArrowDown'].includes(e.key),sign=['ArrowDown','ArrowRight'].includes(e.key)?1:-1;
  const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2}),a=center(origin);
  const candidates=targets.map(el=>{const r=el.getBoundingClientRect(),b=center(r),along=(vertical?b.y-a.y:b.x-a.x)*sign,cross=Math.abs(vertical?b.x-a.x:b.y-a.y);return {el,along,score:along+cross*2}}).filter(v=>v.along>2).sort((a,b)=>a.score-b.score);
  if(candidates[0]){const target=targetAt(candidates[0].el,sign>0?candidates[0].el.getBoundingClientRect().bottom+1:0,false);showTarget(target);target?.el.scrollIntoView({block:'nearest',inline:'nearest'})}
 },true);
 window.addEventListener('blur',cancel);
 return {cancel};
}
