# ФЕНИКС, итерация 2, проба 9: (a) поле bonus отчёта продвижения против баллов акта; (b) доля Маркета в цене с учётом количества;
# (c) П3 и П5 на одном кабинете в одном окне - пересечение по SKU; (d) баллы против денег в штрафах уже в пробе 7
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
promo = rd('promo_monthly.ndjson'); svc = rd('services_monthly.ndjson'); o = rd('orders.ndjson')
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
print('(a) promo rows with bonus field != 0, and act points for the same month/cabinet/kind:')
actp = collections.defaultdict(float)
for r in svc:
    k = 'shows' if r['service'] in ('Буст продаж с оплатой за показы', 'Товарные баннеры') else 'shelf' if r['service'] == 'Полка' else None
    if k:
        actp[(r['ym'], r['business'], k)] += r['points']
for r in promo:
    if r['kind'] in ('shows', 'shelf'):
        print('  ', r['ym'], CAB[r['business']], r['kind'], 'spend', r['spend'], 'bonus', r['bonus'], 'act points', round(actp[(r['ym'], r['business'], r['kind'])], 2))
print('(b) Market share in price, delivered by order month, furniture/mirrors: p_mp/revenue (as section 5) vs p_mp*count/revenue')
p = [r for r in o if not r['service']]
agg = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0])
for r in p:
    if r['status'] == 'DELIVERED' and r['created'][:7] in ('2026-07', '2026-08', '2026-09'):
        k = (r['created'][:7], CAB[r['business']])
        agg[k][0] += r['p_mp']; agg[k][1] += r['p_mp'] * r['count']; agg[k][2] += r['revenue']; agg[k][3] += (r['count'] > 1)
for k in sorted(agg):
    a = agg[k]
    print('  ', k, f'as section 5 {a[0] / a[2]:.1%}', f'with count {a[1] / a[2]:.1%}', 'rows count>1:', a[3])
