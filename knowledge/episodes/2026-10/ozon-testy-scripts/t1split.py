import json
D='/home/user/t1/analytics-mvp/data/'
T=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))['тесты'][0]['тест']
offer=json.load(open(D+'sku_offer.json'));o2s={v:k for k,v in offer.items()}
orders=[json.loads(l) for l in open(D+'orders_daily.ndjson')]
ads=[json.loads(l) for l in open(D+'ads_sku_daily.ndjson')]
st={}
for o in orders:
  if o['offer'] in T and '2026-09-04'<=o['d']<='2026-10-11':
    k=(o['offer'],'b' if o['d']<'2026-09-18' else 'a', o['status'] if o['status'] in('cancelled','delivered') else 'open')
    st[k]=st.get(k,0)+o['units']
for a in T:
  sp=sum(r['sp'] for r in ads if r['sku']==o2s.get(a) and '2026-09-18'<=r['d']<='2026-10-11')
  row={k[1]+'_'+k[2]:v for k,v in st.items() if k[0]==a}
  print(a.ljust(22),row,'spend',sp)
