# Скачки цены для покупателя у отдельного товара (акция или наша цена) и что после них с позицией, показами, заказами.
import json,collections as C,statistics as S,math,datetime as dt
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
TH=0.10
def steps(series,store):
    # series: {art:{day:x}}, store: {day: median log-change}; returns [(art,day,logjump)]
    out=[]
    for art,s in series.items():
        dd=sorted(s)
        for i in range(3,len(dd)-2):
            pre=S.median(math.log(s[d]) for d in dd[i-3:i]); post=S.median(math.log(s[d]) for d in dd[i:i+3])
            j=post-pre-store.get(dd[i],0)
            if abs(j)>=TH and abs(math.log(s[dd[i]])-pre)>=TH*0.8: out.append((art,dd[i],j))
    # keep first day of a run
    out.sort(); res=[]; last={}
    for a,d,j in out:
        if a in last and (dt.date.fromisoformat(d)-dt.date.fromisoformat(last[a])).days<=3: last[a]=d; continue
        last[a]=d; res.append((a,d,j))
    return res
def store_shift(series):
    by=C.defaultdict(list); 
    for art,s in series.items():
        dd=sorted(s)
        for a,b in zip(dd,dd[1:]): by[b].append(math.log(s[b]/s[a]))
    return {d:S.median(v) for d,v in by.items() if len(v)>50}
# ---- validation: Oct, buyer price from gap_daily x seller price from prices_daily
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson')}
V=C.defaultdict(dict)
for g in L('gap_daily.ndjson'):
    pr=P.get((g['date'],g['art']))
    if pr and g['date']>='2026-09-20': V[g['art']][g['date']]=pr*g['site_to_seller']
st=store_shift(V); ev=steps(V,st)
A=L('acts_daily.ndjson'); ads_=sorted({a['date'] for a in A}); mem=C.defaultdict(set)
for a in A:
    if 'бустинг' in a['title'].lower(): mem[(a['date'],a['art'])].add(a['title'][:22])
for a in A: mem[(a['date'],a['art'])]
tr=set()
for art in {a['art'] for a in A}:
    for x,y in zip(ads_,ads_[1:]):
        if mem[(x,art)]!=mem[(y,art)]: tr.add((art,y))
evv=[e for e in ev if e[1]>'2026-09-25']
hit=sum(1 for a,d,j in evv if any((a,dd) in tr for dd in [d,(dt.date.fromisoformat(d)-dt.timedelta(1)).isoformat(),(dt.date.fromisoformat(d)+dt.timedelta(1)).isoformat()]))
trv=[t for t in tr if t[1]>'2026-09-25' and t[0] in V]
found=sum(1 for a,d in trv if any(e[0]==a and abs((dt.date.fromisoformat(e[1])-dt.date.fromisoformat(d)).days)<=1 for e in evv))
print(f'ПРОВЕРКА 26.09-11.10: скачков найдено {len(evv)}, из них совпали со сменой акций {hit} ({hit/max(len(evv),1):.0%}); смен акций у товаров с ценой {len(trv)}, найдено скачком {found} ({found/max(len(trv),1):.0%})')
# ---- history June-Sept
R=L('coinv_daily.ndjson'); H=C.defaultdict(dict)
for r in R:
    if r.get('observed') and r.get('site_listed'): H[r['art']][r['date']]=r['site_listed']
sth=store_shift(H); eh=steps(H,sth)
import sys
MODE=sys.argv[1] if len(sys.argv)>1 else 'all'
if MODE!='all':
    nart=C.Counter(); 
    for a,s_ in H.items():
        for d in s_: nart[d]+=1
    perday=C.Counter(d for a,d,j in eh)
    mass={d for d,n in perday.items() if n>0.03*nart[d]}
    cpo=lambda d:'2026-08-21'<=d<='2026-09-10'
    seen=set(); e2=[]
    for a,d,j in sorted(eh,key=lambda x:x[1]):
        k=(a,j<0)
        if d in mass or cpo(d) or k in seen: continue
        seen.add(k); e2.append((a,d,j))
    print('строгий отбор: массовых дней',len(mass),sorted(mass)[:12],'; осталось событий',len(e2),'из',len(eh))
    eh=e2
print('ИСТОРИЯ 12.06-24.09: скачков',len(eh),'вниз',sum(j<0 for *_,j in eh),'вверх',sum(j>0 for *_,j in eh))
print(' по месяцам',sorted(C.Counter((d[:7],'вниз' if j<0 else 'вверх') for a,d,j in eh).items()))
# ---- effect on funnel (to 21.09), SKUs without ads ±10 days
F=C.defaultdict(dict)
for f in L('funnel_sku_daily.ndjson'): F[f['art']][f['date']]=f
ads=C.defaultdict(set)
sk2a={}
for f in F: 
    for d,r in F[f].items(): sk2a[r['sku']]=f; break
for r in L('ads_sku_daily.ndjson'):
    if r['sp']>0 and r['sku'] in sk2a: ads[sk2a[r['sku']]].add(r['d'])
tot=C.defaultdict(C.Counter)
for a in F:
    for d,r in F[a].items():
        for k in ('search_views','hits_to_cart','ordered_units'): tot[d][k]+=r[k] or 0
def win(d,a,b): x=dt.date.fromisoformat(d); return [(x+dt.timedelta(i)).isoformat() for i in range(a,b)]
res={'вниз':C.defaultdict(list),'вверх':C.defaultdict(list)}
cnt=C.Counter()
for a,d,j in eh:
    if a not in F: continue
    pre=win(d,-7,0); post=win(d,1,8)
    if any(x in ads[a] for x in win(d,-10,11)): continue
    if not all(x in F[a] for x in pre+post): continue
    g='вниз' if j<0 else 'вверх'; cnt[g]+=1
    p0=[F[a][x]['search_position'] for x in pre if F[a][x]['search_position']]; p1=[F[a][x]['search_position'] for x in post if F[a][x]['search_position']]
    if p0 and p1: res[g]['pos'].append(math.log(S.median(p1)/S.median(p0)))
    for k in ('search_views','hits_to_cart','ordered_units'):
        s0=sum(F[a][x][k] or 0 for x in pre); s1=sum(F[a][x][k] or 0 for x in post)
        t0=sum(tot[x][k] for x in pre); t1=sum(tot[x][k] for x in post)
        res[g][k].append((s0,s1,t0,t1))
    res[g]['jump'].append(j)
for g in res:
    r=res[g]; 
    if not cnt[g]: continue
    print(f'\n{g}: событий без рекламы с полной воронкой {cnt[g]}, скачок цены медиана {(math.exp(S.median(r["jump"]))-1)*100:+.0f}%')
    pos=r['pos']; print(f'  позиция: медиана после/до {math.exp(S.median(pos)):.2f} (меньше 1 = выше в поиске), n={len(pos)}')
    for k in ('search_views','hits_to_cart','ordered_units'):
        s0=sum(x[0] for x in r[k]); s1=sum(x[1] for x in r[k]); t0=sum(x[2] for x in r[k]); t1=sum(x[3] for x in r[k])
        print(f'  {k:14} сумма 7 дн {s0:8.0f} -> {s1:8.0f} ({(s1/s0-1)*100 if s0 else float("nan"):+.0f}%), магазин {(t1/t0-1)*100:+.0f}%')
