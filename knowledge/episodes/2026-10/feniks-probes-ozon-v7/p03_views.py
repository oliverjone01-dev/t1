import json, collections as C, datetime as dt
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
sv = L('sku_views.ndjson')
print('sku_views range', min(r['date'] for r in sv), max(r['date'] for r in sv))
tot = C.Counter(); per = C.defaultdict(C.Counter)
SK = {'5426756030': 'KONUX GGT-35-5-1', '3492802310': 'KUVINO GGM-18-2-2', '3564841366': 'TRUBIS E-16080'}
for r in sv:
    tot[r['date']] += r['views']
    if r['sku'] in SK: per[r['sku']][r['date']] += r['views']
ad = L('ads_daily.ndjson')
adv = C.defaultdict(C.Counter); adsp = C.defaultdict(C.Counter)
CID = {'37675958': '5426756030', '39931246': '3492802310', '37239106': '3564841366', '44988949': '3564841366'}
for a in ad:
    if a['id'] in CID:
        adv[CID[a['id']]][a['d']] += a.get('vw', 0); adsp[CID[a['id']]][a['d']] += a['sp']
days = sorted(d for d in tot if d >= '2026-09-01')
for sku, nm in SK.items():
    print('\n==', nm, 'date | store views | sku views | share % | ad impressions (campaign) | ad spend')
    for d in days:
        if d < '2026-09-10': continue
        sh = per[sku][d] / tot[d] * 100 if tot[d] else 0
        print(d, tot[d], per[sku][d], f'{sh:.2f}', adv[sku][d], adsp[sku][d])
