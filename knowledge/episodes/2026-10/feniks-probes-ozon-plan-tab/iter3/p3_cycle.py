# iter3, N2-остаток: как быстро сборщик перезаберёт кампанию после сбоя отчёта.
# Сбой: state = сегодня (ad-sku-daily.ts:72), значит кампания встаёт в конец очереди «самые протухшие первыми» (:56-61).
# Оценка цикла обновления: возраст state у кампаний с расходом в окне 62 дня.
import json, collections, datetime as dt
DD = '/home/user/t1/analytics-mvp/data/'
state = json.load(open(DD + 'ads_sku_state.json'))
spent = collections.defaultdict(float)
for l in open(DD + 'ads_daily.ndjson', encoding='utf-8'):
    if not l.strip(): continue
    r = json.loads(l)
    if '2026-08-13' <= r['d'] <= '2026-10-13' and str(r['id']) != '28753239': spent[str(r['id'])] += float(r.get('sp') or 0)
act = [c for c, v in spent.items() if v > 0]
ages = collections.Counter(state.get(c, 'нет') for c in act)
print('кампаний с расходом в окне:', len(act), '| state по датам:', dict(sorted(ages.items())))
spent_oct = collections.defaultdict(float)
for l in open(DD + 'ads_daily.ndjson', encoding='utf-8'):
    if not l.strip(): continue
    r = json.loads(l)
    if '2026-10-08' <= r['d'] <= '2026-10-13' and str(r['id']) != '28753239': spent_oct[str(r['id'])] += float(r.get('sp') or 0)
a2 = [c for c, v in spent_oct.items() if v > 0]
print('с расходом 08-13.10:', len(a2), '| state:', dict(sorted(collections.Counter(state.get(c, 'нет') for c in a2).items())))
