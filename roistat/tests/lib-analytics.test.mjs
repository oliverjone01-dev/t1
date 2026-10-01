import { itemsOf, metricValue, dimValue, isNoDimension } from '../lib-analytics.mjs';
let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('ПРОВАЛ  ' + name + ': получено ' + JSON.stringify(got) + ', ждали ' + JSON.stringify(want)); }
  else console.log('ok      ' + name);
};

/* форма из API.md, раздел «Форма ответа analytics/data» */
const live = { status:'ok', data:[{ items:[
  { dimensions:{ marker_level_1:{ value:'yandex_direct', title:'Яндекс.Директ' } },
    metrics:[ { value:100, metric_name:'visits', attribution_model_id:'default' },
              { value:999, metric_name:'visits', attribution_model_id:'last_click' },
              { value:'13145742', metric_name:'payment_revenue', attribution_model_id:'default' },
              { value:null, metric_name:'custom_16', attribution_model_id:'default' } ] },
  { dimensions:{ marker_level_1:{ value:'', title:'Прямые визиты' } },
    metrics:[ { value:7, metric_name:'visits', attribution_model_id:'default' } ] },
], mean:{}, dateFrom:'2026-08-01T00:00:00+00:00', dateTo:'2026-09-01T00:00:00+00:00' }] };

const it = itemsOf(live);
t('itemsOf находит строки', it.length, 2);
t('старая (неверная) форма даёт null', itemsOf({ status:'ok', data:{ items:[] } }), null);
t('пустой ответ даёт null', itemsOf({ status:'ok' }), null);

t('метрика берётся по модели default', metricValue(it[0], 'visits'), 100);
t('строковое число приводится', metricValue(it[0], 'payment_revenue'), 13145742);
t('null остаётся null, а не нулём', metricValue(it[0], 'custom_16'), null);
t('отсутствующая метрика - null', metricValue(it[0], 'нету'), null);
t('метрики не массив - null', metricValue({ metrics:{ visits:1 } }, 'visits'), null);

t('значение разреза', dimValue(it[0], 'marker_level_1'), 'yandex_direct');
t('разрез без ключа - первое поле', dimValue(it[0]), 'yandex_direct');
t('строка вне разреза опознана по пустому значению', isNoDimension(it[1], 'marker_level_1'), true);
t('обычная строка не считается «вне разреза»', isNoDimension(it[0], 'marker_level_1'), false);


/* Граничный случай, найденный при сверке модуля с копией в probe-showcase.mjs:
   «поля разреза нет» и «поле есть, значение пустое» - это разные случаи. Записать
   первое в «вне канала» значит завысить непокрытые деньги на сломанной форме. */
t('поля разреза нет - undefined, не пустая строка', dimValue({ dimensions: {} }, 'marker_level_1'), undefined);
t('dimensions нет вовсе - undefined', dimValue({}, 'marker_level_1'), undefined);
t('нет поля разреза - это НЕ «вне канала»', isNoDimension({ dimensions: {} }, 'marker_level_1'), false);
t('нет dimensions - это НЕ «вне канала»', isNoDimension({}, 'marker_level_1'), false);
t('значение пустое - это «вне канала»', isNoDimension({ dimensions: { marker_level_1: { value: '' } } }, 'marker_level_1'), true);
t('значение null - это «вне канала»', isNoDimension({ dimensions: { marker_level_1: { value: null } } }, 'marker_level_1'), true);
console.log(fail ? '\nПРОВАЛОВ: ' + fail : '\nвсе проверки прошли');
process.exit(fail ? 1 : 0);
