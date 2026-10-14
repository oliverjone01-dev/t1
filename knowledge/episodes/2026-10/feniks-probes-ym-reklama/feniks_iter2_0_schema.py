# ФЕНИКС, итерация 2: структура полей и справочники услуг (только чтение analytics-mvp/data-ym)
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
Q = ('2026-07', '2026-08', '2026-09')
for f in ('netting.ndjson', 'orders.ndjson', 'bonuses_monthly.ndjson', 'services_monthly.ndjson', 'promo_monthly.ndjson', 'pnl_sku_netting_daily.ndjson', 'sku_views.ndjson'):
    rows = rd(f)
    keys = collections.Counter()
    for r in rows:
        keys.update(r.keys())
    print('==', f, len(rows), 'rows; fields:', dict(keys))
    print('   sample:', json.dumps(rows[len(rows) // 2], ensure_ascii=False)[:600])
b = rd('bonuses_monthly.ndjson')
print('\n== bonuses: (type, service) in Q with totals')
agg = collections.defaultdict(float)
for r in b:
    if r['ym'] in Q:
        agg[(r['type'], r['service'])] += r['amount']
for k, v in sorted(agg.items(), key=lambda x: (x[0][0], -abs(x[1]))):
    print('  ', k, round(v))
svc = rd('services_monthly.ndjson')
print('\n== act services in Q containing promo words, money/points totals')
agg = collections.defaultdict(lambda: [0.0, 0.0, 0])
for r in svc:
    if r['ym'] in Q:
        agg[r['service']][0] += r.get('money') or 0
        agg[r['service']][1] += r.get('points') or 0
        agg[r['service']][2] += 1
for k, v in sorted(agg.items(), key=lambda x: -x[1][0] - x[1][1]):
    print('  ', k, [round(v[0]), round(v[1]), v[2]])
pnl = rd('pnl_sku_netting_daily.ndjson')
print('\n== pnl basis values', collections.Counter(r.get('basis') for r in pnl))
