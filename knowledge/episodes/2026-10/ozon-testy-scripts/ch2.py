import json,collections
D='/home/user/t1/analytics-mvp/data/'
offer=json.load(open(D+'sku_offer.json'));C=json.load(open('/tmp/ch0810.json'))
cheap={'GGT-03-1-3-E-16080','GGT-03-1-5-E-16080','GGT-03-1-5-O-20090','GGT-03-2-1-E-16080','GGT-03-2-1-O-20090','GGT-03-2-2-E-16080','GGT-03-2-2-O-20090','GGT-03-2-4-E-16080','GGT-03-2-4-O-20090','GGT-03-3-1-E-16080','GGT-03-3-1-O-20090','GGT-03-3-5-O-20090','GGT-03-5-1-O-20090','GGT-03-3-3-E-16080'}
exp={'GGT-03-3-3-O-18090','GGT-03-3-5-E-16080','GGT-48-5-1-100-180','GGT-47-3-5-90'}
stop={'GGT-03-3-5-O-18090','GGT-47-3-3-80'}
V=collections.defaultdict(lambda: collections.Counter())
for l in open(D+'sku_views.ndjson'):
  r=json.loads(l);a=offer.get(str(r['sku']))
  if a and r['date']>='2026-09-24': V[r['date']][a+'|v']+=r.get('vsearch') or 0
od=collections.Counter()
for l in open(D+'orders_daily.ndjson'):
  o=json.loads(l)
  if o['status']!='cancelled' and o['d']>='2026-09-24': od[(o['d'],o['offer'])]+=o['units']
sp=collections.Counter()
for l in open(D+'ads_sku_daily.ndjson'):
  x=json.loads(l);a=offer.get(x['sku'])
  if a and x['d']>='2026-09-24': sp[(x['d'],a)]+=x['sp']
def agg(arts,a,b):
  ds=[d for d in V if a<=d<=b];n=len(ds)
  return (sum(V[d][x+'|v'] for d in ds for x in arts)/n, sum(od[(d,x)] for d in ds for x in arts), sum(sp[(d,x)] for d in ds for x in arts)/n, n)
for nm,g in (('дешёвые ~12₽',cheap),('дорогие 33-52₽',exp),('остановленные',stop)):
  b=agg(g,'2026-09-24','2026-10-07');a=agg(g,'2026-10-09','2026-10-10')
  print(nm,len(g),'показы/день %.0f -> %.0f'%(b[0],a[0]),'заказы шт %d за %dд -> %d за %dд'%(b[1],b[3],a[1],a[3]),'расход/день %.0f -> %.0f'%(b[2],a[2]))
