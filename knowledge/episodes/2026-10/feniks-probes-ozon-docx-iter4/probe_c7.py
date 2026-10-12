# ФЕНИКС: все кампании, впервые потратившие 07-10.10, без фильтра 500 ₽/день из camp10.py
import json, collections
D = '/home/user/t1/analytics-mvp/data/'
first = {}; name = {}; sp = collections.defaultdict(lambda: collections.defaultdict(int)); cl = collections.defaultdict(int)
for l in open(D + 'ads_daily.ndjson'):
    x = json.loads(l)
    name[x['id']] = x['off']
    if x['sp'] > 0:
        first[x['id']] = min(first.get(x['id'], '9'), x['d'])
        sp[x['id']][x['d']] += x['sp']
        if x['d'] >= '2026-10-09': cl[x['id']] += x['cl']
for c in sorted(first, key=lambda z: first[z]):
    if first[c] >= '2026-10-07':
        s = sum(v for d, v in sp[c].items() if d >= '2026-10-09')
        print(c, name[c][:30].ljust(30), 'first', first[c], 'sp/day 09-10 %.0f' % (s / 2), 'cpc', round(s / cl[c], 1) if cl[c] else '-', "| 'заказ' in name:", 'заказ' in name[c].lower())
