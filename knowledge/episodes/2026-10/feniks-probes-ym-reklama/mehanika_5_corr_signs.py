#!/usr/bin/env python3
"""ФЕНИКС, проба 5: (a) корреляция ценовой стратегии с базой price*count, как у автора (проба 4a считала без count и
заменяется этой); (b) знак сумм буста в реестре - нет ли возвратов, записанных тем же типом с плюсом (abs() их бы сложил);
(c) GGM-29-4: буст по всем заказам, откуда 63 572 из analiz-output:141."""
import json, sys, collections, statistics, random
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson')
BOOST = 'Буст продаж, оплата за продажи'
p = [r for r in o if not r['service']]; po = {(r['order'], r['sku']): r for r in p}
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'): bo[(r['order'], r['sku'])] += abs(r['amount'])
obs = [(po[k]['sku'], po[k]['created'][:7], bo[k] / (po[k]['price'] * po[k]['count']), po[k]['p_mp'] / po[k]['price']) for k in bo if k in po and po[k]['price'] and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in ('2026-07', '2026-08', '2026-09', '2026-10')]
def corr(rows, key, minn=5):
    g = collections.defaultdict(list)
    for r in rows: g[key(r)].append(r)
    xs, ys = [], []
    for v in g.values():
        if len(v) < minn: continue
        mx = statistics.mean(r[2] for r in v); my = statistics.mean(r[3] for r in v)
        xs += [r[2] - mx for r in v]; ys += [r[3] - my for r in v]
    return round(statistics.correlation(xs, ys), 3), len(xs)
skus5 = {s for s, c in collections.Counter(r[0] for r in obs).items() if c >= 5}
base = [r for r in obs if r[0] in skus5]
print('## a) ценовая стратегия, база price*count')
print('  внутри SKU (как автор):', corr(base, lambda r: r[0]))
print('  внутри SKU x месяц (группы от 2):', corr(base, lambda r: (r[0], r[1]), 2))
print('  без 5-1:', corr([r for r in base if r[0] != 'GGT-35-5-1-100-180'], lambda r: r[0]))
print('  без 5-1 и GGM-01-1:', corr([r for r in base if r[0] not in ('GGT-35-5-1-100-180', 'GGM-01-1')], lambda r: r[0]))
random.seed(7); sl = sorted(skus5); bs = []
for _ in range(2000):
    pick = [random.choice(sl) for _ in sl]; rows = []
    for i, s in enumerate(pick): rows += [(f"{s}#{i}",) + r[1:] for r in base if r[0] == s]
    bs.append(corr(rows, lambda r: r[0])[0])
bs.sort(); print(f"  бутстреп по SKU (2000): 90% интервал {bs[100]:.2f} .. {bs[1899]:.2f}; доля <= 0: {sum(1 for x in bs if x <= 0) / len(bs):.1%}")
print('\n## b) знаки сумм буста в реестре (тип, знак): число строк')
print(' ', dict(collections.Counter((r['type'], 'плюс' if r['amount'] > 0 else 'минус' if r['amount'] < 0 else 'ноль') for r in n if r['service'] == BOOST)))
print('  все типы с «Возврат» в реестре по заказам, где был буст:', dict(collections.Counter((r['service'][:40], r['type']) for r in n if r['type'].startswith('Возврат') and any(k[0] == r['order'] for k in [(r['order'], r['sku'])] if (r['order'], r['sku']) in bo or r['order'] in {kk[0] for kk in []}))))
bo_orders = {k[0] for k in bo}
print('  то же по номеру заказа:', dict(collections.Counter((r['service'][:40], r['type'], r['src'][:40]) for r in n if r['type'].startswith('Возврат') and r['order'] in bo_orders)))
print('\n## c) GGM-29-4: буст по заказам')
for r in sorted([r for r in p if r['sku'] == 'GGM-29-4'], key=lambda r: r['created']):
    print(f"   {r['created']} {r['order']} {r['status']} rev={r['revenue']} буст={bo.get((r['order'], r['sku']), 0):,.0f}")
q = [r for r in p if r['sku'] == 'GGM-29-4' and r['created'][:7] in ('2026-07', '2026-08', '2026-09')]
print('  квартал все статусы: буст', f"{sum(bo.get((r['order'], r['sku']), 0) for r in q):,.0f}", '; все заказы:', f"{sum(bo.get((r['order'], r['sku']), 0) for r in p if r['sku'] == 'GGM-29-4'):,.0f}")
