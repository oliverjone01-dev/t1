import json,collections
D='/home/user/t1/analytics-mvp/data/'
offer=json.load(open(D+'sku_offer.json'));o2s={v:k for k,v in offer.items()}
cogs=json.load(open(D+'sku_cogs.json'))
orders=[json.loads(l) for l in open(D+'orders_daily.ndjson') ]
orders=[o for o in orders if o['status']!='cancelled']
canc=collections.Counter()
ads=[json.loads(l) for l in open(D+'ads_sku_daily.ndjson')]
def contrib(arts):
  # per-unit contribution share: payout 0.494 - cogs - logistics 0.093
  xs=[]
  for a in arts:
    s=o2s.get(a); c=cogs.get(s)
    pr=[o['revenue']/o['units'] for o in orders if o['offer']==a]
    if c and pr: xs.append((a,round(pr[-1]),c,round(c/pr[-1],3)))
  return xs
def card(prefix,a,b):
  arts=[x for x in offer.values() if x.startswith(prefix)]
  s={o2s[x] for x in arts}
  days=(int(b[-2:])-int(a[-2:]))%31+1 if a[5:7]==b[5:7] else None
  u=sum(o['units'] for o in orders if o['offer'] in arts and a<=o['d']<=b)
  rv=sum(o['revenue'] for o in orders if o['offer'] in arts and a<=o['d']<=b)
  sp=sum(r['sp'] for r in ads if r['sku'] in s and a<=r['d']<=b)
  return arts,u,rv,sp
import datetime as dt
def n(a,b): return (dt.date.fromisoformat(b)-dt.date.fromisoformat(a)).days+1
for pref,w in [('GGT-35-',[('2026-08-01','2026-09-06'),('2026-09-07','2026-09-21'),('2026-09-22','2026-10-11')]),
               ('GGM-18-',[('2026-08-01','2026-09-12'),('2026-09-13','2026-09-30'),('2026-10-01','2026-10-11')]),
               ('GGM-20-',[('2026-08-01','2026-09-17'),('2026-09-18','2026-09-27'),('2026-10-01','2026-10-11')])]:
  print('==',pref)
  for a,b in w:
    arts,u,rv,sp=card(pref,a,b);d=n(a,b)
    print('  %s..%s %2dd units/wk %.1f rev/wk %.0f spend/wk %.0f'%(a,b,d,u/d*7,rv/d*7,sp/d*7))
  print('  ',contrib(arts)[:8])
