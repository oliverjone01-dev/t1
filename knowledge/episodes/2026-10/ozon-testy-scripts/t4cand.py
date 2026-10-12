import json,collections
R='/home/user/t1/analytics-mvp/';D=R+'data/'
TJ=json.load(open(R+'tools/tests/tests.json'))
offer=json.load(open(D+'sku_offer.json'));o2s={v:k for k,v in offer.items()}
G=json.load(open(D+'card_groups.json'))['groups'];card={s['offer']:g['main'] for g in G for s in g['skus']}
busy=set()
for t in TJ['тесты']:
  busy|=set(t.get('тест',[]))|set(t.get('контроль',[]))
  for v in (t.get('роли') or {}).values(): busy|=set(v)
for t in TJ['тесты_ставок']:
  for p in t['пары']: busy|={p['большая']['артикул'],p['малая']['артикул']}
t4=set(TJ['тесты_цены'][0]['тест'])
busycards={card[a] for a in busy|t4 if a in card}
cpc=collections.defaultdict(float);cpc_any=set()
for l in open(D+'ads_sku_daily.ndjson'):
  r=json.loads(l)
  if r['d']>='2026-09-01' and r['sp']>0:
    a=offer.get(r['sku']); 
    if a: cpc[a]+=r['sp']
cpccards={card[a] for a in cpc if a in card and r}
acts=collections.defaultdict(lambda: collections.defaultdict(set))
last_act=''
for l in open(D+'acts_daily.ndjson'):
  x=json.loads(l);acts[x['art']][x['date']].add(x['title'][:30]);last_act=max(last_act,x['date'])
pr=collections.defaultdict(dict)
for l in open(D+'prices_daily.ndjson'):
  x=json.loads(l)
  if x['d']>='2026-09-23': pr[x['offer']][x['d']]=(x['price'],x['before'])
gapdays=collections.defaultdict(int);gd=set()
for l in open(D+'gap_daily.ndjson'):
  x=json.loads(l)
  if x['date']>='2026-09-23' and x.get('gap_pct') is not None: gapdays[x['art']]+=1;gd.add(x['date'])
od=collections.Counter()
for l in open(D+'orders_daily.ndjson'):
  o=json.loads(l)
  if o['status']!='cancelled' and o['d']>='2026-08-12': od[o['offer']]+=o['units']
out=[]
for a,ds in pr.items():
  if a in busy or a in t4 or a in cpc: continue
  if gapdays[a]<len(gd)-1: continue
  prices={v[0] for v in ds.values()}
  if len(prices)!=1: continue  # предельная не менялась с 23.09
  p,b=ds[max(ds)]
  if not p or not b or p>=b: continue  # в акции со скидкой к базовой
  t=acts[a].get(last_act,set())
  if not any('Эластичный' in x for x in t): continue
  if any('Максимальный' in x or 'Усилени' in x for d in acts[a] for x in acts[a][d] if d>='2026-09-23'): continue
  if od[a]<1: continue
  c=card.get(a,'-')
  out.append((od[a],a,c,p,c in busycards, c in cpccards))
out.sort(reverse=True)
print('всего',len(out),'; без карточек тестов',sum(1 for x in out if not x[4]),'; и без CPC в карточке',sum(1 for x in out if not x[4] and not x[5]))
for x in out[:40]: print(x)
