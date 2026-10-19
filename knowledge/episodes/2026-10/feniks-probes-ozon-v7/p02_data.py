import json, collections as C, datetime as dt, sys
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
od = L('orders_daily.ndjson'); ad = L('ads_daily.ndjson'); asd = L('ads_sku_daily.ndjson')
print('orders_daily', min(o['d'] for o in od), max(o['d'] for o in od))
print('ads_daily', min(a['d'] for a in ad), max(a['d'] for a in ad))
print('ads_sku_daily', min(a['d'] for a in asd), max(a['d'] for a in asd), 'n days', len({a['d'] for a in asd}))
rows = {r['sku']: r for r in json.load(open('/tmp/ozon-floor/floor_rows.json'))}
art2sku = {r['art']: r['sku'] for r in rows.values()}
lst = json.load(open('/tmp/ozon-v5/list26.json'))
print('list26 entries', len(lst), 'step>0', sum(1 for o in lst if o['step'] > 0), 'step==0', sum(1 for o in lst if o['step'] == 0))
print('list26 keys', sorted(lst[0].keys()))
z = [o for o in lst if o['step'] == 0]
print('step0 h10 values (rentab after file step?)', sorted(round(o['h10'], 1) if o.get('h10') is not None else None for o in z if o.get('h10') is not None)[-5:], 'None count', sum(1 for o in z if o.get('h10') is None))
note17 = 'GGT-35-5-1-100-180 -10%, GGM-18-2-2 -10%, GGT-12-2 -10%, GGM-16-2-3 -10%, GGT-03-3-3-L-120 -5%, GGM-02-1-2 -10%, GGM-16-1-2 -10%, GGM-02-2-1 -10%, GGT-35-2-3-100-180 -10%, GGR-11-1 -10%, GGT-35-3-3-100-180 -10%, GGT-48-2-2-100-180 -10%, GGT-35-1-3-100-180 -10%, GGT-35-2-2-100-180 -8%, GGT-48-5-1-100-180 -10%, GGKP-02-1 -7%, GGM-08-3-M -10%'
note9 = 'GGT-03-3-3-E-16080 -10%, GGL-09-2 -10%, GGM-01-1 -9%, GGK-02-2-2-80 -10%, GGL-07-XL-2 -10%, GGM-24-1 -10%, GGM-23-3-1 -10%, GGT-03-3-5-E-16080 -5%, GGM-16-1-3-LED -9%'
nm = {}
for part in (note17 + ', ' + note9).split(', '):
    a, s = part.rsplit(' ', 1); nm[a] = int(s.strip('-%'))
ls = {o['art']: o['step'] for o in lst if o['step'] > 0}
print('note arts', len(nm), 'list arts', len(ls), 'mismatch', {a: (nm.get(a), ls.get(a)) for a in set(nm) | set(ls) if nm.get(a) != ls.get(a)})
# card groups: membership of ladder cards
g = json.load(open(D + 'card_groups.json'))['groups']
off2card = {}
for i, gr in enumerate(g):
    for s in gr['skus']:
        off2card[s['offer']] = i
NOW_ART = [p.rsplit(' ', 1)[0] for p in note17.split(', ')]
WAIT_ART = [p.rsplit(' ', 1)[0] for p in note9.split(', ')]
for a in ('GGT-35-5-1-100-180', 'GGT-03-3-3-E-16080', 'GGM-18-2-2'):
    ci = off2card.get(a)
    mem = [s['offer'] for s in g[ci]['skus']]
    print('\n==', a, 'card', g[ci]['model'], 'size', len(mem))
    print('   in price list now (15.10):', [m for m in mem if m in NOW_ART])
    print('   in price list after test 4:', [m for m in mem if m in WAIT_ART])
# card weekly orders 14.09-11.10 (4 weeks) and 15.09-12.10 etc
def card_orders(ci, A, B):
    offs = {s['offer'] for s in g[ci]['skus']}
    n = 0
    for o in od:
        if A <= o['d'] <= B and o['status'] != 'cancelled' and o.get('offer') in offs:
            n += o['units']
    return n
for a in ('GGT-35-5-1-100-180', 'GGT-03-3-3-E-16080', 'GGM-18-2-2'):
    ci = off2card[a]
    for A, B in (('2026-09-14', '2026-10-11'), ('2026-09-17', '2026-10-14')):
        n = card_orders(ci, A, B)
        days = (dt.date.fromisoformat(B) - dt.date.fromisoformat(A)).days + 1
        print(a, 'card orders', A, B, n, 'per week', round(n / days * 7, 2))
