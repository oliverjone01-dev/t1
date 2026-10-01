/* Разбор ответа analytics/data. Общий модуль, а не копия в каждом скрипте.
 *
 * Зачем отдельный файл: две копии одной логики расходятся, и расходятся молча -
 * это класс К9 из реестра. Здесь живёт ровно то, что уже оплачено разведкой и
 * записано в roistat/API.md разделом «Форма ответа analytics/data».
 *
 * Форма ответа (проверена прогоном 36697301501, не взята из памяти):
 *   { status, data: [ { items, mean, dateFrom, dateTo, unprocessed, total_count } ] }
 * Строка разреза:
 *   { dimensions: { <ключ>: {value, title, ...} },
 *     metrics: [ {value, formatted, metric_name, attribution_model_id}, ... ] }
 */

/* Строки разреза. Ройстат отвечает HTTP 200 всегда, поэтому форма проверяется, а
   не предполагается: неверный разбор давал нули по всем метрикам и не падал. */
export function itemsOf(j) {
  const d = j && j.data;
  if (Array.isArray(d) && d.length && Array.isArray(d[0].items)) return d[0].items;
  return null;                    /* null это «форма не та», а не «строк нет» */
}

/* Число метрики из строки. Модель атрибуции у метрики может быть не одна: берём
   только `default`, иначе одна сделка посчитается столько раз, сколько моделей
   (К4, двойной учёт). Возвращает null, когда данных нет - не ноль (К7). */
export function metricValue(row, name) {
  const list = row && row.metrics;
  if (!Array.isArray(list)) return null;
  const hit = list.find(x => x && x.metric_name === name &&
    (x.attribution_model_id == null || x.attribution_model_id === 'default'));
  if (!hit) return null;
  const v = hit.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

/* Значение разреза. Строка «вне разреза» опознаётся по ПУСТОМУ значению, а не по
   тексту заголовка: заголовок Ройстат называет как угодно («Прямые визиты»), и
   поиск по словам её молча пропускает.
   ВАЖНО: «поля разреза нет» и «поле есть, значение пустое» - разные случаи, и
   путать их нельзя. Пустое значение это реальная строка «вне канала», по ней
   считается покрытие. Отсутствие поля - это сломанная форма ответа, и записать
   её в «вне канала» значит завысить непокрытые деньги на мусоре. Поэтому
   отсутствие поля даёт undefined, а пустое значение - пустую строку. */
export function dimValue(row, key) {
  const d = row && row.dimensions;
  if (!d) return undefined;
  const f = (key && d[key]) || Object.values(d)[0];
  if (!f) return undefined;
  return f.value == null ? '' : String(f.value);
}

export function isNoDimension(row, key) {
  return dimValue(row, key) === '';
}
