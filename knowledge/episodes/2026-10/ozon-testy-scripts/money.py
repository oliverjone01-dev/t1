import json,collections,statistics as st
D='/home/user/t1/analytics-mvp/data/'
T=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))['тесты']
offer=json.load(open(D+'sku_offer.json'));o2s={v:k for k,v in offer.items()}
cogs=json.load(open(D+'sku_cogs.json'))
orders=[json.loads(l) for l in open(D+'orders_daily.ndjson')]
st_cnt=collections.Counter(o['status'] for o in orders);print(st_cnt.most_common())
# delivered orders economics: payout/revenue
dl=[o for o in orders if o['status']=='delivered' and o['revenue']>0 and o['d']>='2026-08-01']
r=sum(o['revenue'] for o in dl);p=sum(o['payout'] for o in dl);pd=sum(o['paid'] or 0 for o in dl)
print('delivered since 08-01 n',len(dl),'payout/revenue',round(p/r,3),'paid/revenue',round(pd/r,3))
for k in ['commission','delivery','acquiring','buyer_delivery','ads','partner','other','storage']:
  print(' ',k,round(sum(o[k] for o in dl)/r,3))
cg=[cogs.get(o['sku'])/ (o['revenue']/o['units']) for o in dl if cogs.get(o['sku'])]
print('cogs/revenue median',round(st.median(cg),3),'n',len(cg),'mean',round(sum(cg)/len(cg),3))
ok=lambda o:o['status'] not in('cancelled',)
def grp(arts,a,b):
  s=set(arts);x=[o for o in orders if o['offer'] in s and a<=o['d']<=b and ok(o)]
  return sum(o['units'] for o in x), sum(o['revenue'] for o in x)
ads=[json.loads(l) for l in open(D+'ads_sku_daily.ndjson')]
def spend(arts,a,b):
  s={o2s.get(x) for x in arts};return sum(r['sp'] for r in ads if r['sku'] in s and a<=r['d']<=b)
allart=set(offer.values())
for t in T:
  print('==',t['id'],t['старт'])
  print('  keys',[k for k in t if k not in('гипотеза','правило','заметка','промежуточный_вывод','наблюдение')])
json.dump({},open('/dev/null','w'))
dv={}
for l in open(D+'delivery_orders.ndjson'):
  x=json.loads(l);dv[x['order']]=(x.get('ship') or 0)+(x.get('deliv') or 0)
m=[(dv[o['order']],o['revenue']) for o in dl if o['order'] in dv]
print('logistics/revenue',round(sum(a for a,b in m)/sum(b for a,b in m),3),'n',len(m),'per order',round(sum(a for a,b in m)/len(m)))
def win(arts,a,b,days):
  u,rv=grp(arts,a,b);return u/days,rv/days
t1=T[0];te=t1['тест']
ctrl=allart-set(te)-set(t1['контроль'])  # wide control
for name,arts in [('test',te),('pairctrl',t1['контроль']),('wide',ctrl)]:
  b=win(arts,'2026-09-04','2026-09-17',14);a=win(arts,'2026-09-18','2026-10-11',24)
  print(name,len(arts),'units/day before %.2f after %.2f'%(b[0],a[0]),'rev/day before %.0f after %.0f'%(b[1],a[1]))
print('test spend 18.09-11.10',spend(te,'2026-09-18','2026-10-11'),'before',spend(te,'2026-09-04','2026-09-17'))
for t in T[2:]:
  print('==',t['id'],json.dumps({k:v for k,v in t.items() if k not in('гипотеза','правило','заметка')},ensure_ascii=False)[:1500])
