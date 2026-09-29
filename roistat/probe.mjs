/* Разведка Roistat API.
 *
 * Зачем отдельный шаг до синка: набор доступных методов зависит от тарифа проекта
 * и от прав ключа. Писать снимок по методу, которого у нас нет, значит отлаживать
 * вслепую. Разведчик стучится по списку кандидатов, записывает код ответа и первые
 * байты тела, и печатает таблицу. Данные наружу не пишутся: только форма ответа.
 *
 * Запуск: ROISTAT_API_KEY=... ROISTAT_PROJECT_ID=... node roistat/probe.mjs
 * Из песочницы Claude не работает: cloud.roistat.com закрыт прокси. Только Actions.
 */
const KEY = process.env.ROISTAT_API_KEY || '';
const PRJ = process.env.ROISTAT_PROJECT_ID || '';
if (!KEY) { console.error('Нет ROISTAT_API_KEY'); process.exit(1); }

const HOST = 'https://cloud.roistat.com';
const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

/* Кандидаты. Один и тот же метод пробуется двумя способами авторизации:
   ключ в query (как в старой документации) и заголовок Api-key. */
const CAND = [
  ['список проектов',        'GET',  '/api/v1/project/list', null],
  ['сквозная аналитика',     'POST', '/api/v1/project/analytics/data',
    { dimensions: ['marker_level_1'], metrics: ['visitsCount', 'leadsCount', 'ordersCount', 'cost', 'income'],
      period: { from: weekAgo, to: today } }],
  ['список заявок',          'POST', '/api/v1/project/integration/lead/list',
    { period: { from: weekAgo + ' 00:00:00', to: today + ' 23:59:59' }, limit: 5 }],
  ['список визитов',         'POST', '/api/v1/project/site/visit/list',
    { period: { from: weekAgo + ' 00:00:00', to: today + ' 23:59:59' }, limit: 5 }],
  ['справочник маркеров',    'GET',  '/api/v1/project/analytics/marker/list', null],
  ['справочник статусов',    'GET',  '/api/v1/project/integration/status/list', null],
  ['звонки',                 'POST', '/api/v1/project/integration/call/list',
    { period: { from: weekAgo + ' 00:00:00', to: today + ' 23:59:59' }, limit: 5 }]
];

const AUTHS = [
  ['ключ в query', (u) => u + (u.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : ''), {}],
  ['заголовок Api-key', (u) => u + (PRJ ? (u.includes('?') ? '&' : '?') + 'project=' + encodeURIComponent(PRJ) : ''), { 'Api-key': KEY }]
];

/* Ключ не должен утечь в лог ни при каком исходе */
const scrub = s => String(s).split(KEY).join('***');

const rows = [];
for (const [name, method, path, body] of CAND) {
  for (const [authName, mkUrl, hdr] of AUTHS) {
    const url = mkUrl(HOST + path);
    let code = '-', note = '', shape = '';
    try {
      const r = await fetch(url, {
        method,
        headers: Object.assign({ 'Content-Type': 'application/json' }, hdr),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000)
      });
      code = r.status;
      const txt = (await r.text()).slice(0, 400);
      try {
        const j = JSON.parse(txt);
        shape = 'ключи: ' + Object.keys(j).slice(0, 8).join(', ');
        if (j.status) note = 'status=' + j.status;
        if (j.error) note += ' error=' + JSON.stringify(j.error).slice(0, 120);
      } catch { shape = 'не JSON: ' + txt.slice(0, 120).replace(/\s+/g, ' '); }
    } catch (e) {
      note = 'сеть: ' + e.message;
    }
    rows.push([name, method, path, authName, code, scrub(note || shape)]);
  }
}

const w = [22, 6, 44, 20, 5];
console.log('\nРазведка Roistat, ' + new Date().toISOString());
console.log('проект: ' + (PRJ || 'не задан') + ', ключ: ' + KEY.length + ' символов\n');
for (const r of rows) {
  console.log(
    r[0].padEnd(w[0]) + ' ' + r[1].padEnd(w[1]) + ' ' + r[2].padEnd(w[2]) + ' ' +
    r[3].padEnd(w[3]) + ' ' + String(r[4]).padStart(w[4]) + '  ' + r[5]
  );
}
const ok = rows.filter(r => r[4] === 200);
console.log('\nОтветили 200: ' + ok.length + ' из ' + rows.length);
if (!ok.length) console.log('Ни один метод не ответил. Проверить: тот ли ключ, тот ли project id, не закрыт ли API тарифом.');
