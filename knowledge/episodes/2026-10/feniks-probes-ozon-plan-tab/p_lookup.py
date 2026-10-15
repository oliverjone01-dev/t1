import json, collections
DD = '/home/user/t1/analytics-mvp/data/'
G = json.load(open(DD + 'card_groups.json'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
for a in ['GGT-03-3-3-E-16080', 'GGM-20-2', 'GGT-03-3-3-O-18090', 'GGT-03-1-3-E-12080', 'GGT-35-5-1-100-180']:
    print(a, off2sku.get(a))
rows = [json.loads(l) for l in open(DD + 'ads_sku_daily.ndjson') if l.strip()]
P = json.load(open(DD + 'plan_2026-10-15.json'))
mains = {off2sku[c['main_art']]: c['short'] for c in P['cards']}
mins = {off2sku.get(a): c['short'] for c in P['cards'] for a in c['min_arts'] if off2sku.get(a)}
tomin = {k['cid'] for k in P['to_min']}
c = collections.defaultdict(float)
for r in rows:
    if '2026-10-08' <= r['d'] <= '2026-10-13' and str(r['cid']) != '28753239':
        s = str(r['sku'])
        if s in mains: c[('main', mains[s], str(r['cid']))] += r['sp']
        if s in mins: c[('min', mins[s], str(r['cid']))] += r['sp']
print('расход 08-13.10 на главные и «минимальные» товары по кампаниям (to_min помечены *):')
for k, v in sorted(c.items()):
    if v > 0: print(' ', k[0], k[1], k[2] + ('*' if k[2] in tomin else ''), round(v))
print('ca есть в строках с 14.09:', sum(1 for r in rows if r['d'] >= '2026-09-14' and 'ca' in r), 'из', sum(1 for r in rows if r['d'] >= '2026-09-14'))
print('первая дата с ca:', min((r['d'] for r in rows if 'ca' in r), default=None))
print('min_arts без SKU в card_groups:', [a for c in P['cards'] for a in c['min_arts'] if a not in off2sku])
