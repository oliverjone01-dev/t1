import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
rows = [json.loads(l) for l in open(D + 'sku_views.ndjson')]
tot = C.Counter()
for x in rows: tot[x['date']] += x.get('vsearch', 0) or 0
for sku, nm in (('5426756030', 'KONUX'), ('3492802310', 'KUVINO')):
    r = [x for x in rows if x['sku'] == sku]
    nz = [x for x in r if (x.get('views') or 0) > 0]
    print(nm, 'rows', len(r), 'first row', r[0]['date'] if r else None, 'first views>0', nz[0]['date'] if nz else None)
    for x in r:
        if '2026-08-08' <= x['date'] <= '2026-09-03':
            print('  ', x['date'], 'views', x['views'], 'vsearch', x['vsearch'], f"share {x['vsearch'] / tot[x['date']] * 100:.2f}%", 'units', x['units'])
od = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
k = [o['d'] for o in od if o['sku'] == '5426756030']
print('KONUX first order', min(k) if k else None)
