# Тезис Ивана 2: выключили кампанию - надбавка живёт ~неделю; выключили и включили - сгорает, 2 дня заново.
# Плюс размер надбавки в пунктах соинвеста (coinv_listed_pct, база cap заморожена 09.09).
# Запуск: python3 -I click_stops.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,math,datetime as dt,sys
exec(open(__file__.replace('click_stops.py','click_starts.py')).read().split("ev=[]")[0])
P=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('coinv_listed_pct') is not None: P[r['sku']][r['date']]=r['coinv_listed_pct']
pct=lambda x:'%+.1f%%'%((math.exp(x)-1)*100) if x is not None else '   -  '
# размер надбавки в пунктах на стартах (d-1 -> d+3)
pts=[]
for s in SP:
    for d in sorted(x for x in SP[s] if SP[s][x]>0):
        if '2026-07-08'<=d<='2026-09-20' and not any(SP[s][sh(d,-k)]>0 for k in range(1,6)) and sh(d,-1) in P[s] and sh(d,3) in P[s]:
            pts.append(P[s][sh(d,3)]-P[s][sh(d,-1)])
print('надбавка в пунктах соинвеста на стартах (d-1 -> d+3): n=%d медиана %+.1f п., квартили %+.1f..%+.1f'%(len(pts),S.median(pts),sorted(pts)[len(pts)//4],sorted(pts)[3*len(pts)//4]))
# остановки: последний день с расходом d, затем >=10 дней без расхода
st=[]
for s in SP:
    if s not in H: continue
    for d in sorted(x for x in SP[s] if SP[s][x]>0):
        if SP[s][sh(d,1)]==0 and all(SP[s][sh(d,k)]==0 for k in range(1,11)) and '2026-07-05'<=d<='2026-09-12':
            r=[exc(s,d,sh(d,k)) for k in range(1,12)]
            if sum(x is not None for x in r)>=8: st.append((s,d,r))
print('остановок рекламы за клик (>=10 дней без расхода после):',len(st))
for k in range(11):
    v=[e[2][k] for e in st if e[2][k] is not None]
    print('  через %2d дн. n=%d медиана %s, доля подорожавших >5%%: %.0f%%'%(k+1,len(v),pct(S.median(v)),100*sum(x>math.log(1.05) for x in v)/len(v)))
if '-v' in sys.argv:
    for s,d,r in sorted(st,key=lambda e:e[1]): print(s2a.get(s,s),d,' '.join(pct(x) for x in r))
# короткие паузы: расход d, 1-4 дня без расхода, снова расход
print('короткие паузы 1-4 дня (выключили и включили):')
for s in SP:
    if s not in H: continue
    on=sorted(x for x in SP[s] if SP[s][x]>0)
    for a,b in zip(on,on[1:]):
        gap=(dt.date.fromisoformat(b)-dt.date.fromisoformat(a)).days-1
        if 1<=gap<=4 and '2026-07-05'<=a<='2026-09-20':
            r=[exc(s,a,sh(a,k)) for k in range(1,gap+5)]
            print('  %-22s расход до %s, пауза %d дн., цена к магазину по дням после: %s'%(s2a.get(s,s),a[5:],gap,' '.join(pct(x) for x in r)))
