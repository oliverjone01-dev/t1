# Вопрос Ивана 13.10: на сколько снизить нашу цену, чтобы покупатель увидел цену ниже на 5%.
# Перенос изменения нашей предельной (prices_daily.price, с 23.09) в цену на витрине (site_to_seller * предельная, gap_daily),
# за вычетом общего сдвига витрины магазина в тот день. Запуск: python3 -I passthrough.py
import os,json,collections as C,statistics as S,math
ROOT=os.path.abspath(__file__).split('knowledge/')[0]; D=ROOT+'analytics-mvp/data/'
P=C.defaultdict(dict); G=C.defaultdict(dict)
for l in open(D+'prices_daily.ndjson'):
    r=json.loads(l)
    if r.get('price'): P[r['offer']][r['d']]=r['price']
for l in open(D+'gap_daily.ndjson'):
    r=json.loads(l); G[r['art']][r['date']]=r['site_to_seller']
days=sorted({d for a in G for d in G[a] if d>='2026-09-23'})
print('витрина / наша предельная, медиана магазина:',' '.join('%s %.2f'%(d[5:],S.median(G[a][d] for a in G if d in G[a])) for d in days))
rows=[]
for a in G:
    for x,y in zip(days,days[1:]):
        if all(k in G[a] and k in P[a] for k in (x,y)):
            rows.append((a,x,y,math.log(P[a][y]/P[a][x]),math.log(G[a][y]*P[a][y]/(G[a][x]*P[a][x]))))
base=C.defaultdict(list)
for a,x,y,dp,ds in rows:
    if abs(dp)<0.001: base[(x,y)].append(ds)
big=[(a,dp,ds-S.median(base[(x,y)])) for a,x,y,dp,ds in rows if abs(dp)>0.03]
for nm,f in (('наша цена вниз',lambda t:t[1]<0),('наша цена вверх',lambda t:t[1]>0)):
    v=[t for t in big if f(t)]; pt=sorted(t[2]/t[1] for t in v)
    print('%s: %d случаев, %d товаров; наша медиана %+.1f%%, витрина %+.1f%%; перенос медиана %.2f (четверти %.2f..%.2f)'%(
        nm,len(v),len({t[0] for t in v}),S.median(t[1] for t in v)*100,S.median(t[2] for t in v)*100,S.median(pt),pt[len(pt)//4],pt[3*len(pt)//4]))
