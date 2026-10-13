"""ФЕНИКС, итерация 2: акции у 28 товаров пилота цены и помесячные заказы с долей комиссии.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter2b.py
"""
import json, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
rows = json.load(open(ROOT / 'knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', encoding='utf-8'))
sel = [r for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5]
arts = set(r['art'] for r in sel)
pr = collections.defaultdict(set)
with open(D / 'acts_daily.ndjson', encoding='utf-8') as f:
    for l in f:
        r = json.loads(l)
        if r['date'] == '2026-10-11' and r['art'] in arts:
            pr[r['art']].add(r['title'].split('.')[0])
c = collections.Counter()
for a in arts:
    t = pr.get(a, set())
    if any('Эластичный' in x for x in t):
        c['Эластичный бустинг'] += 1
    elif any('Максимальный' in x for x in t):
        c['Максимальный бустинг'] += 1
    elif t:
        c['только другие (рассрочка, кредит, автоакции)'] += 1
    else:
        c['без акций'] += 1
print('28 товаров пилота цены по акциям на 11.10:', dict(c))
print('названия акций:', dict(collections.Counter(x for a in arts for x in pr.get(a, set()))))
O = [json.loads(l) for l in open(D / 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
for m in ('2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'):
    rs = [o for o in O if o['d'][:7] == m and o['status'] == 'delivered' and o['revenue'] > 0]
    units = sum(o['units'] for o in O if o['d'][:7] == m and o['status'] != 'cancelled')
    com = -sum(o['commission'] for o in rs) / max(1, sum(o['revenue'] for o in rs))
    print(m, 'шт без отмен', units, 'комиссия у доставленных %.1f%%' % (100 * com))
