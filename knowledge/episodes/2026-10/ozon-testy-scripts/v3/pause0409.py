# Пауза 05-06.09: цены на сайте по дням у товаров с рекламой за клик, расход кампаний, индекс магазина.
# Запуск: python3 -I pause0409.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,math,datetime as dt
exec(open(__file__.replace('pause0409.py','click_starts.py')).read().split("ev=[]")[0])
dd=[f'2026-09-{i:02d}' for i in range(1,13)]
idx=1; I={}
for d in dd: idx*=math.exp(store.get(d,0)); I[d]=idx
print('индекс магазина (без рекламы за клик):',' '.join('%s %.3f'%(d[8:],I[d]/I['2026-09-04']) for d in dd))
arts=[s for s in SP if s in H and SP[s]['2026-09-04']>0 and SP[s]['2026-09-07']>0]
print('товаров с расходом 04.09 и 07.09:',len(arts))
print('расход по дням (сумма):',' '.join('%s %d'%(d[8:],sum(SP[s][d] for s in arts)) for d in dd))
for s in arts:
    b=H[s].get('2026-09-04')
    print('%-20s'%s2a.get(s,s),' '.join('%s:%s'%(d[8:], ('%+.0f%%'%((H[s][d]/b/(I[d]/I['2026-09-04'])-1)*100) if d in H[s] else '-')) for d in dd),' цена 04.09 %d'%b)
R=[json.loads(l) for l in open(D+'ads_daily.ndjson')]
print('кампании за клик: расход 03-08.09')
cs=C.defaultdict(dict)
for r in R:
    if '2026-09-03'<=r['d']<='2026-09-09' and r['id']!='28753239': cs[(r['id'],r['off'])][r['d'][8:]]=(r['sp'],r['vw'])
for k,v in sorted(cs.items()):
    if any(x[0]>0 for x in v.values()): print(' ',k,v)
