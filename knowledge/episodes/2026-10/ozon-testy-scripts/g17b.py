import json,collections,statistics as st
D='/home/user/t1/analytics-mvp/data/'
offer=json.load(open(D+'sku_offer.json'))
gap=collections.defaultdict(dict)
for l in open(D+'gap_daily.ndjson'):
  x=json.loads(l)
  if x.get('gap_pct') is not None: gap[x['art']][x['date']]=x['gap_pct']
acts=collections.defaultdict(lambda: collections.defaultdict(set))
for l in open(D+'acts_daily.ndjson'):
  x=json.loads(l);acts[x['art']][x['date']].add(x['title'][:22])
cpcfirst={}
for l in open(D+'ads_sku_daily.ndjson'):
  x=json.loads(l);a=offer.get(x['sku'])
  if a and x['sp']>0 and x['d']>='2026-09-01': cpcfirst[a]=min(cpcfirst.get(a,'9'),x['d'])
cpcany=set(cpcfirst)
def inst(a,d): return any('Рассрочка' in t or 'АБ тест' in t for t in acts[a].get(d,()))
med=lambda d: st.median([g[d] for g in gap.values() if d in g])
print('store median 23.09 %.1f 24.09 %.1f 25.09 %.1f'%(med('2026-09-23'),med('2026-09-24'),med('2026-09-25')))
G=json.load(open(D+'card_groups.json'))['groups'];card={s['offer']:g['main'] for g in G for s in g['skus']}
c=card['GGM-17-2-1'];sib=[s['offer'] for g in G if g['main']==c for s in g['skus']]
print('card',c,len(sib))
for a in sib:
  print(' ',a.ljust(14),'cpc from',cpcfirst.get(a,'-'),'inst 23/24/25',[inst(a,d) for d in('2026-09-23','2026-09-24','2026-09-25')],
    'gap 21/23/24/25:',[gap[a].get(d) for d in('2026-09-21','2026-09-23','2026-09-24','2026-09-25')])
# groups: new installment on 24.09 (not on 23.09)
def jump(a): 
  g=gap[a]; return g['2026-09-24']-g['2026-09-23'] if '2026-09-23' in g and '2026-09-24' in g else None
grp=collections.defaultdict(list)
for a in gap:
  j=jump(a)
  if j is None: continue
  newinst = inst(a,'2026-09-24') and not inst(a,'2026-09-23')
  hadinst = inst(a,'2026-09-23')
  ads = a in cpcany and cpcfirst[a]<='2026-09-23'
  grp[(('рассрочка новая 24.09' if newinst else 'рассрочка была' if hadinst else 'без рассрочки'),('реклама' if ads else 'без рекламы'))].append(j)
for k,v in sorted(grp.items()): print(k,'n',len(v),'median jump %.1f'%st.median(v),'share >5п %.0f%%'%(100*sum(x>5 for x in v)/len(v)))
