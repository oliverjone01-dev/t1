export const GRID = 24;
export const CARD = { width: 288, height: 192 };
export const QUADRANTS = [
  { id: 'do', title: 'Сделать сейчас', subtitle: 'Важно · срочно', color: 'coral' },
  { id: 'plan', title: 'Запланировать', subtitle: 'Важно · не срочно', color: 'violet' },
  { id: 'delegate', title: 'Делегировать', subtitle: 'Не важно · срочно', color: 'blue' },
  { id: 'later', title: 'Отложить', subtitle: 'Не важно · не срочно', color: 'slate' },
];
export const STATUSES = ['Не указан', 'В ожидании', 'В работе', 'Готово', 'Отменено'];
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
  if (mode === 'priority') return task.priority || 'inbox';
  if (mode === 'owners') return task.owner || 'unassigned';
  return timeBucket(task, today);
}
export function createLayout(tasks, mode, today, extraOwners = []) {
  let groups;
  const laneWidth = 672;
  if (mode === 'priority') {
    groups = [{ id: 'inbox', title: 'Входящие', subtitle: 'Приоритет ещё не назначен', color: 'slate', x: 0, y: 0, w: 336, h: Math.max(1032, Math.ceil(tasks.filter(t => !t.priority).length) * 216 + 144) },
      ...QUADRANTS.map((q, i) => ({ ...q, x: 384 + (i % 2) * laneWidth, y: Math.floor(i / 2) * 600, w: 624, h: 552 }))];
    for (const group of groups.slice(1)) {
      const entries = tasks.filter(t => t.priority === group.id);
      const maxY = Math.max(0, ...entries.map(t => t.positions?.priority?.y || 0));
      group.h = Math.max(552, Math.ceil(entries.length / 2) * 216 + 120, maxY + CARD.height + 48);
    }
    const topHeight = Math.max(groups[1].h, groups[2].h);
    groups[3].y = topHeight + 48; groups[4].y = topHeight + 48;
  } else {
    groups = mode === 'owners'
      ? ['unassigned', ...new Set([...tasks.map(t => t.owner).filter(Boolean), ...extraOwners])].map(id => ({ id, title: id === 'unassigned' ? 'Без ответственного' : id, subtitle: id === 'unassigned' ? 'Назначьте исполнителя' : 'Ответственный', color: id === 'unassigned' ? 'slate' : 'violet' }))
      : timeLanes(today);
    const height = Math.max(1032, ...groups.map(g => Math.ceil(tasks.filter(t => groupFor(t, mode, today) === g.id).length / 2) * 216 + 144), ...tasks.map(t => (t.positions?.[mode]?.y || 0) + 240));
    groups = groups.map((g, i) => ({ ...g, x: i * laneWidth, y: 0, w: 624, h: height }));
  }
  // Extend inbox for manually moved cards too.
  if (mode === 'priority') groups[0].h = Math.max(groups[0].h, ...tasks.filter(t => !t.priority).map(t => (t.positions?.priority?.y || 0) + 240));
  const placed = new Map();
  for (const group of groups) {
    const entries = tasks.filter(t => groupFor(t, mode, today) === group.id);
    entries.forEach((task, index) => {
      const cols = group.w < 500 ? 1 : 2;
      const saved = task.positions?.[mode];
      const valid = saved && saved.group === group.id;
      const x = valid ? Math.max(24, Math.min(group.w - CARD.width - 24, snap(saved.x))) : 24 + (index % cols) * 312;
      const y = valid ? Math.max(96, snap(saved.y)) : 96 + Math.floor(index / cols) * 216;
      placed.set(task.id, { x: group.x + x, y: group.y + y, group: group.id });
    });
  }
  return { groups, placed, width: Math.max(...groups.map(g => g.x + g.w)) + 48, height: Math.max(...groups.map(g => g.y + g.h)) + 48 };
}
export function moveTask(task, mode, group, worldX, worldY, today) {
  if (mode === 'time' && group.id === 'overdue' && timeBucket(task, today) !== 'overdue') throw new Error('Прошедший срок задайте точной датой в карточке.');
  const next = structuredClone(task);
  if (mode === 'priority') next.priority = group.id === 'inbox' ? null : group.id;
  if (mode === 'owners') next.owner = group.id === 'unassigned' ? '' : group.id;
  if (mode === 'time' && group.id !== timeBucket(task, today)) next.due = group.due;
  next.positions ||= {};
  next.positions[mode] = { group: group.id, x: Math.max(24, Math.min(group.w - CARD.width - 24, snap(worldX - group.x))), y: Math.max(96, snap(worldY - group.y)) };
  return next;
}
export function parseDelimited(text, delimiter) {
  text = text.replace(/^\uFEFF/, '');
  delimiter ||= text.split('\n')[0].includes('\t') ? '\t' : ',';
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
  const m = tail.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?=$|\s|—|–)/);
  if (!m) return '';
  const value = `${m[3] || year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(+d) && localDate(d) === value ? value : '';
}
export function fromSheet(rows, year = new Date().getFullYear()) {
  const header = rows.findIndex(r => r.includes('ID') && r.includes('Направление'));
  if (header < 0) throw new Error('Не найдены заголовки ID и Направление. Вставьте строки вместе с заголовками.');
  const headers = rows[header]; const at = (row, name) => String(row[headers.indexOf(name)] || '').trim();
  return rows.slice(header + 1).filter(r => at(r, 'ID') && (at(r, 'Задача') || at(r, 'Направление'))).map(row => ({
    id: `sheet-${at(row, 'ID')}`, sourceId: at(row, 'ID'), title: at(row, 'Задача') || at(row, 'Направление'),
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
      if (p && typeof p.group === 'string' && Number.isFinite(p.x) && Number.isFinite(p.y)) result.positions[mode] = { group: p.group, x: Math.max(0, Math.min(100000, p.x)), y: Math.max(0, Math.min(100000, p.y)) };
    }
    return result;
  });
}
