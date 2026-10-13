# Размер надбавки в пунктах разрыва (gap_daily: 1 - цена сайта / цена продавца) на стартах рекламы за клик
# с 12.09 (gap_daily есть с 09.09). Минус медиана магазина (товары без расхода). Запуск: python3 -I click_gap.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,datetime as dt
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
G=C.defaultdict(dict); s2a={}
for g in L('gap_daily.ndjson'): G[g['sku']][g['date']]=g['gap_pct']; s2a[g['sku']]=g['art']
SP=C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'): SP[r['sku']][r['d']]+=r['sp']
days=sorted({d for s in G.values() for d in s}); print('gap_daily',days[0],days[-1],'ads_sku_daily до',max(d for s in SP.values() for d in s))
st={d:S.median([G[s][d] for s in G if d in G[s] and sum(SP[s][sh(d,-k)] for k in range(0,8))==0]) for d in days}
ev=[]
for s in SP:
    for d in sorted(x for x in SP[s] if SP[s][x]>0):
        if d<'2026-09-12' or any(SP[s][sh(d,-k)]>0 for k in range(1,6)): continue
        a,b=sh(d,-1),sh(d,3)
        if a in G[s] and b in G[s]:
            ev.append((s2a.get(s,s),d,S.mean(SP[s][sh(d,k)] for k in range(5)),(G[s][b]-st[b])-(G[s][a]-st[a]),[round(G[s].get(sh(d,k),float('nan'))-st.get(sh(d,k),0),1) for k in range(-1,5)]))
v=[e[3] for e in ev]
print('стартов с 12.09: %d, рост разрыва к магазину d-1 -> d+3: медиана %+.1f п., квартили %+.1f..%+.1f'%(len(v),S.median(v),sorted(v)[len(v)//4],sorted(v)[3*len(v)//4]))
for lo,hi in ((0,300),(300,1500),(1500,1e9)):
    x=[e[3] for e in ev if lo<=e[2]<hi]
    if x: print('  расход %d-%s ₽/день: n=%d медиана %+.1f п.'%(lo,int(hi) if hi<1e9 else '+',len(x),S.median(x)))
for e in sorted(ev,key=lambda e:e[1]): print(' ',e[0],e[1],'%5.0f ₽/д'%e[2],'разрыв к магазину d-1..d+4:',e[4])
# Поправка ФЕНИКСА 13.10: одна кампания = одно событие; бюджет - расход всей кампании в день по дням с данными
# (пропуск дня не ноль: ads_sku_daily кончается 10.10).
CSP=C.defaultdict(dict); SC=C.defaultdict(set); last=max(d for s in SP.values() for d in s)
for r in L('ads_sku_daily.ndjson'):
    CSP[r['cid']][r['d']]=CSP[r['cid']].get(r['d'],0)+r['sp']
    if r['sp']>0: SC[(off_:=r['sku'],r['d'])].add(r['cid'])
a2s={v:k for k,v in s2a.items()}
cl=C.defaultdict(list)
for art,d,b,x,_ in ev:
    for c in SC[(a2s.get(art),d)]: cl[(d,c)].append(x)
rows=[]
for (d,c),v in sorted(cl.items()):
    dd=[sh(d,k) for k in range(5) if sh(d,k) in CSP[c]]
    rows.append((d,c,len(v),S.mean(CSP[c][x] for x in dd) if dd else float('nan'),S.median(v)))
print('по кампаниям: %d событий'%len(rows))
for lo,hi in ((0,300),(300,1500),(1500,1e9)):
    x=[r[4] for r in rows if lo<=r[3]<hi]
    if x: print('  кампания %d-%s ₽/день: событий %d, рост разрыва медиана %+.1f п., от %+.1f до %+.1f'%(lo,int(hi) if hi<1e9 else '+',len(x),S.median(x),min(x),max(x)))
for r in rows: print('   ',r[0],r[1],'товаров',r[2],'%.0f ₽/день'%r[3],'%+.1f п.'%r[4])
