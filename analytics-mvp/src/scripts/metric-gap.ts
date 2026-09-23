// День без съёма это не ноль.
//
// Количества (показы, клики, заказы) заполняли пустую клетку нулём, и пропуск выгрузки рисовался
// обвалом до нуля. 23.09.2026 график вкладки «Тесты» показывал, будто тест рухнул в показах,
// хотя воронка просто доехала только по 22.09, а шапка стояла на 23.09. Иван прочитал это как
// провал теста, и был прав в том, что картинка говорила именно это.
//
// Отличить «ноль показов» от «день не снят» по одному товару нельзя: у товара ноль показов это
// обычное дело. Можно по всему снимку разом: если метрику в этот день не отдал НИ ОДИН артикул,
// значит её не снимали. Настоящий ноль по всем пятистам товарам невозможен, а если он
// когда-нибудь случится, разрыв линии это безопасная ошибка, в отличие от нарисованного обвала.

/** Метрики-уровни (соинвест, цена, позиция): у них пустая клетка всегда пропуск, не ноль.
 *  Усреднять уровень с нулём нельзя, это не «ничего не было», а «не знаем». */
export type IsLevel = (key: string) => boolean;

/** Дни, в которые метрика вообще снималась: хоть у одного артикула снимка есть значение. */
export function metricDays<R extends Record<string, unknown>>(
  series: Map<string, Map<string, R>>, key: string,
): Set<string> {
  const out = new Set<string>();
  for (const [, byDay] of series) for (const [day, row] of byDay) if (row[key] != null) out.add(day);
  return out;
}

/** Чем заполнить пустую клетку: пропуском (null) или нулём.
 *  Уровень - всегда пропуск. Количество - ноль, но только если день вообще снимали. */
export function gapValue(key: string, day: string, isLevel: IsLevel, days: Set<string>): number | null {
  if (isLevel(key)) return null;
  return days.has(day) ? 0 : null;
}

/** Кэш по метрике: series обходится один раз на ключ, а не на каждую клетку графика. */
export function gapFiller<R extends Record<string, unknown>>(
  series: Map<string, Map<string, R>>, isLevel: IsLevel,
): (key: string, day: string) => number | null {
  const cache = new Map<string, Set<string>>();
  return (key, day) => {
    let d = cache.get(key);
    if (!d) { d = metricDays(series, key); cache.set(key, d); }
    return gapValue(key, day, isLevel, d);
  };
}

/** До какого дня доезжает каждая метрика. Шапка страницы пишет одну дату на всё, а метрики
 *  отстают по-разному, и без этой сводки конец линии читается как падение. */
export function coverage<R extends Record<string, unknown>>(
  series: Map<string, Map<string, R>>, keys: string[],
): Array<{ key: string; last: string }> {
  return keys
    .map((key) => ({ key, last: [...metricDays(series, key)].sort().pop() ?? "" }))
    .filter((x) => x.last);
}
