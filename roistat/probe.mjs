/* Разведка Roistat API.
 *
 * Зачем отдельный шаг до синка: набор доступных методов зависит от тарифа
 * проекта и прав ключа, а документация help-ru.roistat.com и сам
 * cloud.roistat.com закрыты egress-прокси песочницы. Поэтому состав данных
 * выясняется запросом из Actions, а не пересказом по памяти.
 *
 * Разведчик стучится по кандидатам, записывает код ответа и форму тела.
 * Значения полей наружу не печатаются: только имена ключей и размеры
 * массивов. Ключ вырезается из вывода на случай эха в тексте ошибки.
 *
 * Запуск: ROISTAT_API=... ROISTAT_PROJECTID=... node roistat/probe.mjs
 */
const KEY = process.env.ROISTAT_API || process.env.ROISTAT_API_KEY || '';
const PRJ = process.env.ROISTAT_PROJECTID || process.env.ROISTAT_PROJECT_ID || '';
if (!KEY) { console.error('Нет ключа: ждём ROISTAT_API'); process.exit(1); }

const HOST = 'https://cloud.roistat.com/api/v1';
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const TO = day(1), FROM = day(8);

/* Пути взяты из индекса официальной документации (разделы about, analytics,
   statystics, channels, access). Что из них откроется нашему ключу - и есть
   предмет разведки. */
const CAND = [
  ['проекты',              'POST', '/project/list', {}],
  ['справочник метрик',    'POST', '/project/analytics/metrics-new', {}],
  ['справочник разрезов',  'POST', '/project/analytics/dimensions', {}],
  ['рекламные каналы',     'POST', '/project/analytics/source/list', {}],
  ['сквозная аналитика',   'POST', '/project/analytics/data',
    { dimensions: ['marker_level_1'],
      metrics: ['visitsCount', 'leadsCount', 'ordersCount', 'cost', 'income', 'profit'],
      period: { from: FROM, to: TO } }],
  ['статистика по дням',   'POST', '/project/statistics/get-daily', { period: { from: FROM, to: TO } }],
  ['заявки',               'POST', '/project/integration/lead/list',
    { period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 3 }],
  ['сделки',               'POST', '/project/integration/order/list',
    { period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 3 }],
  ['звонки',               'POST', '/project/integration/call/list',
    { period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 3 }],
  ['визиты',               'POST', '/project/site/visit/list',
    { period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 3 }],
  ['расходы по каналам',   'POST', '/project/integration/costs/list', { period: { from: FROM, to: TO } }],
  ['статусы сделок',       'POST', '/project/integration/status/list', {}]
];

/* Два способа авторизации: ключ в строке запроса и заголовком. Какой рабочий,
   покажет ответ, а не предположение. */
const AUTHS = [
  ['ключ в query', u => u + '?key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : ''), {}],
  ['заголовок Api-key', u => u + (PRJ ? '?project=' + encodeURIComponent(PRJ) : ''), { 'Api-key': KEY }]
];

const PRINT_ITEMS = Number(process.env.ROISTAT_PRINT_ITEMS || 200);
const scrub = s => String(s).split(KEY).join('***');

/* Форма ответа без значений: имена ключей, длины массивов, образец имён полей
   первого элемента. Ни одной строки клиентских данных в лог не уходит. */
function shape(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (!v.length) return 'массив[0]';
    const inner = (typeof v[0] === 'object' && v[0]) ? '{' + Object.keys(v[0]).slice(0, 25).join(', ') + '}' : typeof v[0];
    return 'массив[' + v.length + '] из ' + inner;
  }
  if (typeof v === 'object') {
    if (depth >= 2) return '{...}';
    return '{' + Object.keys(v).slice(0, 15).map(k => k + ': ' + shape(v[k], depth + 1)).join(', ') + '}';
  }
  return typeof v;
}

const results = [];
for (const [name, method, path, body] of CAND) {
  for (const [authName, mkUrl, hdr] of AUTHS) {
    const row = { name, path, auth: authName, code: '-', info: '' };
    try {
      const r = await fetch(mkUrl(HOST + path), {
        method,
        headers: Object.assign({ 'Content-Type': 'application/json' }, hdr),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      });
      row.code = r.status;
      const txt = await r.text();
      try {
        const j = JSON.parse(txt);
        row.info = shape(j);
        /* Текст отказа - сообщение API, а не клиентские данные: без него не понять,
           это неверные параметры запроса или метод закрыт правами ключа. */
        if (j.status === 'error' || j.error) {
          row.info += ' || ОТКАЗ: ' + JSON.stringify({ status: j.status, error: j.error, description: j.description });
        }
        row.json = j;
      } catch { row.info = 'не JSON: ' + txt.slice(0, 160).replace(/\s+/g, ' '); }
    } catch (e) { row.info = 'сеть: ' + e.message; }
    results.push(row);
  }
}


/* Разбор: что реально доступно и чем можно оперировать в дашборде */
const live = results.filter(r => r.code === 200 && r.json && r.json.status !== 'error');
console.log('\n=== Итог ===');
console.log('ответили без ошибки: ' + live.length + ' из ' + results.length);
const byName = new Map();
for (const r of live) if (!byName.has(r.name)) byName.set(r.name, r);
console.log('доступные разделы: ' + ([...byName.keys()].join(', ') || 'ни одного'));

/* Справочники печатаем целиком: это и есть ответ на вопрос «чем оперировать».
   Имена метрик и разрезов - не клиентские данные. */
for (const key of ['справочник метрик', 'справочник разрезов', 'рекламные каналы', 'статусы сделок']) {
  const r = byName.get(key);
  if (!r) continue;
  console.log('\n--- ' + key + ' ---');
  const arr = r.json.data || r.json.result || r.json;
  const list = Array.isArray(arr) ? arr : (arr && typeof arr === 'object' ? Object.values(arr).find(Array.isArray) || [] : []);
  for (const it of list.slice(0, PRINT_ITEMS)) {
    if (it && typeof it === 'object') {
      console.log('  ' + [it.key || it.name || it.id, it.title || it.label || '', it.type || ''].filter(Boolean).join(' · '));
    } else console.log('  ' + it);
  }
  console.log('  всего: ' + list.length);
}
if (!live.length) {
  console.log('\nНи один метод не ответил. Проверить по порядку: тот ли ключ (это ключ проекта, а не токен интеграции),');
  console.log('тот ли номер проекта, открыт ли API на тарифе, не ограничен ли ключ по IP.');
}

/* Таблица ответов идёт последней: лог читается с хвоста. */
console.log('\n=== Разведка Roistat, ' + new Date().toISOString() + ' ===');
console.log('проект: ' + (PRJ || 'НЕ ЗАДАН') + ', длина ключа: ' + KEY.length);
console.log('\n--- что ответил каждый метод ---');
for (const r of results) {
  console.log('[' + String(r.code).padStart(3) + '] ' + r.name.padEnd(20) + ' ' + r.auth.padEnd(20) + ' ' + r.path);
  console.log('      ' + scrub(r.info).slice(0, 500));
}
