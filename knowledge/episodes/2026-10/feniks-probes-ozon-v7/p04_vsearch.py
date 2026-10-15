import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
sv = L('sku_views.ndjson')
tot = C.Counter(); per = C.defaultdict(C.Counter)
SK = {'5426756030': 'KONUX GGT-35-5-1', '3492802310': 'KUVINO GGM-18-2-2', '3564841366': 'TRUBIS E-16080'}
for r in sv:
    tot[r['date']] += r.get('vsearch', 0) or 0
    if r['sku'] in SK: per[r['sku']][r['date']] += r.get('vsearch', 0) or 0
ad = L('ads_daily.ndjson')
adv = C.defaultdict(C.Counter)
CID = {'37675958': '5426756030', '39931246': '3492802310', '37239106': '3564841366', '44988949': '3564841366'}
for a in ad:
    if a['id'] in CID: adv[CID[a['id']]][a['d']] += a.get('vw', 0)
days = sorted(d for d in tot if d >= '2026-09-28')
for sku, nm in SK.items():
    print('\n==', nm, 'date | store vsearch | sku vsearch | share % | campaign ad impressions')
    for d in days:
        sh = per[sku][d] / tot[d] * 100 if tot[d] else 0
        print(d, tot[d], per[sku][d], f'{sh:.3f}', adv[sku][d])
# projection for KONUX and KUVINO: remove ad impressions above minimum (impressions ~ spend^0.81)
E = 0.81
for sku, w_now, w_new in (('5426756030', 30002, 2000), ('3492802310', 20016, 2000), ('3492802310', 20016, 5000)):
    last = [d for d in days if d >= '2026-10-05']
    base = [per[sku][d] / tot[d] for d in last]
    proj = [(per[sku][d] - adv[sku][d] * (1 - (w_new / w_now) ** E)) / tot[d] for d in last]
    print(f'\n{SK[sku]} {w_now}->{w_new}: base share 05-11.10 median {S.median(base)*100:.3f}% (half {S.median(base)*50:.3f}%), '
          f'projected share after cut median {S.median(proj)*100:.3f}%, ratio {S.median(proj)/S.median(base):.2f}')
