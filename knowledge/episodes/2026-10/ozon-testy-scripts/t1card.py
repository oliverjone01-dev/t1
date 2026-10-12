import json
D='/home/user/t1/analytics-mvp/data/'
T=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))['тесты'][0]['тест']
G=json.load(open(D+'card_groups.json'))['groups']
card={s['offer']:g['main'] for g in G for s in g['skus']}
members={}
for g in G: members[g['main']]=[s['offer'] for s in g['skus']]
od=[json.loads(l) for l in open(D+'orders_daily.ndjson')]
od=[o for o in od if o['status']!='cancelled']
last=max(o['d'] for o in od);print('last order day',last)
B=('2026-09-04','2026-09-17',14);A=('2026-09-18','2026-10-10',23)
def u(arts,w): return sum(o['units'] for o in od if o['offer'] in arts and w[0]<=o['d']<=w[1])
# units from test units: test arts own card; non-card tests standalone
units={}
for a in T:
  c=card.get(a); arts=set(members[c]) if c else {a}
  units.setdefault(c or a,arts)
testcards_all=set().union(*units.values())
allo=set(o['offer'] for o in od)
ctrl=allo-testcards_all
cb=u(ctrl,B)/14;ca=u(ctrl,A)/23;k=ca/cb;print('wide ctrl (excl test cards) per day %.2f -> %.2f  x%.3f'%(cb,ca,k))
tot=0;rows=[]
for c,arts in units.items():
  tb=[x for x in arts if x in T]
  b=u(arts,B)/14;a=u(arts,A)/23;inc=(a-b*k)*23
  rows.append((c,len(arts),tb,u(arts,B),u(arts,A),round(inc,1)));tot+=inc
for r in rows: print(r)
print('card-level incremental units 23d %.1f'%tot)
for ex in ['6279981715']:
  print('without',ex, round(tot-[r[5] for r in rows if r[0]==ex][0],1))
# test-SKU only, for sensitivity
tb=u(set(T),B)/14;ta=u(set(T),A)/23
print('test SKUs only: %.2f -> %.2f/day inc %.1f'%(tb,ta,(ta-tb*k)*23), 'GGL-09-2 after',u({'GGL-09-2'},A))
offer=json.load(open(D+'sku_offer.json'));o2s={v:k for k,v in offer.items()}
ads=[json.loads(l) for l in open(D+'ads_sku_daily.ndjson')]
sp=sum(r['sp'] for r in ads if r['sku'] in {o2s.get(a) for a in T} and A[0]<=r['d']<=A[1]);print('spend to 10.10',sp)
kon=set(members['6279981715'])
for name,arts in [('all',set(T)),('noKONUX',set(T)-kon),('noKONUX_noGGL',set(T)-kon-{'GGL-09-2'})]:
  x=[o for o in od if o['offer'] in arts and A[0]<=o['d']<=A[1]]
  un=sum(o['units'] for o in x);rv=sum(o['revenue'] for o in x)
  b=u(arts,B)/14;inc=un-b*k*23
  opn=sum(o['units'] for o in x if o['status']!='delivered')
  inc_adj=inc-0.16*opn
  print(name,'units',un,'open',opn,'inc %.1f adj %.1f avg %.0f'%(inc,inc_adj,rv/un))
