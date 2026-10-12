import json,collections,statistics as st
D='/home/user/t1/analytics-mvp/data/'
TJ=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
offer=json.load(open(D+'sku_offer.json'))
t1=set(TJ['тесты'][0]['тест']);rest=set(offer.values())-t1
od=[json.loads(l) for l in open(D+'orders_daily.ndjson')]
def ordd(arts,a,b,n): return sum(o['units'] for o in od if o['offer'] in arts and a<=o['d']<=b and o['status']!='cancelled')/n
print('orders/day rest %.2f -> %.2f'%(ordd(rest,'2026-09-04','2026-09-17',14),ordd(rest,'2026-09-18','2026-10-10',23)))
gap=collections.defaultdict(dict)
for l in open(D+'gap_daily.ndjson'):
  x=json.loads(l)
  if x.get('gap_pct') is not None: gap[x['date']][x['art']]=x['gap_pct']
def gavg(arts,a,b):
  ds=[d for d in gap if a<=d<=b];vals=[st.median([gap[d][x] for x in arts if x in gap[d]]) for d in ds if any(x in gap[d] for x in arts)]
  return sum(vals)/len(vals),len(vals),sorted(ds)
for nm,ar in (('test',t1),('rest',rest)):
  b=gavg(ar,'2026-09-04','2026-09-17');a=gavg(ar,'2026-09-18','2026-10-10')
  print(nm,'gap median avg before %.1f (%d days %s) after %.1f (%d)'%(b[0],b[1],b[2],a[0],a[1]))
# step 2 campaigns
camp=collections.defaultdict(float);names={}
for l in open(D+'ads_daily.ndjson'):
  x=json.loads(l)
  if '2026-10-01'<=x['d']<='2026-10-10': camp[x['id']]+=x['sp'];names[x['id']]=x['off']
for cid,s in sorted(camp.items(),key=lambda z:-z[1])[:15]: print(cid,names[cid][:60],round(s/10*7))
