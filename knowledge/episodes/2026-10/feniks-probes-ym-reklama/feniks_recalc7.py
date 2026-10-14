import json, collections
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
sv=[r for r in rd('sku_views.ndjson') if not r.get('aggregate')]; o=rd('orders.ndjson')
print('card_groups.json:',open(D+'card_groups.json').read()[:300])
F=collections.defaultdict(collections.Counter)
for r in sv:
    for f in ('views','vsearch','pdp','cart','units'): F[r['sku']][f]+=r[f]
five=['GGT-35-2-3-100-180','GGT-35-3-2-100-180','GGT-03-2-2-O-20090','GGT-03-3-3-O-20090','GGT-35-3-3-100-180']
alt=['GGT-35-2-3-100-180','GGT-35-3-2-100-180','GGT-03-2-2-O-20090','GGT-03-3-3-O-20090','GGT-20-1-5-20090']
for name,S in (('author5 (sum=172k?)',five),('alt5 CTR lt 1.1',alt)):
    v=sum(F[s]['views'] for s in S); u=sum(F[s]['units'] for s in S); pdp=sum(F[s]['pdp'] for s in S)
    print(name,'views',v,'pdp',pdp,'units',u,[(s,F[s]['views'],round(F[s]['pdp']/F[s]['views']*100,2),F[s]['units']) for s in S])
# all furniture/mirror SKUs with CTR below 1.1% and views gt 10000
low=[(s,F[s]['views'],round(F[s]['pdp']/F[s]['views']*100,2),F[s]['units']) for s in F if F[s]['views']>10000 and F[s]['pdp']/F[s]['views']<0.011]
print('all SKUs views gt 10k and CTR lt 1.1%:',sorted(low,key=lambda x:-x[1]))
# GGT-35-5-1 CTR before and after 02.10, and siblings
for s in ('GGT-35-5-1-100-180','GGT-35-1-3-100-180','GGT-35-2-3-100-180','GGT-35-3-3-100-180'):
    pre=collections.Counter(); post=collections.Counter()
    for r in sv:
        if r['sku']==s:
            t=pre if r['date']<'2026-10-02' else post
            for f in ('views','vsearch','pdp','cart','units'): t[f]+=r[f]
    f=lambda c: (c['views'],c['vsearch'],c['pdp'],round(c['pdp']/c['views']*100,2) if c['views'] else None,c['units'])
    print(s,'pre 02.10 (views,vsearch,pdp,CTR,units)',f(pre),'| post',f(post))
# weekly CTR for 5-1
wk=collections.defaultdict(collections.Counter)
for r in sv:
    if r['sku']=='GGT-35-5-1-100-180':
        for f in ('views','pdp','units'): wk[r['date'][:8]+('1' if r['date'][8:]<'11' else '2' if r['date'][8:]<'21' else '3')][f]+=r[f]
print('5-1 by decade',[(k,v['views'],v['pdp'],round(v['pdp']/v['views']*100,1) if v['views'] else None,v['units']) for k,v in sorted(wk.items())])
# vsearch share for KONUX variants
for s in [x for x in F if x.startswith('GGT-35-') and x.endswith('-100-180')]:
    print(' ',s,'views',F[s]['views'],'vsearch',F[s]['vsearch'],'share',round(F[s]['vsearch']/F[s]['views']*100,1) if F[s]['views'] else None)
