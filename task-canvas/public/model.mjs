import {parseAssignee} from './people.mjs?rev=20261107-view-1';
export const GRID = 24;
export const CARD = { width: 288, height: 192 };
export const QUADRANTS = [
  { id: 'do', title: 'Сделать сейчас', subtitle: 'Важно · срочно', color: 'coral' },
  { id: 'plan', title: 'Запланировать', subtitle: 'Важно · не срочно', color: 'violet' },
  { id: 'delegate', title: 'Делегировать', subtitle: 'Не важно · срочно', color: 'blue' },
  { id: 'later', title: 'Отложить', subtitle: 'Не важно · не срочно', color: 'slate' },
];
export const STATUSES = ['Не указан', 'В ожидании', 'В работе', 'Готово', 'Отменено'];
export const STATUS_LANES = [
  {id:'status:done',status:'Готово',title:'Готово',subtitle:'Завершённые задачи',color:'green',symbol:'✓'},
  {id:'status:cancelled',status:'Отменено',title:'Отменено',subtitle:'Отменённые задачи',color:'cancelled',symbol:'×'},
];
export const statusGroup = task => STATUS_LANES.find(group=>group.status===task.status)?.id || null;
export const snap = value => Math.round(value / GRID) * GRID;
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(today, days) {
  const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d);
}
export function weekEnd(today) {
  const day = new Date(`${today}T12:00:00`).getDay(); return shiftDate(today, (7 - day) % 7);
}
export function timeBucket(task, today) {
  if (!task.due) return 'undated';
  if (task.due < today) return 'overdue';
  if (task.due === today) return 'today';
  if (task.due <= weekEnd(today)) return 'week';
  if (task.due <= shiftDate(weekEnd(today), 7)) return 'next';
  return 'future';
}
export function timeLanes(today) {
  const end = weekEnd(today);
  return [
    { id: 'overdue', title: 'Просрочено', subtitle: 'Срок уже прошёл', color: 'coral' },
    { id: 'today', title: 'Сегодня', subtitle: today, due: today, color: 'violet' },
    { id: 'week', title: 'До конца недели', subtitle: `до ${end}`, due: end, color: 'blue' },
    { id: 'next', title: 'Следующая неделя', subtitle: `до ${shiftDate(end, 7)}`, due: shiftDate(end, 7), color: 'green' },
    { id: 'future', title: 'Позже', subtitle: 'Через две недели и дальше', due: shiftDate(end, 8), color: 'slate' },
    { id: 'undated', title: 'Без срока', subtitle: 'Дата пока не назначена', due: '', color: 'slate' },
  ];
}
export function groupFor(task, mode, today) {
  if(statusGroup(task))return statusGroup(task);
  if (mode === 'priority') return task.priority || 'inbox';
  if (mode === 'owners') return task.owner ? `owner:${task.owner}` : 'unassigned';
  return timeBucket(task, today);
}
export function createLayout(tasks, mode, today, extraOwners = []) {
  const laneWidth = 672;
  let groups = mode === 'priority'
    ? [{ id: 'inbox', title: 'Входящие', subtitle: 'Приоритет ещё не назначен', color: 'slate', x: 0, y: 0, w: 336, h: 1032 },
       ...QUADRANTS.map((q, i) => ({ ...q, x: 384 + (i % 2) * laneWidth, y: 0, w: 648, h: 552 }))]
    : (mode === 'owners'
       ? [{ id: 'unassigned', title: 'Без ответственного', subtitle: 'Назначьте исполнителя', color: 'slate' },
          ...[...new Set([...tasks.map(t => t.owner).filter(Boolean), ...extraOwners])].map(owner => ({ id: `owner:${owner}`, title: owner, subtitle: 'Ответственный', color: 'violet' }))]
       : timeLanes(today)).map((g, i) => ({ ...g, x: i * laneWidth, y: 0, w: 648, h: 1032 }));
  const statusX=Math.max(...groups.map(g=>g.x+g.w))+24;
  groups.push(...STATUS_LANES.map((group,i)=>({...group,x:statusX+i*laneWidth,y:0,w:648,h:mode==='priority'?552:1032})));
  const local = new Map();
  for (const group of groups) {
    const entries = tasks.filter(t => groupFor(t, mode, today) === group.id);
    const occupied = [];
    const hasPosition = task => task.positions?.[mode]?.group === group.id;
    // Reserve manual positions first, then fill unused slots. No card is hidden underneath another.
    const ordered = [...entries.filter(hasPosition), ...entries.filter(t => !hasPosition(t))];
    for (const task of ordered) {
      const index = entries.indexOf(task), cols = group.w < 500 ? 1 : 2;
      const saved = hasPosition(task) ? task.positions[mode] : null;
      const x = Math.max(24, Math.min(group.w - CARD.width - 24, snap(saved ? saved.x : 24 + (index % cols) * 312)));
      let y = Math.max(96, snap(saved ? saved.y : 96 + Math.floor(index / cols) * 216));
      const overlaps = occupied.some(p => x < p.x + CARD.width + 24 && x + CARD.width + 24 > p.x && y < p.y + CARD.height + 24 && y + CARD.height + 24 > p.y);
      if (overlaps) y = Math.max(y, ...occupied.map(p => p.y + CARD.height + 24));
      occupied.push({ x, y }); local.set(task.id, { x, y, group: group.id });
      group.h = Math.max(group.h, y + CARD.height + 24);
    }
  }
  if (mode === 'priority') {
    const topHeight = Math.max(groups[1].h, groups[2].h);
    groups[3].y = topHeight + 48; groups[4].y = topHeight + 48;
  }
  const placed = new Map();
  for (const task of tasks) {
    const p = local.get(task.id), g = groups.find(g => g.id === p?.group);
    if (g) placed.set(task.id, { ...p, x: g.x + p.x, y: g.y + p.y });
  }
  return { groups, placed, width: Math.max(...groups.map(g => g.x + g.w)) + 48, height: Math.max(...groups.map(g => g.y + g.h)) + 48 };
}
export function dropTarget(groups, x, y) {
  const withinX = g => x >= g.x && x <= g.x + g.w;
  return groups.find(g => withinX(g) && y >= g.y && y <= g.y + g.h)
    || groups.find(g => withinX(g) && y > g.y + g.h && y <= g.y + g.h + 216);
}
export function fitCamera(positions, width, height) {
  if (!positions.length) return { x: 32, y: 32, z: 0.8 };
  const minX = Math.min(...positions.map(p => p.x)) - 30, minY = Math.min(...positions.map(p => p.y)) - 96;
  const maxX = Math.max(...positions.map(p => p.x)) + CARD.width + 30, maxY = Math.max(...positions.map(p => p.y)) + CARD.height + 30;
  const z = Math.max(0.0001, Math.min(1, Math.max(1, width - 64) / (maxX - minX), Math.max(1, height - 80) / (maxY - minY)));
  return { z, x: (width - (maxX - minX) * z) / 2 - minX * z, y: 24 - minY * z };
}
export function moveTask(task, mode, group, worldX, worldY, today) {
  if (mode === 'time' && group.id === 'overdue' && timeBucket(task, today) !== 'overdue') throw new Error('Прошедший срок задайте точной датой в карточке.');
  const next = structuredClone(task);
  const terminal=STATUS_LANES.find(lane=>lane.id===group.id);
  if(terminal)next.status=terminal.status;
  else {
    if(statusGroup(task))next.status='В работе';
    if (mode === 'priority') next.priority = group.id === 'inbox' ? null : group.id;
    if (mode === 'owners') next.owner = group.id === 'unassigned' ? '' : group.id.slice(6);
    if (mode === 'time' && group.id !== timeBucket(task, today)) next.due = group.due;
  }
  next.positions ||= {};
  next.positions[mode] = { group: group.id, x: Math.max(24, Math.min(group.w - CARD.width - 24, snap(worldX - group.x))), y: Math.max(96, snap(worldY - group.y)) };
  return next;
}
export function parseDelimited(text, delimiter) {
  text = text.replace(/^\uFEFF/, '');
  const headerLine = text.split(/\r?\n/).find(line => line.includes('ID') && line.includes('Направление')) || text.split('\n')[0];
  delimiter ||= headerLine.includes('\t') ? '\t' : (headerLine.split(';').length > headerLine.split(',').length ? ';' : ',');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || !cell) quoted = !quoted; else cell += c;
    } else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Незакрытая кавычка в CSV. Проверьте файл.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function parseDeadline(raw, year) {
  if (!raw || /не указан|течени|ноябр.*проверяем/i.test(raw)) return '';
  // An explicit last rescheduling arrow takes precedence; preserve original text separately.
  const tail = raw.split(/->|→/).at(-1).trim();
  if (/\d{1,2}\.\d{1,2}(?:\.\d{4})?\s*[-\u2013\u2014]\s*\d{1,2}\.\d{1,2}|\d\s+[-\u2013\u2014]\s*\d/.test(tail)) return '';
  const m = tail.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?=$|\s|\u2014|\u2013)/);
  if (!m) return '';
  const value = `${m[3] || year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(+d) && localDate(d) === value ? value : '';
}
export function fromSheet(rows, year = new Date().getFullYear()) {
  const header = rows.findIndex(r => r.includes('ID') && r.includes('Направление'));
  if (header < 0) throw new Error('Не найдены заголовки ID и Направление. Вставьте строки вместе с заголовками.');
  const headers = rows[header]; const at = (row, name) => String(row[headers.indexOf(name)] ?? '').trim();
  return rows.slice(header + 1).filter(r => at(r, 'ID') && (at(r, 'Задача') || at(r, 'Направление'))).map(row => ({
    id: at(row, 'ID карточки') || `sheet-${at(row, 'ID')}`, sourceId: at(row, 'ID'), title: at(row, 'Задача') || at(row, 'Направление'),
    unit: at(row, 'Юнит').replace(/\s*\/\s*$/, ''), direction: at(row, 'Направление'),
    description: at(row, 'Ожидаемый результат'), status: at(row, 'Статус') || 'Не указан',
    owner: '', ownerNote: at(row, 'Ответственный'), due: parseDeadline(at(row, 'Срок'), year), dueNote: at(row, 'Срок'),
    comment: at(row, 'Коммент'), dependency: at(row, 'Зависимости и уточнения'), requester: at(row, 'Постановщик'),
    link: /^https?:\/\//.test(at(row, 'ID задачи/ ссылка')) ? at(row, 'ID задачи/ ссылка') : '',
    priority: null, positions: {},
  }));
}
export function validateBoard(value) {
  const tasks = Array.isArray(value) ? value : value?.tasks;
  if (!Array.isArray(tasks) || tasks.length > 2000) throw new Error('Ожидается доска не более чем с 2000 карточками.');
  const ids = new Set();
  return tasks.map(t => {
    if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.title !== 'string' || !t.title.trim()) throw new Error('В файле есть карточки без ID, заголовка или с повторяющимся ID.');
    ids.add(t.id);
    if (t.due && (!/^\d{4}-\d{2}-\d{2}$/.test(t.due) || Number.isNaN(+new Date(`${t.due}T12:00:00`)) || localDate(new Date(`${t.due}T12:00:00`)) !== t.due)) throw new Error('Некорректный формат даты.');
    if (t.priority && !QUADRANTS.some(q => q.id === t.priority)) throw new Error('Неизвестный приоритет.');
    const result = { id: t.id, title: t.title, priority: t.priority || null, positions: {} };
    for (const key of ['sourceId','unit','direction','description','status','owner','ownerNote','due','dueNote','comment','dependency','requester','link']) result[key] = typeof t[key] === 'string' ? t[key] : '';
    for (const mode of ['priority','owners','time']) {
      const p = t.positions?.[mode];
      if (p && typeof p.group === 'string' && Number.isFinite(p.x) && Number.isFinite(p.y)) result.positions[mode] = { group: mode === 'owners' && p.group === result.owner && result.owner ? `owner:${result.owner}` : p.group, x: Math.max(0, Math.min(100000, p.x)), y: Math.max(0, Math.min(100000, p.y)) };
    }
    return result;
  });
}

export function importBoard(text, currentTasks = [], currentOwners = [], { replace = false, year = new Date().getFullYear() } = {}) {
  text = text.trim();
  if (!text) throw new Error('Выберите файл или вставьте строки таблицы.');
  const json = text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null;
  if (json?.version && json.version !== 1) throw new Error('Неизвестная версия доски. Файл не изменён.');
  let imported = json ? validateBoard(json) : validateBoard(fromSheet(parseDelimited(text), year));
  if (!json) {
    if (!imported.length) throw new Error('В файле не нашлось задач с названием.');
    imported = imported.map(t => ({ ...t, owner: parseAssignee(t.ownerNote) || '' }));
  }
  const owners = Array.isArray(json?.owners) ? [...new Set(json.owners.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim()))] : [];
  const ids = new Set(currentTasks.map(t => t.id));
  const added = replace ? imported : imported.filter(t => !ids.has(t.id));
  const merged = validateBoard(replace ? imported : [...currentTasks, ...added]);
  const mergedOwners = replace ? owners : [...new Set([...currentOwners, ...owners])];
  if (!replace && !added.length && mergedOwners.length === currentOwners.length) throw new Error('Эти ID уже есть на доске. Для восстановления копии выберите замену.');
  return { tasks: merged, owners: mergedOwners, added: added.length, skipped: imported.length - added.length };
}
