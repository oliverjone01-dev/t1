import {REPORT_KEY, REPORT_ZOOMS, FACT_OUTCOMES, reportPreferences, composeReport} from '../weekly-report-model.mjs?rev=20261123-weekly-report-22';
import {statusBadge} from '../quick-controls.mjs?rev=20261120-dnd-21';
import {workProgress} from '../work-progress.mjs?rev=20261120-dnd-21';
import {icon} from '../icons.mjs?rev=20261120-dnd-21';

export function installReport({$, esc, ownerName, range, stamp, fmt, redraw}) {
  let prefs;
  try { prefs = reportPreferences(JSON.parse(localStorage.getItem(REPORT_KEY))); }
  catch { prefs = reportPreferences(); }
  let context, draft;
  const dialog = $('#report-dialog'), form = dialog.querySelector('form');
  const zoom = $('#report-zoom'), search = $('#report-find'), side = $('#report-side');
  const save = next => {
    localStorage.setItem(REPORT_KEY, JSON.stringify(next));
    prefs = next;
  };
  zoom.innerHTML = REPORT_ZOOMS.map(n => `<option value="${n}">${n}%</option>`).join('');
  const applyZoom = n => {
    try { save({...prefs, zoom:n}); } catch { prefs = {...prefs, zoom:n}; }
    $('#report-grid').style.setProperty('--report-zoom', n / 100);
    zoom.value = n;
    $('#zoom-out').disabled = n === REPORT_ZOOMS[0];
    $('#zoom-in').disabled = n === REPORT_ZOOMS.at(-1);
  };
  zoom.onchange = () => applyZoom(Number(zoom.value));
  $('#zoom-out').onclick = () => applyZoom(REPORT_ZOOMS[REPORT_ZOOMS.indexOf(prefs.zoom) - 1]);
  $('#zoom-in').onclick = () => applyZoom(REPORT_ZOOMS[REPORT_ZOOMS.indexOf(prefs.zoom) + 1]);
  applyZoom(prefs.zoom);

  function taskLink(task, focusStatus = false) {
    const params = new URLSearchParams({task:task.id, reportWeek:context.week});
    if (focusStatus) params.set('focus','status');
    return '../?' + params.toString();
  }
  function tile(task, section) {
    const isFact = section === 'fact';
    const archival = ['В архиве','Нет на доске'].includes(task.liveStatus);
    const badge = archival
      ? `<span class="task-status none">${esc(task.liveStatus)}</span>`
      : statusBadge({status:task.liveStatus});
    const badgeControl = task.canOpen
      ? `<a class="report-status-link" href="${esc(taskLink(task, true))}" aria-label="Изменить статус: ${esc(task.title)}. Сейчас: ${esc(task.liveStatus)}">${badge}</a>` : badge;
    const title = task.canOpen ? `<a href="${esc(taskLink(task))}">${esc(task.title)}</a>` : esc(task.title);
    const date = task.start && task.due && task.start !== task.due
      ? fmt(task.start) + ' – ' + fmt(task.due) : task.due ? 'до ' + fmt(task.due) : task.start ? 'с ' + fmt(task.start) : 'Без рабочих дат';
    const historicStyle = {done:'Готово', open:'В работе', moved:'В работе', cancelled:'Отменено'}[task.outcome] || 'Не указан';
    const visual = isFact
      ? icon(task.outcome === 'done' ? 'check' : task.outcome === 'moved' ? 'arrow-right' : 'calendar')
      : workProgress(task);
    return `<article class="report-task" data-task-status="${esc(isFact ? historicStyle : task.liveStatus)}">
      <div class="report-task-symbol" aria-hidden="true">${visual}</div>
      <div class="report-task-copy"><div class="report-task-title">${title}</div>
        <div class="report-task-meta">${esc(ownerName(task) || 'Не назначен')} · ${esc(date)}${isFact ? ' · ' + esc(FACT_OUTCOMES[task.outcome] || '') : ''}${task.manual ? ' · Добавлена вручную' : ''}</div>
      </div>
      <div class="report-task-actions">${badgeControl}<button type="button" class="icon-button report-hide-task" data-report-hide="${esc(task.id)}" data-report-section="${section}" aria-label="Исключить из отчёта: ${esc(task.title)}" title="Исключить из отчёта">${icon('close')}</button></div>
    </article>`;
  }

  const unitOf = t => t.unit?.trim() || 'Без юнита';
  function render(data, {week, currentWeek, filter}) {
    context = {data, week, currentWeek, filter};
    const report = composeReport(data, {week,currentWeek,prefs});
    $('#report-settings').disabled = false;
    const fact = filter(report.factRows), plan = filter(report.planRows);
    fact.sort((a,b) => Object.keys(FACT_OUTCOMES).indexOf(a.outcome) - Object.keys(FACT_OUTCOMES).indexOf(b.outcome));
    plan.sort((a,b) => (a.due || a.start || '9999').localeCompare(b.due || b.start || '9999') || a.title.localeCompare(b.title,'ru'));
    const unitOrder = ['ГГ','ГГР','ГГВ','ГГС','ГМ','Без юнита'];
    const units = [...new Set([...fact,...plan].map(unitOf))];
    units.sort((a,b) => {
      const rank = name => unitOrder.includes(name) ? unitOrder.indexOf(name) : unitOrder.length - 1;
      return rank(a) - rank(b) || a.localeCompare(b,'ru');
    });
    const factNote = report.fact.historical ? 'Итоги не подтверждены архивом'
      : `${fact.filter(t=>t.outcome==='done').length} выполнено · ${fact.filter(t=>t.planned&&t.outcome==='done').length} из ${fact.filter(t=>t.planned).length} по плану`;
    const planNote = week === currentWeek ? 'Текущая доска' : report.planSnapshot ? 'Снимок на ' + stamp(report.planSnapshot.at) + ' МСК' : 'Снимок плана отсутствует';
    $('#report-grid').innerHTML = `<div class="report-headings">
      <header><h3>Факт</h3><p>${esc(range(report.factWeek))} · ${fact.length} шт.</p><p>${esc(factNote)}</p></header>
      <header><h3>План</h3><p>${esc(range(week))} · ${plan.length} шт.</p><p>${esc(planNote)}</p></header>
      </div>${units.map(unit => `<section class="report-unit"><h4>${esc(unit)}</h4><div class="report-pair">${[['fact',fact,'Факт'],['plan',plan,'План']].map(([section,rows,label]) => {
        const items = rows.filter(t => unitOf(t) === unit);
        return `<div class="report-side" role="group" aria-label="${label}: ${esc(unit)}"><p class="report-side-count">${label} · ${items.length}</p><div class="report-tiles">${items.map(t=>tile(t,section)).join('')}</div></div>`;
      }).join('')}</div></section>`).join('') || '<p class="empty">По текущим настройкам задач нет.</p>'}`;
    $('#report-count').textContent = `Факт: ${fact.length} · План: ${plan.length}`;
    $('#section-note').textContent = 'Цвет плитки в факте показывает итог недели. Бейдж показывает текущий статус на доске.';
    if (!report.fact.historical && report.fact.baseline?.quality === 'late') {
      $('#section-note').textContent += ` Первый снимок плана сделан ${stamp(report.fact.baseline.at)} МСК.`;
    }
  }

  function updateChoice(target, section, id, value) {
    const week = context.week;
    const savedWeek = target.weeks[week] || {};
    const sectionChoices = {...savedWeek[section]};
    if (value === undefined) delete sectionChoices[id];
    else sectionChoices[id] = value;
    return {...target, weeks:{...target.weeks, [week]:{...savedWeek,[section]:sectionChoices}}};
  }

  const readRules = () => ({
    outcomes:[...form.querySelectorAll('[name="outcome"]:checked')].map(input=>input.value),
    ...Object.fromEntries(['extra','overdue','undated','terminal'].map(key=>[key,form.elements[key].checked])),
  });
  function renderCandidates() {
    draft.rules = readRules();
    const section = side.value, query = search.value.trim().toLocaleLowerCase('ru');
    const report = composeReport(context.data,{week:context.week,currentWeek:context.currentWeek,prefs:draft});
    const included = new Set(report[section+'Rows'].map(task=>task.id));
    const choices = draft.weeks[context.week]?.[section] || {};
    const items = [...report.candidates[section].values()].filter(task => query
      ? [task.title, unitOf(task), ownerName(task)].join(' ').toLocaleLowerCase('ru').includes(query)
      : Object.hasOwn(choices, task.id));
    const visible = items.slice(0,30);
    $('#report-candidates').innerHTML = visible.length ? `<ul>${visible.map(task => `<li><label>
      <input type="checkbox" data-report-task="${esc(task.id)}" ${included.has(task.id)?'checked':''}>
      <span>${esc(task.title)}<small>${esc(unitOf(task))} · ${esc(ownerName(task)||'Не назначен')}${Object.hasOwn(choices,task.id)?' · Ручной выбор':''}</small></span>
      </label></li>`).join('')}</ul>${items.length>visible.length?`<p>Показано ${visible.length} из ${items.length}. Уточните поиск.</p>`:''}`
      : `<p>${query?'Задач не найдено.':'Введите название задачи или просмотрите свой ручной выбор.'}</p>`;
  }
  $('#report-settings').onclick = () => {
    if (!context) return;
    draft = structuredClone(prefs);
    $('#fact-rules').innerHTML = Object.entries(FACT_OUTCOMES).map(([value,label]) =>
      `<label><input type="checkbox" name="outcome" value="${value}" ${draft.rules.outcomes.includes(value)?'checked':''}> ${label}</label>`).join('');
    for (const key of ['extra','overdue','undated','terminal']) form.elements[key].checked = draft.rules[key];
    $('#report-settings-error').textContent = '';
    search.value = '';
    side.value = 'plan';
    renderCandidates();
    dialog.showModal();
  };
  search.oninput = side.onchange = renderCandidates;
  form.addEventListener('change', event => {
    const input = event.target;
    if (input.dataset.reportTask) {
      draft = updateChoice(draft,side.value,input.dataset.reportTask,input.checked);
      const details = input.nextElementSibling.querySelector('small');
      if (!details.textContent.endsWith('Ручной выбор')) details.append(' · Ручной выбор');
    } else if (input.name) renderCandidates();
  });
  $('#report-reset-week').onclick = () => {
    delete draft.weeks[context.week];
    renderCandidates();
  };
  form.onsubmit = event => {
    if (event.submitter?.value !== 'apply') return;
    event.preventDefault();
    try {
      save({...draft,rules:readRules(),zoom:prefs.zoom});
      dialog.close();
      redraw();
    } catch { $('#report-settings-error').textContent = 'Браузер не сохранил настройки. Попробуйте ещё раз.'; }
  };
  $('#report-grid').onclick = event => {
    const button = event.target.closest('[data-report-hide]');
    if (!button) return;
    try {
      save(updateChoice(prefs,button.dataset.reportSection,button.dataset.reportHide,false));
      redraw();
      $('#report-settings').focus({preventScroll:true});
    } catch { $('#report-count').textContent = 'Не удалось сохранить выбор в браузере.'; }
  };
  return {render};
}
