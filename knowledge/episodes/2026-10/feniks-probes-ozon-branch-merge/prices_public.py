# Проба ФЕНИКСА (вне охвата ветки): сколько предельных цен в рублях лежит в публичном data/prices_daily.ndjson с 23.09
# (по build-tests.ts:2234 с 23.09 поле price = предельная), против правила gap-daily.ts:26-31.
import json
n = 0; offers = set(); days = set()
for l in open('/home/user/t1-v4/analytics-mvp/data/prices_daily.ndjson'):
    r = json.loads(l)
    if r['d'] < '2026-09-23' or not r.get('price'):
        continue
    n += 1; offers.add(r['offer']); days.add(r['d'])
print('строк с 23.09: %d, артикулов: %d, дней: %d, последний: %s' % (n, len(offers), len(days), max(days)))
