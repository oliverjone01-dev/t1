# ФЕНИКС, итерация 2, проба 13: З7 - баллы на буст привязаны к заказу? Строки «только деньгами» против доли Маркета в цене заказа
import json, collections, statistics
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); b = rd('bonuses_monthly.ndjson')
F = '74986385'; B = 'Буст продаж, оплата за продажи'
po = {(r['order'], r['sku']): r for r in o if not r['service']}
od = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание') and r['d'][:7] == '2026-09' and r['business'] == F:
        od[(r['order'], r['sku'], r['d'])][0 if r['type'] == 'Удержание' else 1] += -r['amount']
# accrued points per order (bonus report Начисление) and Market share per order
acc = collections.defaultdict(float)
for r in b:
    if r['type'] == 'Начисление' and r['order']:
        acc[r['order']] += r['amount']
groups = {'only money': [], 'both': [], 'only points': []}
for k, v in od.items():
    g = 'only money' if v[0] > 0 and v[1] == 0 else 'both' if v[0] > 0 else 'only points'
    r = po.get((k[0], k[1]))
    groups[g].append((k, v, r['p_mp'] / r['price'] if r else None, acc.get(k[0], 0.0), r['created'] if r else None, r['region'] if r else None))
for g, xs in groups.items():
    shares = [x[2] for x in xs if x[2] is not None]
    print(f'{g}: rows {len(xs)}, money {sum(x[1][0] for x in xs):,.0f}; Market share in price median {statistics.median(shares):.0%} min {min(shares):.0%}; orders with 0 points accrued: {sum(1 for x in xs if x[3] == 0)}')
print('only-money rows detail (order, day, money, mp share, points accrued for order, created):')
for x in sorted(groups['only money'], key=lambda x: -x[1][0])[:24]:
    print('  ', x[0][0], x[0][2][5:], round(x[1][0]), f'{x[2]:.0%}' if x[2] is not None else None, round(x[3]), x[4])
