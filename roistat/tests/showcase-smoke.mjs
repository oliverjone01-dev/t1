/* Дымовая проверка probe-showcase.mjs: fetch подменён, живой API не трогается.
 *
 * Зачем она есть. `node --check` не ловит удалённое имя: скрипт разбирается и
 * падает уже на прогоне, то есть в Actions и на живых вызовах. Разбор метрик из
 * этого скрипта переехал в lib-analytics.mjs, и проверить переезд можно только
 * прогоном. Стенд не проверяет цифры среза - он проверяет, что скрипт доходит до
 * конца и ни одно имя не потерялось.
 *
 * Запуск: node roistat/tests/showcase-smoke.mjs
 */
const METRICS = ['visits', 'leads', 'marketing_cost', 'revenue', 'payment_revenue',
  'net_profit', 'potential_revenue', 'revenue_canceled', 'payment_sales',
  'profit', 'payment_profit', 'products_revenue', 'products_profit', 'net_cost'];

const row = (dimKey, value, title, mult) => ({
  dimensions: { [dimKey]: { value, title } },
  metrics: METRICS.map((n, i) => ({ value: (i + 1) * 100 * mult, formatted: '', metric_name: n, attribution_model_id: 'default' }))
    .concat([{ value: 999999, metric_name: 'visits', attribution_model_id: 'last_click' }]),
});

global.fetch = async (url, init) => {
  const body = JSON.parse(init.body || '{}');
  const path = String(url).split('?')[0];
  let payload;
  if (path.endsWith('/analytics/metrics-new')) {
    payload = { status: 'ok', metrics: METRICS.concat(
      Array.from({ length: 21 }, (_, i) => 'custom_' + (13 + i))
    ).map(n => ({ name: n, title: 'Заголовок ' + n, type: 'money' })) };
  } else if (path.endsWith('/analytics/data')) {
    const dims = body.dimensions || [];
    const key = dims[0] || 'marker_level_1';
    const items = dims.length
      ? [row(key, 'yandex_direct', 'Яндекс.Директ', 1), row(key, '', 'Прямые визиты', 0.1), row(key, '49', 'GG RF Заказы', 0.5)]
      : [row(key, 'total', 'Итог', 1.6)];
    payload = { status: 'ok', data: [{ items, mean: {}, dateFrom: (body.period || {}).from + 'T00:00:00+00:00',
      dateTo: (body.period || {}).to + 'T00:00:00+00:00', unprocessed: 0, total_count: items.length }] };
  } else if (path.endsWith('/analytics/dimensions') || path.includes('dimension')) {
    payload = { status: 'ok', dimensions: [
      { name: 'marker_level_1', title: 'Рекламный канал' },
      { name: 'order_field_339', title: 'Идентификатор направления сделки' },
      { name: 'order_field_2', title: 'Воронка продаж' } ] };
  } else if (path.endsWith('/integration/status/list')) {
    payload = { status: 'ok', data: [
      { id: 'deal_C49:WON', name: 'Сделка успешна', type: 'paid' },
      { id: 'deal_C49:EXECUTING', name: 'Предоплата получена', type: 'paid' },
      { id: 'deal_C49:NEW', name: 'Формирование ТЗ', type: 'progress' } ] };
  } else if (path.endsWith('/integration/order/list')) {
    payload = { status: 'ok', total: 10, data: [{ id: 'deal_1', status: 'deal_C49:WON', creation_date: '2026-08-01', revenue: 1 }] };
  } else {
    payload = { status: 'ok', data: [] };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
};

process.env.ROISTAT_API = 'STUB-KEY';
process.env.ROISTAT_PROJECTID = 'stub';
process.env.PAUSE_MS = '0';
process.env.TODAY = '2026-09-30';
process.env.CLOSED_MONTH = '2026-08';
await import('../probe-showcase.mjs');
console.log('\n[дымовая проверка] probe-showcase.mjs дошёл до конца, имена на месте');
