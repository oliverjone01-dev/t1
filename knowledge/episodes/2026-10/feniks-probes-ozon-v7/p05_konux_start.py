import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
ad = L('ads_daily.ndjson')
# all click campaigns on the three SKUs (by offer) and their first/last spend days
OFF = {'GGT-35-5-1-100-180', 'GGM-18-2-2', 'GGT-03-3-3-E-16080'}
cs = C.defaultdict(lambda: dict(first='9999', last='', sp=0, off=''))
for a in ad:
    if a['off'] in OFF and a['id'] != '28753239' and a['sp'] > 0:
        c = cs[a['id']]; c['first'] = min(c['first'], a['d']); c['last'] = max(c['last'], a['d']); c['sp'] += a['sp']; c['off'] = a['off']
for k, c in sorted(cs.items(), key=lambda x: x[1]['first']):
    print(k, c)
sv = L('sku_views.ndjson')
tot = C.Counter(); per = C.defaultdict(C.Counter)
SK = {'5426756030': 'GGT-35-5-1-100-180', '3492802310': 'GGM-18-2-2', '3564841366': 'GGT-03-3-3-E-16080'}
for r in sv:
    tot[r['date']] += r.get('vsearch', 0) or 0
    if r['sku'] in SK: per[r['sku']][r['date']] += r.get('vsearch', 0) or 0
spd = C.defaultdict(C.Counter); vwd = C.defaultdict(C.Counter)
for a in ad:
    if a['off'] in OFF and a['id'] != '28753239':
        spd[a['off']][a['d']] += a['sp']; vwd[a['off']][a['d']] += a.get('vw', 0)
# weekly: sku vsearch share, ad spend, ad impressions, for each SKU
import datetime as dt
for sku, off in SK.items():
    print('\n==', off, 'week start | spend/wk | ad imps/wk | sku vsearch/wk | share of store vsearch %')
    d0 = dt.date(2026, 6, 1)
    while d0 < dt.date(2026, 10, 12):
        ds = [(d0 + dt.timedelta(i)).isoformat() for i in range(7)]
        sp_ = sum(spd[off][d] for d in ds); vw_ = sum(vwd[off][d] for d in ds); v = sum(per[sku][d] for d in ds); t = sum(tot[d] for d in ds)
        if t: print(ds[0], sp_, vw_, v, f'{v / t * 100:.2f}')
        d0 += dt.timedelta(7)
