# ФЕНИКС: откуда расход у товаров, которые не в 6 новых кампаниях, но получили рекламу 08-10.10
import json, collections
D = '/home/user/t1/analytics-mvp/data/'
offer = json.load(open(D + 'sku_offer.json'))
W = {'GGT-03-1-3-O-18090', 'GGT-03-2-1-O-18090', 'GGT-03-2-2-O-18090', 'GGT-03-3-4-O-18090', 'GGT-03-3-1-O-18090'}
r = collections.defaultdict(lambda: collections.defaultdict(int))
for l in open(D + 'ads_sku_daily.ndjson'):
    x = json.loads(l); a = offer.get(x['sku'])
    if a in W and x['d'] >= '2026-09-25': r[a][(x['d'], x['cid'])] += x['sp']
for a in sorted(W):
    print(a, sorted((k, v) for k, v in r[a].items() if v))
# имена кампаний
names = {}
for l in open(D + 'ads_daily.ndjson'):
    x = json.loads(l); names[x['id']] = x['off']
cids = {c for a in W for (d, c) in r[a]}
print({c: names.get(c, '?')[:40] for c in cids})
