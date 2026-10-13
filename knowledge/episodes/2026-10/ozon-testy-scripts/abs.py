import json,collections
D='/home/user/t1/analytics-mvp/data/'
TJ=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
offer=json.load(open(D+'sku_offer.json'))
V=collections.defaultdict(lambda: collections.Counter())
for l in open(D+'sku_views.ndjson'):
  r=json.loads(l);a=offer.get(str(r['sku']))
  if a: V[r['date']][a]+=0; 
  if a:
    for k in('vsearch','views','pdp','cart'): V[(r['date'],k)][a]+=r.get(k) or 0
def avg(arts,a,b,k):
  days=sorted({d for (d,kk) in [x for x in V if isinstance(x,tuple)] if a<=d<=b and kk==k})
  return sum(sum(V[(d,k)][x] for x in arts) for d in days)/len(days), len(days)
t1=set(TJ['тесты'][0]['тест'])
allart=set(offer.values());rest=allart-t1
for k in ('vsearch','views','pdp','cart'):
  b,nb=avg(t1,'2026-09-04','2026-09-17',k);a,na=avg(t1,'2026-09-18','2026-10-10',k)
  rb,_=avg(rest,'2026-09-04','2026-09-17',k);ra,_=avg(rest,'2026-09-18','2026-10-10',k)
  print(k,'test %.0f -> %.0f'%(b,a),'| rest %.0f -> %.0f'%(rb,ra),nb,na)
