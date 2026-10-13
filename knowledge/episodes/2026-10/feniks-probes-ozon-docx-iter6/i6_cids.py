import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
G = json.load(open(D + 'card_groups.json'))['groups']
kon = {s['offer'] for g in G if g['main'] == '6279981715' for s in g['skus']}
offer = json.load(open(D + 'sku_offer.json'))
ads = [json.loads(l) for l in open(D + 'ads_sku_daily.ndjson')]
camp = {}
for r in (json.loads(l) for l in open(D + 'ads_daily.ndjson')):
    camp[r['id']] = r['off']
def win(d):
    if d < '2026-08-01': return '1_Jul'
    if d < '2026-09-01': return '2_Aug'
    if d < '2026-09-04': return '3_01-03.09'
    if d < '2026-09-18': return '4_B 04-17.09'
    if d <= '2026-10-07': return '5_A1 18.09-07.10'
    return '6_A2 08-10.10'
m = C.defaultdict(float)
for r in ads:
    o = offer.get(r['sku'])
    if o in kon and r['sp'] > 0:
        m[(win(r['d']), o, r['cid'], camp.get(str(r['cid']), '?'))] += r['sp']
for k in sorted(m):
    print('%-18s %-20s cid %-9s %-30s %8.0f' % (k[0], k[1], k[2], k[3][:30], m[k]))
