# ФЕНИКС iter7 (голова 20b2d08): строгий отбор, недели -2, -1, +1 на одной выборке (воронка -14..+7, без рекламы -17..+10).
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_strict_same.py
import runpy,io,contextlib,collections as C
buf=io.StringIO()
with contextlib.redirect_stdout(buf):
    g=runpy.run_path('/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_strict.py')
kept,F,ads,win=g['kept'],g['F'],g['ads'],g['win']
tot=C.defaultdict(C.Counter)
for a in F:
    for d,r in F[a].items():
        for k in ('search_views','hits_to_cart','ordered_units'): tot[d][k]+=r[k] or 0
for gname,sign in (('вниз',True),('вверх',False)):
    es=[(a,d,j) for a,d,j in kept if (j<0)==sign and a in F and not any(x in ads[a] for x in win(d,-17,11)) and all(x in F[a] for x in win(d,-14,0)+win(d,1,8))]
    n=len(es); print(f'{gname}: одна выборка n={n}')
    for k,nm in (('search_views','показы'),('hits_to_cart','корзины'),('ordered_units','заказы')):
        s=[sum(sum(F[a][x][k] or 0 for x in win(d,a0,b0)) for a,d,j in es) for a0,b0 in ((-14,-7),(-7,0),(1,8))]
        t=[sum(sum(tot[x][k] for x in win(d,a0,b0)) for a,d,j in es) for a0,b0 in ((-14,-7),(-7,0),(1,8))]
        r1=(s[1]/s[0])/(t[1]/t[0])-1 if s[0] else float('nan'); r2=(s[2]/s[1])/(t[2]/t[1])-1 if s[1] else float('nan')
        print(f'  {nm}: нед-2 {s[0]}, нед-1 {s[1]}, нед+1 {s[2]}; к магазину: до скачка {r1:+.0%}, после {r2:+.0%}')
