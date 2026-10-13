# Проба ФЕНИКСА: «комиссия ~51% от предельной, нам остаётся 44%» - сверка двумя семействами источников.
# 1) отчёт о реализации (realization_monthly: revenue = оплата покупателя + bonus = доплата OZON, commission, payout)
# 2) заказы API (orders_daily: revenue = предельная, commission, paid), по месяцам, без отмен.
import json, collections as C, statistics as S
D = '/home/user/t1-v4/analytics-mvp/data/'
rm = [json.loads(l) for l in open(D + 'realization_monthly.ndjson')]
agg = C.defaultdict(lambda: C.Counter())
for r in rm:
    a = agg[r['ym']]
    for k in ('revenue', 'commission', 'payout', 'bonus', 'sold', 'ret'):
        a[k] += r.get(k) or 0
print('Отчёт о реализации (realization_monthly):')
for ym in sorted(agg):
    a = agg[ym]
    seller = a['revenue'] + a['bonus']
    if seller <= 0:
        continue
    print('  %s продано %d возвр %d | revenue %.0f bonus %.0f -> цена продавца %.0f | commission/цена продавца %.3f | payout/цена продавца %.3f | commission/revenue %.3f | bonus/цена %.3f' % (
        ym, a['sold'], a['ret'], a['revenue'], a['bonus'], seller, a['commission'] / seller, a['payout'] / seller, a['commission'] / a['revenue'], a['bonus'] / seller))
od = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
m = C.defaultdict(list)
for o in od:
    if o['status'] == 'cancelled' or not o.get('revenue'):
        continue
    if o.get('commission'):
        m[o['d'][:7]].append((o['commission'] / o['revenue'], (o.get('paid') or 0) / o['revenue']))
print('Заказы API (orders_daily, без отмен, только с начисленной комиссией):')
for ym in sorted(m):
    v = m[ym]
    print('  %s n=%d commission/revenue median %.3f | paid/revenue median %.3f' % (ym, len(v), S.median(x for x, _ in v), S.median(y for _, y in v if y)))
