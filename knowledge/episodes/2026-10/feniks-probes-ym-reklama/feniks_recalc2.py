import json, collections, statistics, datetime
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); o=rd('orders.ndjson'); promo=rd('promo_monthly.ndjson')
B='Буст продаж, оплата за продажи'; Q=('2026-07','2026-08','2026-09')
p=[r for r in o if not r['service']]; oc={(r['order'],r['sku']):r for r in p}
bq=collections.defaultdict(float); bdate={}
for r in n:
    if r['service']==B and r['type'] in ('Удержание','Списание'):
        k=(r['order'],r['sku'])
        if r['d'][:7] in Q: bq[k]+=-r['amount']
        bdate.setdefault(k,set()).add(r['d'])
a=[];c=[];multi=[]
for k,v in bq.items():
    r=oc.get(k)
    if r and r['price']:
        a.append(v/r['price']); c.append(v/(r['price']*r['count']))
        if r['count']>1: multi.append((k[1],r['count'],round(v/r['price']*100,1),round(v/(r['price']*r['count'])*100,1)))
q=lambda x: statistics.quantiles(x,n=10)
print('author-def n',len(a),'median',round(statistics.median(a)*100,2),'p10',round(q(a)[0]*100,2),'p90',round(q(a)[8]*100,2),'max',round(max(a)*100,1),'ge20',sum(x>=0.2 for x in a))
print('per-unit   n',len(c),'median',round(statistics.median(c)*100,2),'p10',round(q(c)[0]*100,2),'p90',round(q(c)[8]*100,2),'max',round(max(c)*100,1),'ge20',sum(x>=0.2 for x in c))
print('multi-unit lines with boost in Q:',len(multi),multi[:12])
def stats(sel,label,src=bq):
    xs=[v/(oc[k]['price']*oc[k]['count']) for k,v in src.items() if k in oc and oc[k]['price'] and sel(k)]
    if len(xs)>=10: print(label,'n',len(xs),'median',round(statistics.median(xs)*100,2),'p90',round(q(xs)[8]*100,2))
stats(lambda k: oc[k]['created']>='2026-09-15','Q-postings, created ge 15.09')
stats(lambda k: min(bdate[k])>='2026-09-15','Q-postings, first posting ge 15.09')
stats(lambda k: oc[k]['created']<'2026-09-15','Q-postings, created lt 15.09')
ball=collections.defaultdict(float)
for r in n:
    if r['service']==B and r['type'] in ('Удержание','Списание'): ball[(r['order'],r['sku'])]+=-r['amount']
stats(lambda k: oc[k]['created']>='2026-09-15','ALL postings, created ge 15.09',ball)
stats(lambda k: min(bdate[k])>='2026-09-15','ALL postings, first posting ge 15.09',ball)
hi=[(oc[k]['sku'],oc[k]['created'],round(v/(oc[k]['price']*oc[k]['count'])*100,1)) for k,v in bq.items() if k in oc and v/(oc[k]['price']*oc[k]['count'])>=0.2]
print('orders ge20 per-unit:',len(hi),collections.Counter(s for s,_,_ in hi))
print('by month created',collections.Counter(d[:7] for _,d,_ in hi))
for s in ('GGM-01-1','GGM-29-4','GGM-01-2','GGM-01-3'):
    rows=sorted([(oc[k]['created'][5:],min(bdate[k])[5:],round(ball[k]/(oc[k]['price']*oc[k]['count'])*100,1)) for k in ball if k in oc and oc[k]['sku']==s and oc[k]['created']>='2026-06-01'])
    print(s,rows)
