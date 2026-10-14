import json, collections, statistics, datetime, sys
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); o=rd('orders.ndjson')
B='Буст продаж, оплата за продажи'
Q=('2026-07','2026-08','2026-09')
p=[r for r in o if not r['service']]
# sign check on boost rows
bs=[r for r in n if r['service']==B]
print('boost rows',len(bs),'types',collections.Counter(r['type'] for r in bs))
print('sign by type',collections.Counter((r['type'], 'pos' if r['amount']>0 else 'neg' if r['amount']<0 else 'zero') for r in bs))
# 1) totals: boost posted in Q, money/points (signed, not abs)
mon=sum(-r['amount'] for r in bs if r['d'][:7] in Q and r['type']=='Удержание')
pts=sum(-r['amount'] for r in bs if r['d'][:7] in Q and r['type']=='Списание')
other=collections.Counter(r['type'] for r in bs if r['d'][:7] in Q and r['type'] not in ('Удержание','Списание'))
print('Q boost signed money',round(mon),'points',round(pts),'total',round(mon+pts),'other types',other)
rev_q=sum(r['revenue'] for r in p if r['created'][:7] in Q and r['status']=='DELIVERED')
print('delivered rev by order date Q',rev_q,'DRR',round((mon+pts)/rev_q*100,2))
# same-population DRR: boost for orders created in Q (any posting date) / delivered rev created in Q
oc={ (r['order'],r['sku']):r for r in p}
bord=collections.defaultdict(float)
for r in bs:
    if r['type'] in ('Удержание','Списание'): bord[(r['order'],r['sku'])]+= -r['amount']
same=sum(v for k,v in bord.items() if k in oc and oc[k]['created'][:7] in Q)
print('boost for orders created in Q (any posting date)',round(same),'DRR same-pop',round(same/rev_q*100,2))
# delivery-date population: delivered with statusDate in Q
rev_dd=sum(r['revenue'] for r in p if r['status']=='DELIVERED' and r['statusDate'][:7] in Q)
print('delivered rev by statusDate Q',rev_dd,'DRR (boost by posting)/(rev by delivery)',round((mon+pts)/rev_dd*100,2))
# boost posted in Q for orders created before Q
pre=sum(-r['amount'] for r in bs if r['d'][:7] in Q and r['type'] in ('Удержание','Списание') and (r['order'],r['sku']) in oc and oc[(r['order'],r['sku'])]['created'][:7]<'2026-07')
nomatch=sum(-r['amount'] for r in bs if r['d'][:7] in Q and r['type'] in ('Удержание','Списание') and (r['order'],r['sku']) not in oc)
print('boost posted in Q for orders created before July',round(pre),'boost rows in Q not matched to product order line',round(nomatch))
# per month by cabinet, both definitions
CAB={'1023124':'зеркала','74986385':'мебель'}
for m in Q:
  for c in CAB:
    b_post=sum(-r['amount'] for r in bs if r['d'][:7]==m and r['business']==c and r['type'] in ('Удержание','Списание'))
    r_ord=sum(r['revenue'] for r in p if r['created'][:7]==m and r['business']==c and r['status']=='DELIVERED')
    r_del=sum(r['revenue'] for r in p if r['statusDate'][:7]==m and r['business']==c and r['status']=='DELIVERED')
    b_same=sum(v for k,v in bord.items() if k in oc and oc[k]['created'][:7]==m and oc[k]['business']==c)
    inflight=sum(1 for r in p if r['created'][:7]==m and r['business']==c and r['status'] in ('DELIVERY','PROCESSING','PICKUP'))
    print(m,CAB[c],'boost_post',round(b_post),'rev_by_order',r_ord,'DRR',round(b_post/r_ord*100,1),'| rev_by_deliv',r_del,'DRR',round(b_post/r_del*100,1),'| same-pop boost',round(b_same),'DRR',round(b_same/r_ord*100,1),'| inflight',inflight)
