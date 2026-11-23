import {installReport} from './report.mjs?rev=20261123-weekly-editor-23';
import {filterWeeklyRows,weeklyMetrics,weeklyError} from '../weekly-scope.mjs?rev=20261120-dnd-21';
import {installThemeToggle} from '../appearance.mjs?rev=20261120-dnd-21';
import {workProgress,installExecutionControls} from '../work-progress.mjs?rev=20261120-dnd-21';
import {createdDay} from '../task-dates.mjs?rev=20261120-dnd-21';
import {installQuickControls} from '../quick-controls.mjs?rev=20261120-dnd-21';
import {temperature,observedTask} from '../task-signals.mjs?rev=20261120-dnd-21';
import {Directory} from '../directory.mjs?rev=20261120-dnd-21';
import {PublicSheetsApi} from '../sheet-viewer.mjs?rev=20261120-dnd-21';
import {parseDelimited} from '../model.mjs?rev=20261120-dnd-21';
import {SHEET_ID} from '../sync-model.mjs?rev=20261120-dnd-21';
import {SNAPSHOT_TAB,EVENT_TAB,parseSnapshots,parseEvents,normalize,account,weekOf,weekEnd,shift,active,planned} from '../weekly-model.mjs?rev=20261120-dnd-21';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const directory=new Directory({fetcher:(url,options)=>fetch(url==='./directory.json'?'../directory.json':url,options)});await directory.load();
const ownerName=t=>directory.name(t.owner);
const initialURL = new URL(location.href);
let data=null,tab=['fact','plan','decisions'].includes(initialURL.searchParams.get('view'))?initialURL.searchParams.get('view'):'report',
 selected=initialURL.searchParams.get('week')||(tab==='report'?weekOf(new Date()):shift(weekOf(new Date()),-7)),loading=false;
const reportUI = installReport({$,esc,ownerName,range:w=>range(w),stamp:d=>stamp(d),fmt:d=>fmt(d),redraw:()=>render()});
const fmt=d=>d?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(d+'T12:00:00Z')):'Без срока';
const stamp=d=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(d));
const range=w=>`${fmt(w)} — ${fmt(weekEnd(w))} ${w.slice(0,4)}`;
const editorDialog=$('#report-editor-dialog'), editorFrame=$('#report-editor-frame'),
  editorLoading=$('#report-editor-loading'), editorFallback=$('#report-editor-fallback');
let editorTask, editorTimer, editorTrigger, editorStatusFocus;
function openReportEditor(url, trigger) {
 const src=new URL(url, location.href);
 if(editorDialog.open||src.origin!==location.origin||src.pathname!==new URL('../',location.href).pathname)return;
 editorTask=src.searchParams.get('task');
 if(!editorTask)return;
 editorStatusFocus=src.searchParams.get('focus')==='status';
 editorTrigger=trigger;
 editorFrame.hidden=true;
 editorLoading.hidden=false;
 editorFallback.href=src.href;
 $('#report-editor-state').textContent='Загружаем задачу…';
 $('#report-editor-notice').textContent='';
 src.searchParams.set('reportEditor','1');
 editorFrame.src=src.href;
 editorDialog.showModal();
 editorTimer=setTimeout(()=>{$('#report-editor-state').textContent='Редактор ещё загружается. Задачу можно открыть на доске.'},15000);
}
document.addEventListener('click', event=>{
 const link=event.target.closest('a[data-report-edit],#table a[href^="../?task="]');
 if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 openReportEditor(link.href,link);
});
$('#report-editor-close').onclick=()=>editorDialog.close();
editorDialog.addEventListener('cancel',event=>{if(!editorFrame.hidden)event.preventDefault()});
editorDialog.addEventListener('close',()=>{
 if(editorDialog.open)return;
 clearTimeout(editorTimer);
 editorTask=null;
 editorFrame.removeAttribute('src');
 if(editorTrigger?.isConnected)editorTrigger.focus({preventScroll:true});
 editorTrigger=null;
});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==editorFrame.contentWindow||!editorDialog.open)return;
 const {type,taskId,state}=event.data||{};
 if(type!=='gengroup:report-editor'||taskId!==editorTask)return;
 if(state==='ready'){
  clearTimeout(editorTimer);
  editorLoading.hidden=true;
  editorFrame.hidden=false;
  const editor=editorFrame.contentDocument?.querySelector('#editor');
  const status=editor?.querySelector('select[name=status]:enabled');
  (editorStatusFocus&&status||editor?.querySelector('#editor-title'))?.focus();
 }else if(state==='unavailable'){
  clearTimeout(editorTimer);
  $('#report-editor-state').textContent='Задача недоступна в текущей доске.';
 }else if(['closed','saved','queued'].includes(state)){
  editorDialog.close();
  if(state==='saved'){
   $('#report-editor-notice').textContent='Задача сохранена. Обновляем отчёт…';
   const previousTrigger=editorTrigger?.getAttribute('href');
   load().then(ok=>{
    $('#report-editor-notice').textContent=ok?'Задача сохранена.':'Задача сохранена. Отчёт пока не получил свежие данные.';
    if(!editorDialog.open&&document.activeElement===document.body){
     const matchingLink=[...document.querySelectorAll('a[data-report-edit],#table a[href^="../?task="]')]
      .find(link=>link.getAttribute('href')===previousTrigger);
     (matchingLink||document.querySelector('[data-tab][aria-pressed=true]'))?.focus({preventScroll:true});
    }
   });
  }else if(state==='queued'){
   $('#report-editor-notice').textContent='Изменения сохранены на устройстве. Доска пока не подтвердила синхронизацию.';
  }
 }
});
async function csv(id,header){const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${id}&range=A1:G30000&_=${Date.now()}`,{credentials:'omit',cache:'no-store',signal:c.signal});if(!r.ok)throw Error('Архив недели пока недоступен.');const rows=parseDelimited(await r.text(),',');if(rows[0]?.[0]!==header||rows.length>=30000)throw Error('Архив повреждён или превышает размер чтения. Данные не усечены.');return rows}finally{clearTimeout(timer)}}
async function load(){if(loading){await loading;return load()}
 let finish;loading=new Promise(resolve=>{finish=resolve});$('#refresh').disabled=true;try{const [live,snaps,events,state]=await Promise.all([new PublicSheetsApi().read(),csv(SNAPSHOT_TAB,'Неделя'),csv(EVENT_TAB,'Обнаружено'),csv(1909260103,'Проверено')]);const observed=new Map(state.slice(2).filter(r=>r[2]).map(r=>[r[2],JSON.parse(r[3])]));data={tasks:live.records.map(r=>normalize({...r,task:observedTask(r.task,observed.get(r.id))})),snapshots:parseSnapshots(snaps),events:parseEvents(events),at:new Date().toISOString(),sourceAt:state[1]?.[0]||''};$('#error').hidden=true;render();return true;}catch(e){$('#error').hidden=false;$('#error').textContent=(data?'Обновление не удалось. Ниже последняя загруженная версия. ':'')+weeklyError(e);$('#fresh').textContent=data?'Последняя загрузка: '+stamp(data.at)+' МСК':'Свежие данные не загружены';if(!data)$('#report-count').textContent='Данные не загружены';return false;}finally{loading=false;finish();$('#refresh').disabled=false}}
function render(){if(!data)return;
 const overview=tab==='report';
 $('#summary').hidden=overview;$('#table').hidden=overview;$('#report').hidden=!overview;$('.rules').hidden=overview;
 const cw=weekOf(new Date()),weeks=[...new Set([cw,shift(cw,-7),...data.snapshots.map(s=>s.week)])].sort().reverse();if(!weeks.includes(selected))selected=weeks[0];$('#week').innerHTML=weeks.map(w=>`<option value="${w}" ${w===selected?'selected':''}>${range(w)}</option>`).join('');const wi=weeks.indexOf(selected);$('#next').disabled=wi===0;$('#prev').disabled=wi===weeks.length-1;
 const baseline=data.snapshots.find(s=>s.week===selected&&s.kind==='plan'),end=data.snapshots.find(s=>s.week===selected&&s.kind==='fact'),restored=data.snapshots.find(s=>s.week===selected&&s.kind==='reconstructed');
 const ended=selected<cw,historical=!baseline||ended&&!end||end?.quality==='gap';const result=account(selected,baseline?.tasks||[],ended?(end?.tasks||restored?.tasks||[]):data.tasks,data.events,{historical,quality:baseline?.quality||'unknown'});
 const today=new Date(Date.now()+10800000).toISOString().slice(0,10),issues=data.tasks.filter(t=>active(t)&&(!t.owner||!t.due||t.due<today)).map(t=>({...t,outcome:!t.owner?'no-owner':!t.due?'no-due':'overdue'}));$('#decision-count').textContent=issues.length||'';
 const notices=[];if(!data.sourceAt||Date.now()-Date.parse(data.sourceAt)>900000)notices.push('Сборщик давно не обновлял историю. Данные текущей доски доступны, но факт может быть неполным.');if(!overview&&historical)notices.push('Исторический план или закрывающий снимок не подтверждён. Ниже — доступное состояние задач; выполнение за неделю и процент плана не вычисляются.');if(!overview&&baseline?.quality==='late')notices.push(`Первый план зафиксирован позднее начала недели: ${stamp(baseline.at)} МСК. Изменения до этой точки неизвестны.`);if(!overview&&end?.quality==='gap')notices.push('В сборе был перерыв на границе недели; итог требует подтверждения.');$('#quality').hidden=!notices.length;$('#quality').textContent=notices.join(' ');
 $('#fresh').textContent=`Загружено ${stamp(data.at)} МСК · история: ${data.sourceAt?stamp(data.sourceAt)+' МСК':'нет данных'}`;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
 let rows=overview?[...data.tasks,...data.snapshots.filter(s=>s.week===shift(selected,-7)||s.week===selected).flatMap(s=>s.tasks)]:tab==='decisions'?issues:tab==='plan'?(baseline?.tasks||(ended?[]:data.tasks)).filter(t=>planned(t,selected)).map(t=>({...t,outcome:baseline?'planned':'draft'})):result.rows;
 for(const [id,list,label] of [['owner',[...new Set(rows.map(ownerName).filter(Boolean))].sort(),'Вся команда'],['unit',[...new Set(rows.map(t=>t.unit).filter(Boolean))].sort(),'Все юниты']]){const el=$('#'+id),v=el.value;el.innerHTML=`<option value="">${label}</option>`+list.map(x=>`<option>${esc(x)}</option>`).join('');if(list.includes(v))el.value=v}
 const scope={owner:$('#owner').value,unit:$('#unit').value,query:$('#search').value};
 if(overview){
  $('#section-title').textContent='Факт и план по юнитам';
  $('#decision-count').textContent=filterWeeklyRows(issues,scope,ownerName).length||'';
  reportUI.render(data,{week:selected,currentWeek:cw,filter:tasks=>filterWeeklyRows(tasks,scope,ownerName)});
  updateURL();
  return;
 }
 rows=filterWeeklyRows(rows,scope,ownerName);
 $('#decision-count').textContent=filterWeeklyRows(issues,scope,ownerName).length||'';
 const metrics=weeklyMetrics(tab,rows,{historical,baseline:!!baseline,today:tab==='plan'?selected:today,ownerName});
 $('#summary').innerHTML=metrics.map(([v,l,n,c=''])=>`<div class="metric ${c}"><p>${l}</p><strong>${v}</strong><small>${n}</small></div>`).join('');$('#section-title').textContent=tab==='fact'?'Результаты · '+range(selected):tab==='plan'?'План · '+range(selected):'Что мешает двигаться';$('#section-note').textContent=tab==='fact'?(end?'Закрытый снимок. Изменения доски не переписывают эту неделю.':'Открытая неделя или восстановленное состояние.'):tab==='plan'?(baseline?'Зафиксировано '+stamp(baseline.at)+' МСК. Текущие сроки не меняют исходный план.':ended?'План этой недели не был зафиксирован. Текущие задачи не подставляются вместо истории.':'План ещё не зафиксирован. Показана предварительная выборка по срокам.'):'Текущие задачи без срока, назначения или с просрочкой.';
 const labels={done:'Выполнено',cancelled:'Отменено',removed:'Удалена / в архиве',moved:'Перенесена',open:ended?'Не завершена':'В работе недели',unknown:'Не подтверждено',planned:'В плане',draft:'Предварительно','no-owner':'Нужен ответственный','no-due':'Нужен срок',overdue:'Просрочена'};
 $('#table').innerHTML=rows.length?`<table><thead><tr><th scope="col">Задача / результат</th><th scope="col">Ответственный</th><th scope="col">Поставлена</th><th scope="col">Срок</th><th scope="col">${tab==='fact'?'Факт':'Состояние'}</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${workProgress(t,!ended)}${temperature(t,!ended)}<a href="../?task=${encodeURIComponent(t.id)}">${esc(t.title)} ↗</a><div class="task-meta">${esc(t.unit||'Без направления')} · #${esc(t.sourceId||t.id)} ${tab==='fact'&&!historical?(t.extra?'· Вне плана':'· Из первоначального плана'):''}</div>${t.description?`<span class="subnote">Ожидаемый результат: ${esc(t.description)}</span>`:''}${t.comment?`<details><summary>Комментарий / результат</summary>${esc(t.comment)}</details>`:''}</td><td>${esc(ownerName(t)||'Не назначен')}${!t.owner&&t.ownerNote?`<span class="subnote">${esc(t.ownerNote)}</span>`:''}${t.originalOwner&&t.originalOwner!==t.owner?`<span class="subnote">В плане: ${esc(directory.name(t.originalOwner))}</span>`:''}</td><td>${t.createdAt?fmt(createdDay(t.createdAt)):"—"}</td><td>${fmt(t.due)}${t.originalDue&&t.originalDue!==t.due?`<span class="subnote">В плане: ${fmt(t.originalDue)}</span>`:''}</td><td><span class="status ${esc(t.outcome)}">${labels[t.outcome]}</span>${!ended?`<span class="subnote"><a href="../?task=${encodeURIComponent(t.id)}&setStatus=${encodeURIComponent("Готово")}">Готово…</a> · <a href="../?task=${encodeURIComponent(t.id)}&setStatus=${encodeURIComponent("Отменено")}">Отменено…</a></span>`:""}${tab==='fact'?`<span class="subnote">Статус: ${esc(t.status)}</span>`:''}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Нет задач для этого раздела и выбранных фильтров.</div>';
 updateURL();
}
function updateURL(){
 const url=new URL(location.href);url.searchParams.set('week',selected);
 if(tab==='report')url.searchParams.delete('view');else url.searchParams.set('view',tab);
 history.replaceState(null,'',url);
}
$('#week').onchange=e=>{selected=e.target.value;render()};for(const [id,delta] of [['prev',1],['next',-1]])$('#'+id).onclick=()=>{const options=[...$('#week').options],i=options.findIndex(o=>o.value===selected);selected=options[i+delta]?.value||selected;render()};for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;$('#owner').value='';$('#unit').value='';render()};for(const id of ['owner','unit','search'])$('#'+id).addEventListener(id==='search'?'input':'change',render);$('#refresh').onclick=load;$('#print').onclick=()=>window.print();installThemeToggle({button:$('#theme')});load();setInterval(()=>{if(!document.hidden)load()},60000);

const editHost={canEdit:()=>selected===weekOf(new Date()),tasks:()=>data?.tasks||[],commit:async update=>{const before=data.tasks,after=update(before),changed=after.find((t,i)=>t.importance!==before[i].importance||t.progress!==before[i].progress||t.status!==before[i].status);if(changed){const prior=before.find(t=>t.id===changed.id),field=changed.importance!==prior.importance?'setImportance':changed.progress!==prior.progress?'setProgress':'setWorkAction',value=field==='setImportance'?changed.importance:field==='setProgress'?changed.progress:changed.status==='В работе'?'play':'pause';openReportEditor('../?task='+encodeURIComponent(changed.id)+'&'+field+'='+encodeURIComponent(value),document.activeElement);}return true},toast:()=>{}};
installQuickControls(editHost);installExecutionControls(editHost);
