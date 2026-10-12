import json,collections
D='/home/user/t1/analytics-mvp/data/';A='GGM-17-2-1'
offer=json.load(open(D+'sku_offer.json'));sku=[k for k,v in offer.items() if v==A][0];print('sku',sku)
rows=collections.defaultdict(dict)
for l in open(D+'gap_daily.ndjson'):
  x=json.loads(l)
  if x['art']==A: rows[x['date']]['gap']=x['gap_pct']
for l in open(D+'prices_daily.ndjson'):
  x=json.loads(l)
  if x['offer']==A: rows[x['d']]['price']=x['price'];rows[x['d']]['before']=x['before'];rows[x['d']]['paid']=x.get('paid')
for l in open(D+'ads_sku_daily.ndjson'):
  x=json.loads(l)
  if x['sku']==sku: rows[x['d']]['cpc']=rows[x['d']].get('cpc',0)+x['sp'];rows[x['d']].setdefault('cid',set()).add(x['cid'])
for l in open(D+'acts_daily.ndjson'):
  x=json.loads(l)
  if x['art']==A: rows[x['date']].setdefault('acts',[]).append(f"{x['title'][:28]}={x['value']}")
for l in open(D+'orders_daily.ndjson'):
  o=json.loads(l)
  if o['offer']==A and o['status']!='cancelled': rows[o['d']]['ord']=rows[o['d']].get('ord',0)+o['units']
for l in open(D+'cpo_sku_daily.ndjson'):
  x=json.loads(l)
  if x.get('offer')==A: rows[x['d']]['cpo']=x['sp']
for d in sorted(rows):
  if d<'2026-09-01': continue
  r=rows[d];print(d[5:],'gap',r.get('gap'),'price',r.get('price'),'/',r.get('before'),'cpc',r.get('cpc'),sorted(r.get('cid',[])),'cpo',r.get('cpo'),'ord',r.get('ord'),'|',' ; '.join(r.get('acts',[])))
