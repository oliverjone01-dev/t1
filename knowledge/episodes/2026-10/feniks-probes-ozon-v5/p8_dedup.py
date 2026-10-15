# ФЕНИКС проба B3 (OZON v5): ключи без дублей в окне базы 14.09-11.10 (orders_daily: заказ x sku; ads_daily: кампания x день)
import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
O = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
w = [o for o in O if '2026-09-14' <= o['d'] <= '2026-10-11']
k = C.Counter((o['order'], o['sku']) for o in w)
print('orders_daily окно: строк', len(w), '; уникальных (заказ, sku)', len(k), '; дублей', sum(v - 1 for v in k.values() if v > 1))
A = [json.loads(l) for l in open(D + 'ads_daily.ndjson')]
wa = [a for a in A if '2026-09-14' <= a['d'] <= '2026-10-11']
ka = C.Counter((a['id'], a['d']) for a in wa)
print('ads_daily окно: строк', len(wa), '; уникальных (кампания, день)', len(ka), '; дублей', sum(v - 1 for v in ka.values() if v > 1))
print('последние даты: заказы', max(o['d'] for o in O), '; реклама', max(a['d'] for a in A))
