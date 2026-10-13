# ФЕНИКС iter7 (голова 20b2d08): проверка строгого отбора acts_steps_strict.py.
# 1) из чего складываются 1 746 отсеянных; 2) массовые дни против журнала ставки за заказ;
# 3) октябрь: попали бы смены акций под правило «скачок у >3% товаров»; 4) 91 = 48 + 43.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_strict.py
import json,collections as C,statistics as S,math,datetime as dt
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
# ---- история, отбор как в acts_steps_strict.py:52-67
H=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed'): H[r['art']][r['date']]=r['site_listed']
eh=steps(H,store_shift(H))
nart=C.Counter()
for a,s_ in H.items():
    for d in s_: nart[d]+=1
perday=C.Counter(d for a,d,j in eh)
mass={d for d,n in perday.items() if n>0.03*nart[d]}
cpo=lambda d:'2026-08-21'<=d<='2026-09-10'
seen=set(); kept=[]; why=C.Counter()
for a,d,j in sorted(eh,key=lambda x:x[1]):
    k=(a,j<0)
    if d in mass: why['массовый день']+=1; continue
    if cpo(d): why['21.08-10.09 (не массовый день)']+=1; continue
    if k in seen: why['повтор товара и направления']+=1; continue
    seen.add(k); kept.append((a,d,j))
print(f'1. Скачков {len(eh)}, осталось {len(kept)}, отсеяно {len(eh)-len(kept)}: {dict(why)}')
inmass_cpo=sum(1 for a,d,j in eh if d in mass and cpo(d))
print(f'   из массовых дней внутри 21.08-10.09: {inmass_cpo}; порог массового дня: >3% товаров, это {min(int(0.03*nart[d])+1 for d in mass)}-{max(int(0.03*nart[d])+1 for d in mass)} скачков в день')
# ---- массовые дни против журнала ставки за заказ
log=[l.strip().split('|') for l in open('/home/user/t1/analytics-mvp/tools/tests/cpo_history.psv')][1:]
cdays={x[0][:10] for x in log}
near=lambda d:any(sh(d,k) in cdays for k in (-1,0,1))
mm=sorted(mass)
ev_mass=C.Counter(d for a,d,j in eh if d in mass)
cpo_m=[d for d in mm if near(d)]; other=[d for d in mm if not near(d)]
print(f'2. Массовых дней {len(mm)}; рядом (±1 день) со сменой ставки за заказ {len(cpo_m)} ({sum(ev_mass[d] for d in cpo_m)} скачков), без смены ставки {len(other)} ({sum(ev_mass[d] for d in other)} скачков)')
print('   без смены ставки:',[(d,ev_mass[d],f'{ev_mass[d]/nart[d]:.0%}') for d in other])
# ---- октябрь: смены акций и правило массового дня
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
nv=C.Counter()
for a,s_ in V.items():
    for d in s_: nv[d]+=1
pdv=C.Counter(d for a,d,j in ev)
massv={d for d,n in pdv.items() if n>0.03*nv[d]}
hit=[e for e in evv if any((e[0],x) in tr for x in (e[1],sh(e[1],-1),sh(e[1],1)))]
trd=C.Counter(d for a,d in tr if d>'2026-09-25')
print(f'3. Октябрь: скачков {len(evv)}, совпали со сменой акций {len(hit)}; из них в «массовые» по тому же правилу дни {sum(1 for e in hit if e[1] in massv)}')
print(f'   смены акций по дням: {sorted(trd.items())} из {len({a for a,d in tr})} товаров; массовые дни октября {sorted(massv)}')
# ---- 91 = 48 + 43
F=C.defaultdict(dict)
for f in L('funnel_sku_daily.ndjson'): F[f['art']][f['date']]=f
ads=C.defaultdict(set); sk2a={}
for f in F:
    for d,r in F[f].items(): sk2a[r['sku']]=f; break
for r in L('ads_sku_daily.ndjson'):
    if r['sp']>0 and r['sku'] in sk2a: ads[sk2a[r['sku']]].add(r['d'])
cnt=C.Counter(); why2=C.Counter()
for a,d,j in kept:
    if a not in F: why2['нет воронки по товару']+=1; continue
    if any(x in ads[a] for x in win(d,-10,11)): why2['реклама за клик в ±10 дней']+=1; continue
    if not all(x in F[a] for x in win(d,-7,0)+win(d,1,8)): why2['воронка не на все 14 дней']+=1; continue
    cnt['вниз' if j<0 else 'вверх']+=1
print(f'4. Из {len(kept)}: вниз {cnt["вниз"]} + вверх {cnt["вверх"]} = {sum(cnt.values())}; выбыли {dict(why2)}')
unv=[e for e in kept if e[0] in F and win(e[1],-10,11)[0]<'2026-07-03']
print(f'   окно «без рекламы» начинается до 03.07 у {len(unv)} из {len(kept)}')
