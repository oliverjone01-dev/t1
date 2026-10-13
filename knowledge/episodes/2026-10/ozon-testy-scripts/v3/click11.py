# Тезис Ивана 5: 11 рекламируемых товаров: 7-8.09 (кампании вкл., надбавки нет) 32-34 тыс. показов в день,
# 5-6.09 (кампании выкл., надбавка есть) 5-9 тыс.; 7-8.09 86 тыс. ₽ и один заказ.
# Товары - с расходом за клик 04.09 и 07.09 (как в pause0409.py). Запуск: python3 -I click11.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
SP=C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'): SP[r['sku']][r['d']]+=r['sp']
S11={s for s in SP if SP[s]['2026-09-04']>0 and SP[s]['2026-09-07']>0}
CAMP={}
for r in L('ads_daily.ndjson'):
    if r['id']!='28753239': CAMP.setdefault(r['d'],C.Counter()); CAMP[r['d']]['vw']+=r['vw']; CAMP[r['d']]['sp']+=r['sp']
V=C.defaultdict(C.Counter)
for r in L('sku_views.ndjson'):
    if str(r['sku']) in S11 and '2026-09-01'<=r['date']<='2026-09-12':
        for k in ('views','vsearch','pdp','cart'): V[r['date']][k]+=r.get(k) or 0
O=C.Counter(); OA=C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled':
        OA[o['d']]+=1
        if o['sku'] in S11: O[o['d']]+=1
print('товаров',len(S11))
print('день  | расход клик (11 тов.) | показы всего / в поиске / заходы / корзины (11 тов.) | заказы 11 тов. | заказы магазина')
for d in sorted(V): print(d[5:],'| %6d | %6d %6d %4d %3d | %d | %d'%(sum(SP[s][d] for s in S11),V[d]['views'],V[d]['vsearch'],V[d]['pdp'],V[d]['cart'],O[d],OA[d]))
