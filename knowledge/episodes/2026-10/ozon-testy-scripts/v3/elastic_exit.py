# Что даёт «Эластичный бустинг»: 51 товар вышел из акции 29.09 (снимки acts_daily 28.09 -> 29.09).
# Вышедшие против оставшихся (товары без рекламы за клик 15.09-10.10), неделя до (22-28.09) и после (30.09-06.10):
# предельная (prices_daily.price с 23.09), цена для покупателя (предельная × site_to_seller), буст (boost_daily),
# показы в поиске (sku_views.vsearch), заказы без отмен. Запуск: python3 -I elastic_exit.py
import os,json,collections as C,statistics as S
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
E=C.defaultdict(set)
for a in L('acts_daily.ndjson'):
    if 'Эластичный' in a['title']: E[a['date']].add(a['art'])
P0={(p['d'],p['offer']) for p in L('prices_daily.ndjson')}
ex=E['2026-09-28']-E['2026-09-29']; st=E['2026-09-28']&E['2026-10-07']
back=ex&E['2026-10-11']
off=json.load(open(D+'sku_offer.json')); a2s={v:k for k,v in off.items()}
SP=C.Counter()
for r in L('ads_sku_daily.ndjson'):
    if '2026-09-15'<=r['d']<='2026-10-10': SP[off.get(r['sku'],r['sku'])]+=r['sp']
ex={a for a in ex if SP[a]==0 and ('2026-09-30',a) in P0}; st={a for a in st if SP[a]==0}  # только вышедшие, у которых есть цена после выхода
print('(вышли 29.09: из %d вышедших у %d нет цены после выхода - сняты с продажи?)'%(len(E['2026-09-28']-E['2026-09-29']),sum(1 for a in E['2026-09-28']-E['2026-09-29'] if ('2026-09-30',a) not in P0)))
print('вышли 29.09: %d без рекламы (вернулись к 11.10: %d); остались: %d без рекламы'%(len(ex),len(back),len(st)))
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson') if p['d']>='2026-09-23'}
G={(g['date'],g['art']):g['site_to_seller'] for g in L('gap_daily.ndjson')}
B={(b['date'],b['art']):b['boost'] for b in L('boost_daily.ndjson')}
V=C.Counter(); O=C.Counter()
for r in L('sku_views.ndjson'):
    if r['date']>='2026-09-15': V[(r['date'],off.get(str(r['sku'])))]+=r.get('vsearch') or 0
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled': O[(o['d'],o['offer'])]+=1
pre=['2026-09-%02d'%i for i in range(22,29)]; post=['2026-09-30']+['2026-10-%02d'%i for i in range(1,7)]
def med(arts,dd,f):
    v=[]
    for a in arts:
        x=[f(d,a) for d in dd]; x=[y for y in x if y is not None]
        if x: v.append(S.median(x))
    return S.median(v) if v else float('nan'),len(v)
fp=lambda d,a:P.get((d,a)); fs=lambda d,a:P[(d,a)]*G[(d,a)] if (d,a) in P and (d,a) in G else None
fb=lambda d,a:B.get((d,a))
for nm,f in (('предельная',fp),('цена для покупателя (витрина)',fs),('буст OZON',fb)):
    r=[]
    for g in (ex,st):
        a,n1=med(g,pre,f); b,n2=med(g,post,f); r.append((a,b,n1))
    print('%-30s вышедшие %s -> %s (%+.1f%%, n=%d) | оставшиеся %s -> %s (%+.1f%%, n=%d)'%(nm,*('%.3g'%r[0][0],'%.3g'%r[0][1]),(r[0][1]/r[0][0]-1)*100,r[0][2],*('%.3g'%r[1][0],'%.3g'%r[1][1]),(r[1][1]/r[1][0]-1)*100,r[1][2]))
for nm,M in (('показы в поиске',V),('заказы',O)):
    r=[(sum(M[(d,a)] for a in g for d in pre),sum(M[(d,a)] for a in g for d in post)) for g in (ex,st)]
    print('%-30s вышедшие %d -> %d (%+.0f%%) | оставшиеся %d -> %d (%+.0f%%) | разница ×%.2f'%(nm,*r[0],(r[0][1]/max(r[0][0],1)-1)*100,*r[1],(r[1][1]/r[1][0]-1)*100,(r[0][1]/max(r[0][0],1))/(r[1][1]/r[1][0])))
# Риск схемы «база завышена, рабочая цена = цена «Эластичного»»: что с предельной, если товар выпал из «Эластичного»
# и не попал в «Максимальный»/«Усиление». Все выходы 23.09-11.10.
T=C.defaultdict(set)
for a in L('acts_daily.ndjson'): T[(a['date'],a['art'])].add(a['title'])
PB={(p['d'],p['offer']):(p['price'],p['before']) for p in L('prices_daily.ndjson') if p['d']>='2026-09-23'}
ds=sorted(E); res=C.Counter(); jump=[]
for x,y in zip(ds,ds[1:]):
    for a in E[x]-E[y]:
        if (y,a) not in PB: res['пропал из цен (снят с продажи?)']+=1; continue
        other=any(t.startswith('Максимальный') for t in T[(y,a)])
        if other: res['перешёл в «Максимальный»/«Усиление»']+=1; continue
        p0=PB.get((x,a)); p1=PB[(y,a)]
        res['ни в одной ценовой акции']+=1
        if p0: jump.append((p1[0]/p0[0]-1, p1[0]/p1[1]))
print('выходы из «Эластичного» 23.09-11.10:',dict(res))
if jump: print('  без другой акции: предельная изменилась медиана %+.0f%%, предельная/база после выхода медиана %.2f (n=%d)'%(100*S.median(j for j,_ in jump),S.median(b for _,b in jump),len(jump)))
# Показы и заказы этих товаров: 7 дней до выхода и 7 дней после, против оставшихся в «Эластичном» за те же даты.
import datetime as dt
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
ev=[]
for x,y in zip(ds,ds[1:]):
    for a in E[x]-E[y]:
        if (y,a) in PB and not any(t.startswith('Максимальный') for t in T[(y,a)]): ev.append((a,y))
print('выпавшие без другой акции:',sorted({(a,y[5:]) for a,y in ev}))
stay=[a for a in E[ds[0]] if all(a in E[d] for d in ds)]
for nm,M in (('показы в поиске',V),('заказы',O)):
    t=[0,0]; c=[0,0]
    for a,y in ev:
        last=max(d for d,_ in V); pre=[sh(y,-k) for k in range(1,8)]; post=[x for x in (sh(y,k) for k in range(0,7)) if x<=last]
        npre=len(pre); npost=len(post)  # пропуск дня - не ноль: считаем в среднем на день
        t[0]+=sum(M[(d,a)] for d in pre)/npre; t[1]+=sum(M[(d,a)] for d in post)/npost
        c[0]+=sum(M[(d,s)] for s in stay for d in pre)/len(stay)/npre; c[1]+=sum(M[(d,s)] for s in stay for d in post)/len(stay)/npost
    print('  %s в день: выпавшие %.1f -> %.1f (%+.0f%%), оставшиеся (на товар, те же даты) %+.0f%%'%(nm,t[0],t[1],(t[1]/t[0]-1)*100 if t[0] else float('nan'),(c[1]/c[0]-1)*100))
# Поправка ФЕНИКСА iter3: состояние 15 выпавших 08.10 на последний день снимков.
last=ds[-1]
for a,y in sorted(ev):
    p=PB.get((last,a)); print('  %-20s на %s: в «Эластичном» %s, предельная/база %s'%(a,last[5:],'да' if a in E[last] else 'нет','%.2f'%(p[0]/p[1]) if p else '-'))
