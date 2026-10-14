import json, collections, statistics, datetime
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); o=rd('orders.ndjson'); sv=rd('sku_views.ndjson'); tax=json.load(open(D+'sku_taxonomy.json'))
B='Буст продаж, оплата за продажи'; Q=('2026-07','2026-08','2026-09')
p=[r for r in o if not r['service']]; oc={(r['order'],r['sku']):r for r in p}
canc=lambda r: r['status'].startswith('CANCELLED')
W=[r for r in p if r['created'][:7] in Q]
cancel_orders={r['order'] for r in W if canc(r)}
# --- penalties on cancelled orders (netting services), Q-created cancelled orders, any posting date
svc=collections.defaultdict(float)
for r in n:
    if r['order'] in cancel_orders and r['amount']<0:
        svc[(r['service'],r['type'])]+=-r['amount']
for k,v in sorted(svc.items(), key=lambda x:-x[1])[:15]: print(' cancelled-orders charge',k,round(v))
names=[s for s in {r['service'] for r in n} if any(w in s.lower() for w in ('миля','невыкуп','вине продавца','не вовремя'))]
print('service names matching:',names)
for s in names:
    tot=sum(-r['amount'] for r in n if r['service']==s and r['amount']<0 and r['order'] in cancel_orders)
    totq=sum(-r['amount'] for r in n if r['service']==s and r['amount']<0 and r['d'][:7] in Q)
    print('  ',s,'on Q-cancelled orders',round(tot),'| all posted in Q',round(totq))
# --- Sept furniture boost rows: count and same-day money+points
rows=[r for r in n if r['service']==B and r['type'] in ('Удержание','Списание') and r['d'][:7]=='2026-09' and r['business']=='74986385']
byorder=collections.defaultdict(set)
for r in rows: byorder[(r['order'],r['sku'],r['d'])].add(r['type'])
print('Sep mebel boost rows',len(rows),'distinct order-sku-day',len(byorder),'with both money+points',sum(1 for v in byorder.values() if len(v)==2),'money only',sum(1 for v in byorder.values() if v=={'Удержание'}),'points only',sum(1 for v in byorder.values() if v=={'Списание'}))
days=collections.defaultdict(lambda:[0.0,0.0])
for r in rows: days[r['d']][0 if r['type']=='Удержание' else 1]+=-r['amount']
top=sorted(days.items(), key=lambda x:-x[1][0])[:6]
print('top money days',[(d[8:],round(v[0]),round(v[1])) for d,v in top])
print('days with money and points both gt 5000:',sum(1 for v in days.values() if v[0]>5000 and v[1]>5000),'of',len(days))
# per-order split: is money only the remainder after points within an order?
both=[k for k,v in byorder.items() if len(v)==2]
print('orders-days with both types:',len(both))
# --- weekly orders mirrors
wk=collections.Counter()
for r in p:
    if r['business']=='1023124' and r['created']>='2026-06-29':
        d=datetime.date.fromisoformat(r['created']); wk[(d-datetime.timedelta(days=d.weekday())).isoformat()]+=1
print('mirrors orders per week',sorted(wk.items()))
# --- OSOLIS daily views
osk={s for s,v in tax.items() if (v or {}).get('line')=='OSOLIS'}
dv=collections.Counter();
for r in sv:
    if not r.get('aggregate') and r['sku'] in osk: dv[r['date']]+=r['views']
ds=sorted(dv.items())
print('OSOLIS skus',sorted(osk))
print('OSOLIS daily views first 7',ds[:7],'last 7',ds[-7:])
print('aggregate rows',sum(1 for r in sv if r.get('aggregate')),'daily rows',sum(1 for r in sv if not r.get('aggregate')),'date range',min(r['date'] for r in sv if not r.get('aggregate')),max(r['date'] for r in sv if not r.get('aggregate')))
