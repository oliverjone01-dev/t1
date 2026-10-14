import json, collections
D='/home/user/t1/analytics-mvp/data-ym/'
o=[json.loads(l) for l in open(D+'orders.ndjson')]
tax=json.load(open(D+'sku_taxonomy.json'))
Q=('2026-07','2026-08','2026-09')
p=[r for r in o if not r['service'] and r['created'][:7] in Q]
tr=[r for r in p if 'TRUBIS' in r['name'].upper() or r['sku'].startswith('GGT-03-')]
tr_tax=[r for r in p if (tax.get(r['sku']) or {}).get('line')=='TRUBIS']
days=92
print('TRUBIS by name/prefix: orders',len(tr),'delivered',sum(r['status']=='DELIVERED' for r in tr),'distinct SKUs',len({r['sku'] for r in tr}),'per 14 days',round(len(tr)/days*14,1),'delivered per 14d',round(sum(r['status']=='DELIVERED' for r in tr)/days*14,1))
print('TRUBIS by taxonomy: orders',len(tr_tax))
c=collections.Counter(r['sku'] for r in tr)
top=c.most_common(20)
print('top-20 TRUBIS SKUs orders in Q',top)
print('SKUs with ge 5 orders in Q',sum(1 for v in c.values() if v>=5),'top-20 total',sum(v for _,v in top),'per SKU per 14d (top20 avg)',round(sum(v for _,v in top)/20/days*14,2))
mp=[r for r in p if r['business']=='74986385']
print('furniture taxonomy coverage: share of orders with line prochee',round(sum(1 for r in mp if (tax.get(r['sku']) or {}).get('line') in (None,'','прочее'))/len(mp)*100,1))
