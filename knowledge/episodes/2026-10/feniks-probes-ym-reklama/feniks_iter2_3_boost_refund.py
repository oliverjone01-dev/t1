# ФЕНИКС, итерация 2, проба 3: откуда +11 426 promo в разноске у GGM-01-1 04.07 и что в пустых услугах реестра
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson'); svc = rd('services_monthly.ndjson')
Q = ('2026-07', '2026-08', '2026-09')
print('netting rows GGM-01-1 on 2026-07-03..05:')
for r in n:
    if r['sku'] == 'GGM-01-1' and '2026-07-03' <= r['d'] <= '2026-07-05':
        print('  ', {k: r.get(k) for k in ('d', 'type', 'service', 'src', 'amount', 'order', 'status')})
print('pnl rows GGM-01-1 2026-07-04:')
for r in pnl:
    if r['sku'] == 'GGM-01-1' and r['d'] == '2026-07-04':
        print('  ', {k: r[k] for k in ('d', 'accruals', 'commission', 'delivery', 'acquiring', 'cofin', 'promo', 'otherSvc', 'amount', 'points', 'units')})
print('netting rows with empty service in Q, by (type, src, month, business):')
agg = collections.defaultdict(lambda: [0.0, 0])
for r in n:
    if r['d'][:7] in Q and not r['service']:
        agg[(r['type'], r['src'], r['d'][:7], r['business'])][0] += r['amount']; agg[(r['type'], r['src'], r['d'][:7], r['business'])][1] += 1
for k, v in sorted(agg.items()):
    print('  ', k, round(v[0]), v[1])
print('netting boost rows with type other than Удержание/Списание (all months):')
c = collections.Counter()
for r in n:
    if 'Буст' in r['service'] and r['type'] not in ('Удержание', 'Списание'):
        c[(r['type'], r['service'], r['d'][:7])] += r['amount']
print('  ', {k: round(v) for k, v in c.items()})
# act boost money vs registry, Q: does the act carry negative boost (refund) rows?
neg = [(r['ym'], r['business'], r['d'], r['money'], r['sku']) for r in svc if r['service'] == 'Буст продаж' and r['money'] < 0]
print('act Буст продаж negative money rows:', neg[:10], len(neg))
