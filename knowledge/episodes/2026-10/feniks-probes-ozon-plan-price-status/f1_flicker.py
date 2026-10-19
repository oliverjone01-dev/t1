# ФЕНИКС iter2 (3810a26). F1: «на пути» в первые дни месяца мигает? Монте-Карло по правилу кода
# (cmOn = число карточек с фактом с 1-го числа >= план на дату; спидометр: >= 5 зелёный «идём», 4 жёлтый, <= 3 красный).
# Сценарий «ровно в план»: каждая карточка в ноябре получает заказы Пуассоном со средним порог/14 в день (как план кода).
# Сценарий «без эффекта»: среднее u_wk_base/7 (откат или эффекта нет). Сид фиксирован, 20 000 месяцев.
# python3 -I f1_flicker.py <dataDir>
import json, sys, random, math
P = json.load(open(sys.argv[1] + '/plan_2026-10-15_v3.json', encoding='utf-8'))
cards = P['cards']; R = random.Random(20261015); N = 20000; DAYS = 30
def pois(l):
    L, k, p = math.exp(-l), 0, 1.0
    while True:
        p *= R.random()
        if p <= L: return k
        k += 1
def color(n): return 'g' if n >= 5 else 'y' if n >= 4 else 'r'
for name, rate in (('ровно в план (порог/14)', lambda c: c['threshold'] / 14), ('без эффекта (база/7)', lambda c: c['u_wk_base'] / 7)):
    green = [0] * DAYS; flips7 = 0; flips_all = 0
    for _ in range(N):
        cum = [0] * len(cards); prev = None; cols = []
        for d in range(DAYS):
            for i, c in enumerate(cards): cum[i] += pois(rate(c))
            plan = [c['threshold'] / 14 * (d + 1) for c in cards]
            n = sum(f >= p for f, p in zip(cum, plan)); col = color(n); cols.append(col)
            if col == 'g': green[d] += 1
        flips7 += sum(a != b for a, b in zip(cols[:7], cols[1:7]))
        flips_all += sum(a != b for a, b in zip(cols, cols[1:]))
    print(f'{name}: P(зелёный) день 1/2/3/7/14/30 = ' + ' / '.join(f'{green[d] / N:.0%}' for d in (0, 1, 2, 6, 13, 29))
          + f' | смен цвета за дни 1-7 в среднем {flips7 / N:.1f}, за месяц {flips_all / N:.1f}')
