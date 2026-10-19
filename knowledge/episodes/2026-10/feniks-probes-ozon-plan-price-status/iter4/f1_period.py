# ФЕНИКС iter4 (ba5b560). F1 после v7: цвет «Заказов 10 карточек» и «Заказов магазина» = факт с 15.10 к плану на дату
# (>= 100% зелёный, 70-100 жёлтый, < 70 красный), без допуска и без «рано» в первые дни периода.
# Монте-Карло: заказы по дням 15-31.10 Пуассоном, темп = план на день x k (k = 1,0 ровно в план; 1,1; 0,9). Сид фиксирован, 20 000 периодов.
# python3 -I f1_period.py <dataDir>
import json, sys, random, math
P = json.load(open(sys.argv[1] + '/plan_2026-10-15_v3.json', encoding='utf-8'))
R = random.Random(20261015); N = 20000
g = P['goal']['units']['oct']
gp = lambda d: g['lo'] / 31 * d + (g['mid'] - g['lo']) * max(0, min(15, d - 16)) / 15
card_day = [sum(c['threshold'] for c in P['cards']) / 14] * 17
store_day = [gp(d) - gp(d - 1) for d in range(15, 32)]
def pois(l):
    if l > 30:   # нормальное приближение для больших средних
        return max(0, round(R.gauss(l, math.sqrt(l))))
    L, k, p = math.exp(-l), 0, 1.0
    while True:
        p *= R.random()
        if p <= L: return k
        k += 1
col = lambda pct: 'g' if pct >= 100 else 'y' if pct >= 70 else 'r'
for name, plan in (('Заказы 10 карточек', card_day), ('Заказы магазина', store_day)):
    for kk in (1.0, 1.1, 0.9):
        green = [0] * 17; flips = 0; flips7 = 0
        for _ in range(N):
            cf = cp = 0.0; cols = []
            for d in range(17):
                cf += pois(plan[d] * kk); cp += plan[d]
                c = col(cf / cp * 100); cols.append(c)
                if c == 'g': green[d] += 1
            flips += sum(a != b for a, b in zip(cols, cols[1:])); flips7 += sum(a != b for a, b in zip(cols[:7], cols[1:7]))
        print(f'{name}, темп x{kk}: P(зелёный) день 1/3/7/14/17 = ' + ' / '.join(f'{green[d] / N:.0%}' for d in (0, 2, 6, 13, 16))
              + f' | смен цвета дни 1-7 {flips7 / N:.1f}, за период {flips / N:.1f}')
