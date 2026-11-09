import {groupFor,QUADRANTS} from './model.mjs?rev=20261109-priority-2';
import {dateInMonth,insertion,moveInContext,assertDragUnchanged} from './planning-order.mjs?rev=20261109-priority-2';
export function installPlanningDrag(host){
 let gesture=null,frame=0,blockedClick=false,committing=false;
 const root=document,live=document.createElement('div');live.className='visually-hidden';live.setAttribute('aria-live','polite');root.body.append(live);
 const describe=(field,value)=>field==='due'?(value?'Срок: '+new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00')):'Без срока'):field==='owner'?'Ответственный: '+(value||'не назначен'):'Квадрат: '+({inbox:'Входящие','status:done':'Готово','status:cancelled':'Отменено'}[value]||QUADRANTS.find(q=>q.id===value)?.title||value);
 function clearTarget(){root.querySelectorAll('.planning-drop,.planning-before,.planning-after').forEach(el=>el.classList.remove('planning-drop','planning-before','planning-after'))}
 function targetAt(node,y,keyboard=false){
  const el=node?.closest('[data-drop-task],[data-drop-date],[data-drop-month]');if(!el||!gesture)return null;
  const task=host.tasks().find(t=>t.id===el.dataset.dropTask),source=host.tasks().find(t=>t.id===gesture.id);if(!source||gesture.ids.includes(task?.id))return null;
  const field=host.mode()==='calendar'?'due':host.sort()==='due'?'due':host.sort()==='owner'?'owner':'priority';
  const value=task?(field==='due'?task.due||'':field==='owner'?host.personName(task.owner):groupFor(task,'priority',host.today())):el.hasAttribute('data-drop-date')?el.dataset.dropDate:dateInMonth(source.due,el.dataset.dropMonth);
  const rect=el.getBoundingClientRect(),after=task&&!keyboard&&y>rect.top+rect.height/2;
  const before=task?insertion(host.tasks(),gesture.ids,task.id,after,field,value,host.today(),host.personName):null;
  return {el,field,value,before,taskId:task?.id||null,after};
 }
 function showTarget(target){
  clearTarget();gesture.target=target;
  if(target)target.el.classList.add(target.taskId?(target.after?'planning-after':'planning-before'):'planning-drop');
  const label=target?describe(target.field,target.value)+(target.taskId?' · '+(target.after?'после: ':'перед: ')+host.tasks().find(t=>t.id===target.taskId)?.title:' · в конец очереди'):'Наведите на задачу или дату. Escape — отменить.';
  if(gesture.ghost.textContent!==label){gesture.ghost.textContent=label;live.textContent=label}
 }
 function point(){if(!gesture?.active||gesture.keyboard)return;const {x,y}=gesture;gesture.ghost.style.left=Math.min(innerWidth-310,Math.max(10,x+18))+'px';gesture.ghost.style.top=Math.max(12,Math.min(innerHeight-100,y+20))+'px';try{showTarget(targetAt(document.elementFromPoint(x,y),y))}catch{showTarget(null)}}
 function autoScroll(){if(!gesture?.active)return;if(!gesture.keyboard){let el=document.elementFromPoint(gesture.x,gesture.y);for(;el&&el!==document.body;el=el.parentElement){const style=getComputedStyle(el);if(!/(auto|scroll)/.test(style.overflowY)||el.scrollHeight<=el.clientHeight)continue;const r=el.getBoundingClientRect(),dy=gesture.y<r.top+34?-10:gesture.y>r.bottom-34?10:0;if(dy){const before=el.scrollTop;el.scrollTop+=dy;if(before!==el.scrollTop){point();break}}} }frame=requestAnimationFrame(autoScroll)}
 function activate(){if(!gesture||gesture.active)return;gesture.active=true;gesture.base=structuredClone(host.tasks());gesture.basis=host.capture();host.start();const ghost=document.createElement('div');ghost.className='planning-ghost';ghost.setAttribute('aria-hidden','true');document.body.append(ghost);gesture.ghost=ghost;gesture.handle.closest('[data-drop-task]')?.classList.add('planning-source');document.body.classList.add('planning-dragging');live.textContent='Перемещение начато. Стрелки выбирают место, Пробел подтверждает, Escape отменяет.';point();frame=requestAnimationFrame(autoScroll)}
 function cancel(){if(!gesture)return;const g=gesture;gesture=null;cancelAnimationFrame(frame);g.ghost?.remove();clearTarget();root.querySelectorAll('.planning-source').forEach(el=>el.classList.remove('planning-source'));document.body.classList.remove('planning-dragging');if(g.active){host.cancel();if(g.keyboard)requestAnimationFrame(()=>root.querySelector(`[data-plan-grip="${CSS.escape(g.id)}"]`)?.focus({preventScroll:true}));}}
 async function finish(){if(!gesture)return;const g=gesture,target=g.target;cancel();if(!g.active)return;blockedClick=true;setTimeout(()=>{blockedClick=false},0);if(!target){host.toast('Перенос отменён: место не выбрано.');return}committing=true;try{
  const ok=await host.commit(current=>{assertDragUnchanged(current,g.base,g.ids,target.field,target.taskId);return moveInContext(current,g.ids,target,host.today(),host.personName)},g.basis);
  if(ok){const manual=host.mode()==='list'&&host.sort()==='title';if(manual)host.manualOrder();host.toast(describe(target.field,target.value)+' · очередь изменена. '+(manual?'Включён ручной порядок. ':'')+'Доступна отмена.');live.textContent='Перемещение сохранено.';requestAnimationFrame(()=>root.querySelector(`[data-plan-grip="${CSS.escape(g.id)}"]`)?.focus({preventScroll:true}));}
 }catch(error){host.toast(error.message);live.textContent=error.message}finally{committing=false}}
 root.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-plan-grip]');if(!handle||e.button!==0||!host.canEdit()||gesture||committing)return;const id=handle.dataset.planGrip;gesture={id,ids:host.selection().includes(id)?host.selection():[id],handle,pointerId:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false};handle.setPointerCapture(e.pointerId);e.preventDefault()});
 root.addEventListener('pointermove',e=>{if(!gesture||gesture.keyboard||gesture.pointerId!==e.pointerId)return;gesture.x=e.clientX;gesture.y=e.clientY;if(!gesture.active&&Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>6)activate();if(gesture.active){e.preventDefault();point()}},{passive:false});
 root.addEventListener('pointerup',e=>{if(gesture&&!gesture.keyboard&&gesture.pointerId===e.pointerId)finish()});root.addEventListener('pointercancel',cancel);
 root.addEventListener('click',e=>{if(blockedClick){e.preventDefault();e.stopImmediatePropagation()}},true);
 root.addEventListener('keydown',e=>{
  const handle=e.target.closest('[data-plan-grip]');
  if(!gesture&&!committing&&handle&&[' ','Enter'].includes(e.key)&&host.canEdit()){e.preventDefault();e.stopImmediatePropagation();const id=handle.dataset.planGrip;gesture={id,ids:host.selection().includes(id)?host.selection():[id],handle,keyboard:true,active:false};activate();gesture.ghost.style.left='50%';gesture.ghost.style.bottom='24px';gesture.ghost.style.transform='translateX(-50%)';showTarget(null);return}
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
