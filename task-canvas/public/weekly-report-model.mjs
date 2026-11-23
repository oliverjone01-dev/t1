import {account, active, shift, weekEnd} from './weekly-model.mjs?rev=20261120-dnd-21';
import {overlapsRange} from './task-dates.mjs?rev=20261120-dnd-21';

export const REPORT_KEY = 'gengroup.task-canvas.weekly-report.v1';
export const REPORT_ZOOMS = [75, 85, 100, 115, 130, 150];
export const FACT_OUTCOMES = {
  done: 'Выполнена за неделю',
  open: 'Не завершена',
  moved: 'Работа продолжилась',
  cancelled: 'Отменена',
  removed: 'Убрана с доски',
  unknown: 'Итог не подтверждён',
};

export function reportPreferences(value) {
  const rules = value?.rules || {};
  return {
    zoom: REPORT_ZOOMS.includes(value?.zoom) ? value.zoom : 100,
    rules: {
      outcomes: Array.isArray(rules.outcomes)
        ? [...new Set(rules.outcomes.filter(key => Object.hasOwn(FACT_OUTCOMES, key)))]
        : Object.keys(FACT_OUTCOMES),
      extra: rules.extra !== false,
      overdue: rules.overdue === true,
      undated: rules.undated === true,
      terminal: rules.terminal === true,
    },
    weeks: value?.weeks && typeof value.weeks === 'object' ? value.weeks : {},
  };
}

export function weeklyFact(data, week) {
  const snapshot = kind => data.snapshots.find(s => s.week === week && s.kind === kind);
  const baseline = snapshot('plan'), close = snapshot('fact'), restored = snapshot('reconstructed');
  const historical = !baseline || !close || close.quality === 'gap';
  return {
    baseline, close, historical,
    ...account(week, baseline?.tasks || [], close?.tasks || restored?.tasks || [], data.events, {
      historical, quality: baseline?.quality || 'unknown',
    }),
  };
}

export function composeReport(data, {week, currentWeek, prefs}) {
  const factWeek = shift(week, -7), fact = weeklyFact(data, factWeek);
  const planSnapshot = week === currentWeek ? null : data.snapshots.find(s => s.week === week && s.kind === 'plan');
  const live = new Map(data.tasks.map(t => [t.id, t]));
  const pool = week === currentWeek ? data.tasks : planSnapshot?.tasks || [];
  const factSources = [fact.baseline, fact.close, data.snapshots.find(s => s.week === factWeek && s.kind === 'reconstructed')];
  const isArchived = task => task?.archived || !!task?.archiveKind;
  const withLive = task => {
    const current = live.get(task.id);
    const canOpen = !!current && !isArchived(current);
    return {...task, liveStatus: current ? isArchived(current) ? 'В архиве' : current.status || 'Не указан' : 'Нет на доске',
      canOpen, liveSchedule: canOpen ? {start: current.start || '', due: current.due || ''} : null};
  };
  const candidates = {
    fact: new Map([...factSources.flatMap(s => s?.tasks || []), ...fact.rows].map(t => [t.id, t])),
    plan: new Map(pool.map(t => [t.id, t])),
  };
  function choose(section, defaults) {
    const choices = prefs.weeks[week]?.[section] || {};
    const visible = new Map(defaults.map(task => [task.id, task]));
    for (const [id, show] of Object.entries(choices)) {
      if (show === false) visible.delete(id);
      if (show === true && !visible.has(id) && candidates[section].has(id)) {
        const task = candidates[section].get(id);
        visible.set(id, {...task, manual: true, ...(section === 'fact' && !task.outcome ? {outcome:'unknown'} : {})});
      }
    }
    return [...visible.values()].map(withLive);
  }
  const planDefaults = pool.filter(task => {
    if (isArchived(task) || (!active(task) && !prefs.rules.terminal)) return false;
    return overlapsRange(task, week, weekEnd(week))
      || prefs.rules.overdue && !!task.due && task.due < week
      || prefs.rules.undated && !task.start && !task.due;
  });
  return {
    factWeek, fact, planSnapshot, candidates,
    factRows: choose('fact', fact.rows.filter(t => prefs.rules.outcomes.includes(t.outcome) && (prefs.rules.extra || t.planned))),
    planRows: choose('plan', planDefaults),
  };
}
