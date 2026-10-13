import json,collections as C,statistics as S
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
A=L('acts_daily.ndjson')
U={a['art'] for a in A if a['date']=='2026-09-23' and a['title'].startswith('Максимальный бустинг: усил')}
E={a['art'] for a in A if a['date']=='2026-09-23' and 'Эластичный' in a['title']}
print('Усиление 23.09:',len(U),'из них в Эластичном',len(U&E))
B=C.defaultdict(dict)
for b in L('boost_daily.ndjson'): B[b['art']][b['date']]=b['parts'].get('boosting_motivation',0)
for a in sorted(U)[:6]: print(a,[(d[5:],round(v,2)) for d,v in sorted(B[a].items())[:8]])
ads=C.defaultdict(lambda:C.Counter())
for r in L('ads_sku_daily.ndjson'): ads[r['sku']][r['d']]+=r['sp']
F=C.defaultdict(dict)
for f in L('funnel_sku_daily.ndjson'): F[f['art']][f['date']]=f
a2s={a:next(iter(v.values()))['sku'] for a,v in F.items()}
def noads(a): s=a2s.get(a); return s and sum(v for d,v in ads[s].items() if '2026-08-30'<=d<='2026-09-21')==0
bef=[f'2026-09-{d:02d}' for d in range(6,13)]; aft=[f'2026-09-{d:02d}' for d in range(14,22)]
def stat(arts,dd,k,agg):
    out=[]
    for a in arts:
        x=[F[a][d][k] for d in dd if d in F[a] and F[a][d][k] is not None and (k!='search_position' or F[a][d][k]>0)]
        if x: out.append(agg(x))
    return out
grp={'Усиление, без рекламы':[a for a in U if noads(a)],'Усиление, с рекламой':[a for a in U if not noads(a)],'контроль: Эластичный, не Усиление, без рекламы':[a for a in E-U if noads(a)]}
for g,arts in grp.items():
    print(f'\n{g}: n={len(arts)}')
    p0=stat(arts,bef,'search_position',S.median); p1=stat(arts,aft,'search_position',S.median)
    pairs=[]
    for a in arts:
        x=[F[a][d]['search_position'] for d in bef if d in F[a] and F[a][d]['search_position']]
        y=[F[a][d]['search_position'] for d in aft if d in F[a] and F[a][d]['search_position']]
        if x and y: pairs.append(S.median(y)/S.median(x))
    if pairs: print(f'  позиция: медиана по товарам {S.median(p0):.0f} -> {S.median(p1):.0f}; отношение после/до медиана {S.median(pairs):.2f} (n={len(pairs)}; <1 = выше в поиске)')
    for k in ['search_views','pdp_views','hits_to_cart','ordered_units']:
        b=sum(sum(F[a][d][k] for d in bef if d in F[a]) for a in arts)/len(bef); f=sum(sum(F[a][d][k] for d in aft if d in F[a]) for a in arts)/len(aft)
        print(f'  {k:14} в день {b:9.1f} -> {f:9.1f} ({(f/b-1)*100 if b else float("nan"):+.0f}%)')
