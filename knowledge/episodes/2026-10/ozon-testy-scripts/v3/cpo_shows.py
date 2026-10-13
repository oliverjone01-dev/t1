# Тезис Ивана 4: оплата за заказ - «кран показов»: выкл. 28.08 - показы нерекламируемых 67 тыс. -> 9-35 тыс.,
# заходы 6 тыс. -> 2-3, заказы 12 -> 7; 04.09 9% - 123 тыс., заказы 14-15; 5% - 77-47 тыс.; позиция 85 -> 60.
# Источники: sku_views (views, vsearch, pdp), ads_daily 28753239 (показы рекламы за заказ), orders_daily, funnel_sku_daily.
# Запуск: python3 -I cpo_shows.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,datetime as dt
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
SP=C.Counter()
for r in L('ads_sku_daily.ndjson'):
    if '2026-08-14'<=r['d']<='2026-09-14': SP[r['sku']]+=r['sp']
V=C.defaultdict(C.Counter); n=C.Counter()
for r in L('sku_views.ndjson'):
    if '2026-08-14'<=r['date']<='2026-09-20':
        g='na' if SP[str(r['sku'])]==0 else 'ad'
        for k in ('views','vsearch','pdp'): V[(r['date'],g)][k]+=r.get(k) or 0
        if g=='na' and (r.get('views') or 0)>0: n[r['date']]+=1
CPO={r['d']:r for r in L('ads_daily.ndjson') if r['id']=='28753239'}
O=C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled': O[o['d']]+=1
pos=C.defaultdict(list)
for f in L('funnel_sku_daily.ndjson'):
    if '2026-08-14'<=f['date']<='2026-09-20' and f['search_position'] and f['search_views']: pos[f['date']].append((f['search_position'],f['search_views']))
rate={'2026-08-27':'5','2026-08-28':'ВЫКЛ 09:39','2026-09-04':'ВКЛ 5 -> 9','2026-09-07':'9 -> 5'}
print('день   товаров | показы нерекл. всего / в поиске / заходы | показы рекл.за заказ | показы рекл.товаров | заказы магазина | позиция (медиана, взвеш.) | ставка')
for d in sorted({k[0] for k in V}):
    a=V[(d,'na')]; b=V[(d,'ad')]; c=CPO.get(d,{}); p=pos.get(d,[])
    wp=sum(x*w for x,w in p)/sum(w for x,w in p) if p else 0
    print('%s %4d | %6d %6d %5d | %6d | %6d | %3d | %5.0f %5.0f | %s'%(d[5:],n[d],a['views'],a['vsearch'],a['pdp'],c.get('vw',0),b['views'],O[d],S.median([x for x,w in p]) if p else 0,wp,rate.get(d,'')))
def avg(a,b,f):
    dd=[d for d in sorted({k[0] for k in V}) if a<=d[5:]<=b]; return sum(f(d) for d in dd)/len(dd)
for nm,f in (('показы нерекл. в поиске',lambda d:V[(d,'na')]['vsearch']),('заходы нерекл.',lambda d:V[(d,'na')]['pdp']),('заказы магазина',lambda d:O[d])):
    a=avg('08-20','08-27',f); b=avg('08-29','09-03',f); print('%s в день: 20-27.08 %.1f -> 29.08-03.09 %.1f (%+.0f%%)'%(nm,a,b,(b/a-1)*100))
import math as M
a=sum(O[d] for d in V and [] or []) if False else None
pre=[d for d in sorted({k[0] for k in V}) if '08-20'<=d[5:]<='08-27']; post=[d for d in sorted({k[0] for k in V}) if '08-29'<=d[5:]<='09-03']
n1=sum(O[d] for d in pre); n2=sum(O[d] for d in post); rr=(n2/len(post))/(n1/len(pre)); se=M.sqrt(1/n1+1/n2)
print('заказы: %d за %d дн. -> %d за %d дн., изменение %+.0f%%, 95%% ДИ (Пуассон) %+.0f..%+.0f%%'%(n1,len(pre),n2,len(post),(rr-1)*100,(M.exp(M.log(rr)-1.96*se)-1)*100,(M.exp(M.log(rr)+1.96*se)-1)*100))
# Поправка ФЕНИКСА iter3: по всем товарам (с рекламой и без) - показы в поиске.
A=C.Counter()
for r in L('sku_views.ndjson'):
    if '2026-08-20'<=r['date']<='2026-09-03': A[r['date']]+=r.get('vsearch') or 0
a=sum(A[d] for d in pre)/len(pre); b=sum(A[d] for d in post)/len(post)
print('все товары, показы в поиске в день: %.0f -> %.0f (%+.0f%%)'%(a,b,(b/a-1)*100))
