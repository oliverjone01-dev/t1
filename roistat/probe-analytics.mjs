/* Разведка второго шага: можно ли снять трафик и заявки числами, а не формой.
 *
 * Отвечает на три вопроса:
 *   1. Какие метрики визитов, заявок и расходов есть под настоящими именами
 *      (первый прогон упал на угаданном visitsCount).
 *   2. Отдаёт ли analytics/data агрегаты в разрезе рекламного канала.
 *   3. Сколько заявок и сделок лежит в order/list за период и как они делятся
 *      по классу статуса. Это сверяется со снимком Битрикса - независимый источник.
 *
 * Значения клиентских полей не печатаются: только имена, размеры и итоги.
 * Запуск: ROISTAT_API=... ROISTAT_PROJECTID=... node roistat/probe-analytics.mjs
 */
const KEY = process.env.ROISTAT_API || '';
const PRJ = process.env.ROISTAT_PROJECTID || '';
if (!KEY) { console.error('Нет ROISTAT_API'); process.exit(1); }

const HOST = 'https://cloud.roistat.com/api/v1';
const q = p => HOST + p + '?key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : '');
const scrub = s => String(s).split(KEY).join('***');

async function call(path, body) {
  try {
    const r = await fetch(q(path), { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(60000) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { status:'error', error:'не JSON', description:t.slice(0,200) }; }
  } catch (e) { return { status:'error', error:'сеть', description:e.message }; }
}
const bad = j => !j || j.status === 'error' || !!j.error;
const why = j => 'ОТКАЗ ' + scrub(JSON.stringify({ error:j.error, description:j.description }));
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const FROM = process.env.FROM || day(30);
const TO   = process.env.TO   || day(1);
const pause = ms => new Promise(r => setTimeout(r, ms));

console.log('=== Roistat: трафик и заявки числами ===');
console.log('период ' + FROM + ' .. ' + TO + ', проект ' + (PRJ || 'НЕ ЗАДАН') + '\n');

/* ---------- 1. настоящие имена метрик ---------- */
const m = await call('/project/analytics/metrics-new', {});
let names = [];
if (bad(m)) console.log('справочник метрик: ' + why(m));
else {
  const list = m.metrics || [];
  names = list.map(x => x.name);
  /* Шаблон поиска задаётся снаружи: справочник на 217 позиций, в лог нужны
     только те метрики, про которые спросили. */
  const want = new RegExp(process.env.METRIC_GREP || 'visit|lead|order|cost|income|revenue|profit|conversion|cpl|cpo|drr|roi', 'i');
  const hit = list.filter(x => (want.test(x.name) || want.test(String(x.title))) && x.is_available !== false);
  console.log('--- метрики трафика, заявок и денег (' + hit.length + ' из ' + list.length + ') ---');
  for (const x of hit) console.log('  ' + x.name.padEnd(42) + ' ' + String(x.title).slice(0, 44).padEnd(46) + (x.type || ''));
}

/* ---------- 2. сквозная аналитика в разрезе канала ---------- */
await pause(1500);
/* Берём только те имена, которые справочник действительно вернул. */
const pick = cands => cands.filter(n => names.includes(n));
const METRICS = pick(['visitsCount','visits','leadsCount','leads','ordersCount','orders',
  'cost','income','profit','payment_profit','products_revenue','custom_1','custom_5','custom_11']);
console.log('\n--- сквозная аналитика, разрез marker_level_1 ---');
console.log('запрошенные метрики: ' + (METRICS.join(', ') || 'ни одной из кандидатов нет в справочнике'));
if (METRICS.length) {
  const a = await call('/project/analytics/data', {
    dimensions: ['marker_level_1'], metrics: METRICS, period: { from: FROM, to: TO } });
  if (bad(a)) console.log(why(a));
  else {
    const rows = a.data || a.result || [];
    console.log('строк в ответе: ' + (Array.isArray(rows) ? rows.length : 'не массив, ключи: ' + Object.keys(a).join(', ')));
    if (Array.isArray(rows) && rows.length) {
      console.log('форма строки: ' + Object.keys(rows[0]).join(', '));
      /* Итоги по метрикам, чтобы было видно, что цифры непустые. */
      const sum = {};
      for (const r of rows) {
        const ms = r.metrics || r;
        for (const k of Object.keys(ms)) {
          const v = ms[k] && typeof ms[k] === 'object' ? ms[k].value : ms[k];
          if (typeof v === 'number') sum[k] = (sum[k] || 0) + v;
        }
      }
      console.log('итоги за период: ' + JSON.stringify(sum));
    }
  }
}

/* ---------- 3. заявки и сделки: объём и разбивка по классу статуса ---------- */
await pause(1500);
const st = await call('/project/integration/status/list', {});
const stType = {};
if (!bad(st)) for (const s of (st.data || [])) stType[String(s.id)] = { name:s.name, type:s.type };

await pause(1500);
console.log('\n--- order/list: что внутри, заявки или только сделки ---');
const o = await call('/project/integration/order/list', {
  period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 500 });
if (bad(o)) console.log(why(o));
else {
  const rows = o.data || [];
  console.log('total по ответу: ' + o.total + ', в выборке: ' + rows.length);
  const byType = {}, byStatus = {};
  let rev = 0, withVisit = 0;
  for (const r of rows) {
    const sid = String(r.status && (r.status.id != null ? r.status.id : r.status));
    const meta = stType[sid] || {};
    const t = meta.type || 'не найден в справочнике';
    byType[t] = (byType[t] || 0) + 1;
    const nm = meta.name || sid;
    byStatus[nm] = (byStatus[nm] || 0) + 1;
    rev += Number(r.revenue) || 0;
    if (r.visit_id || r.visit) withVisit++;
  }
  console.log('по классу статуса: ' + JSON.stringify(byType));
  console.log('с привязкой к визиту: ' + withVisit + ' из ' + rows.length);
  console.log('сумма revenue в выборке: ' + Math.round(rev));
  const top = Object.entries(byStatus).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log('топ статусов в выборке:');
  for (const [n, c] of top) console.log('  ' + String(n).slice(0, 60).padEnd(62) + c);
}

/* ---------- 4. визиты: объём ---------- */
await pause(2000);
console.log('\n--- visit/list: объём трафика ---');
const v = await call('/project/site/visit/list', {
  period: { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }, limit: 1 });
if (bad(v)) console.log(why(v));
else console.log('total визитов за период: ' + v.total);

/* ---------- 5. работает ли фильтр периода ----------
   За 30 дней order/list вернул 52954 записи, а снимок Битрикса за три месяца по
   воронке C49 даёт 1160 сделок. Расхождение такого порядка бывает по двум разным
   причинам: либо метод покрывает все воронки холдинга, либо фильтр периода не
   применился и пришла вся база. Это класс ошибки К3 из реестра: молчаливая
   подмена периода. Инвариант простой - сутки не могут дать столько же, сколько
   месяц. */
await pause(2000);
console.log('\n--- проверка фильтра периода (инвариант: сутки < месяца) ---');
const oneDay = TO;
const probes = [
  ['месяц ' + FROM + '..' + TO, { from: FROM + ' 00:00:00', to: TO + ' 23:59:59' }],
  ['сутки ' + oneDay,           { from: oneDay + ' 00:00:00', to: oneDay + ' 23:59:59' }],
  ['сутки, поля date_from/date_to', null]
];
for (const [label, period] of probes) {
  const body = period ? { period, limit: 1 } : { date_from: oneDay + ' 00:00:00', date_to: oneDay + ' 23:59:59', limit: 1 };
  const r = await call('/project/integration/order/list', body);
  console.log('  ' + label.padEnd(36) + (bad(r) ? why(r) : 'total = ' + r.total));
  await pause(1500);
}
const vd = await call('/project/site/visit/list', { period: { from: oneDay + ' 00:00:00', to: oneDay + ' 23:59:59' }, limit: 1 });
console.log('  визиты за сутки ' + oneDay + ': ' + (bad(vd) ? why(vd) : 'total = ' + vd.total));
