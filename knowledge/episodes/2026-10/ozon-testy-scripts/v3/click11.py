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
# Поправка ФЕНИКСА 13.10: вместо p-значения по выбранному окну - все товаро-дни 01-12.09.
# Надбавка есть = соинвест товара выше медианы товаров без рекламы за клик в тот же день больше чем на 5 п.
import statistics as St
CO=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('coinv_listed_pct') is not None and '2026-09-01'<=r['date']<='2026-09-12': CO[r['date']][r['sku']]=r['coinv_listed_pct']
noad={s for s in CO['2026-09-01'] if sum(SP[s][d] for d in SP[s] if '2026-08-25'<=d<='2026-09-12')==0}
V2=C.defaultdict(dict)
for r in L('sku_views.ndjson'):
    if str(r['sku']) in S11 and '2026-09-01'<=r['date']<='2026-09-12': V2[str(r['sku'])][r['date']]=r
O2=C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled' and o['sku'] in S11: O2[(o['sku'],o['d'])]+=1
g=C.defaultdict(lambda:[0,0,0,0])
for d in CO:
    med=St.median(v for s,v in CO[d].items() if s in noad)
    for s in S11:
        if s in CO[d] and d in V2[s]:
            k=('надбавка есть' if CO[d][s]-med>5 else 'надбавки нет')+(', клик идёт' if SP[s][d]>0 else ', клик стоит')
            x=g[k]; x[0]+=1; x[1]+=V2[s][d].get('pdp') or 0; x[2]+=O2[(s,d)]; x[3]+=V2[s][d].get('vsearch') or 0
print('товаро-дни 01-12.09 (11 товаров): группа | товаро-дней | заходы | заказы | заказов на 1 000 заходов | заходов на 100 показов в поиске')
for k,(n,p,o,v) in sorted(g.items()): print('  %-28s %3d %5d %3d %5.1f %5.1f'%(k,n,p,o,1000*o/p if p else 0,100*p/v if v else 0))
tot=lambda f:[sum(x[i] for kk,x in g.items() if f(kk)) for i in range(4)]
for nm,f in (('надбавка есть',lambda k:k.startswith('надбавка есть')),('надбавки нет',lambda k:k.startswith('надбавки нет'))):
    n,p,o,v=tot(f); print('  итого %-14s товаро-дней %d, заходов %d, заказов %d, на 1 000 заходов %.1f, заходов на 100 показов %.1f'%(nm,n,p,o,1000*o/p,100*p/v))
print('показы в поиске на 1 ₽ расхода за клик (11 товаров):',' '.join('%s %.2f'%(d[5:],V[d]['vsearch']/sum(SP[s][d] for s in S11)) for d in sorted(V) if sum(SP[s][d] for s in S11)>5000))
