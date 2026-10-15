# ФЕНИКС iter3, @ 754cf5c. Остатки P iter2 на живых файлах чата (main 51f24d2 = данные ветки):
# P1 - строки за сегодня без full и без ts; P5 - формат ts (смещение +03:00 или Z); P4/P6 - значения group (регистр).
# python3 -I p_live.py
import json, collections, glob, os

DD = '/home/user/t1/analytics-mvp/data/'
ft = [json.loads(l) for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8') if l.strip()]
dates = collections.Counter(str(r.get('date'))[:10] for r in ft)
print('funnel_tests: строк', len(ft), '| последние даты', sorted(dates.items())[-4:])
last = max(dates)
lr = [r for r in ft if str(r.get('date'))[:10] == last]
print(f'  за {last}: строк {len(lr)}, с ts {sum(1 for r in lr if r.get("ts"))}, full=false {sum(1 for r in lr if r.get("full") is False)},'
      f' full=true {sum(1 for r in lr if r.get("full") is True)}, без full {sum(1 for r in lr if "full" not in r)}')
ts_fmt = collections.Counter()
for r in ft:
    t = r.get('ts')
    if t:
        ts_fmt['+03:00' if str(t).endswith('+03:00') else 'Z' if str(t).endswith('Z') else 'other:' + str(t)[-6:]] += 1
print('  форматы ts:', dict(ts_fmt))
print('  group:', dict(collections.Counter(str(r.get('group')) for r in ft)))
print('  full:', dict(collections.Counter(str(r.get('full')) for r in ft)))
# прочие файлы чата: формат ts
for f in ('gap_daily', 'acts_daily', 'boost_daily', 'store_moves', 'coinv_daily', 'cpo_sku_status', 'cabinet_orders_check'):
    p = DD + f + '.ndjson'
    if not os.path.exists(p):
        print(f'{f}: файла нет')
        continue
    rows = [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
    c = collections.Counter(('+03:00' if str(r.get('ts')).endswith('+03:00') else 'Z' if str(r.get('ts')).endswith('Z') else 'нет' if not r.get('ts') else 'иное') for r in rows)
    print(f'{f}: строк {len(rows)}, ts {dict(c)}, последняя дата {max(str(r.get("date", r.get("d", "")))[:10] for r in rows)}')
