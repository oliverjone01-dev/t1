/* Первый живой срез витрины маркетингового дашборда.
 *
 * Это не загрузчик и не дашборд. Это проба, которая должна доказать три вещи
 * ДО того, как будет написана хоть строка кода витрины (раздел 8 передаточного
 * файла sessions/handoff/2026-09-30-marketing-roistat-v2.md):
 *
 *   1. Сумма по каналам сходится с итогом из того же ответа.
 *      Иначе разрез marker_level_1 теряет или задваивает деньги (К4).
 *   2. Период реально двигает каждое число на трёх типах периода
 *      (закрытый месяц, часть месяца, текущий неполный месяц) - раздел 15
 *      регламента knowledge/os/analytics-dod.md. Иначе это К3, молчаливая
 *      подмена периода, она же E007 из реестра.
 *   3. Видно, сколько денег осталось вне каналов. Это виджет покрытия, он
 *      обязан стоять на витрине, а не в комментарии.
 *
 * Сверка с Битриксом делается НЕ здесь: снимок Битрикса лежит в репозитории
 * (ветка rop-dashboard-v1, analytics-mvp/rop/data/rop.json), а Ройстат доступен
 * только из Actions. Скрипт печатает выручку по каналам за закрытый месяц в
 * виде, пригодном для сверки, сверку делает сессия сравнением двух чисел.
 *
 * Имена метрик НЕ придумываются: сначала читается справочник, в запрос идут
 * только те имена, которые в нём есть (первый прогон разведки упал на
 * выдуманном visitsCount). Метрики выручки выбираются по русскому заголовку,
 * а не по номеру custom_N: номер ничего не значит без заголовка.
 *
 * Значения клиентских полей не печатаются. Названия рекламных каналов - это не
 * клиентские данные, они печатаются.
 *
 * Запуск: ROISTAT_API=... ROISTAT_PROJECTID=... node roistat/probe-showcase.mjs
 * Входы: CLOSED_MONTH (YYYY-MM, по умолчанию предыдущий полный месяц),
 *        TODAY (YYYY-MM-DD, подменяется в тестах), PAUSE_MS.
 */
const KEY = process.env.ROISTAT_API || '';
const PRJ = process.env.ROISTAT_PROJECTID || '';
if (!KEY) { console.error('Нет ROISTAT_API'); process.exit(1); }

const HOST = 'https://cloud.roistat.com/api/v1';
const q = p => HOST + p + '?key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : '');
const scrub = s => String(s).split(KEY).join('***');
const pause = ms => new Promise(r => setTimeout(r, ms));
const PAUSE = Number(process.env.PAUSE_MS || 2000);

async function raw(path, body) {
  try {
    const r = await fetch(q(path), { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(90000) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { status:'error', error:'не JSON', description:t.slice(0,200) }; }
  } catch (e) { return { status:'error', error:'сеть', description:e.message }; }
}
const bad = j => !j || j.status === 'error' || !!j.error;
const isLimit = j => bad(j) && /limit/i.test(String(j.error));
const why = j => 'ОТКАЗ ' + scrub(JSON.stringify({ error:j.error, description:j.description }));

/* На лимите ждём и повторяем: иначе проба соврёт отказом там, где данные есть. */
async function call(path, body) {
  for (const wait of [5000, 15000, 30000, null]) {
    const j = await raw(path, body);
    if (!isLimit(j) || wait === null) return j;
    console.log('    (лимит запросов, пауза ' + wait / 1000 + 'с и повтор)');
    await pause(wait);
  }
}

/* ---------- периоды ----------
   Три типа из раздела 15 регламента. Границы считаются от TODAY, а не от
   литералов: тест с подменённым TODAY обязан давать те же выводы (правило
   «тесты с инъекцией now», шаг 4 скилла data-guard). */
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const [Y, M, D] = TODAY.split('-').map(Number);
const pad = n => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   /* m - 1..12 */
const prevMonth = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

const [CY, CM] = process.env.CLOSED_MONTH
  ? process.env.CLOSED_MONTH.split('-').map(Number)
  : prevMonth(Y, M);
const closedFrom = `${CY}-${pad(CM)}-01`, closedTo = `${CY}-${pad(CM)}-${pad(lastDay(CY, CM))}`;
const curFrom = `${Y}-${pad(M)}-01`;
const partTo  = `${Y}-${pad(M)}-15`;
const curTo   = TODAY;
/* Половинки текущего месяца для проверки аддитивности. Если сегодня 15-е или
   раньше, второй половины ещё нет и проверка честно пропускается. */
const halfBFrom = `${Y}-${pad(M)}-16`;

const PERIODS = [
  { key:'closed',  label:'закрытый месяц   ' + closedFrom + ' .. ' + closedTo, from:closedFrom, to:closedTo, partial:false },
  { key:'part',    label:'часть месяца     ' + curFrom    + ' .. ' + partTo,   from:curFrom,    to:partTo,   partial:D <= 15 },
  { key:'current', label:'текущий месяц    ' + curFrom    + ' .. ' + curTo,    from:curFrom,    to:curTo,    partial:true },
];

console.log('=== Roistat: первый живой срез витрины ===');
console.log('сегодня ' + TODAY + ', проект ' + (PRJ || 'НЕ ЗАДАН'));
for (const p of PERIODS) console.log('  ' + p.label + (p.partial ? '   [НЕПОЛНЫЙ]' : ''));
console.log('');

const out = [];                                   /* итог печатается последним */
const say = s => console.log(s);
const rub = n => (n == null ? '-' : Math.round(n).toLocaleString('ru-RU'));

/* ---------- 1. справочник: какие метрики брать ---------- */
const dict = await call('/project/analytics/metrics-new', {});
if (bad(dict)) { console.error('справочник метрик: ' + why(dict)); process.exit(1); }
const all = dict.metrics || [];
const byName = new Map(all.map(x => [x.name, x]));
const titleOf = n => String((byName.get(n) || {}).title || '');

say('--- пользовательские метрики Б24: номер ничего не значит, смотрим заголовок ---');
for (const x of all) {
  if (!/^custom_\d+$/.test(x.name)) continue;
  const n = Number(x.name.split('_')[1]);
  if (n < 13 || n > 33) continue;
  say('  ' + x.name.padEnd(12) + String(x.title).slice(0, 62).padEnd(64) + (x.type || ''));
}

/* Выручка выбирается по заголовку. custom_16..26 - «выручка по стадиям», но
   какая из них равна выигранным сделкам, из номера не видно. */
const revenueCustoms = all
  .filter(x => /^custom_(1[6-9]|2[0-6])$/.test(x.name) && x.is_available !== false)
  .map(x => x.name);
const pick = c => c.filter(n => byName.has(n) && byName.get(n).is_available !== false);
const BASE = pick(['visits', 'leads', 'marketing_cost']);
const METRICS = BASE.concat(revenueCustoms);
say('\nв запрос идут ' + METRICS.length + ' метрик: ' + METRICS.join(', '));
if (!BASE.length) { console.error('ни одной базовой метрики нет в справочнике - дальше идти нельзя'); process.exit(1); }

/* ---------- 2. один вызов analytics/data ---------- */
/* Ройстат отвечает HTTP 200 всегда, поэтому «ошибки нет» ничего не доказывает.
   Разбор ответа сделан защитно: форма items на сегодня известна не до конца. */
async function data(from, to, dims) {
  await pause(PAUSE);
  const body = { metrics: METRICS, period: { from, to } };
  if (dims && dims.length) body.dimensions = dims;
  return call('/project/analytics/data', body);
}

/* Достаёт число метрики из строки ответа при любой из трёх известных форм:
   плоское поле, {value}, вложенный объект metrics. */
function metricValue(row, name) {
  const list = row && row.metrics;
  if (!Array.isArray(list)) return null;
  /* Модель атрибуции: у каждой метрики их может быть несколько. Берём default,
     иначе одна сделка посчиталась бы столько раз, сколько моделей (К4). */
  const hit = list.find(x => x && x.metric_name === name &&
    (x.attribution_model_id == null || x.attribution_model_id === 'default'));
  if (!hit) return null;
  const v = hit.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  return null;                      /* null это «нет данных», а не ноль (К7) */
}
/* Название канала. Ключ разреза в ответе Ройстата приходит не под одним именем,
   поэтому берём первое строковое поле из известных, а не гадаем одно. */
/* Строка «вне рекламного канала» опознаётся по ПУСТОМУ значению разреза, а не по
   тексту заголовка: заголовок Ройстат может назвать как угодно («Прямые визиты»),
   и поиск по словам «не определён» её молча пропускает. */
function isNoChannel(row) {
  const d = row && row.dimensions;
  const f = d && (d.marker_level_1 || Object.values(d)[0]);
  return !!f && (f.value === '' || f.value == null);
}
function dimLabel(row) {
  for (const k of ['title', 'name', 'label', 'dimension_title', 'marker_level_1']) {
    const v = row && row[k];
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object' && typeof v.title === 'string') return v.title;
  }
  const d = row && (row.dimensions || row.dimension);
  if (Array.isArray(d) && d.length) return String(d[0].title || d[0].value || d[0]);
  if (d && typeof d === 'object') { const f = Object.values(d)[0]; return String((f && f.title) || f); }
  return '(разрез без имени)';
}
/* Ответ: {status, data:[ {items, mean, dateFrom, dateTo, unprocessed, total_count} ]}.
   Строки разреза лежат в data[0].items, а не в data. */
const blockOf = j => (Array.isArray(j && j.data) && j.data[0]) ? j.data[0] : (j || {});
const rowsOf = j => { const b = blockOf(j); return Array.isArray(b.items) ? b.items : []; };

const sumOver = (rows, name) => rows.reduce((a, r) => {
  const v = metricValue(r, name); return v == null ? a : a + v; }, 0);

/* ---------- 3. три типа периода ---------- */
const snap = {};
for (const p of PERIODS) {
  say('\n=== ' + p.label + (p.partial ? '   [НЕПОЛНЫЙ]' : '') + ' ===');

  const byChan = await data(p.from, p.to, ['marker_level_1']);
  if (bad(byChan)) { say('разрез: ' + why(byChan)); out.push([p.key, 'разрез', 'ОТКАЗ']); continue; }
  const rows = rowsOf(byChan);
  const blk = blockOf(byChan);
  say('ключи блока: ' + Object.keys(blk).join(', '));
  say('строк: ' + rows.length + ', total_count: ' + blk.total_count +
      ', dateFrom/dateTo в ответе: ' + blk.dateFrom + ' .. ' + blk.dateTo);
  if (p.key === 'closed' && rows.length) {
    const r0 = rows[0];
    say('поля строки разреза: ' + Object.keys(r0).join(', '));
    const noMetrics = {}; for (const k of Object.keys(r0)) if (k !== 'metrics') noMetrics[k] = r0[k];
    say('строка без метрик: ' + scrub(JSON.stringify(noMetrics)).slice(0, 500));
    say('метрики первой строки: ' + scrub(JSON.stringify((r0.metrics||[]).map(x => [x.metric_name, x.value, x.attribution_model_id]))).slice(0, 900));
    say('unprocessed: ' + scrub(JSON.stringify(blk.unprocessed)).slice(0, 300));
    say('mean: '        + scrub(JSON.stringify(blk.mean)).slice(0, 300));
  }
  /* Пусто и ноль - разные вещи (К7). Считаем, у скольких строк метрика null. */
  const nulls = {};
  for (const m of METRICS) nulls[m] = rows.filter(r => metricValue(r, m) === null).length;

  const tot = await data(p.from, p.to, null);
  const totRows = rowsOf(tot);
  const totRow = bad(tot) ? null : (totRows[0] || tot.total || tot.mean || null);
  if (bad(tot)) say('итог без разреза: ' + why(tot));

  /* ---- инвариант 1: сумма по каналам = итог из того же ответа ---- */
  say('\n  метрика                        сумма по каналам        итог без разреза     расхождение');
  const cut = {};
  for (const m of METRICS) {
    const s = sumOver(rows, m);
    const t = totRow ? metricValue(totRow, m) : null;
    cut[m] = s;
    const diff = (t == null) ? null : s - t;
    const flag = diff == null ? '' : (Math.abs(diff) <= 0.01 ? '  OK' : '  РАСХОЖДЕНИЕ');
    const nn = nulls[m] === rows.length && rows.length ? '  ПУСТО во всех строках' : (nulls[m] ? '  null в ' + nulls[m] + ' из ' + rows.length : '');
    say('  ' + m.padEnd(16) + rub(s).padStart(20) + rub(t).padStart(22) + rub(diff).padStart(16) + flag + nn);
    if (diff != null && Math.abs(diff) > 0.01) out.push([p.key, 'сумма≠итог ' + m, rub(diff)]);
  }
  snap[p.key] = { rows, cut, totRow, partial: p.partial };

  /* ---- инвариант 3: покрытие. Сколько денег вне канала ---- */
  const money = revenueCustoms.filter(m => cut[m] > 0);
  const moneyMetric = money.sort((a, b) => cut[b] - cut[a])[0] || null;
  if (moneyMetric) {
    const undef = rows.filter(isNoChannel);
    const uSum = undef.reduce((a, r) => a + (metricValue(r, moneyMetric) || 0), 0);
    const total = cut[moneyMetric] || 0;
    say('\n  покрытие по деньгам (метрика ' + moneyMetric + ' - «' + titleOf(moneyMetric) + '»):');
    say('    всего ' + rub(total) + ', вне канала ' + rub(uSum) +
        (total ? ' = ' + (100 * uSum / total).toFixed(1) + '%' : ''));
    for (const r of undef) say('      строка вне канала: ' + dimLabel(r) + '  ' + rub(metricValue(r, moneyMetric)));
    const lv = cut['leads'] || 0;
    const lu = undef.reduce((a, r) => a + (metricValue(r, 'leads') || 0), 0);
    say('    лиды: всего ' + rub(lv) + ', вне канала ' + rub(lu) + (lv ? ' = ' + (100 * lu / lv).toFixed(1) + '%' : ''));
    out.push([p.key, 'деньги вне канала, %', total ? (100 * uSum / total).toFixed(1) : 'нет денег']);
  } else {
    say('\n  покрытие: ни одна метрика выручки не дала ненулевой суммы за период');
    out.push([p.key, 'деньги вне канала, %', 'выручка = 0']);
  }

  /* ---- топ каналов: это то, что пойдёт на сверку с Битриксом ---- */
  /* Таблица каналов печатается всегда: это и есть первый срез витрины, деньги в
     ней могут отсутствовать, а визиты, заявки и расходы - нет. */
  const sortKey = moneyMetric || 'leads';
  const top = rows.slice().sort((a, b) => (metricValue(b, sortKey) || 0) - (metricValue(a, sortKey) || 0)).slice(0, 20);
  say('\n  каналы по ' + sortKey + ' (топ 20 из ' + rows.length + '):');
  say('    канал                                       визиты    лиды       расходы' + (moneyMetric ? '   ' + moneyMetric : ''));
  for (const r of top) {
    say('    ' + dimLabel(r).slice(0, 40).padEnd(42) +
        rub(metricValue(r, 'visits')).padStart(8) + rub(metricValue(r, 'leads')).padStart(8) +
        rub(metricValue(r, 'marketing_cost')).padStart(14) +
        (moneyMetric ? rub(metricValue(r, moneyMetric)).padStart(14) : '') +
        (isNoChannel(r) ? '   <- вне рекламного канала' : ''));
  }
}

/* ---------- 4. инвариант 2: период двигает числа (К3, E007) ---------- */
say('\n=== инвариант: период двигает каждое число ===');
if (snap.part && snap.current) {
  for (const m of METRICS) {
    const a = snap.part.cut[m], b = snap.current.cut[m];
    if (!a && !b) continue;
    const ok = b >= a - 0.01;            /* месяц целиком не меньше своей первой половины */
    say('  ' + m.padEnd(16) + '1-15: ' + rub(a).padStart(14) + '   весь месяц: ' + rub(b).padStart(14) +
        (ok ? (b > a + 0.01 ? '   растёт' : '   РАВНО - период мог не примениться') : '   МЕНЬШЕ ЦЕЛОГО'));
    if (!ok) out.push(['период', m, 'часть больше целого']);
    else if (Math.abs(b - a) <= 0.01 && a > 0) out.push(['период', m, 'часть = целому, проверить']);
  }
} else say('  нет двух периодов для сравнения');

/* ---------- 5. аддитивность: 1-15 + 16-конец = весь месяц ---------- */
say('\n=== аддитивность: 1-15 + 16-' + curTo.slice(8) + ' = 1-' + curTo.slice(8) + ' ===');
if (Number(curTo.slice(8)) <= 16) {
  say('  сегодня ' + TODAY + ', второй половины месяца ещё нет - проверка пропущена, не провалена');
} else {
  const half = await data(halfBFrom, curTo, ['marker_level_1']);
  if (bad(half)) say('  ' + why(half));
  else {
    const hr = rowsOf(half);
    for (const m of METRICS) {
      const a = snap.part ? snap.part.cut[m] : null, b = sumOver(hr, m), c = snap.current ? snap.current.cut[m] : null;
      if (a == null || c == null || (!a && !b && !c)) continue;
      const diff = a + b - c;
      const ok = Math.abs(diff) <= 0.01;
      say('  ' + m.padEnd(16) + rub(a).padStart(14) + ' + ' + rub(b).padStart(14) + ' = ' + rub(a + b).padStart(14) +
          '   против ' + rub(c).padStart(14) + (ok ? '   OK' : '   РАСХОЖДЕНИЕ ' + rub(diff)));
      if (!ok) out.push(['аддитивность', m, rub(diff)]);
    }
  }
}

/* ---------- 6. граница периода: включается ли день, названный в `to` ----------
   Проверка появилась не из любопытства. Аддитивность (раздел 5) провалилась
   ровно на величину одних суток, а ответ Ройстата возвращает dateTo как
   `...T00:00:00+00:00`. Обе улики указывают на полуоткрытый интервал, но улика
   это не доказательство: спрашиваем API прямо. Заодно видно часовой пояс, в
   котором Ройстат режет сутки - он приходит в самом ответе. */
say('\n=== граница периода: включается ли день из `to` ===');
const D15 = `${Y}-${pad(M)}-15`, D16 = `${Y}-${pad(M)}-16`;
const oneDay  = await data(D15, D15, ['marker_level_1']);
const twoDays = await data(D15, D16, ['marker_level_1']);
const vOne = bad(oneDay)  ? null : sumOver(rowsOf(oneDay),  'visits');
const vTwo = bad(twoDays) ? null : sumOver(rowsOf(twoDays), 'visits');
say('  визиты за [' + D15 + ' .. ' + D15 + ']: ' + rub(vOne));
say('  визиты за [' + D15 + ' .. ' + D16 + ']: ' + rub(vTwo));
say('  часовой пояс в ответе: ' + String(blockOf(twoDays).dateFrom) + ' .. ' + String(blockOf(twoDays).dateTo));
if (vOne === 0 && vTwo > 0) {
  say('  ВЕРДИКТ: день из `to` НЕ включается. Интервал полуоткрытый [from, to).');
  say('  Значит «месяц по 30-е» это 1..29, а не весь месяц. Витрина обязана');
  say('  запрашивать `to` = первый день следующего периода, иначе теряются сутки.');
  out.push(['период', 'граница `to`', 'НЕ включается, интервал [from, to)']);
} else if (vOne > 0) {
  say('  ВЕРДИКТ: день из `to` включается, интервал закрытый [from, to].');
  say('  Тогда провал аддитивности объясняется чем-то другим - разбирать отдельно.');
  out.push(['период', 'граница `to`', 'включается, но аддитивность всё равно провалена']);
} else {
  say('  ВЕРДИКТ НЕ ВЫНЕСЕН: оба окна пустые или пришёл отказ. Не вывод, а нехватка данных.');
  out.push(['период', 'граница `to`', 'не выяснено']);
}

/* ---------- 7. где в Ройстате вообще лежат деньги по каналам ----------
   Плановая конструкция была: выручка = custom_16..26 в разрезе marker_level_1.
   Срез показал, что все эти метрики приходят null во всех строках и во всех трёх
   периодах. Пустая метрика и нулевая выручка - разные вещи (К7), поэтому вместо
   вывода «денег нет» перебираем все денежные метрики справочника и смотрим,
   какая из них вообще что-то отдаёт в этом разрезе. */
say('\n=== перебор: какие денежные метрики отдают числа в разрезе marker_level_1 ===');
const moneyAll = all
  .filter(x => x.is_available !== false)
  .filter(x => x.type === 'money' || /revenue|profit|payment|products_|income|cost/i.test(x.name))
  .map(x => x.name)
  .filter(n => !METRICS.includes(n));
say('кандидатов в справочнике: ' + moneyAll.length + ' (перебор только за закрытый месяц, чтобы не жечь лимит)');
const alive = [], empty = [];
for (let i = 0; i < moneyAll.length; i += 10) {
  const batch = moneyAll.slice(i, i + 10);
  await pause(PAUSE);
  const r = await call('/project/analytics/data', {
    metrics: batch, dimensions: ['marker_level_1'], period: { from: closedFrom, to: closedTo } });
  if (bad(r)) { say('  пачка ' + batch.join(',') + ': ' + why(r)); continue; }
  const rr = rowsOf(r);
  for (const m of batch) {
    const nn = rr.filter(x => metricValue(x, m) !== null).length;
    const sm = sumOver(rr, m);
    if (nn === 0) empty.push(m); else alive.push([m, nn, rr.length, sm]);
  }
}
say('\n  отдают числа (' + alive.length + '):');
for (const [m, nn, tot, sm] of alive.sort((a, b) => b[3] - a[3]))
  say('    ' + m.padEnd(30) + rub(sm).padStart(18) + '   строк с данными ' + nn + ' из ' + tot + '   «' + titleOf(m).slice(0, 40) + '»');
say('\n  пустые во всех строках (' + empty.length + '): ' + empty.join(', '));
out.push(['деньги', 'метрик с числами в разрезе', alive.length + ' из ' + moneyAll.length]);

/* ---------- 6. итог. Печатается последним: логи Actions читаются с хвоста ---------- */
say('\n=== ИТОГ СРЕЗА ===');
if (!out.length) say('  все проверки прошли');
else for (const [a, b, c] of out) say('  ' + String(a).padEnd(14) + String(b).padEnd(34) + c);

say('\n=== ДЛЯ СВЕРКИ С БИТРИКСОМ (закрытый месяц ' + closedFrom + ' .. ' + closedTo + ') ===');
if (snap.closed) {
  for (const m of revenueCustoms) {
    const v = snap.closed.cut[m];
    if (v) say('  ' + m.padEnd(12) + rub(v).padStart(16) + '   «' + titleOf(m) + '»');
  }
  say('  ' + 'leads'.padEnd(12) + rub(snap.closed.cut['leads']).padStart(16));
  say('  ' + 'visits'.padEnd(12) + rub(snap.closed.cut['visits']).padStart(16));
  say('  ' + 'marketing_cost'.padEnd(12) + rub(snap.closed.cut['marketing_cost']).padStart(16));
} else say('  среза за закрытый месяц нет');
