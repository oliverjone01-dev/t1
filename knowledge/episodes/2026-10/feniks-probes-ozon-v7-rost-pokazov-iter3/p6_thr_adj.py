# P6: порог 29.10 с поправкой на цену (тот же критерий 15%, база = λ с ценами на 14.10 и шагами списка 26), по сценариям эластичности
# python3 -I -B p6_thr_adj.py   (после restore_inputs.py; p4_falsekeep.py лежит рядом)
import os, io, contextlib, importlib.util
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('p4', os.path.join(here, 'p4_falsekeep.py'))
with contextlib.redirect_stdout(io.StringIO()):
    p4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(p4)
K = p4.K
def thr(lam, alpha=0.15):
    k = 0
    while K.pois_sf(k, lam) > alpha: k += 1
    return k
print('карточка              порог книги | только цены на 14.10: низ/сред/выс | + шаги списка 26: низ/сред/выс')
for i, c in enumerate(p4.cards, 1):
    a = [thr(p4.lam_price(c, sc, False)) for sc in p4.F.SCN]; b = [thr(p4.lam_price(c, sc, True)) for sc in p4.F.SCN]
    print(f"#{i:2} {c['main_art']:20} {K.threshold(c):3} | {a} | {b}")
