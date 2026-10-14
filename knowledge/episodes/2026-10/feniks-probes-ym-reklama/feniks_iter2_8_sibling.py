# ФЕНИКС, итерация 2, проба 8: контроль для З8 - соседний вариант GGT-35-3-3 (ставка, цена, показы по дням около 02.10)
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); n = rd('netting.ndjson')
B = 'Буст продаж, оплата за продажи'
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание'):
        bo[(r['order'], r['sku'])] += -r['amount']
for S in ('GGT-35-3-3-100-180', 'GGT-35-2-3-100-180'):
    print('==', S, 'orders 01.09-12.10: created | price | p_buyer | mp share | boost rate | status')
    for r in sorted((r for r in o if not r['service'] and r['sku'] == S and r['created'] >= '2026-09-01'), key=lambda r: r['created']):
        b = bo.get((r['order'], r['sku']))
        print('  ', r['created'], r['price'], r['p_buyer'], f"{r['p_mp'] / r['price']:.0%}", f"{b / (r['price'] * r['count']):.1%}" if b else '-', r['status'])
    dv = collections.defaultdict(int)
    for r in sv:
        if not r.get('aggregate') and r['sku'] == S and '2026-09-24' <= r['date'] <= '2026-10-12':
            dv[r['date']] += r['views']
    print('   views by day', [(d[5:], v) for d, v in sorted(dv.items())])
