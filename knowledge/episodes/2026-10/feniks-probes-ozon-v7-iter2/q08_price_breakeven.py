# ФЕНИКС iter2, проба Q08: при какой эластичности цена фазы 1 (1а: 16 артикулов неделя 1, 26 - недели 2-4, клик как есть)
# выходит в ноль в модели записки - без АДМ и с АДМ 30%; переток 25% (средний) и 0% (высокий). Для сравнения с порогом книги v8.
import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P

def price4(eps, xf, key):
    old = dict(F.XFER); F.XFER['средний'] = xf
    b0 = F.run('В0', 'средний', eps=eps)[key] / F.H
    s = 0
    for t in range(4):
        s += F.run('В1б', 'средний', eps=eps, cut=P.NOW if t == 0 else set(F.lst), keep=P.ACTIVE)[key] / F.H
    F.XFER.clear(); F.XFER.update(old)
    return s - 4 * b0
for key in ('prof', 'prof_adm'):
    for xf in (0.25, 0.0):
        prev = None; be = None
        for i in range(0, 801):
            e = -i / 100; d = price4(e, xf, key)
            if prev is not None and (d > 0) != (prev > 0): be = e; break
            prev = d
        print(f'{key:8} переток {xf:.0%}: цена 4 недели в ноль при ε = {be}')
