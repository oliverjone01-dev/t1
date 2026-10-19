# ФЕНИКС iter2, проба Q04: сверка фазы 2 (03.12 и 31.12: заказы карточек KONUX и KUVINO против 22.10-10.11, порог -30%).
# (1) заказы карточек в неделю (14.09-11.10, без отмен); (2) какое падение даёт сам урез по модели (k = 0,5 и 1);
# (3) вероятность сработать по шуму (эффект 0) и при k = 1, Пуассон, 20 000 прогонов; (4) есть ли в данных декабрь прошлого года.
import sys, json, random, math, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
G = json.load(open(F.D + 'card_groups.json'))['groups']
card = {s['sku']: g['main'] for g in G for s in g['skus']}
CARDS = {'GGT-35-5-1-100-180': '6279981715', 'GGM-18-2-2': '4714207903'}
U = C.Counter(); dmin = '9999'; dmax = ''
for l in open(F.D + 'orders_daily.ndjson'):
    o = json.loads(l); dmin = min(dmin, o['d']); dmax = max(dmax, o['d'])
    if F.A <= o['d'] <= F.B and o['status'] != 'cancelled': U[card.get(o['sku'], o['sku'])] += o['units']
print('orders_daily: даты', dmin, '-', dmax)
rnd = random.Random(20261014)
def pois(m):
    L = math.exp(-m); k = 0; p = 1.0
    while True:
        p *= rnd.random()
        if p < L: return k
        k += 1
for a, cd in CARDS.items():
    wk = U[cd] / F.WEEKS
    drop = {k: k * (P.mu(a, P.W_NOW[a]) - P.mu(a, P.D_W[a])) for k in (0.5, 1.0)}
    print(f'\n{a} карточка {cd}: заказов в неделю {wk:.2f}; урез до Д уберёт по модели: k 0,5 - {drop[0.5]:.2f} ({drop[0.5]/wk:.0%}), k 1 - {drop[1.0]:.2f} ({drop[1.0]/wk:.0%})')
    base_days = 20
    for lab, days in (('03.12 (19.11-02.12, 14 дн)', 14), ('31.12 (19.11-30.12, 42 дн)', 42)):
        for eff_lab, eff in (('эффект 0', 0.0), ('k = 1', drop[1.0] / wk)):
            n = 20000; hit = 0
            for _ in range(n):
                b = pois(wk / 7 * base_days); c = pois(wk / 7 * days * (1 - eff))
                if b > 0 and (c / days) / (b / base_days) < 0.7: hit += 1
            print(f'   {lab}, {eff_lab}: сработает «упали больше чем на 30%» в {hit/n:.0%}')
