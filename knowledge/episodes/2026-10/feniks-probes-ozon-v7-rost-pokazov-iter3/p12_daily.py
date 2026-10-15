# P12: заказы магазина без отмен по дням с 28.09 (полнота последнего дня)
import json, collections as C
u = C.Counter()
for l in open('/home/user/t1/analytics-mvp/data/orders_daily.ndjson'):
    o = json.loads(l)
    if o['d'] >= '2026-09-28' and o['status'] != 'cancelled': u[o['d']] += o['units']
print(sorted(u.items()))
