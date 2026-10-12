import json,collections,statistics as st
D='/home/user/t1/analytics-mvp/data/';R='/home/user/t1/analytics-mvp/'
offer=json.load(open(D+'sku_offer.json'))
NEW={'44989034','44988191','44988572','44920406','44989441','44990352'};STOP={'37239106','37007560','43315519'}
cs=collections.defaultdict(set);last=''
for l in open(D+'ads_sku_daily.ndjson'):
  x=json.loads(l);last=max(last,x['d'])
  if x['cid'] in NEW|STOP and x['sp']>0: cs[x['cid']].add(offer.get(x['sku'],x['sku']))
print('ads_sku_daily last',last)
for c in sorted(cs): print(c,'NEW' if c in NEW else 'STOP',sorted(cs[c]))
newsku=set().union(*[cs[c] for c in NEW if c in cs]);stopsku=set().union(*[cs[c] for c in STOP if c in cs])
# tests membership
TJ=json.load(open(R+'tools/tests/tests.json'))
G=json.load(open(D+'card_groups.json'))['groups'];card={s['offer']:g['main'] for g in G for s in g['skus']}
mem={}
for i,t in enumerate(TJ['тесты']):
  for k in ('тест','контроль'): 
    for a in t.get(k,[]): mem.setdefault(a,[]).append(f"т{i+1}.{k}")
  for k,v in (t.get('роли') or {}).items():
    for a in v: mem.setdefault(a,[]).append(f"т{i+1}.{k}")
for t in TJ['тесты_ставок']:
  for p in t['пары']: 
    for side in('большая','малая'): mem.setdefault(p[side]['артикул'],[]).append('т3.'+side)
for a in TJ['тесты_цены'][0]['тест']: mem.setdefault(a,[]).append('т4')
tcards=collections.defaultdict(list)
for a,m in mem.items():
  if a in card: tcards[card[a]].append(f"{a}:{'/'.join(m)}")
for a in sorted(newsku|stopsku):
  print(('NEW ' if a in newsku else 'STOP'),a.ljust(22),'в тестах:',mem.get(a,'-'),'| карточка',card.get(a,'-'),'тестовые в карточке:',len(tcards.get(card.get(a),[])))
# gap per sku 01..11
gap=collections.defaultdict(dict)
for l in open(D+'gap_daily.ndjson'):
  x=json.loads(l)
  if x['date']>='2026-10-01' and x.get('gap_pct') is not None: gap[x['date']][x['art']]=x['gap_pct']
ds=sorted(gap);med={d:st.median(gap[d].values()) for d in ds}
print('store median',{d[5:]:round(med[d],1) for d in ds})
for a in sorted(newsku|stopsku):
  print(('NEW ' if a in newsku else 'STOP'),a.ljust(22),' '.join(f"{d[8:]}:{gap[d].get(a,float('nan'))-med[d]:+.1f}" for d in ds))
json.dump({'new':sorted(newsku),'stop':sorted(stopsku)},open('/tmp/ch0810.json','w'))
