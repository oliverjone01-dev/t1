# Тезис Ивана 1: реклама за клик через 2 дня даёт надбавку скидки OZON ~10%, от бюджета не зависит.
# Событие: товар начал получать расход за клик после >=5 дней без расхода (ads_sku_daily, с 03.07).
# Мера: изменение цены на сайте (coinv_daily.site_listed) от дня d-1 к d+k минус медиана магазина
# (товары без расхода за клик в этот день). Запуск: python3 -I click_starts.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,math,datetime as dt,sys
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
H=C.defaultdict(dict); a2s={}
for r in L('coinv_daily.ndjson'):
    a2s[r['art']]=r['sku']
    if r.get('observed') and r.get('site_listed'): H[r['sku']][r['date']]=r['site_listed']
s2a={v:k for k,v in a2s.items()}
SP=C.defaultdict(C.Counter); CAMP=C.defaultdict(set)
for r in L('ads_sku_daily.ndjson'):
    SP[r['sku']][r['d']]+=r['sp']; CAMP[r['sku']].add(r['cid'])
days=sorted({d for s in H.values() for d in s})
adv=lambda s,d:SP[s][d]>0
store={}
for a,b in zip(days,days[1:]):
    v=[math.log(H[s][b]/H[s][a]) for s in H if a in H[s] and b in H[s] and not adv(s,a) and not adv(s,b) and not adv(s,sh(b,-2))]
    if len(v)>50: store[b]=S.median(v)
def exc(s,d0,d1):  # избыточное лог-изменение цены товара d0->d1 против магазина
    if d0 not in H[s] or d1 not in H[s]: return None
    st=sum(store.get(x,0) for x in days if d0<x<=d1)
    return math.log(H[s][d1]/H[s][d0])-st
ev=[]
for s in SP:
    if s not in H: continue
    dd=sorted(d for d in SP[s] if SP[s][d]>0)
    for d in dd:
        if d<'2026-07-08' or d>'2026-09-20': continue
        if any(SP[s][sh(d,-k)]>0 for k in range(1,6)): continue
        b=S.mean(SP[s][sh(d,k)] for k in range(0,5))
        r=[exc(s,sh(d,-1),sh(d,k)) for k in range(0,6)]
        if None in r[:4]: continue
        ev.append((s,d,b,r))
print('стартов рекламы за клик (после >=5 дней без расхода), 08.07-20.09:',len(ev))
pct=lambda x:'%+.1f%%'%((math.exp(x)-1)*100) if x is not None else '  -  '
print('изменение цены на сайте к магазину, медиана: день старта / +1 / +2 / +3 / +4 / +5')
for k in range(6):
    v=[e[3][k] for e in ev if e[3][k] is not None]; print('  d+%d n=%d медиана %s, доля упавших >5%%: %.0f%%'%(k,len(v),pct(S.median(v)),100*sum(x<math.log(0.95) for x in v)/len(v)))
print('по бюджету (средний расход на товар в день, первые 5 дней), изменение к d+3:')
for lo,hi in ((0,300),(300,1000),(1000,3000),(3000,1e9)):
    v=[e[3][3] for e in ev if lo<=e[2]<hi]
    if v: print('  %5d-%-6s ₽/день: n=%d медиана %s, квартили %s..%s'%(lo,int(hi) if hi<1e9 else '+',len(v),pct(S.median(v)),pct(sorted(v)[len(v)//4]),pct(sorted(v)[3*len(v)//4])))
# плацебо: случайные дни у товаров без рекламы
import random; random.seed(1); pl=[]
noad=[s for s in H if sum(SP[s].values())==0]
for _ in range(2000):
    s=random.choice(noad); d=random.choice(days[10:-6]); x=exc(s,sh(d,-1),sh(d,3))
    if x is not None: pl.append(x)
print('плацебо (товары без рекламы, случайный день), d+3: n=%d медиана %s, доля упавших >5%%: %.0f%%'%(len(pl),pct(S.median(pl)),100*sum(x<math.log(0.95) for x in pl)/len(pl)))
if '-v' in sys.argv:
    for s,d,b,r in sorted(ev,key=lambda e:e[1]): print(s2a.get(s,s),d,'%6.0f'%b,' '.join(pct(x) for x in r))
# Поправка ФЕНИКСА 13.10: одна кампания = одно событие; бюджет - расход всей кампании в день (только дни с данными).
CSP=C.defaultdict(C.Counter); SC=C.defaultdict(set)
for r in L('ads_sku_daily.ndjson'):
    CSP[r['cid']][r['d']]+=r['sp']
    if r['sp']>0: SC[(r['sku'],r['d'])].add(r['cid'])
cl=C.defaultdict(list)
for s,d,b,r in ev:
    for c in SC[(s,d)]: cl[(d,c)].append(r[3])
print('по кампаниям (кампания + дата старта = одно событие): %d событий'%len(cl))
rows=[]
for (d,c),v in sorted(cl.items()):
    dd=[x for x in (sh(d,k) for k in range(5)) if x in CSP[c]]; b=S.mean(CSP[c][x] for x in dd) if dd else 0
    rows.append((d,c,len(v),b,S.median(v)))
for lo,hi in ((0,300),(300,1500),(1500,1e9)):
    x=[r[4] for r in rows if lo<=r[3]<hi]
    if x: print('  кампания %d-%s ₽/день: событий %d, медиана изменения цены к 3 дню %s, подешевели >5%%: %d из %d'%(lo,int(hi) if hi<1e9 else '+',len(x),pct(S.median(x)),sum(v<math.log(0.95) for v in x),len(x)))
if '-c' in sys.argv:
    for d,c,n,b,m in rows: print('   ',d,c,'товаров',n,'%.0f ₽/день'%b,pct(m))
# Поправка ФЕНИКСА iter2: по месяцам (событие = кампания + дата) и счёт кампаний.
bym=C.defaultdict(list)
for d,c,n,b,m in rows: bym[d[:7]].append(m)
print('по месяцам старта (кампании), изменение цены к 3 дню:',' '.join('%s: %s (n=%d)'%(k,pct(S.median(v)),len(v)) for k,v in sorted(bym.items())))
print('событий %d в %d кампаниях'%(len(rows),len({c for d,c,n,b,m in rows})))
