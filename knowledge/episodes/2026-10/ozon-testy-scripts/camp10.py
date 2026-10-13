import json,collections
D='/home/user/t1/analytics-mvp/data/'
rows=[json.loads(l) for l in open(D+'ads_daily.ndjson')]
rows=[r for r in rows if '2026-10-01'<=r['d']<='2026-10-10' and 'заказ' not in r['off'].lower()]
by=collections.defaultdict(lambda: collections.defaultdict(lambda:[0,0]))
first={};name={}
for r in rows:
  by[r['id']][r['d']][0]+=r['sp'];by[r['id']][r['d']][1]+=r['cl'];name[r['id']]=r['off']
allr=[json.loads(l) for l in open(D+'ads_daily.ndjson')]
for r in allr:
  if r['sp']>0: first[r['id']]=min(first.get(r['id'],'9'),r['d'])
wk=lambda a,b: sum(v[0] for c in by.values() for d,v in c.items() if a<=d<=b)
print('CPC/day 01-07: %.0f  08: %.0f  09-10: %.0f'%(wk('2026-10-01','2026-10-07')/7,wk('2026-10-08','2026-10-08'),wk('2026-10-09','2026-10-10')/2))
for cid in sorted(by,key=lambda c:-sum(v[0] for d,v in by[c].items() if d>='2026-10-09')):
  e=sum(v[0] for d,v in by[cid].items() if d<='2026-10-07')/7; l=sum(v[0] for d,v in by[cid].items() if d>='2026-10-09')/2
  cl=sum(v[1] for d,v in by[cid].items() if d>='2026-10-09'); last=max([d for d,v in by[cid].items() if v[0]>0] or ['-'])
  if max(e,l)<500: continue
  print(cid,name[cid][:34].ljust(34),'first',first.get(cid),'last',last,'per day 01-07 %.0f  09-10 %.0f  cpc09-10 %s'%(e,l,round(l*2/cl,1) if cl else '-'))
