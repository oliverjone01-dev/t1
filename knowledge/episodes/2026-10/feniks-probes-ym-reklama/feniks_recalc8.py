import json, collections
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
o=rd('orders.ndjson'); b=rd('bonuses_monthly.ndjson'); sv=rd('sku_views.ndjson')
p=[r for r in o if not r['service']]
print('vsearch nonzero rows',sum(1 for r in sv if r.get('vsearch')),'of',len(sv))
g=[r for r in p if r['sku']=='GGL-09-2' and r['created'][:7]=='2026-10']
print('OSOLIS Oct',collections.Counter((r['status'],(__import__('datetime').date.fromisoformat(r['statusDate'])-__import__('datetime').date.fromisoformat(r['created'])).days) for r in g))
Q=('2026-07','2026-08','2026-09')
msk={'Москва','Балашиха','Химки','Мытищи','Подольск','Одинцово','Красногорск','Люберцы'}
import datetime
late=[r for r in p if r['created'][:7] in Q and r['status']=='CANCELLED_IN_DELIVERY' and (datetime.date.fromisoformat(r['statusDate'])-datetime.date.fromisoformat(r['created'])).days>=14]
print('IN_DELIVERY 14+ days:',len(late),'in MSK set',sum(r['region'] in msk for r in late),'by cabinet',collections.Counter(r['business'] for r in late))
# points accrued Sept furniture vs p_mp of delivered in Sept
acc=sum(r['amount'] for r in b if r['ym']=='2026-09' and r['business']=='74986385' and r['type']=='Начисление')
pmp=sum(r['p_mp']*r['count'] for r in p if r['business']=='74986385' and r['status']=='DELIVERED' and r['statusDate'][:7]=='2026-09')
print('Sept furniture points accrued',round(acc),'sum p_mp delivered in Sept (by statusDate)',round(pmp))
# delivered revenue by statusDate vs promo revAll
promo=rd('promo_monthly.ndjson')
for r in promo:
    if r['kind']=='boost' and r['ym'] in Q:
        ours=sum(x['revenue'] for x in p if x['business']==r['business'] and x['status']=='DELIVERED' and x['statusDate'][:7]==r['ym'])
        print('revAll vs ours by delivery date',r['ym'],r['business'],r['revAll'],ours,round((ours-r['revAll'])/r['revAll']*100,1))
