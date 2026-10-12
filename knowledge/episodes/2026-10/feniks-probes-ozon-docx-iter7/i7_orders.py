# ФЕНИКС iter7: заказы и корзины при снижении цены на одной выборке (main ∩ placebo) против недели -2, по датам-кучам.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_orders.py
import runpy,io,contextlib,collections as C
buf=io.StringIO()
with contextlib.redirect_stdout(buf):
    g=runpy.run_path('/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_acts.py')
M,PL,sums=g['M'],g['PL'],g['sums']
cm=[e for e in M['вниз'] if e in set(PL['вниз'])]
top=[d for d,_ in C.Counter(d for a,d,j in cm).most_common(5)]
groups=[(d,[e for e in cm if e[1]==d]) for d in top]+[('прочие',[e for e in cm if e[1] not in top])]
for k,nm in (('ordered_units','заказы'),('hits_to_cart','корзины')):
    print(nm)
    for lab,es in groups:
        n=len(es); w0=sums(es,-14,-7,k); w2=sums(es,1,8,k)
        print(f'  {lab}: n={n}, нед-2 {w0[0]} шт, нед+1 {w2[0]} шт, магазин x{w2[1]/w0[1]:.2f}, сверх магазина {(w2[0]-w0[0]*w2[1]/w0[1])/n:+.3f} на товар в неделю')
