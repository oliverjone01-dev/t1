import {FOCUS,SORTS,matchesFocus,sortTasks,cleanView,cleanPersonal,deadlinePreset,bulkPatch,applyBulk,parseTaskLines,duplicateValues,taskLink,linkedTask} from './productivity-model.mjs?rev=20261110-planning-4';
import {QUADRANTS,STATUSES,validateBoard} from './model.mjs?rev=20261110-planning-4';
import {icon} from './icons.mjs?rev=20261110-planning-4';

// UI-only preferences live separately from the shared board and its outbox.
export function installProductivity(host) {
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=host.esc;
 const key=host.storageKey+'.personal.v1';
 let personal=cleanPersonal(), focus='all', sort='manual', review=[], navigating=false, busy=false, bulkBase=[], bulkBasis=null, intake=[], intakeBasis=null, linkPending=linkedTask(location.hash), linkScheduled=false;
 try{personal=cleanPersonal(JSON.parse(host.storage.getItem(key)||'{}'))}catch{host.toast('Личные настройки не прочитаны. Общие задачи не затронуты.');}
 const option=(id,label)=>`<option value="${esc(id)}">${esc(label)}</option>`;
 const closeButton=id=>`<button type="button" class="icon-button" data-product-close="${id}" aria-label="Закрыть">${icon('close')}</button>`;
 const modal=(id,title,body)=>`<dialog id="${id}" class="modal productivity-dialog" aria-labelledby="${id}-title"><div class="dialog-top"><h2 id="${id}-title">${title}</h2>${closeButton(id)}</div>${body}</dialog>`;
 $('#filter-panel').insertAdjacentHTML('beforeend',`<div class="personal-filters"><label>В фокусе<select id="focus-filter">${FOCUS.map(([id,label])=>option(id,label)).join('')}</select></label><div class="personal-view-actions"><button class="text-button" id="views-open">Мои виды</button><button class="text-button" id="view-save">Сохранить вид</button></div></div>`);
 $('.side-tools').insertAdjacentHTML('afterbegin','<button id="intake-open" class="text-button">Добавить списком</button>');
 $('#filter-panel').append($('#intake-open'));
 $('.toolbar').insertAdjacentHTML('afterend',`<div id="work-context" class="work-context" hidden><button id="active-focus" class="context-chip" title="Сбросить быструю выборку" hidden></button><span id="result-context"></span><label id="sort-label" hidden><span class="visually-hidden">Сортировка списка</span><select id="list-sort" aria-label="Сортировка списка">${SORTS.map(([id,label])=>option(id,label)).join('')}</select></label><button id="list-select-all" class="text-button" hidden>Выбрать все</button><button id="context-bulk" class="text-button" hidden>Изменить выбранные</button></div>`);
 $('#editor-title').insertAdjacentHTML('afterend',`<div class="task-tools"><button type="button" id="task-pin" class="text-button" aria-pressed="false" title="Личное избранное в этом браузере">В избранное</button><button type="button" id="task-share" class="text-button">Ссылка</button><button type="button" id="task-duplicate" class="text-button">По образцу</button></div><div class="review-nav"><button type="button" id="review-prev" class="icon-button" aria-label="Предыдущая задача">←</button><span id="review-position"></span><button type="button" id="review-next" class="icon-button" aria-label="Следующая задача">→</button></div>`);
 $('#due-note').insertAdjacentHTML('beforebegin',`<div id="due-presets" class="date-presets" aria-label="Быстрый срок">${[['today','Сегодня'],['tomorrow','Завтра'],['week','Через неделю'],['clear','Без срока']].map(([id,label])=>`<button type="button" class="text-button" data-due-preset="${id}">${label}</button>`).join('')}</div>`);
 $('#save-task').insertAdjacentHTML('beforebegin','<button type="button" id="save-next" class="button quiet">Сохранить и далее</button>');
 document.body.insertAdjacentHTML('beforeend',
 modal('views-dialog','Мои виды',`<p class="source-meta">Сохранённые виды и избранное — только в этом браузере. Общая доска не меняется.</p><div id="saved-views"></div><form id="save-view-form"><label>Название вида<input id="view-name" maxlength="60" required placeholder="Например, задачи Ивана на неделю"></label><button class="button primary" type="submit">Сохранить текущий вид</button></form><p id="views-error" class="error" role="alert"></p>`)+
 modal('share-task-dialog','Ссылка на задачу',`<p>Ссылка откроет эту карточку. Просмотр доступен без входа, редактирование — по действующим правам доски.</p><label>Адрес<input id="task-link" readonly></label><button id="task-link-copy" class="button primary">Скопировать</button><p id="share-result" role="status"></p>`)+
 modal('bulk-dialog','Изменить выбранные',`<p id="bulk-summary"></p><p class="source-meta">Поменяются только указанные поля. Остальные данные сохранятся.</p><form id="bulk-form">${[['owner','Ответственный'],['due','Срок'],['status','Статус'],['priority','Приоритет'],['importance','Срочность']].map(([name,label])=>`<div class="bulk-field"><label>${label}<select name="${name}Mode" aria-label="Действие: ${label}"><option value="keep">Не менять</option><option value="set">Назначить</option>${name==='status'?'':'<option value="clear">'+(name==='priority'?'Во входящие':'Очистить')+'</option>'}</select></label><label class="bulk-value" data-bulk-field="${name}" hidden><span class="visually-hidden">${label}</span>${name==='owner'?'<input name="owner" list="owner-list" maxlength="80" placeholder="Один человек">':name==='due'?'<input name="due" type="date">':`<select name="${name}">${(name==='importance'?[1,2,3,4,5].map(n=>[n,n+' / 5']):name==='status'?STATUSES.map(s=>[s,s]):QUADRANTS.map(q=>[q.id,q.subtitle])).map(([id,title])=>option(id,title)).join('')}</select>`}</label></div>`).join('')}<div id="bulk-preview" class="action-preview" aria-live="polite"></div><p id="bulk-error" class="error" role="alert"></p><button class="button primary" type="submit" id="bulk-submit">Применить</button></form>`)+
 modal('intake-dialog','Добавить задачи списком',`<p class="source-meta">Каждая строка станет отдельной задачей. До 50 за раз. Перед добавлением покажем результат.</p><form id="intake-form"><label>Задачи<textarea id="intake-lines" rows="7" maxlength="51000" placeholder="Согласовать макет\nПодготовить презентацию\nСобрать обратную связь"></textarea></label><div class="form-row"><label>Ответственный<input id="intake-owner" list="owner-list" maxlength="80"></label><label>Юнит<input id="intake-unit" list="unit-list" maxlength="100"></label></div><label>Приоритет<select id="intake-priority"><option value="">Входящие</option>${QUADRANTS.map(q=>option(q.id,q.subtitle)).join('')}</select></label><button class="button quiet" type="submit">Проверить список</button></form><div id="intake-preview" class="action-preview" hidden></div><label id="intake-duplicates-label" class="check" hidden><input type="checkbox" id="intake-duplicates">Добавить и совпадающие названия</label><p id="intake-error" class="error" role="alert"></p><button id="intake-submit" class="button primary" hidden>Добавить задачи</button>`));
 function savePersonal(){try{host.storage.setItem(key,JSON.stringify(personal));return true}catch{host.toast('Личный выбор работает, но не сохранился в браузере.');return false}}
 function show(id){$('#'+id).showModal()}
 $$('[data-product-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.productClose).close());
 function error(id,e){$('#'+id).textContent=e.message||e}
 function filters(){return cleanView({query:$('#search').value,unit:$('#unit-filter').value,owner:$('#owner-filter').value,hideDone:$('#hide-done').checked,focus,sort,mode:host.mode()})}
 function renderViews(){
  $('#saved-views').innerHTML=personal.views.length?personal.views.map(v=>`<div class="saved-view"><button class="text-button" data-load-view="${esc(v.id)}">${esc(v.name)}</button><button class="icon-button" data-remove-view="${esc(v.id)}" aria-label="Удалить вид ${esc(v.name)}">${icon('close')}</button></div>`).join(''):'<p>Сохраните нужную выборку, чтобы возвращаться к ней одним нажатием.</p>';
 }
 function openViews(){renderViews();error('views-error','');show('views-dialog')}
 $('#views-open').onclick=openViews;
 $('#view-save').onclick=()=>{openViews();$('#view-name').focus()};
 $('#save-view-form').onsubmit=e=>{e.preventDefault();const name=$('#view-name').value.trim();if(!name)return; if(personal.views.length>=12)return error('views-error','Можно сохранить до 12 видов. Удалите ненужный.');personal.views.push({id:crypto.randomUUID(),name,view:filters()});if(savePersonal()){error('views-error','');$('#view-name').value='';renderViews();host.toast('Вид сохранён в этом браузере');}};
 $('#saved-views').onclick=e=>{const remove=e.target.closest('[data-remove-view]'),load=e.target.closest('[data-load-view]');if(remove){personal.views=personal.views.filter(v=>v.id!==remove.dataset.removeView);savePersonal();renderViews();return}if(!load)return;const v=personal.views.find(v=>v.id===load.dataset.loadView)?.view;if(!v)return;$('#search').value=v.query;for(const [id,value] of [['unit-filter',v.unit],['owner-filter',v.owner]]){if(![...$('#'+id).options].some(o=>o.value===value))$('#'+id).insertAdjacentHTML('beforeend',option(value,value.replace(/^owner:/,'')+' · нет на доске'));$('#'+id).value=value;}$('#hide-done').checked=v.hideDone;focus=v.focus;sort=v.sort;$('#views-dialog').close();$('#filters-dialog').open&&$('#filters-dialog').close();host.setMode(v.mode)};
 $('#focus-filter').onchange=e=>{focus=e.target.value;host.render()};
 $('#active-focus').onclick=()=>{focus='all';host.render()};
 $('#list-sort').onchange=e=>{sort=e.target.value;host.render()};
 $('#list-select-all').onclick=()=>host.selectAll(host.visible().map(t=>t.id));
 const togglePin=id=>{if(!id)return;personal.pins=personal.pins.includes(id)?personal.pins.filter(p=>p!==id):[...personal.pins,id];savePersonal();host.render();if($('#editor').open)editorTools(id)};
 $('#task-pin').onclick=()=>togglePin(host.editing());
 function editorTools(id){
  const exists=host.tasks().some(t=>t.id===id),index=review.indexOf(id),next=review.slice(index+1).some(id=>host.tasks().some(t=>t.id===id));
  $('#task-pin').hidden=!exists;$('#task-share').hidden=!exists;$('#task-duplicate').hidden=!exists||!host.canEdit();
  $('#task-pin').textContent=personal.pins.includes(id)?'В избранном':'В избранное';$('#task-pin').setAttribute('aria-pressed',String(personal.pins.includes(id)));
  $('.review-nav').hidden=index<0||review.length<2;$('#review-position').textContent=index>=0?`${index+1} из ${review.length} в выборке`:'';
  $('#review-prev').disabled=busy||index<=0||!review.slice(0,index).some(id=>host.tasks().some(t=>t.id===id));$('#review-next').disabled=busy||!next;
  $('#due-presets').hidden=!host.canEdit();$('#save-next').hidden=!host.canEdit()||!next||!exists;$('#save-next').disabled=busy;
 }
 function beforeOpen(id){if(!navigating){review=host.visible().map(t=>t.id);if(id&&!review.includes(id))review=[id]}}
 function editorOpened(id){editorTools(id)}
 const nextReview=direction=>{const index=review.indexOf(host.editing());return (direction>0?review.slice(index+1):review.slice(0,index).reverse()).find(id=>host.tasks().some(t=>t.id===id))};
 function navigate(direction){const id=nextReview(direction);if(!id||busy)return;if(!host.saveDraft())return host.toast('Черновик не сохранился. Сохраните задачу перед переходом.');navigating=true;host.openTask(id);navigating=false;host.field('title').focus()}
 $('#review-prev').onclick=()=>navigate(-1);$('#review-next').onclick=()=>navigate(1);
 $('#save-next').onclick=async()=>{if(busy)return;const next=nextReview(1);busy=true;editorTools(host.editing());try{const ok=await host.submitTask();if(ok&&next&&host.tasks().some(t=>t.id===next)){navigating=true;host.openTask(next);navigating=false;host.field('title').focus()}}finally{busy=false;if($('#editor').open)editorTools(host.editing())}};
 $('#due-presets').onclick=e=>{const b=e.target.closest('[data-due-preset]');if(!b||!host.canEdit())return;host.field('due').value=deadlinePreset(host.today(),b.dataset.duePreset);host.saveDraft()};
 $('#task-share').onclick=()=>{$('#task-link').value=taskLink(location.href,host.editing());$('#share-result').textContent='';show('share-task-dialog')};
 $('#task-link-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#task-link').value);$('#share-result').textContent='Ссылка скопирована'}catch{$('#task-link').focus();$('#task-link').select();$('#share-result').textContent='Выделили ссылку. Нажмите Ctrl+C или Cmd+C.'}};
 $('#task-duplicate').onclick=()=>{if(!host.requireEditor())return;if(host.hasNewDraft())return host.toast('Сначала сохраните или удалите черновик новой задачи через «Черновики».');if(!host.saveDraft())return;const source=host.tasks().find(t=>t.id===host.editing());if(!source)return;const values=duplicateValues(source);host.openTask();for(const [key,value] of Object.entries(values))host.field(key).value=value;host.saveDraft();host.field('title').focus();host.toast('Новая задача по образцу. Проверьте название и срок, затем сохраните.');};
 function openBulk(){
  if(!host.requireEditor()||busy)return;
  bulkBase=structuredClone(host.tasks().filter(t=>host.selection().includes(t.id)));if(!bulkBase.length)return host.toast('Сначала выделите задачи.');
  bulkBasis=host.capture();$('#bulk-form').reset();$('#bulk-summary').textContent=`Выбрано задач: ${bulkBase.length}`;error('bulk-error','');previewBulk();show('bulk-dialog');
 }
 function readBulk(){const values=Object.fromEntries(new FormData($('#bulk-form')));return bulkPatch(values)}
 function previewBulk(){
  for(const label of $$('[data-bulk-field]'))label.hidden=$(`#bulk-form [name="${label.dataset.bulkField}Mode"]`).value!=='set';
  try{const patch=readBulk();$('#bulk-preview').innerHTML=`<strong>Будет изменено задач: ${bulkBase.length}</strong><ul>${Object.entries(patch).map(([k,v])=>`<li>${{owner:'Ответственный',due:'Срок',status:'Статус',priority:'Приоритет',importance:'Срочность'}[k]}: ${esc(k==='priority'?QUADRANTS.find(q=>q.id===v)?.subtitle||'Входящие':v||'Не назначен')}</li>`).join('')}</ul><details><summary>Показать задачи</summary><ul>${bulkBase.map(t=>`<li>${esc(t.title)}</li>`).join('')}</ul></details>`;}catch(e){$('#bulk-preview').textContent=e.message}
 }
 $('#bulk-form').oninput=previewBulk;$('#bulk-form').onchange=previewBulk;
 $('#bulk-form').onsubmit=async e=>{e.preventDefault();if(busy||!host.requireEditor())return;busy=true;$('#bulk-submit').disabled=true;try{const patch=readBulk();if(await host.commit(current=>applyBulk(current,bulkBase,patch),bulkBasis)){host.clearSelection();$('#bulk-dialog').close();host.toast(`Изменено задач: ${bulkBase.length}. Доступна отмена.`)}else error('bulk-error','Изменения не подтверждены. Проверьте состояние сохранения доски.')}catch(e){error('bulk-error',e)}finally{busy=false;$('#bulk-submit').disabled=false}};
 $('#context-bulk').onclick=openBulk;
 function openIntake(){if(!host.requireEditor())return;error('intake-error','');show('intake-dialog');$('#intake-lines').focus()}
 $('#intake-open').onclick=openIntake;
 const invalidateIntake=()=>{intake=[];$('#intake-preview').hidden=true;$('#intake-submit').hidden=true;$('#intake-duplicates-label').hidden=true};
 $('#intake-form').oninput=invalidateIntake;
 $('#intake-form').onsubmit=e=>{e.preventDefault();try{
  const lines=parseTaskLines($('#intake-lines').value,host.tasks()),patch=bulkPatch({ownerMode:$('#intake-owner').value.trim()?'set':'clear',owner:$('#intake-owner').value,priorityMode:$('#intake-priority').value?'set':'clear',priority:$('#intake-priority').value});
  intake=lines.map(line=>({...line,task:validateBoard([{id:crypto.randomUUID(),title:line.title,unit:$('#intake-unit').value.trim(),status:'В ожидании',...patch}])[0]}));intakeBasis=host.capture();
  $('#intake-preview').innerHTML=`<strong>Строк: ${intake.length}</strong><ol>${intake.map(t=>`<li>${esc(t.title)}${t.duplicate?' <span class="duplicate-note">Совпадает название</span>':''}</li>`).join('')}</ol>`;$('#intake-preview').hidden=false;$('#intake-duplicates').checked=false;$('#intake-duplicates-label').hidden=!intake.some(t=>t.duplicate);$('#intake-submit').hidden=false;updateIntakeCount();error('intake-error','');
 }catch(e){invalidateIntake();error('intake-error',e)}};
 function updateIntakeCount(){const count=intake.filter(t=>!t.duplicate||$('#intake-duplicates').checked).length;$('#intake-submit').textContent=`Добавить задач: ${count}`;$('#intake-submit').disabled=busy||!count}
 $('#intake-duplicates').onchange=updateIntakeCount;
 $('#intake-submit').onclick=async()=>{if(busy||!intake.length||!host.requireEditor())return;busy=true;updateIntakeCount();try{
  const additions=intake.filter(t=>!t.duplicate||$('#intake-duplicates').checked).map(t=>{t.task.createdAt ||= new Date().toISOString();return t.task});
  if(!additions.length)return;
  if(await host.commit(current=>{
    const newTasks=additions.filter(t=>!current.some(c=>c.id===t.id));
    if(!$('#intake-duplicates').checked&&newTasks.some(t=>parseTaskLines(t.title,current)[0].duplicate))throw new Error('На доске появилось совпадающее название. Проверьте список заново.');
    return validateBoard([...current,...newTasks]);
  },intakeBasis)){$('#intake-form').reset();invalidateIntake();$('#intake-dialog').close();host.toast(`Добавлено задач: ${additions.length}. Доступна отмена.`)}else error('intake-error','Сохранение не подтверждено. Список оставлен; повтор не создаст копии.');
 }catch(e){error('intake-error',e)}finally{busy=false;updateIntakeCount()}};
 function checkLink(){if(!linkPending||linkScheduled)return;const task=host.tasks().find(t=>t.id===linkPending);if(!task&&!host.loaded())return;linkScheduled=true;queueMicrotask(()=>{const id=linkPending;linkPending=null;linkScheduled=false;if(task)host.openTask(id);else host.toast('Задача по этой ссылке не найдена. Возможно, её убрали с доски.');})}
 window.addEventListener('hashchange',()=>{if($('#editor').open&&!host.saveDraft())return;linkPending=linkedTask(location.hash);checkLink()});
 function render(){
  $('#focus-filter').value=focus;$('#list-sort').value=sort;
  const isList=host.mode()==='list',filtered=focus!=='all'||$('#search').value||$('#unit-filter').value||$('#owner-filter').value||$('#hide-done').checked,selection=host.selection();
  $('#work-context').hidden=!isList&&!filtered&&(!selection.length||host.mode()==='priority');$('#active-focus').hidden=focus==='all';$('#active-focus').textContent=(FOCUS.find(([id])=>id===focus)?.[1]||'')+' ×';
  $('#result-context').textContent=filtered?`${host.visible().length} из ${host.tasks().length}`:'';
  $('#sort-label').hidden=!isList;$('#list-select-all').hidden=!isList||!host.canEdit()||!host.visible().length;$('#context-bulk').hidden=!selection.length||!host.canEdit()||host.mode()==='priority';$('#context-bulk').textContent=`Изменить выбранные · ${selection.length}`;
  $('#intake-open').hidden=!host.canEdit();if($('#editor').open)editorTools(host.editing());checkLink();
 }
 return {render,sortKind:()=>sort,manualOrder:()=>{sort='manual';host.render()},matches:task=>matchesFocus(task,focus,host.today(),personal.pins,host.unread(task.id)),sort:tasks=>sortTasks(tasks,sort,host.personName,host.today()),reset:()=>{focus='all'},filterActive:()=>focus!=='all',beforeOpen,editorOpened,openBulk,togglePin,pins:()=>personal.pins,
 commands:()=>[{title:'Добавить задачи списком',detail:'Одна строка — одна новая задача',run:openIntake},{title:'Мои сохранённые виды',detail:'Быстрый возврат к выборке',run:openViews},...FOCUS.filter(([id])=>id!=='all').map(([id,title])=>({title,detail:'Быстрая выборка задач',run:()=>{host.clearFilters();focus=id;host.render()}}))]};
}
