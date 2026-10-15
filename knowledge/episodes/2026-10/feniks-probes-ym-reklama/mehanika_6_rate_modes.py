#!/usr/bin/env python3
"""ФЕНИКС, проба 6: повторяющиеся точные значения списанной ставки (до 0,01 п.п.).
При второй цене с меняющимся конкурентом точные повторы редки; при общей ставке кабинета - частые.
Мода по месяцу и кабинету, доля заказов в моде, сколько SKU делят моду. Только чтение."""
import json, sys, collections
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson')
BOOST = 'Буст продаж, оплата за продажи'; CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
p = [r for r in o if not r['service']]; po = {(r['order'], r['sku']): r for r in p}
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'): bo[(r['order'], r['sku'])] += abs(r['amount'])
rows = [(po[k]['business'], po[k]['created'][:7], po[k]['sku'], round(bo[k] / (po[k]['price'] * po[k]['count']) * 100, 2)) for k in bo if k in po and po[k]['price'] and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in ('2026-07', '2026-08', '2026-09', '2026-10')]
for c in CAB:
    for m in ('2026-07', '2026-08', '2026-09', '2026-10'):
        g = [r for r in rows if r[0] == c and r[1] == m]
        if not g: continue
        top = collections.Counter(r[3] for r in g).most_common(3)
        print(f"{CAB[c]} {m}: заказов {len(g)}; топ точных ставок: " + '; '.join(f"{v}% x{cn} ({len({r[2] for r in g if r[3] == v})} SKU)" for v, cn in top))
allc = collections.Counter(r[3] for r in rows)
print('всего заказов', len(rows), '; в значениях, повторённых 3+ раза:', sum(cn for v, cn in allc.items() if cn > 2), '; различных значений', len(allc))
