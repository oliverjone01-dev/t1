/* Раскладка расхождения сверки ПО СТРОКАМ: полный обход integration/order/list.
 *
 * Зачем. Сверка агрегатов за август по воронке 49 сошлась на 97.5%: Битрикс
 * 113 продаж и 13 472 158, Ройстат `payment_revenue` 109 и 13 145 742, остаток
 * 326 416 (2.5%) НЕ разложен (раздел «Сверка со снимком Битрикса» в API.md).
 * «Сошлось в пределах 2.5%» это не «сошлось»: остаток обязан быть объяснён
 * списком строк (шаг 5 скилла data-guard). Этот скрипт достаёт строки.
 *
 * Чем этот скрипт НЕ является. `order/list` и `analytics/data` - одна система,
 * Ройстат. Сравнение строк с его же агрегатом это НЕ сверка (К5, запись E015 в
 * реестре), а ПОИСК ОПРЕДЕЛЕНИЯ: какой датой и каким полем Ройстат относит
 * деньги к месяцу. Сверкой остаётся только стык со снимком Битрикса, и его
 * делает roistat/reconcile-rows.py по файлу, который пишет этот скрипт.
 *
 * Грабли, уже оплаченные разведкой (roistat/API.md):
 *   - Фильтр периода `order/list` ИГНОРИРУЕТ: сутки и месяц дают один и тот же
 *     total 52 954 (К3). Поэтому обход полный, а окно режется на нашей стороне.
 *   - `creation_date` в середине базы это штамп импорта 2026-03-05, а не дата
 *     сделки (К6, запись E022). Осью её брать нельзя, поэтому дата не задаётся
 *     руками: перебираются ВСЕ поля, похожие на дату, и побеждает то, которое
 *     воспроизводит агрегат Ройстата.
 *   - Порядок по убыванию, база растёт во время обхода: запись, приехавшая на
 *     середине, сдвинет остальные вниз - одна придёт дважды, другая не придёт
 *     вовсе (К4 и К7 сразу). Поэтому склейка по `id` в Map, `total` снимается до
 *     и после, недобор уникальных id роняет прогон (fail-closed, запись E027).
 *   - Ройстат отвечает HTTP 200 всегда: вердикт по составу данных, не по коду.
 *
 * Персональные данные. В записи заявки лежат клиентские поля. В лог уходят
 * только идентификаторы, числа, даты и имена статусов; значения остальных полей
 * не печатаются никогда, в выходной файл не попадают тоже.
 *
 * Запуск: ROISTAT_API=... ROISTAT_PROJECTID=... node roistat/probe-orders.mjs
 * Входы: CLOSED_MONTH (YYYY-MM, по умолчанию предыдущий полный месяц),
 *        TODAY, PAUSE_MS, PAGE (размер страницы), MAX_PAGES (страховка),
 *        FUNNEL (номер категории Битрикса, по умолчанию 49),
 *        ORDERS_OUT (куда писать файл для стыка с Битриксом).
 */
import { writeFileSync } from 'node:fs';
import { itemsOf, metricValue, dimValue } from './lib-analytics.mjs';

const KEY = process.env.ROISTAT_API || '';
const PRJ = process.env.ROISTAT_PROJECTID || '';
if (!KEY) { console.error('Нет ROISTAT_API'); process.exit(1); }

const HOST = 'https://cloud.roistat.com/api/v1';
const q = p => HOST + p + '?key=' + encodeURIComponent(KEY) + (PRJ ? '&project=' + encodeURIComponent(PRJ) : '');
const scrub = s => String(s).split(KEY).join('***');
const pause = ms => new Promise(r => setTimeout(r, ms));

const PAUSE = Number(process.env.PAUSE_MS || 2000);
const PAGE = Number(process.env.PAGE || 5000);
const MAX_PAGES = Number(process.env.MAX_PAGES || 60);   /* 12 страниц x 3 прохода + запас */
const FUNNEL = String(process.env.FUNNEL || '49');
const OUT = process.env.ORDERS_OUT || '/tmp/roistat-orders.json';

let calls = 0;
async function raw(path, body) {
  calls++;
  try {
    const r = await fetch(q(path), { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(120000) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { status:'error', error:'не JSON', description:t.slice(0,200) }; }
  } catch (e) { return { status:'error', error:'сеть', description:e.message }; }
}
const bad = j => !j || j.status === 'error' || !!j.error;
const isLimit = j => bad(j) && /limit/i.test(String(j.error));
const why = j => 'ОТКАЗ ' + scrub(JSON.stringify({ error:j.error, description:j.description }));

/* На лимите ждём и повторяем: иначе проба соврёт отказом там, где данные есть. */
async function call(path, body) {
  for (const wait of [5000, 15000, 30000, 60000, null]) {
    const j = await raw(path, body);
    if (!isLimit(j) || wait === null) return j;
    console.log('    (лимит запросов, пауза ' + wait / 1000 + 'с и повтор)');
    await pause(wait);
  }
}

/* ---------- окно ----------
   Границы считаются от TODAY, а не от литералов: тест с подменённым TODAY
   обязан давать те же выводы. Месяц закрытый, поэтому полуоткрытость границы
   здесь роли не играет - но окно всё равно пишется как [from, to), чтобы
   правило было одно и то же во всех скриптах Ройстата. */
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const [Y, M] = TODAY.split('-').map(Number);
const pad = n => String(n).padStart(2, '0');
const prevMonth = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
const [CY, CM] = process.env.CLOSED_MONTH
  ? process.env.CLOSED_MONTH.split('-').map(Number)
  : prevMonth(Y, M);
const MONTH = `${CY}-${pad(CM)}`;

const out = [];                       /* итоговая таблица, печатается последней */
const rub = x => Math.round(x).toLocaleString('ru-RU').replace(/ /g, ' ');

console.log('=== Roistat: раскладка сверки по строкам ===');
console.log('месяц ' + MONTH + ', воронка ' + FUNNEL + ', проект ' + (PRJ || 'НЕ ЗАДАН'));
console.log('страница ' + PAGE + ', пауза ' + PAUSE + 'мс\n');

/* ---------- 0. справочник статусов ----------
   Класс статуса берётся из API той же системы, а не назначается нами: в воронке
   49 класс `paid` несут пять стадий, и это доказано прогоном 36697832771. */
const st = await call('/project/integration/status/list', {});
if (bad(st)) { console.log('справочник статусов: ' + why(st)); process.exit(1); }
const ST = new Map();
for (const s of (st.data || [])) ST.set(String(s.id), { name: String(s.name || ''), type: String(s.type || '') });
console.log('--- справочник статусов: ' + ST.size + ' позиций ---');
const byType = {};
for (const v of ST.values()) byType[v.type] = (byType[v.type] || 0) + 1;
console.log('  классы: ' + JSON.stringify(byType));

/* Стадии воронки FUNNEL по классу. Идентификатор статуса несёт номер категории:
   `deal_C49:EXECUTING`. Отсюда и берём принадлежность к воронке - отдельного
   поля воронки в записи может не быть вовсе. */
const funnelRe = new RegExp('^deal_C' + FUNNEL + ':');
const stagesOfFunnel = [...ST.keys()].filter(k => funnelRe.test(k));
const paidStages = new Set(stagesOfFunnel.filter(k => ST.get(k).type === 'paid'));
console.log('  стадий воронки ' + FUNNEL + ': ' + stagesOfFunnel.length
  + ', из них класс paid: ' + paidStages.size);
for (const k of [...paidStages].sort()) console.log('    paid  ' + k + '  «' + ST.get(k).name + '»');
if (!paidStages.size) console.log('  ВНИМАНИЕ: ни одной стадии paid - проверить формат id статуса');
out.push(['стадий paid в воронке ' + FUNNEL, String(paidStages.size)]);

/* ---------- 0.5. эталон: агрегат analytics/data за тот же месяц и ту же воронку ----------
   Цифры прошлой сессии (payment_revenue 13 145 742, payment_sales 109) сюда НЕ
   вписываются: вписанная цифра устаревает молча, и раскладка начинает сходиться
   с прошлым месяцем вместо текущего (К10). Эталон снимается тем же прогоном, из
   той же минуты. Разрез воронки - `order_field_339` «Идентификатор направления
   сделки», он отдаёт id категорий Битрикса (проверено прогоном 36697832771). */
const FUNNEL_DIM = process.env.FUNNEL_DIM || 'order_field_339';
const nextMonthFirst = (() => {
  const [ny, nm] = CM === 12 ? [CY + 1, 1] : [CY, CM + 1];
  return `${ny}-${pad(nm)}-01`;
})();
const PERIOD = { from: `${MONTH}-01`, to: nextMonthFirst };   /* полуоткрытый [from, to) */

await pause(PAUSE);
const dict = await call('/project/analytics/metrics-new', {});
if (bad(dict)) { console.log('справочник метрик: ' + why(dict)); process.exit(1); }
const known = new Set((dict.metrics || []).map(x => x.name));
/* В запрос идут только имена, которые есть в справочнике: выдуманное имя роняет
   весь вызов - на этом упал самый первый прогон разведки. */
const WANT = ['visits', 'leads', 'marketing_cost', 'revenue', 'payment_revenue', 'payment_sales']
  .filter(n => known.has(n));

console.log('\n--- эталон: analytics/data за ' + MONTH + ', разрез ' + FUNNEL_DIM + ' ---');
console.log('  период [' + PERIOD.from + ', ' + PERIOD.to + ') - граница полуоткрытая, сутки по UTC');
console.log('  метрики: ' + WANT.join(', '));

const REF = {};
let DIM_MAP = [];
await pause(PAUSE);
const agg = await call('/project/analytics/data',
  { metrics: WANT, period: PERIOD, dimensions: [FUNNEL_DIM] });
if (bad(agg)) {
  console.log('  ' + why(agg) + ' - эталона не будет, подбор поля пойдёт без него');
} else {
  const items = itemsOf(agg);
  if (!items) {
    console.log('  ФОРМА ОТВЕТА НЕ ТА: строк разреза нет. Эталона не будет.');
  } else {
    console.log('  строк разреза: ' + items.length);
    /* Прогон 36735896587: разрез отдаёт значения `339:1`, `339:3`, `339:7` и
       пустое, а НЕ id категорий Битрикса 49/21/33, как записано в API.md - там в
       таблицу попали заголовки, а не значения. Поэтому воронка ищется и по
       значению, и по заголовку, а вся карта печатается: без неё непонятно, какой
       код чему соответствует, и подбор пошёл бы по пустой строке. */
    const labelOf = r => {
      const d = r && r.dimensions;
      const f = d && (d[FUNNEL_DIM] || Object.values(d)[0]);
      return String((f && f.title) || '');
    };
    console.log('  карта разреза ' + FUNNEL_DIM + ' (значение -> заголовок):');
    for (const r of items) console.log('    «' + dimValue(r, FUNNEL_DIM) + '» -> «' + labelOf(r) + '»');
    DIM_MAP = items.map(r => ({ value: dimValue(r, FUNNEL_DIM), title: labelOf(r) }));
    const hits = items.filter(r => dimValue(r, FUNNEL_DIM) === FUNNEL
      || new RegExp('(^|[^0-9])' + FUNNEL + '([^0-9]|$)').test(labelOf(r)));
    if (hits.length > 1)
      console.log('  ВНИМАНИЕ: воронке ' + FUNNEL + ' отвечает больше одной строки, эталон неоднозначен');
    const row = hits.length === 1 ? hits[0] : null;
    if (!row) {
      console.log('  однозначной строки воронки ' + FUNNEL + ' в разрезе НЕТ - эталона не будет');
    } else {
      console.log('  воронка ' + FUNNEL + ' опознана как «' + dimValue(row, FUNNEL_DIM)
        + '» / «' + labelOf(row) + '»');
      for (const n of WANT) REF[n] = metricValue(row, n);
      for (const n of WANT) console.log('    ' + n.padEnd(20)
        + (REF[n] == null ? 'нет данных' : rub(REF[n]).padStart(16)));
      out.push(['эталон payment_revenue ' + MONTH, REF.payment_revenue == null ? 'нет' : rub(REF.payment_revenue)]);
      out.push(['эталон payment_sales ' + MONTH, REF.payment_sales == null ? 'нет' : String(REF.payment_sales)]);
    }
  }
}
/* Ручное переопределение оставлено на случай разбора руками, но по умолчанию
   эталон живой. Если переопределили - это видно в логе. */
for (const k of Object.keys(REF).concat(['revenue', 'payment_revenue', 'payment_sales', 'leads'])) {
  const v = process.env['REF_' + k.toUpperCase()];
  if (v) { REF[k] = Number(v); console.log('  ПЕРЕОПРЕДЕЛЕНО руками: ' + k + ' = ' + v); }
}

/* ---------- 1. форма записи ----------
   Имена полей не берутся из памяти: снимаются с живого ответа. Значения
   печатаются только у полей, чьё ИМЯ прошло белый список (идентификаторы, даты,
   числа, статус, канал). Всё остальное - только тип, без значения. */
/* ЗАПРЕТ сильнее разрешения. Белый список ловит поле по куску имени, и `order`
   в нём пропустил бы `order_email`, а телефон, лежащий строкой «79991234567»,
   прошёл бы как число и уехал в файл как кандидат на деньги. Поэтому сначала
   запрет по имени, и он перекрывает всё: и печать значения, и попадание поля в
   кандидаты, и попадание в файл (К13). */
const DENY = /phone|tel|mobile|mail|email|fio|name|contact|client|person|address|adres|city|comment|text|descr|title|passport|inn|account|card|ip|login|utm_term|query|referer|url|link/i;
const SAFE = /(^id$)|(_id$)|(^status)|date|time|created|updated|changed|closed|revenue|cost|price|profit|sum|amount|budget|marker|visit|order|deal|lead|currency|channel/i;
const allowed = k => !DENY.test(k);
/* Запись раскладывается в плоский вид: `custom_fields` приходит объектом, и
   пользовательские поля Битрикса лежат именно там. Прогон 36735896587 показал,
   что на верхнем уровне из денег есть только `revenue` и `cost` (а `profit`
   пустой), а из дат - `creation_date` и `update_date`, и ни одна из них не «дата
   продажи». Значит смотреть надо внутрь, иначе поле просто не будет найдено.
   Запрет по имени применяется и к развёрнутым ключам. */
const flat = r => {
  const o = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (k === 'custom_fields' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of Object.entries(v)) {
        if (cv === null || typeof cv === 'object') continue;
        o['cf_' + ck] = cv;
      }
      continue;
    }
    if (v !== null && typeof v === 'object') continue;   /* products, status - не скаляры */
    o[k] = v;
  }
  return o;
};
const looksDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(v);
/* Телефон - это не деньги. Целое из 10-15 цифр, начинающееся с 7, 8 или +,
   в кандидаты на сумму не берём: в лог и в файл оно попасть не должно. */
const looksPhone = v => /^\+?[78]?\d{9,14}$/.test(String(v).replace(/[\s()-]/g, ''));
const looksNum = v => (typeof v === 'number' || (typeof v === 'string' && v !== '' && /^-?\d+(\.\d+)?$/.test(v)))
  && !looksPhone(v);
/* Даже у разрешённого поля значение маскируется, если похоже на контакт. */
const maskSample = v => {
  const t = String(v);
  if (looksPhone(t) || /@/.test(t)) return '(замаскировано)';
  return t.slice(0, 40);
};

function shapeOf(rows, label) {
  const keys = new Map();
  for (const r of rows) for (const [k, v] of Object.entries(flat(r))) {
    const e = keys.get(k) || { n: 0, types: new Set(), date: 0, num: 0, sample: null };
    e.n++;
    e.types.add(v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
    if (looksDate(v)) e.date++;
    if (looksNum(v)) e.num++;
    if (e.sample === null && allowed(k) && SAFE.test(k) && v !== null && typeof v !== 'object') e.sample = maskSample(v);
    keys.set(k, e);
  }
  console.log('\n--- форма записи, ' + label + ' (' + rows.length + ' записей, ' + keys.size + ' полей) ---');
  for (const [k, e] of [...keys.entries()].sort()) {
    const tag = e.date === e.n && e.n ? 'ДАТА' : e.num === e.n && e.n ? 'число' : '';
    console.log('  ' + k.padEnd(26) + [...e.types].join('|').padEnd(18) + tag.padEnd(6)
      + (!allowed(k) ? '(имя в запретном списке, значение не печатается)'
          : SAFE.test(k) ? (e.sample === null ? '' : 'напр. ' + e.sample) : '(значение не печатается)'));
  }
  return keys;
}

await pause(PAUSE);
const head = await call('/project/integration/order/list', { limit: 20 });
if (bad(head)) { console.log('первая страница: ' + why(head)); process.exit(1); }
const TOTAL_BEFORE = Number(head.total) || 0;
console.log('total до обхода: ' + TOTAL_BEFORE);
shapeOf(head.data || [], 'начало базы, offset 0');

await pause(PAUSE);
const mid = await call('/project/integration/order/list', { limit: 20, offset: Math.floor(TOTAL_BEFORE / 2) });
if (!bad(mid)) shapeOf(mid.data || [], 'середина базы, offset ' + Math.floor(TOTAL_BEFORE / 2));

/* Поля-кандидаты: дата и деньги. Список не задан руками - он собран с ответа.
   Кандидатом считается поле, которое похоже на дату (или на число) хотя бы в
   одной из двух проб: в начале базы лежат лиды, в середине сделки, и набор
   заполненных полей у них разный. Поле, где встретилась хоть одна дата, в
   деньги не берётся: строка «2026-08-01» проходит и как дата, и как не-число,
   но смысл у неё один. */
const cand = new Map();
for (const r of [...(head.data || []), ...(bad(mid) ? [] : (mid.data || []))])
  for (const [k, v] of Object.entries(flat(r))) {
    const e = cand.get(k) || { date: 0, num: 0 };
    if (looksDate(v)) e.date++;
    if (looksNum(v)) e.num++;
    cand.set(k, e);
  }
const DATE_FIELDS = [...cand.entries()].filter(([k, e]) => e.date > 0 && allowed(k)).map(([k]) => k).sort();
/* Идентификатор и флаг - не деньги. Прогон 36735896587 положил в кандидаты на
   сумму `roistat`, `visit_id` и `is_multichannel`: сложить их можно, смысла нет,
   а `roistat` это ещё и идентификатор посетителя. */
const NOT_MONEY = /(^id$)|(_id$)|^is_|^roistat$|^page$|^visit$|^order_id_alias$/i;
const NUM_FIELDS = [...cand.entries()]
  .filter(([k, e]) => e.num > 0 && e.date === 0 && allowed(k) && !NOT_MONEY.test(k))
  .map(([k]) => k).sort();
const denied = [...cand.keys()].filter(k => !allowed(k));
if (denied.length) console.log('\nполя, отсечённые запретным списком: ' + denied.join(', '));
console.log('\nполя-кандидаты на дату:   ' + (DATE_FIELDS.join(', ') || 'НЕТ'));
console.log('поля-кандидаты на деньги: ' + (NUM_FIELDS.join(', ') || 'НЕТ'));
out.push(['полей-дат найдено', String(DATE_FIELDS.length)]);

/* ---------- 2. полный обход ---------- */
const statusId = r => String(r && r.status && r.status.id != null ? r.status.id : (r ? r.status : ''));
const keep = new Map();
let pages = 0, shortPage = 0;

console.log('\n--- полный обход базы ---');
/* Граница обхода следит за ЖИВЫМ total из каждого ответа, а не за снятым до
   начала: если база выросла, проход по старой границе обрежется молча. Одна
   страница сверх границы берётся нарочно - она добирает хвост, съехавший вниз
   от новых записей в начале.

   Проходов несколько. Прогон 36735896587 собрал 52 984 из 52 987: на странице
   offset 30000 три записи пришли повторно, а три с конца не пришли вовсе - окно
   съехало, пока шёл обход. Ослаблять инвариант нельзя, иначе он перестаёт ловить
   настоящую дыру, поэтому обход просто повторяется и склеивается по id: две
   независимые попытки почти наверняка накрывают то, что первая пропустила. Если
   и после повторов недобор остался - прогон падает, как и раньше. */
const PASSES = Number(process.env.PASSES || 3);
let totalLive = TOTAL_BEFORE;
for (let pass = 1; pass <= PASSES; pass++) {
  const before = keep.size;
  if (pass > 1) console.log('  --- проход ' + pass + ': добираем недостающее ---');
for (let off = 0; off < totalLive + PAGE && pages < MAX_PAGES; off += PAGE) {
  await pause(PAUSE);
  const j = await call('/project/integration/order/list', { limit: PAGE, offset: off });
  pages++;
  if (bad(j)) { console.log('  offset ' + off + ': ' + why(j)); process.exit(1); }
  if (Number(j.total)) totalLive = Math.max(totalLive, Number(j.total));
  const rows = j.data || [];
  if (!rows.length) { console.log('  offset ' + off + ': пусто, обход закончен'); break; }
  if (rows.length < PAGE) shortPage++;
  for (const r of rows) {
    const f = flat(r);
    const id = String(r.id);
    const proj = { id, status: statusId(r) };
    for (const k of DATE_FIELDS) if (f[k] != null) proj[k] = String(f[k]);
    for (const k of NUM_FIELDS) if (f[k] != null && looksNum(f[k])) proj[k] = Number(f[k]);
    proj.has_visit = !!(r.visit_id || r.visit);
    /* Ссылка лида на сделку: Ройстат кладёт сюда `deal_N`, и N это id сделки
       Битрикса (проверено - deal_101293 есть в снимке). Для стыка она нужна. */
    if (r.order_id_alias) proj.alias = String(r.order_id_alias);
    keep.set(id, proj);                     /* склейка по id: дубль перезапишет сам себя */
  }
  if (pages % 3 === 1 || rows.length < PAGE)
    console.log('  offset ' + String(off).padStart(6) + ': пришло ' + String(rows.length).padStart(5)
      + ', уникальных всего ' + keep.size);
}
  const got = keep.size - before;
  console.log('  проход ' + pass + ': уникальных стало ' + keep.size + ' из ' + totalLive
    + (pass > 1 ? ' (добрано ' + got + ')' : ''));
  if (keep.size >= totalLive) break;
  if (pass === PASSES) break;
  if (pass > 1 && got === 0) { console.log('  повтор ничего не добрал, дальше смысла нет'); break; }
}

await pause(PAUSE);
const tail = await call('/project/integration/order/list', { limit: 1 });
const TOTAL_AFTER = bad(tail) ? null : Number(tail.total) || 0;
console.log('\ntotal до обхода ' + TOTAL_BEFORE + ', после ' + (TOTAL_AFTER === null ? 'не прочитан' : TOTAL_AFTER)
  + ', уникальных id собрано ' + keep.size + ', вызовов ' + calls);
if (TOTAL_AFTER !== null && TOTAL_AFTER !== TOTAL_BEFORE)
  console.log('БАЗА ДВИГАЛАСЬ во время обхода на ' + (TOTAL_AFTER - TOTAL_BEFORE) + ' записей');

/* fail-closed: недобор уникальных id значит, что окно съехало и часть базы не
   пришла. Это не «почти всё», это неполный снимок (E027).
   Сравнивать надо с тем, сколько записей было НА СТАРТЕ: рост базы не оправдание
   дыры, но и не сам по себе дыра. Прошлая версия считала разницу со знаком и при
   выросшей базе уходила в минус, то есть молча пропускала недобор - это поймал
   стенд, а не живой прогон. */
const MOVED = TOTAL_AFTER === null ? 0 : TOTAL_AFTER - TOTAL_BEFORE;
const shortfall = TOTAL_BEFORE - keep.size;
console.log('проходов сделано: ' + pages + ' страниц, порог проходов ' + PASSES);
out.push(['уникальных id / total на старте', keep.size + ' / ' + TOTAL_BEFORE]);
if (shortfall > 0) {
  console.log('НЕДОБОР ' + shortfall + ' записей из тех, что были на старте:');
  console.log('снимок неполный, раскладка по строкам недостоверна.');
  out.push(['ВЕРДИКТ', 'НЕДОБОР ' + shortfall + ', раскладку не делать']);
  for (const [k, v] of out) console.log('  ' + k.padEnd(40) + v);
  process.exit(1);
}
if (MOVED > 0) {
  console.log('База выросла на ' + MOVED + ' записей, и собрано ' + keep.size + ' против '
    + TOTAL_AFTER + ' на конец обхода.');
  console.log('Все записи, что были на старте, собраны (' + keep.size + ' >= ' + TOTAL_BEFORE + ').');
  console.log('Недобранное могло появиться только ВО ВРЕМЯ обхода, то есть сегодня,');
  console.log('а раскладка идёт по закрытому месяцу ' + MONTH + '. Пометка уходит в файл.');
  out.push(['база двигалась за обход', '+' + MOVED + ' записей']);
}

/* ---------- 3. воронка и класс ---------- */
const mine = [...keep.values()].filter(r => funnelRe.test(r.status));
const unknownStatus = [...keep.values()].filter(r => r.status && !ST.has(r.status)).length;
console.log('\n--- записи воронки ' + FUNNEL + ' ---');
console.log('  всего записей воронки: ' + mine.length + ' из ' + keep.size);
console.log('  записей со статусом, которого НЕТ в справочнике: ' + unknownStatus
  + ' (в «прочее» не списываются, см. раздел про справочник)');
const paid = mine.filter(r => paidStages.has(r.status));
console.log('  из них в стадии класса paid СЕЙЧАС: ' + paid.length);
console.log('  ВАЖНО: это состояние на момент прогона, а не «продажа в августе».');
console.log('  Месяц продажи задаёт дата, и какая именно - ищется ниже.');
out.push(['записей воронки ' + FUNNEL, String(mine.length)]);

/* ---------- 4. поиск определения: какая дата и какое поле дают агрегат ----------
   Это НЕ сверка: обе цифры из Ройстата (К5). Это поиск определения - без него
   раскладка расхождения с Битриксом сравнивала бы разные популяции (К2). */
const inMonth = (v) => typeof v === 'string' && v.slice(0, 7) === MONTH;
console.log('\n--- поиск определения: чем воспроизводится агрегат analytics/data ---');
console.log('  эталон, снятый этим же прогоном: ' + JSON.stringify(REF));
console.log('  ВНИМАНИЕ: обе цифры из Ройстата. Это не сверка (К5), а поиск определения:');
console.log('  какой датой и каким полем Ройстат относит деньги к месяцу.');
console.log('  строки ниже - перебор «поле даты x поле денег x класс статуса»');

const CLASSES = [
  ['paid сейчас', r => paidStages.has(r.status)],
  ['любой статус', () => true],
];
const rows4 = [];
for (const df of DATE_FIELDS) {
  for (const [clabel, cpred] of CLASSES) {
    const sel = mine.filter(r => cpred(r) && inMonth(r[df]));
    if (!sel.length) continue;
    const sums = {};
    for (const nf of NUM_FIELDS) {
      const s = sel.reduce((a, r) => a + (Number(r[nf]) || 0), 0);
      if (s) sums[nf] = s;
    }
    rows4.push({ df, clabel, n: sel.length, sums });
  }
}
if (!rows4.length) console.log('  НИ ОДНО поле даты не кладёт записи воронки в ' + MONTH);
for (const r of rows4.sort((a, b) => b.n - a.n)) {
  console.log('  ' + r.df.padEnd(22) + r.clabel.padEnd(14) + 'записей ' + String(r.n).padStart(5));
  for (const [nf, s] of Object.entries(r.sums).sort((a, b) => b[1] - a[1]))
    console.log('      ' + nf.padEnd(22) + rub(s).padStart(16)
      + (REF.payment_revenue && Math.abs(s - REF.payment_revenue) / REF.payment_revenue < 0.01 ? '   <-- совпало с payment_revenue' : '')
      + (REF.revenue && Math.abs(s - REF.revenue) / REF.revenue < 0.01 ? '   <-- совпало с revenue' : ''));
}

/* ---------- 5. файл для стыка с Битриксом ----------
   Стык делает python: снимок Битрикса лежит в git, Ройстат доступен только
   отсюда. В файл идут id, статусы, даты и числа - клиентских полей в нём нет. */
writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: 'roistat:integration/order/list',
  month: MONTH, funnel: FUNNEL,
  total_before: TOTAL_BEFORE, total_after: TOTAL_AFTER, unique: keep.size, moved: MOVED,
  date_fields: DATE_FIELDS, num_fields: NUM_FIELDS,
  paid_stages: [...paidStages],
  ref: REF, ref_period: PERIOD, funnel_dim: FUNNEL_DIM, dim_map: DIM_MAP,
  stages: Object.fromEntries(stagesOfFunnel.map(k => [k, ST.get(k)])),
  rows: mine,
}, null, 0), 'utf8');
console.log('\nфайл для стыка с Битриксом: ' + OUT + ' (' + mine.length + ' строк воронки ' + FUNNEL + ')');

console.log('\n=== итог ===');
for (const [k, v] of out) console.log('  ' + k.padEnd(40) + v);
