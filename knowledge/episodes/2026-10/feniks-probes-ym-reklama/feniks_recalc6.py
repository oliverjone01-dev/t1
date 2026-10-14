import json, collections, statistics
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); b=rd('bonuses_monthly.ndjson')
B='Буст продаж, оплата за продажи'
rows=[r for r in n if r['service']==B and r['type'] in ('Удержание','Списание') and r['d'][:7]=='2026-09' and r['business']=='74986385']
print('row keys',sorted(rows[0].keys()))
per=collections.defaultdict(list)
for r in rows: per[(r['order'],r['sku'],r['d'])].append((r['type'],r['amount'],r.get('src'),r.get('tx')))
ex=[(k,v) for k,v in per.items() if len({t for t,_,_,_ in v})==2][:6]
for k,v in ex: print(k,v)
# money vs points per order-day
sh=[]
for k,v in per.items():
    m=sum(-a for t,a,_,_ in v if t=='Удержание'); pt=sum(-a for t,a,_,_ in v if t=='Списание')
    if m>0 and pt>0: sh.append(m/(m+pt))
print('n both',len(sh),'money share quartiles',[round(x,3) for x in statistics.quantiles(sh,n=4)],'min',round(min(sh),3),'max',round(max(sh),3))
# bonuses: shows/shelf points for мебель Sept, any campaign field?
bs=[r for r in b if r['ym']=='2026-09' and r['business']=='74986385' and r['type']=='Списание' and r['service'] in ('Полки','Буст продаж, оплата за показы')]
print('bonus shows/shelf rows',len(bs),'keys',sorted(bs[0].keys()) if bs else None)
print('sum by service',{s:round(sum(-r['amount'] if r['amount']<0 else r['amount'] for r in bs if r['service']==s)) for s in {r['service'] for r in bs}})
print('samples',[ (r['d'],r['service'],r['amount'],r.get('order'),r.get('src')) for r in bs[:5]])
print('bonus services Sept furniture',collections.Counter(r['service'] for r in b if r['ym']=='2026-09' and r['business']=='74986385' and r['type']=='Списание').most_common(12))
