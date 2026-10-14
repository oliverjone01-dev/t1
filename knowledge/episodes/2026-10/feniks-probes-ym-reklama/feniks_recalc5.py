import json, collections, statistics, datetime
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); o=rd('orders.ndjson'); svc=rd('services_monthly.ndjson'); promo=rd('promo_monthly.ndjson')
B='Буст продаж, оплата за продажи'; Q=('2026-07','2026-08','2026-09'); CAB={'1023124':'зеркала','74986385':'мебель'}
p=[r for r in o if not r['service']]
# (a) per-order split money/points, Sept furniture
per=collections.defaultdict(lambda:[0.0,0.0])
for r in n:
    if r['service']==B and r['type'] in ('Удержание','Списание') and r['d'][:7]=='2026-09' and r['business']=='74986385':
        per[(r['order'],r['sku'],r['d'])][0 if r['type']=='Удержание' else 1]+=-r['amount']
sh=[v[0]/(v[0]+v[1]) for v in per.values() if v[0]>0 and v[1]>0]
print('(a) orders with both: n',len(sh),'money share median',round(statistics.median(sh)*100,1),'quartiles',[round(x*100,1) for x in statistics.quantiles(sh,n=4)])
# (b) live money per month: boost money (netting) + act shows/shelf/banners money per cabinet
act=collections.defaultdict(float); actsrv=collections.Counter()
for r in svc:
    if r['ym'] in Q: actsrv[r['service']]+=1
    if r['ym'] in Q and r['service'] in ('Буст продаж с оплатой за показы','Полка','Товарные баннеры'):
        act[(r['ym'],r['business'],'sp' if r['service']!='Товарные баннеры' else 'ban')]+=r['money']
bm=collections.defaultdict(float)
for r in n:
    if r['service']==B and r['type']=='Удержание' and r['d'][:7] in Q: bm[(r['d'][:7],r['business'])]+=-r['amount']
# boost money in act?
actboost=collections.defaultdict(lambda:[0.0,0.0])
for r in svc:
    if r['ym'] in Q and 'Буст продаж' in r['service'] and 'показы' not in r['service']:
        actboost[(r['ym'],r['business'])][0]+=r['money']; actboost[(r['ym'],r['business'])][1]+=r['points']
tot=0
for m in Q:
    row=0
    for c in CAB:
        x=bm[(m,c)]+act[(m,c,'sp')]; row+=x
        print('(b)',m,CAB[c],'boost money',round(bm[(m,c)]),'act boost money/points',[round(v) for v in actboost[(m,c)]],'act shows+shelf money',round(act[(m,c,'sp')]),'banners',round(act[(m,c,'ban')]))
    tot+=row; print('(b)',m,'live money both cabinets (boost money + act shows/shelf money)',round(row))
print('(b) quarter total',round(tot))
print('(b) act service names in Q (top)',[s for s,_ in actsrv.most_common(40) if 'уст' in s or 'олк' in s or 'аннер' in s or 'родвиж' in s])
# (j) furniture shows by campaign in act
camp=collections.defaultdict(lambda:[0.0,0.0])
for r in svc:
    if r['ym'] in Q and r['business']=='74986385' and r['service'] in ('Буст продаж с оплатой за показы','Полка'):
        camp[(r['ym'],r['service'],r['campaign'])][0]+=r['money']; camp[(r['ym'],r['service'],r['campaign'])][1]+=r['points']
for k in sorted(camp): print('(j)',k,[round(v) for v in camp[k]])
# (g) BILLED_AMOUNT vs netting money+points, all promo boost months
nb=collections.defaultdict(float)
for r in n:
    if r['service']==B and r['type'] in ('Удержание','Списание'): nb[(r['d'][:7],r['business'])]+=-r['amount']
for r in promo:
    if r['kind']=='boost': print('(g)',r['ym'],CAB[r['business']],'BILLED',round(r['spend']),'netting',round(nb[(r['ym'],r['business'])]),'diff',round(r['spend']-nb[(r['ym'],r['business'])]),'rev',r['rev'],'revAll',r.get('revAll'))
# (e) promo october rows
for r in promo:
    if r['ym']=='2026-10': print('(e)',r)
# (i) buyer price furniture Aug vs Sep, delivered and all
for m in ('2026-08','2026-09'):
    for sel,lab in ((lambda r: r['status']=='DELIVERED','deliv'),(lambda r: True,'all')):
        g=[r for r in p if r['business']=='74986385' and r['created'][:7]==m and sel(r)]
        pr=sum(r['price']*r['count'] for r in g); pb=sum(r['p_buyer']*r['count'] for r in g); pm=sum(r['p_mp']*r['count'] for r in g)
        print('(i)',m,lab,'n',len(g),'avg price/line',round(pr/len(g)),'avg buyer/line',round(pb/len(g)),'mp share',round(pm/pr*100,1))
