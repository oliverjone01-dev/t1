import { CARD, QUADRANTS, STATUSES, localDate, createLayout, moveTask, parseDelimited, fromSheet, validateBoard, groupFor } from './model.mjs';
const $ = selector => document.querySelector(selector);
const STORAGE = 'gengroup.task-canvas.v1';
const today = () => localDate();
let tasks = [], extraOwners = [], mode = 'priority', camera = { x: 32, y: 32, z: .8 }, selected = null, editing = null;
let history = [], future = [], layout, gesture = null, space = false, storageFailed = false, toastTimer;
let stateLoadError = false, storageConflict = false;
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) {
    const state = JSON.parse(saved); tasks = validateBoard(state); extraOwners = Array.isArray(state.owners) ? state.owners.filter(o => typeof o === 'string') : [];
    mode = ['priority', 'owners', 'time'].includes(state.mode) ? state.mode : 'priority';
    if (state.camera && ['x','y','z'].every(k => Number.isFinite(state.camera[k]))) camera = { x: state.camera.x, y: state.camera.y, z: Math.max(.08, Math.min(2, state.camera.z)) };
  }
} catch { stateLoadError = true; storageFailed = true; }
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function persist() {
  try {
    if (storageConflict) { $('#save-state').textContent = 'Конфликт вкладок · экспортируйте копию'; return; }
    if (stateLoadError) { $('#save-state').textContent = 'Ошибка чтения · экспортируйте копию'; return; }
    localStorage.setItem(STORAGE, JSON.stringify({ version: 1, tasks, owners: extraOwners, mode, camera }));
    storageFailed = false; $('#save-state').textContent = 'Сохранено на устройстве';
  } catch { storageFailed = true; $('#save-state').textContent = 'Не сохранено · экспортируйте доску'; toast('Браузер не смог сохранить доску. Скачайте экспорт, чтобы не потерять изменения.'); }
}
function snapshot() { return JSON.stringify({ tasks, owners: extraOwners }); }
function change(fn) {
  const before = snapshot(); fn();
  if (snapshot() !== before) { history.push(before); if (history.length > 50) history.shift(); future = []; persist(); }
  render();
}
function restore(from, to) {
  if (!from.length) return;
  to.push(snapshot()); const state = JSON.parse(from.pop()); tasks = state.tasks; extraOwners = state.owners; selected = null; persist(); render();
}
function updateOptions() {
  const units = [...new Set(tasks.map(t => t.unit).filter(Boolean))].sort();
  const owners = [...new Set([...tasks.map(t => t.owner).filter(Boolean), ...extraOwners])].sort();
  for (const [id, values, label] of [['unit-filter', units, 'Все юниты'], ['owner-filter', owners, 'Вся команда']]) {
    const select = $(`#${id}`); const current = select.value;
    select.innerHTML = `<option value="">${label}</option>` + (id === 'owner-filter' ? '<option value="__none">Без ответственного</option>' : '') + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }
  $('#owner-list').innerHTML = owners.map(o => `<option value="${esc(o)}"></option>`).join('');
  $('#unit-list').innerHTML = units.map(u => `<option value="${esc(u)}"></option>`).join('');
}
function isVisible(task) {
  const q = $('#search').value.toLocaleLowerCase('ru').trim();
  return (!$('#hide-done').checked || !['Готово','Отменено'].includes(task.status)) &&
    (!$('#unit-filter').value || task.unit === $('#unit-filter').value) &&
    (!$('#owner-filter').value || ($('#owner-filter').value === '__none' ? !task.owner : task.owner === $('#owner-filter').value)) &&
    (!q || [task.title, task.owner, task.ownerNote, task.direction, task.unit, task.sourceId, task.comment].some(v => (v || '').toLocaleLowerCase('ru').includes(q)));
}
function render() {
  updateOptions();
  const visible = tasks.filter(isVisible);
  layout = createLayout(visible, mode, today(), [...new Set([...extraOwners,...tasks.map(t => t.owner).filter(Boolean)])]);
  $('#lane-jump').innerHTML = '<option value="">К дорожке…</option>' + layout.groups.map(g => `<option value="${esc(g.id)}">${esc(g.title)}</option>`).join('');
  $('#task-count').textContent = visible.length;
  const info = {
    priority: ['МАТРИЦА ПРИОРИТЕТОВ','Что действительно важно','Перенесите карточку, чтобы изменить приоритет'],
    owners: ['КОМАНДА И ОТВЕТСТВЕННОСТЬ','У каждой задачи — свой человек','Перенос в дорожку назначает ответственного'],
    time: ['ПЛАНИРОВАНИЕ ПО ВРЕМЕНИ','Найдите правильный момент','Перенос меняет срок на дату дорожки'],
  }[mode];
  $('#view-kicker').textContent = info[0]; $('#view-title').textContent = info[1]; $('#view-hint').textContent = info[2];
  document.querySelectorAll('[data-mode]').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
  $('#new-owner').hidden = mode !== 'owners';
  $('#zones').innerHTML = layout.groups.map((g, i) => `<section class="zone ${g.color}" data-group="${esc(g.id)}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><div class="zone-header"><span class="zone-number">${g.id === 'inbox' ? '↓' : String(i + (mode === 'priority' ? 0 : 1)).padStart(2,'0')}</span><div><h3>${esc(g.title)}</h3><p>${esc(g.subtitle)}</p></div><span class="zone-count">${visible.filter(t => groupFor(t, mode, today()) === g.id).length}</span></div></section>`).join('');
  $('#cards').innerHTML = visible.map(task => {
    const p = layout.placed.get(task.id); if (!p) return '';
    const name = task.owner || (task.ownerNote ? 'Уточнить ответственного' : 'Не назначен');
    const initials = task.owner ? task.owner.split(/\s+/).slice(0,2).map(s => s[0]).join('') : '·';
    const date = task.due ? new Date(`${task.due}T12:00:00`).toLocaleDateString('ru', { day:'numeric', month:'short' }) : 'Без срока';
    return `<article tabindex="0" role="button" aria-label="${esc(task.title)}. Открыть детали" class="task-card${selected === task.id ? ' selected' : ''}" data-id="${esc(task.id)}" style="left:${p.x}px;top:${p.y}px"><div class="card-top"><span class="unit-tag">${esc(task.unit || 'ЗАДАЧА')}</span><span class="card-id">${task.sourceId ? '#' + esc(task.sourceId) : ''}</span><span class="status-text"><i class="status-dot ${task.status === 'Готово' ? 'done' : task.status === 'В работе' ? 'working' : ''}"></i> ${esc(task.status || 'Не указан')}</span></div><h3>${esc(task.title)}</h3><div class="card-direction">${esc(task.direction || task.description)}</div><div class="card-bottom"><span class="avatar">${esc(initials)}</span><span class="owner-name">${esc(name)}</span><span class="date${task.due && task.due < today() && !['Готово','Отменено'].includes(task.status) ? ' overdue' : ''}">◷ ${esc(date)}</span></div></article>`;
  }).join('');
  $('#empty').hidden = tasks.length > 0;
  $('#no-results').hidden = !tasks.length || visible.length > 0;
  $('#undo').disabled = !history.length; $('#redo').disabled = !future.length;
  applyCamera();
}
function applyCamera() {
  $('#world').style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  $('#viewport').style.backgroundSize = `${24 * camera.z}px ${24 * camera.z}px`;
  $('#viewport').style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  $('#zoom-label').textContent = `${Math.round(camera.z * 100)}%`;
}
function zoom(factor, point) {
  const rect = $('#viewport').getBoundingClientRect(); point ||= { x: rect.width / 2, y: rect.height / 2 };
  const next = Math.max(.08, Math.min(2, camera.z * factor));
  camera.x = point.x - (point.x - camera.x) * next / camera.z;
  camera.y = point.y - (point.y - camera.y) * next / camera.z; camera.z = next; applyCamera();
}
function fit() {
  if (!tasks.length) return;
  const visible = tasks.filter(isVisible); if (!visible.length) return;
  const positions = visible.map(t => layout.placed.get(t.id)).filter(Boolean);
  const minX = Math.min(...positions.map(p => p.x)) - 30, minY = Math.min(...positions.map(p => p.y)) - 100;
  const maxX = Math.max(...positions.map(p => p.x)) + CARD.width + 30, maxY = Math.max(...positions.map(p => p.y)) + CARD.height + 30;
  const rect = $('#viewport').getBoundingClientRect();
  camera.z = Math.min(1, Math.max(.08, Math.min((rect.width - 64) / (maxX - minX), (rect.height - 80) / (maxY - minY))));
  camera.x = (rect.width - (maxX - minX) * camera.z) / 2 - minX * camera.z;
  camera.y = 24 - minY * camera.z; applyCamera(); persist();
}
function worldPoint(event) {
  const r = $('#viewport').getBoundingClientRect();
  return { x: (event.clientX - r.left - camera.x) / camera.z, y: (event.clientY - r.top - camera.y) / camera.z };
}
$('#viewport').addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const rect = $('#viewport').getBoundingClientRect(); zoom(Math.exp(-e.deltaY * .008), { x: e.clientX - rect.left, y: e.clientY - rect.top });
  } else { camera.x -= e.deltaX; camera.y -= e.deltaY; applyCamera(); }
  clearTimeout(window.cameraSave); window.cameraSave = setTimeout(persist, 250);
}, { passive:false });
const touches = new Map(); let pinch = null;
$('#viewport').addEventListener('pointerdown', e => {
  if (e.target.closest('#empty, #no-results')) return;
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (touches.size === 2) {
      if (gesture?.type === 'card') { render(); }
      gesture = null;
      const [a,b] = [...touches.values()]; const r = $('#viewport').getBoundingClientRect();
      pinch = { distance:Math.hypot(a.x-b.x,a.y-b.y), camera:{...camera}, center:{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top} };
      $('#viewport').setPointerCapture(e.pointerId); return;
    }
  }
  if (e.button !== 0 && e.button !== 1) return;
  const card = e.target.closest('.task-card'); const p = worldPoint(e);
  if (card && !space && e.button === 0) {
    selected = card.dataset.id;
    document.querySelectorAll('.task-card').forEach(c => c.classList.toggle('selected', c === card));
    const original = layout.placed.get(selected);
    gesture = { type:'card', id:selected, pointer:e.pointerId, start:{x:e.clientX,y:e.clientY}, dx:p.x-original.x, dy:p.y-original.y, original, moved:false, card };
    card.focus({preventScroll:true});
  } else {
    gesture = { type:'pan', pointer:e.pointerId, start:{x:e.clientX,y:e.clientY}, camera:{...camera} };
    $('#viewport').classList.add('panning');
  }
  (gesture.type === 'card' ? card : $('#viewport')).setPointerCapture(e.pointerId);
});
$('#viewport').addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (pinch && touches.size === 2) {
    const [a,b] = [...touches.values()]; const r = $('#viewport').getBoundingClientRect();
    const center = {x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top};
    const z = Math.max(.08,Math.min(2,pinch.camera.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));
    camera = {z,x:center.x-(pinch.center.x-pinch.camera.x)*z/pinch.camera.z,y:center.y-(pinch.center.y-pinch.camera.y)*z/pinch.camera.z}; applyCamera(); return;
  }
  if (!gesture || e.pointerId !== gesture.pointer) return;
  if (gesture.type === 'pan') {
    camera.x = gesture.camera.x + e.clientX - gesture.start.x; camera.y = gesture.camera.y + e.clientY - gesture.start.y; applyCamera(); return;
  }
  if (Math.hypot(e.clientX - gesture.start.x,e.clientY - gesture.start.y) < 4 && !gesture.moved) return;
  gesture.moved = true; gesture.card.classList.add('dragging');
  const p = worldPoint(e); const x = p.x-gesture.dx, y = p.y-gesture.dy;
  gesture.card.style.left = `${x}px`; gesture.card.style.top = `${y}px`;
  const group = layout.groups.find(g => x+CARD.width/2 >= g.x && x+CARD.width/2 <= g.x+g.w && y+CARD.height/2 >= g.y && y+CARD.height/2 <= g.y+g.h+216);
  document.querySelectorAll('.zone').forEach(el => el.classList.toggle('drop-target', el.dataset.group === group?.id));
});
function endGesture(e, cancelled = false) {
  touches.delete(e.pointerId);
  if (pinch) { if (touches.size < 2) { pinch = null; gesture = null; persist(); render(); } return; }
  if (!gesture || gesture.pointer !== e.pointerId) return;
  const current = gesture; gesture = null; $('#viewport').classList.remove('panning');
  if (current.type === 'pan') { persist(); return; }
  if (current.moved && !cancelled) {
    const p = worldPoint(e), x = p.x-current.dx, y = p.y-current.dy;
    const target = layout.groups.find(g => x+CARD.width/2 >= g.x && x+CARD.width/2 <= g.x+g.w && y+CARD.height/2 >= g.y && y+CARD.height/2 <= g.y+g.h+216);
    if (target) {
      try {
        const task = tasks.find(t => t.id === current.id); const next = moveTask(task,mode,target,x,y,today());
        change(() => tasks = tasks.map(t => t.id === current.id ? next : t));
        const label = mode === 'priority' ? target.title : mode === 'owners' ? `Ответственный: ${next.owner || 'не назначен'}` : `Срок: ${next.due || 'не указан'}`;
        toast(label);
      } catch (error) { toast(error.message); render(); }
    } else { render(); toast('Поместите карточку внутрь дорожки.'); }
  } else if (cancelled) render();
}
$('#viewport').addEventListener('pointerup', e => endGesture(e));
$('#viewport').addEventListener('pointercancel', e => endGesture(e,true));
$('#cards').addEventListener('dblclick', e => { const card = e.target.closest('[data-id]'); if(card) openTask(card.dataset.id); });
$('#cards').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); openTask(e.target.closest('[data-id]').dataset.id); } });
function openTask(id = null) {
  editing = id; const task = tasks.find(t => t.id === id) || { title:'', status:'В ожидании', unit:$('#unit-filter').value, owner:'', due:'', priority:'' };
  const form = $('#task-form'); form.reset();
  form.elements.status.innerHTML = [...new Set([...STATUSES, ...tasks.map(t => t.status).filter(Boolean)])].map(s => `<option>${esc(s)}</option>`).join('');
  for (const key of ['title','unit','status','owner','due','priority','description','comment']) form.elements[key].value = task[key] || '';
  $('#editor-id').textContent = task.sourceId ? `ЗАДАЧА #${task.sourceId}` : id ? 'ЗАДАЧА' : 'НОВАЯ ЗАДАЧА';
  $('#owner-note').textContent = task.ownerNote ? `Из таблицы: ${task.ownerNote}` : '';
  $('#due-note').textContent = task.dueNote ? `Исходный срок: ${task.dueNote}` : '';
  $('#source-context').textContent = [task.direction && `Направление: ${task.direction}`,task.requester && `Постановщик: ${task.requester}`,task.dependency && `Зависимости и уточнения: ${task.dependency}`].filter(Boolean).join('\n\n') || 'Дополнительного контекста нет.';
  $('#source-link').hidden = !/^https?:\/\//.test(task.link || '');
  if (!$('#source-link').hidden) $('#source-link').href = task.link;
  $('#delete-task').hidden = !id;
  $('#editor').showModal();
}
$('#task-form').addEventListener('submit', e => {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); data.title = data.title.trim(); data.owner = data.owner.trim();
  if (!data.title) { e.target.elements.title.setCustomValidity('Введите название задачи.'); e.target.elements.title.reportValidity(); return; }
  const old = tasks.find(t => t.id === editing);
  const task = { ...(old || {id:crypto.randomUUID(),positions:{}}), ...data, priority:data.priority || null };
  if (old) {
    task.positions = structuredClone(old.positions || {});
    if (task.owner !== old.owner) delete task.positions.owners;
    if (task.due !== old.due) delete task.positions.time;
    if (task.priority !== old.priority) delete task.positions.priority;
  }
  change(() => tasks = old ? tasks.map(t => t.id === editing ? task : t) : [...tasks,task]);
  $('#editor').close(); toast('Задача сохранена');
});
$('#task-form').elements.title.addEventListener('input',e => e.target.setCustomValidity(''));
$('#delete-task').onclick = () => { change(() => tasks = tasks.filter(t => t.id !== editing)); $('#editor').close(); toast('Задача удалена. Можно отменить.'); };
$('#add').onclick = () => openTask();
$('#new-owner').onclick = () => {
  const name = prompt('Имя ответственного для новой дорожки');
  if (!name?.trim()) return;
  if (extraOwners.includes(name.trim()) || tasks.some(t => t.owner === name.trim())) return toast('Такая дорожка уже есть.');
  change(() => extraOwners.push(name.trim()));
  const g = layout.groups.find(g => g.id === name.trim()); camera.x = 30-g.x*camera.z; camera.y = 30; applyCamera(); persist();
};
function openImport() { $('#import-error').textContent = ''; $('#import-dialog').showModal(); }
$('#import-open').onclick = openImport; $('#empty-import').onclick = openImport; $('#help-open').onclick = () => $('#help-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(`#${b.dataset.close}`).close());
$('#import-file').onchange = async e => {
  try { const file = e.target.files[0]; if (file) $('#import-text').value = await file.text(); }
  catch { $('#import-error').textContent = 'Не удалось прочитать файл. Попробуйте вставить текст.'; }
};
$('#import-submit').onclick = () => {
  try {
    const text = $('#import-text').value.trim(); if (!text) throw new Error('Выберите файл или вставьте строки таблицы.');
    const json = text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null;
    let imported = json ? validateBoard(json) : fromSheet(parseDelimited(text));
    const importedOwners = Array.isArray(json?.owners) ? json.owners.filter(o => typeof o === 'string' && o.trim()) : [];
    if (!imported.length) throw new Error('В файле не нашлось задач с названием.');
    // Only an exact, single name is safe to promote from the source note.
    const simpleNames = /^(Иван|Дима|Миша|Надя|Катя|Софа|Сергей|Саша Климен|Кристина|Виктория|Богдан)$/i;
    imported = imported.map(t => ({...t, owner: t.owner || (simpleNames.test(t.ownerNote || '') ? t.ownerNote : '')}));
    const duplicates = imported.length - new Set(imported.map(t => t.id)).size;
    if (duplicates) throw new Error('В таблице повторяются ID задач. Исправьте их перед импортом.');
    const existing = new Set(tasks.map(t => t.id)); const added = $('#replace-import').checked ? imported : imported.filter(t => !existing.has(t.id));
    if (!added.length && !$('#replace-import').checked) throw new Error('Эти ID уже есть на доске. Для восстановления копии выберите замену.');
    change(() => { tasks = $('#replace-import').checked ? imported : [...tasks,...added]; extraOwners = $('#replace-import').checked ? importedOwners : [...new Set([...extraOwners,...importedOwners])]; });
    clearFilters(); $('#import-dialog').close(); camera = { x:32,y:24,z:.8 }; applyCamera(); persist();
    toast(`Добавлено ${added.length} задач${added.length < imported.length ? '; существующие ID пропущены' : ''}.`);
  } catch (error) { $('#import-error').textContent = error.message; }
};
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), tasks, owners:extraOwners, mode, camera }, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `gengroup-board-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  toast('Копия доски скачана');
};
function clearFilters() { $('#search').value=''; $('#unit-filter').value=''; $('#owner-filter').value=''; $('#hide-done').checked=true; render(); }
$('#clear-filters').onclick = clearFilters;
$('#reset-search').onclick = () => { clearFilters(); $('#hide-done').checked=false; render(); };
for (const id of ['search','unit-filter','owner-filter','hide-done']) $(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change',render);
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode=b.dataset.mode; camera={x:32,y:32,z:.8}; render(); const first=tasks.filter(isVisible).map(t=>layout.placed.get(t.id)).find(Boolean); if(first) { const g=layout.groups.find(g=>g.id===first.group); camera.x=32-g.x*camera.z; } applyCamera(); persist(); });
$('#lane-jump').onchange = e => { const g=layout.groups.find(g=>g.id===e.target.value); if(!g) return; camera.x=32-g.x*camera.z; camera.y=24-g.y*camera.z; applyCamera(); persist(); };
$('#undo').onclick = () => restore(history,future); $('#redo').onclick = () => restore(future,history);
$('#zoom-in').onclick = () => { zoom(1.2); persist(); }; $('#zoom-out').onclick = () => { zoom(1/1.2); persist(); }; $('#zoom-label').onclick = () => { zoom(1/camera.z); persist(); }; $('#fit').onclick=fit;
window.addEventListener('keydown',e => {
  const typing = e.target.closest('input,textarea,select,[contenteditable]'); if (typing || document.querySelector('dialog[open]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z') { e.preventDefault(); e.shiftKey ? restore(future,history) : restore(history,future); return; }
  if (e.code==='Space') { e.preventDefault(); space=true; $('#viewport').classList.add('hand'); }
  if (e.key==='/') { e.preventDefault(); $('#search').focus(); }
  if (e.key.toLowerCase()==='f') { e.preventDefault(); fit(); }
  if (['+','=','-'].includes(e.key)) { e.preventDefault(); zoom(e.key==='-' ? 1/1.2 : 1.2); persist(); }
  if (e.key==='Escape') { selected=null; render(); }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault(); const d=e.shiftKey?160:64;
    if (e.key==='ArrowUp') camera.y+=d; if(e.key==='ArrowDown') camera.y-=d;
    if(e.key==='ArrowLeft') camera.x+=d; if(e.key==='ArrowRight') camera.x-=d; applyCamera(); persist();
  }
});
window.addEventListener('keyup',e => { if(e.code==='Space') { space=false; $('#viewport').classList.remove('hand'); } });
window.addEventListener('blur',() => { space=false; touches.clear(); pinch=null; if(gesture) { gesture=null; render(); } $('#viewport').classList.remove('hand','panning'); });
window.addEventListener('storage',e => { if(e.key===STORAGE) { storageConflict=true; $('#save-state').textContent='Доска изменена в другой вкладке'; toast('Доска изменена в другой вкладке. Экспортируйте текущую копию и обновите страницу.'); } });
$('#demo').onclick = () => {
  const example = [
    ['Подготовить план запуска','ГГР','Иван','do','В работе'],['Согласовать материалы для команды','ГГВ','Софа','do','В ожидании'],
    ['Обновить каталог решений','ГМ','Катя','plan','В работе'],['Продумать сценарий презентации','ГГР','Иван','plan','В ожидании'],
    ['Собрать обратную связь','ГМ','Дима','delegate','В ожидании'],['Передать макеты в производство','ГГВ','Софа','delegate','В работе'],
    ['Разобрать идеи на следующий месяц','ГГР','','later','В ожидании'],['Уточнить новый запрос','','',null,'Не указан'],
  ].map(([title,unit,owner,priority,status],i) => ({ id:`example-${i}`,title,unit,owner,priority,status,due:'',description:'Пример задачи. Замените своими данными.',direction:'Пример · демонстрационные данные',positions:{} }));
  change(() => tasks=example); fit(); toast('Демонстрационные задачи. Импортируйте свою таблицу с заменой.');
};
render();
if(stateLoadError) { $('#save-state').textContent='Не удалось прочитать сохранённую доску'; toast('Сохранённые данные повреждены. Исходная копия не перезаписана.'); }
