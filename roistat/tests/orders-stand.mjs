/* Стенд для roistat/probe-orders.mjs: fetch подменён целиком, живой API не трогается.
   Проверяет то, что node --check не видит: удалённые имена, обход, фильтр воронки,
   поиск определения, fail-closed на недоборе и отсутствие клиентских полей в логе. */
const CASE = process.env.CASE || 'ok';

/* Синтетическая база. Порядок по убыванию (как у Ройстата), лиды в начале,
   сделки дальше. У сделок воронки 49 деньги и две даты: одна кладёт их в
   август, другая - в месяц импорта. Клиентское поле client НЕ должно попасть
   ни в лог, ни в файл. */
const base = [];
for (let i = 0; i < 40; i++) base.push({
  id: 'lead_' + (9000 - i), status: { id: 'lead_4', name: 'В работе' },
  creation_date: '2026-09-2' + (i % 9) + 'T10:00:00+00:00',
  update_date: '2026-09-30T14:29:55+00:00',
  client: 'Иванов Иван +7999' + i, revenue: 0, price: 0, cost: 0,
  /* шум, который прошлый прогон принял за деньги: идентификаторы и флаги */
  roistat: '17590000000' + i, visit_id: i % 2 ? '59178' + i : null, is_multichannel: 0,
  /* ссылка лида на сделку - настоящее поле, через него тоже идёт стык */
  order_id_alias: i === 0 ? 'deal_711' : null,
  custom_fields: { manager: 'Кто-то', utm_source: 'ya' },
});
/* 12 сделок воронки 49 «оплачено»: paid_date в августе, creation_date - штамп импорта.
   Сумма revenue по ним = 12 * 1000 = 12000, price = 12 * 900 = 10800. */
for (let i = 0; i < 12; i++) base.push({
  id: 'deal_' + (700 + i),
  status: { id: i % 3 === 0 ? 'deal_C49:WON' : 'deal_C49:EXECUTING', name: 'Стадия' },
  creation_date: '2026-03-05T19:14:46+00:00', update_date: '2026-09-01T00:00:00+00:00',
  client: 'Петров Пётр +7911' + i, revenue: 1000, price: 900, cost: 0,
  roistat: '17590000100' + i, visit_id: i % 2 ? 'v' + i : null, is_multichannel: 0,
  /* «Дата продажи» лежит в custom_fields, а не на верхнем уровне: на верхнем
     уровне настоящий API даёт только creation_date и update_date, и ни одна из
     них не дата продажи. Разведчик обязан заглянуть внутрь и найти поле там. */
  custom_fields: { paid_date: '2026-08-' + String(10 + i).padStart(2, '0'),
                   manager_phone: '7999000111' + i, deal_sum: 1000,
                   /* Ловушка прогона 36737751819: идентификатор посетителя Метрики
                      из девятнадцати цифр. Он обязан быть отсечён - и по имени
                      (uid), и по величине. Если просочится, «наибольшая сумма»
                      выберет его полем денег, и весь вывод станет мусором. */
                   ym_uid: '1785653809988413952',
                   /* Та же ловушка, но с НЕВИННЫМ именем: запрет по имени её не
                      берёт, обязан сработать запрет по величине. Без этой строки
                      проверялся бы только список имён, а он всегда неполный. */
                   'Расчет': '999999999999999',
                   'Идентификатор направления сделки': '49' },
});
/* сделка воронки 49, оплачена в сентябре - в август попасть не должна */
base.push({ id: 'deal_800', status: { id: 'deal_C49:WON' }, creation_date: '2026-03-05T00:00:00+00:00',
  client: 'Сидоров', revenue: 55555, price: 55555, custom_fields: { paid_date: '2026-09-04' } });
/* сделка чужой воронки 21 с августовской датой - в раскладку попасть не должна */
base.push({ id: 'deal_900', status: { id: 'deal_C21:WON' }, creation_date: '2026-03-05T00:00:00+00:00',
  client: 'Чужой', revenue: 77777, price: 77777, custom_fields: { paid_date: '2026-08-15' } });
/* Ловушки на персональные данные (К13). Белый список ловит поле по куску имени,
   и `order` в нём пропускал `order_email`; телефон строкой проходил как число и
   уезжал в файл кандидатом на деньги. Ни одно из этих значений не должно попасть
   ни в лог, ни в файл. */
/* unshift, а не push: форма записи снимается с НАЧАЛА базы и с её середины, и
   ловушка, дописанная в хвост, не попала бы ни в одно окно - проверка молча
   прошла бы, ничего не проверив. */
for (let i = 0; i < 3; i++) base.unshift({
  id: 'deal_' + (600 + i), status: { id: 'deal_C49:WON' },
  creation_date: '2026-03-05T00:00:00+00:00', custom_fields: { paid_date: '2026-08-05' },
  revenue: 500, price: 500,
  order_email: 'klient' + i + '@example.com',       /* имя проходит SAFE через `order` */
  client_phone: '7999123456' + i,                   /* строка из цифр, похожа на число */
  deal_contact_name: 'Кузнецов Кузьма',             /* имя проходит SAFE через `deal` */
  lead_comment: 'позвонить после 18, тел 89991112233',
});
/* статус, которого нет в справочнике: обязан быть подсвечен, а не списан в прочее */
base.push({ id: 'deal_950', status: { id: 'deal_C49:UC_UNKNOWN' }, creation_date: '2026-03-05T00:00:00+00:00',
  client: 'Нет в справочнике', revenue: 1, price: 1, custom_fields: { paid_date: '2026-08-20' } });

const statuses = [
  { id: 'lead_4', name: 'В работе (Лиды)', type: 'progress' },
  { id: 'deal_C49:NEW', name: 'Формирование ТЗ', type: 'progress' },
  { id: 'deal_C49:EXECUTING', name: 'Предоплата получена', type: 'paid' },
  { id: 'deal_C49:WON', name: 'Сделка успешна', type: 'paid' },
  { id: 'deal_C49:LOSE', name: 'Отказ', type: 'canceled' },
  { id: 'deal_C21:WON', name: 'Успех 21', type: 'paid' },
];

let orderCalls = 0, everN = 0;
global.fetch = async (url, init) => {
  const body = JSON.parse(init.body || '{}');
  const path = String(url).split('?')[0];
  let payload;
  if (path.endsWith('/integration/status/list')) {
    payload = { status: 'ok', data: statuses };
  } else if (path.endsWith('/integration/order/list')) {
    orderCalls++;
    let db = base, total = base.length;
    /* CASE=grow: во время обхода в начало базы приезжает больше записей, чем
       страница, окно съезжает и часть базы не придёт - скрипт обязан упасть
       на недоборе, а не досчитать молча (К4 и К7 сразу). */
    if (CASE === 'grow' && orderCalls > 3) {
      const add = [];
      for (let i = 0; i < 15; i++) add.push({ id: 'lead_NEW' + i, status: 'lead_4', creation_date: '2026-09-30', client: 'x' });
      db = [...add, ...base];
      total = db.length;
    }
    /* CASE=hole: страница в середине молча отдала половину. Ройстат отвечает
       HTTP 200 всегда, поэтому короткая страница - не отказ, а дыра в снимке. */
    const off = Number(body.offset || 0);
    let lim = Number(body.limit || 5000);
    if (CASE === 'hole' && orderCalls === 4) lim = Math.floor(lim / 2);
    /* CASE=permahole: дыра держится на КАЖДОМ проходе. Повторы её не закрывают, и
       прогон обязан упасть. Без этого случая многопроходность тихо превратила бы
       fail-closed в fail-open: `hole` теперь добирается со второго раза, и сам по
       себе он больше не доказывает, что инвариант ещё кусается. */
    if (CASE === 'permahole' && off > 0 && off < total) lim = Math.max(1, lim - 2);
    /* CASE=dup / dupmoney: в самой базе есть записи с одинаковым id, и `total`
       Ройстата считает СТРОКИ, а не различные id. Ровно это случилось в прогонах
       36735896587 и 36736887635: строк пришло столько, сколько обещал total, а
       различных id на три меньше, и повтор обхода дал то же самое. Прогон падать
       НЕ должен: ничего не потеряно. А вот если под одним id лежат РАЗНЫЕ деньги
       (dupmoney), склейка по id теряет сумму - это обязано быть видно. */
    if (CASE === 'dup' || CASE === 'dupmoney') {
      const twin = { ...db[1] };
      if (CASE === 'dupmoney') twin.revenue = 424242;
      db = [...db, twin];
      total = db.length;
    }
    /* CASE=slide: воспроизводит ровно то, что случилось в прогоне 36735896587 -
       на одной странице первого прохода окно съехало на 3 записи вперёд, три
       записи пришли повторно, а три с конца не пришли вовсе. Второй проход по
       нормальной базе обязан их добрать, и недобора остаться не должно. */
    /* CASE=everslide: база пополняется на КАЖДОМ вызове, поэтому каждый проход
       приносит id, которых раньше не было, и обход не сходится никогда. Сойтись
       он и не должен: набор записей от прохода к проходу разный, это не дубли в
       базе, и раскладку по строкам делать нельзя. Первая версия этого случая
       просто сдвигала окно на фиксированный набор - и честно СОШЛАСЬ на третьем
       проходе, потому что объединение накрыло всю базу. Проверку сходимости она
       не проверяла вовсе. */
    if (CASE === 'everslide') {
      /* ПОДМЕНА, а не дописывание: одна запись заменяется новой, длина базы та
         же. Тогда строк каждый проход приходит ровно `total` (проход полный), но
         набор id всё время новый, и объединение растёт без конца. Именно это
         обязана поймать проверка сходимости, а не проверка полноты: если
         дописывать записи, проход становится неполным и срабатывает другой
         вердикт, а сходимость так и остаётся непроверенной. */
      everN++;
      base[base.length - 1] = { id: 'lead_EV' + everN, status: { id: 'lead_4' },
                                creation_date: '2026-09-30T00:00:00+00:00', revenue: 0, price: 0 };
      db = base;
      total = db.length;
      /* Плюс сдвиг окна: без него проход не видит дублей, честно сходится на
         первом же проходе, и до проверки сходимости дело не доходит. Нужны оба
         признака сразу - дубли внутри прохода и новые id каждый проход. */
      if (off > 0 && off < total) {
        payload = { status: 'ok', total, data: db.slice(Math.max(0, off - 2), off - 2 + lim) };
        return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
      }
    }
    if (CASE === 'slide' && orderCalls === 4) {
      payload = { status: 'ok', total, data: db.slice(Math.max(0, off - 3), off - 3 + lim) };
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    }
    payload = { status: 'ok', total, data: db.slice(off, off + lim) };
  } else if (path.endsWith('/analytics/metrics-new')) {
    payload = { status: 'ok', metrics: [
      { name: 'visits', title: 'Визиты' }, { name: 'leads', title: 'Заявки' },
      { name: 'marketing_cost', title: 'Расходы' }, { name: 'revenue', title: 'Выручка' },
      { name: 'payment_revenue', title: 'Выручка' }, { name: 'payment_sales', title: 'Продажи' },
    ] };
  } else if (path.endsWith('/analytics/data')) {
    /* CASE=noagg: разрез воронки не отдаётся. Скрипт обязан идти дальше без
       эталона, а не падать и не подставлять цифру из памяти. */
    const items = CASE === 'noagg' ? [] : [
      /* Настоящий API отдаёт значения вида `339:3`, а номер воронки стоит в
         ЗАГОЛОВКЕ. Заглушка обязана врать так же, иначе она не проверяет разбор. */
      { dimensions: { order_field_339: { value: '339:3', title: '49' } },
        metrics: [
          { value: 40, metric_name: 'leads', attribution_model_id: 'default' },
          { value: 13501, metric_name: 'payment_revenue', attribution_model_id: 'default' },
          { value: 99999, metric_name: 'payment_revenue', attribution_model_id: 'last_click' },
          { value: 16, metric_name: 'payment_sales', attribution_model_id: 'default' },
          { value: 12301, metric_name: 'revenue', attribution_model_id: 'default' } ] },
      { dimensions: { order_field_339: { value: '339:1', title: '21' } },
        metrics: [ { value: 77777, metric_name: 'payment_revenue', attribution_model_id: 'default' } ] },
    ];
    payload = { status: 'ok', data: [{ items, mean: {}, dateFrom: '2026-08-01T00:00:00+00:00',
      dateTo: '2026-09-01T00:00:00+00:00', unprocessed: 0, total_count: items.length }] };
  } else {
    payload = { status: 'error', error: 'неизвестный метод' };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
};

process.env.ROISTAT_API = 'STUB-KEY';
process.env.ROISTAT_PROJECTID = 'stub';
process.env.PAUSE_MS = '0';
process.env.PAGE = '10';
process.env.TODAY = '2026-09-30';
process.env.CLOSED_MONTH = '2026-08';
process.env.ORDERS_OUT = process.env.ORDERS_OUT || '/tmp/stand-orders.json';
await import('../probe-orders.mjs');
