# ФЕНИКС iter7: проверка абзаца «Сколько даёт акция» (make2.js:88 @ 65a6f6f).
# Детектор и окна - копия acts_steps.py / acts_steps_placebo.py (a253fc0) без изменений.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_acts.py
import json,collections as C,statistics as S,math,datetime as dt,random
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
TH=0.10
def steps(series,store):
    out=[]
    for art,s in series.items():
        dd=sorted(s)
        for i in range(3,len(dd)-2):
            pre=S.median(math.log(s[d]) for d in dd[i-3:i]); post=S.median(math.log(s[d]) for d in dd[i:i+3])
            j=post-pre-store.get(dd[i],0)
            if abs(j)>=TH and abs(math.log(s[dd[i]])-pre)>=TH*0.8: out.append((art,dd[i],j))
    out.sort(); res=[]; last={}
    for a,d,j in out:
        if a in last and (dt.date.fromisoformat(d)-dt.date.fromisoformat(last[a])).days<=3: last[a]=d; continue
        last[a]=d; res.append((a,d,j))
    return res
def store_shift(series):
    by=C.defaultdict(list)
    for art,s in series.items():
        dd=sorted(s)
        for a,b in zip(dd,dd[1:]): by[b].append(math.log(s[b]/s[a]))
    return {d:S.median(v) for d,v in by.items() if len(v)>50}
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
def win(d,a,b): x=dt.date.fromisoformat(d); return [(x+dt.timedelta(i)).isoformat() for i in range(a,b)]

# ---------- 1. Проверка детектора на октябре и уровень случайных совпадений
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson')}
V=C.defaultdict(dict)
for g in L('gap_daily.ndjson'):
    pr=P.get((g['date'],g['art']))
    if pr and g['date']>='2026-09-20': V[g['art']][g['date']]=pr*g['site_to_seller']
ev=steps(V,store_shift(V))
A=L('acts_daily.ndjson'); ads_=sorted({a['date'] for a in A}); mem=C.defaultdict(set)
for a in A:
    if 'бустинг' in a['title'].lower(): mem[(a['date'],a['art'])].add(a['title'][:22])
for a in A: mem[(a['date'],a['art'])]
tr=set()
for art in {a['art'] for a in A}:
    for x,y in zip(ads_,ads_[1:]):
        if mem[(x,art)]!=mem[(y,art)]: tr.add((art,y))
evv=[e for e in ev if e[1]>'2026-09-25']
hits=lambda es: sum(1 for a,d,j in es if any((a,x) in tr for x in (d,sh(d,-1),sh(d,1))))
random.seed(1); arts=sorted(V)
rs=sorted(hits([(random.choice(arts),d,j) for a,d,j in evv])/len(evv) for _ in range(200))
print(f'1. Октябрь: скачков {len(evv)}, совпали со сменой акций {hits(evv)} ({hits(evv)/len(evv):.0%}); случайный товар в тот же день: {S.mean(rs):.0%} (p95 {rs[189]:.0%})')

# ---------- 2. История: события как в acts_steps.py (main) и acts_steps_placebo.py (placebo)
H=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed'): H[r['art']][r['date']]=r['site_listed']
eh=steps(H,store_shift(H))
by=C.defaultdict(list)
for art,s in H.items():
    dd=sorted(s)
    for x,y in zip(dd,dd[1:]): by[y].append(math.log(s[y]/s[x]))
smed={d:S.median(v) for d,v in by.items() if len(v)>50}
F=C.defaultdict(dict)
for f in L('funnel_sku_daily.ndjson'): F[f['art']][f['date']]=f
ads=C.defaultdict(set); sk2a={}
for f in F:
    for d,r in F[f].items(): sk2a[r['sku']]=f; break
AS=L('ads_sku_daily.ndjson')
for r in AS:
    if r['sp']>0 and r['sku'] in sk2a: ads[sk2a[r['sku']]].add(r['d'])
tot=C.defaultdict(C.Counter)
for a in F:
    for d,r in F[a].items():
        for k in ('search_views','hits_to_cart','ordered_units'): tot[d][k]+=r[k] or 0
def sel(main):
    out={'вниз':[],'вверх':[]}
    for a,d,j in eh:
        if a not in F: continue
        if main:
            pre=win(d,-7,0); post=win(d,1,8)
            if any(x in ads[a] for x in win(d,-10,11)): continue
        else:
            pre=win(d,-14,-7); post=win(d,-7,0)
            if any(x in ads[a] for x in win(d,-17,1)): continue
        if not all(x in F[a] for x in pre+post): continue
        out['вниз' if j<0 else 'вверх'].append((a,d,j))
    return out
M=sel(True); PL=sel(False)
def sums(es,a0,b0,k):
    return (sum(sum(F[a][x][k] or 0 for x in win(d,a0,b0)) for a,d,j in es),
            sum(sum(tot[x][k] for x in win(d,a0,b0)) for a,d,j in es))
def eff(es,label):
    n=len(es); out=[label,f'n={n}']
    for k,nm in (('search_views','показы'),('hits_to_cart','корзины'),('ordered_units','заказы')):
        s0,t0=sums(es,-7,0,k); s1,t1=sums(es,1,8,k)
        out.append(f'{nm}: база {s0/n:.2f}, сверх магазина {(s1-s0*t1/t0)/n:+.2f} (магазин x{t1/t0:.2f})')
    print('   '+' | '.join(out))
print('\n2. Выборки main/placebo')
for g in M:
    a,b=set(M[g]),set(PL[g]); print(f'   {g}: main {len(a)}, placebo {len(b)}, общих {len(a&b)}')
s,_=sums(PL['вниз'],-14,-7,'ordered_units'); s2,_=sums(M['вниз'],1,8,'ordered_units')
print(f'   в тексте 0,13 -> 0,15: {s}/{len(PL["вниз"])} (placebo, нед -2) -> {s2}/{len(M["вниз"])} (main, нед +1) - разные выборки')
for g in M:
    cm=[e for e in M[g] if e in set(PL[g])]; n=len(cm); line=[f'   одна выборка {g} n={n}:']
    for k,nm in (('search_views','показы'),('hits_to_cart','корзины'),('ordered_units','заказы')):
        w0=sums(cm,-14,-7,k); w1=sums(cm,-7,0,k); w2=sums(cm,1,8,k)
        line.append(f'{nm} нед-2 {w0[0]/n:.3f} нед-1 {w1[0]/n:.3f} нед+1 {w2[0]/n:.3f}, сверх магазина к нед-2 {(w2[0]-w0[0]*w2[1]/w0[1])/n:+.3f}, к нед-1 {(w2[0]-w1[0]*w2[1]/w1[1])/n:+.3f} (шт {w0[0]}/{w1[0]}/{w2[0]})')
    print('\n     '.join(line))

# ---------- 3. Кучность по датам, общий сдвиг магазина накануне, возврат цены, окно без ставки за заказ
print('\n3. Даты и общие сдвиги')
CPO_OFF=set(win('2026-08-28',0,8))
def back(a,d):
    s=H[a]; pre=[s[x] for x in win(d,-4,-1) if x in s]; post=[s[x] for x in win(d,2,8) if x in s]
    if not pre or not post: return None
    p0=S.median(pre); return sum(1 for v in post if abs(math.log(v/p0))<0.04)/len(post)
for g in M:
    c=C.Counter(d for a,d,j in M[g]); top=c.most_common(5)
    print(f'   {g}: {len(M[g])} событий у {len({a for a,d,j in M[g]})} товаров, {len(c)} дат, топ-5 дат {top} = {sum(v for _,v in top)/len(M[g]):.0%}')
    leak=[e for e in M[g] if (lambda s,x1,x2: x1 in s and x2 in s and abs(math.log(s[x1]/s[x2]))>=0.08 and abs(smed.get(x1,0))>=0.05)(H[e[0]],sh(e[1],-1),sh(e[1],-2))]
    rev=[e for e in M[g] if (back(e[0],e[1]) or 0)>=0.5]
    cpo=[e for e in M[g] if any(x in CPO_OFF for x in win(e[1],-7,8))]
    print(f'   {g}: шаг был накануне вместе с магазином {len(leak)} ({len(leak)/len(M[g]):.0%}) {sorted(C.Counter(d for a,d,j in leak).items())}; цена вернулась в окне после {len(rev)}; окна задевают 28.08-04.09 {len(cpo)}')
    unv=[e for e in M[g] if win(e[1],-10,11)[0]<min(r['d'] for r in AS)]
    print(f'   {g}: окно «без рекламы» начинается до {min(r["d"] for r in AS)} (выгрузки рекламы по товарам нет): {len(unv)} ({len(unv)/len(M[g]):.0%})')
for d in ('2026-08-07','2026-08-08','2026-08-10','2026-09-04','2026-09-05','2026-09-07'):
    v=by[d]; print(f'   {d}: медиана изменения цены по магазину {S.median(v):+.3f}, доля товаров -10% и ниже {sum(1 for x in v if x<-0.1)/len(v):.0%}, +10% и выше {sum(1 for x in v if x>0.1)/len(v):.0%}; показы магазина {tot[d]["search_views"]}')
print('\n4. Эффект по отборам')
for g in M:
    print(f'   {g}:')
    eff(M[g],'все')
    for d,_ in C.Counter(d for a,d,j in M[g]).most_common(3):
        eff([e for e in M[g] if e[1]==d],'только '+d); eff([e for e in M[g] if e[1]!=d],'без '+d)
    clean=[e for e in M[g] if not ((lambda s,x1,x2: x1 in s and x2 in s and abs(math.log(s[x1]/s[x2]))>=0.08 and abs(smed.get(x1,0))>=0.05)(H[e[0]],sh(e[1],-1),sh(e[1],-2)))
           and not (back(e[0],e[1]) or 0)>=0.5 and not any(x in CPO_OFF for x in win(e[1],-7,8))]
    eff(clean,'чистые (без общего сдвига накануне, без возврата цены, без 28.08-04.09)')
    eff([e for e in clean if not e[1].startswith('2026-07-2')],'чистые без 27-28.07')

# ---------- 5. Тест 1: те ли показы
Vw={}
for l in open(D+'sku_views.ndjson'):
    r=json.loads(l)
    if '2026-06-12'<=r['date']<='2026-09-21': Vw[(r['date'],str(r['sku']))]=r.get('vsearch') or 0
Fk={(r['date'],str(r['sku'])):(r['search_views'] or 0) for a in F for r in F[a].values()}
ks=set(Fk)&set(Vw)
print(f'\n5. funnel search_views = sku_views vsearch: {sum(1 for k in ks if Fk[k]==Vw[k])} из {len(ks)} товаро-дней, суммы {sum(Fk[k] for k in ks)} / {sum(Vw[k] for k in ks)}')
print(f'   тест 1 (abs.py): (5805-2072)*7/11 = {(5805-2072)*7/11:.0f}; с поправкой на остальные товары (84761 -> 76997): {(5805-2072*76997/84761)*7/11:.0f}; база {2072*7/11:.0f} в неделю на товар')
