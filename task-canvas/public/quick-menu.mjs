import {icon} from './icons.mjs?rev=20261120-canon-20';
import {QUADRANTS,STATUSES} from './model.mjs?rev=20261120-canon-20';
import {statusStyle} from './status-model.mjs?rev=20261120-canon-20';
import {dueShortcuts,quickPatch,applyQuickEdit,QUICK_FIELDS} from './quick-menu-model.mjs?rev=20261120-canon-20';
// Quick edit without the full card: right click, the context-menu key or a long press on any task.
// Every view renders a [data-quick-id] control inside its card, so the card is found by walking up to it.
const CARD='.matrix-card,.task-card,.map-task,.day-board-card,.calendar-task-wrap,tr[data-row],.gantt-row';
export function installQuickMenu(host){
 const dialog=document.createElement('dialog');dialog.className='quick-menu';dialog.setAttribute('aria-labelledby','quick-menu-title');document.body.append(dialog);
 let context=null,press=null;
 const esc=host.esc;
 const taskIdFrom=target=>{const card=target.closest?.(CARD);const id=card?.querySelector('[data-quick-id]')?.dataset.quickId;return id?{card,id:decodeURIComponent(id)}:null};
 const people=()=>[...new Set([...host.tasks().map(t=>t.owner).filter(Boolean),...host.people()])].sort((a,b)=>a.localeCompare(b,'ru'));
 function draw(){const t=context.base,today=host.today(),chips=dueShortcuts(today);
  dialog.innerHTML=`<form method="dialog" class="quick-menu-form">
 <header><h2 id="quick-menu-title" class="visually-hidden">Быстрая правка</h2><textarea name="title" rows="2" aria-label="Название задачи" maxlength="1000">${esc(t.title)}</textarea><button type="button" class="icon-button" data-qm-close aria-label="Закрыть">${icon('close')}</button></header>
 <fieldset class="qm-group"><legend>Приоритет</legend><div class="qm-segments qm-quadrants">${[['','Не разобрано'],...QUADRANTS.map(q=>[q.id,q.title])].map(([id,label])=>`<button type="button" data-qm-priority="${id}" aria-pressed="${(t.priority||'')===id}">${esc(label)}</button>`).join('')}</div></fieldset>
 <div class="qm-row"><label class="qm-group">Ответственный<input name="owner" list="qm-people" value="${esc(t.owner||'')}" placeholder="Не назначен" autocomplete="off"><datalist id="qm-people">${people().map(p=>`<option value="${esc(p)}"></option>`).join('')}</datalist></label>
 <label class="qm-group">Срок<input name="due" type="date" value="${esc(t.due||'')}"></label></div>
 <div class="qm-chips" role="group" aria-label="Быстрый срок">${chips.map(([label,date])=>`<button type="button" data-qm-due="${date}" aria-pressed="${(t.due||'')===date}">${label}</button>`).join('')}</div>
 <fieldset class="qm-group"><legend>Статус</legend><div class="qm-segments qm-statuses">${STATUSES.map(s=>`<button type="button" class="task-status ${statusStyle(s).key}" data-qm-status="${esc(s)}" aria-pressed="${(t.status||'Не указан')===s}"><span class="status-icon" aria-hidden="true">${icon(statusStyle(s).icon)}</span><span>${esc(s)}</span></button>`).join('')}</div></fieldset>
 <p class="qm-error" role="alert"></p>
 <footer><button type="button" class="text-button" data-qm-open>Открыть полностью</button><span class="qm-hint">Enter сохраняет, Esc закрывает</span><button type="submit" class="button primary">Сохранить</button></footer></form>`;
  context.form={title:t.title,priority:t.priority||'',owner:t.owner||'',due:t.due||'',status:t.status||'Не указан'}}
 function place(x,y){const w=dialog.offsetWidth,h=dialog.offsetHeight;dialog.style.margin='0';dialog.style.left=Math.max(12,Math.min(innerWidth-w-12,x))+'px';dialog.style.top=Math.max(12,Math.min(innerHeight-h-12,y))+'px'}
 function open(id,x,y){if(dialog.open)return;if(!host.canEdit()){host.toast('Быстрая правка доступна после входа редактора.');return}const base=host.tasks().find(t=>t.id===id);if(!base)return;context={base:structuredClone(base),basis:host.capture?.()};draw();dialog.showModal();if(innerWidth<768){dialog.classList.add('is-sheet');dialog.style.left='';dialog.style.top=''}else{dialog.classList.remove('is-sheet');place(x,y)}dialog.querySelector('textarea').focus({preventScroll:true});dialog.querySelector('textarea').select()}
 const pick=(attr,value)=>{for(const b of dialog.querySelectorAll(`[${attr}]`))b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value))};
 async function save(){const c=context;if(!c||c.busy)return;const f=dialog.querySelector('form');c.form.title=f.title.value;c.form.owner=f.owner.value;c.form.due=f.due.value;
  let patch;try{patch=quickPatch(c.base,c.form)}catch(e){dialog.querySelector('.qm-error').textContent=e.message;return}
  if(!patch.changed.length){dialog.close();return}
  c.busy=true;dialog.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=true);
  try{const ok=await host.commit(current=>{const t=current.find(t=>t.id===c.base.id);if(!t)throw Error('Задача удалена. Обновите доску.');
    for(const k of patch.changed){if(!QUICK_FIELDS.includes(k))continue;if(String(t[k]||'')!==String(c.base[k]||''))throw Error('Это поле уже изменили на другом устройстве. Откройте задачу и проверьте новую версию.')}
    const next=applyQuickEdit(t,c.base,c.form).task;return current.map(x=>x.id===t.id?next:x)},c.basis);
   if(ok!==false){dialog.close();host.toast('Сохранено')}}
  catch(e){dialog.querySelector('.qm-error').textContent=e.message||String(e)}
  finally{if(c===context){c.busy=false;dialog.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=false)}}}
 dialog.addEventListener('click',e=>{if(e.target===dialog){dialog.close();return}const b=e.target.closest('button');if(!b||!context)return;const f=context.form;
  if(b.hasAttribute('data-qm-close'))dialog.close();
  if(b.hasAttribute('data-qm-priority')){f.priority=b.dataset.qmPriority;pick('data-qm-priority',f.priority)}
  if(b.hasAttribute('data-qm-status')){f.status=b.dataset.qmStatus;pick('data-qm-status',f.status)}
  if(b.hasAttribute('data-qm-due')){f.due=b.dataset.qmDue;dialog.querySelector('[name=due]').value=f.due;pick('data-qm-due',f.due)}
  if(b.hasAttribute('data-qm-open')){const id=context.base.id;dialog.close();host.openTask(id)}});
 dialog.addEventListener('input',e=>{if(e.target.name==='due')pick('data-qm-due',e.target.value)});
 dialog.addEventListener('submit',e=>{e.preventDefault();save()});
 dialog.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName==='TEXTAREA'){e.preventDefault();save()}});
 dialog.addEventListener('cancel',e=>{if(context?.busy)e.preventDefault()});
 dialog.addEventListener('close',()=>{const id=context?.base.id;context=null;if(id)document.querySelector(`[data-quick-id="${CSS.escape(encodeURIComponent(id))}"]`)?.focus({preventScroll:true})});
 document.addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea,select,a[href],dialog'))return;const hit=taskIdFrom(e.target);if(!hit)return;e.preventDefault();open(hit.id,e.clientX,e.clientY)});
 document.addEventListener('keydown',e=>{if(!(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')))return;const hit=taskIdFrom(document.activeElement||document.body);if(!hit)return;e.preventDefault();const r=hit.card.getBoundingClientRect();open(hit.id,r.left+16,r.top+16)});
 // Long press on touch: 500 ms without moving. A drag or scroll cancels it.
 document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||e.target.closest('button,input,textarea,select,a[href],dialog,.planning-grip'))return;const hit=taskIdFrom(e.target);if(!hit)return;press={x:e.clientX,y:e.clientY,timer:setTimeout(()=>{press=null;navigator.vibrate?.(10);open(hit.id,e.clientX,e.clientY)},500)}});
 const cancel=e=>{if(!press)return;if(e.type==='pointermove'&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<8)return;clearTimeout(press.timer);press=null};
 for(const type of ['pointermove','pointerup','pointercancel','scroll'])document.addEventListener(type,cancel,{passive:true,capture:true});
 return {open};
}
