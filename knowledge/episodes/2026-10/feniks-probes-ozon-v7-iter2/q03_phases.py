# ФЕНИКС iter2, проба Q03: (1) фаза 1 - вклад уреза клика и цены по отдельности (модель v5 как есть);
# (2) фаза 2 - минимакс сожаления, чувствительность к остатку эластичности на заказах рекламы (E1) и к сетке долей своих;
# (3) доля заказов карточек KONUX/KUVINO среди артикулов цены. Печатает только суммы по магазину и доли, без прибыли по артикулам.
import sys, json, math, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P

def ph1(sc, keep, cut_week, rate=False):
    F.RATE = rate
    b0 = {k: v / F.H for k, v in F.run('В0', sc).items()}
    S_ = C.Counter()
    for t in range(4):
        x = F.run('В1б', sc, cut=cut_week(t), keep=keep)
        for k in ('prof', 'prof_adm', 'units'): S_[k] += x[k] / F.H
    F.RATE = False
    return {k: (S_[k] - 4 * b0[k]) for k in S_}

K1v = P.ACTIVE - (P.EXP - P.LAD_IDS)
price = lambda t: P.NOW if t == 0 else set(F.lst)
noprice = lambda t: set()
print('== фаза 1, 4 недели, тыс. ₽ против «как сейчас»: 1в (цена + урез 7) | только урез 7 без цены | только цена (1а) | вклад цены = 1в - урез')
for rate in (False, True):
    for sc in F.SCN:
        a = ph1(sc, K1v, price, rate); b = ph1(sc, K1v, noprice, rate); c = ph1(sc, P.ACTIVE, price, rate)
        print(f'  {"темп" if rate else "ср4н"} {sc:8} 1в {a["prof"]/1e3:+6.0f} (с АДМ {a["prof_adm"]/1e3:+5.0f}) | урез {b["prof"]/1e3:+6.0f} (с АДМ {b["prof_adm"]/1e3:+5.0f}) '
              f'| цена {c["prof"]/1e3:+6.0f} (с АДМ {c["prof_adm"]/1e3:+5.0f}) | вклад цены {(a["prof"]-b["prof"])/1e3:+6.0f} (с АДМ {(a["prof_adm"]-b["prof_adm"])/1e3:+5.0f})')

# ---------------- фаза 2
LAD = P.LAD; W_NOW = P.W_NOW
def step_of(a): return F.lst[F.art2sku[a]]['step'] / 100
def val(a, w, k, f=1.0):
    return k * f * (P.mu(a, w) - P.mu(a, F.MIN_WK)) * P.pi_cut(a) - (w - F.MIN_WK)
def table(kgrid, eps_grid=None):
    out = {}
    for name, ws in (('А', {a: F.MIN_WK for a in LAD}), ('Б', W_NOW), ('Д', P.D_W)):
        r = []
        for j, k in enumerate(kgrid):
            tot = 0
            for a in LAD:
                f = (1 - step_of(a)) ** eps_grid[j] if eps_grid else 1.0
                tot += 6 * (val(a, ws[a], k, f) - val(a, W_NOW[a], k, f))
            r.append(tot)
        out[name] = r
    return out
def regret(tab):
    n = len(next(iter(tab.values())))
    best = [max(v[j] for v in tab.values()) for j in range(n)]
    return {k: max(best[j] - v[j] for j in range(n)) for k, v in tab.items()}
K = [F.K_CLK[s] for s in F.SCN]; E = [F.EPS[s] for s in F.SCN]
print('\n== фаза 2 (А, Б, Д), 6 недель, тыс. ₽ против Б; наибольшее сожаление')
for lab, kg, eg in (('как в записке, k 0/0,5/1', K, None), ('E1: заказы рекламы x (1-шаг)^ε, k 0/0,5/1', K, E),
                    ('k 0,3/0,5/1 (сетка v8)', [0.3, 0.5, 1.0], None), ('k 0/0,25/0,5 (без 100% своих)', [0, 0.25, 0.5], None)):
    t = table(kg, eg); r = regret(t)
    print(f'  {lab:42}', '  '.join(f'{n} ' + '/'.join(f'{x/1e3:+.0f}' for x in v) + f' (сожал. {r[n]/1e3:.0f})' for n, v in t.items()))
# лучший бюджет по минимаксу сожаления на сетке бюджетов (общий k для обоих товаров), k 0/0,5/1 и E1
def grid_best(kgrid, eps_grid=None):
    W = list(range(2000, 40001, 1000))
    cand = {}
    for w1 in W:
        for w2 in W:
            ws = {'GGT-35-5-1-100-180': w1, 'GGM-18-2-2': w2}
            r = []
            for j, k in enumerate(kgrid):
                tot = 0
                for a in LAD:
                    f = (1 - step_of(a)) ** eps_grid[j] if eps_grid else 1.0
                    tot += 6 * (val(a, ws[a], k, f) - val(a, W_NOW[a], k, f))
                r.append(tot)
            cand[(w1, w2)] = r
    n = len(kgrid); best = [max(v[j] for v in cand.values()) for j in range(n)]
    reg = {w: max(best[j] - v[j] for j in range(n)) for w, v in cand.items()}
    wb = min(reg, key=reg.get)
    return wb, reg[wb], reg[(10000, 5000)]
print('\n== бюджет KONUX/KUVINO с наименьшим наибольшим сожалением (сетка 2 000-40 000 шаг 1 000):')
for lab, kg, eg in (('k 0/0,5/1', K, None), ('E1', K, E)):
    wb, rb, rd = grid_best(kg, eg)
    print(f'  {lab:10} лучший {wb} сожаление {rb/1e3:.0f} тыс.; у Д (10 000 / 5 000) {rd/1e3:.0f} тыс.')

# ---------------- TRUBIS: окупаемость при малом бюджете (k = 1)
a = 'GGT-03-3-3-E-16080'
print('\n== TRUBIS: доля своих для окупаемости при бюджете (k нужно):', [(w, round(P.kbe(a, w), 2)) for w in (2100, 2500, 3000, 5000, 10000)])

# ---------------- доля заказов карточек KONUX и KUVINO среди артикулов цены
G = json.load(open(F.D + 'card_groups.json'))['groups']
card = {s['sku']: g['main'] for g in G for s in g['skus']}
KK = {'6279981715', '4714207903'}
for lab, S in (('16 артикулов 15.10', P.NOW), ('26 артикулов', set(F.lst))):
    u = sum(F.U[s] for s in S) / F.WEEKS; uk = sum(F.U[s] for s in S if card.get(s) in KK) / F.WEEKS
    print(f'  {lab}: заказов в неделю {u:.2f}, из них в карточках KONUX и KUVINO {uk:.2f} ({uk/u:.0%})')
