# ФЕНИКС iter3 (e063381). F1 после W5: «Карточки на пути» теперь по окну 15-28.10 (правило таблицы 1), дни 1-2 «рано».
# Монте-Карло по правилу кода: на день n (3..14) карточка на пути, если заказы окна >= round(порог x n / 14, 1);
# цвет спидометра: >= 5 зелёный, 4 жёлтый, <= 3 красный. Сценарии: ровно в план (Пуассон порог/14), +20%, без эффекта (база/7).
# Сид фиксирован, 20 000 окон. Сравнение с iter2 (месяц): 2,3 смены цвета за дни 1-7, 7,5 за месяц.
# python3 -I f1_window.py <dataDir>
import json, sys, random, math
P = json.load(open(sys.argv[1] + '/plan_2026-10-15_v3.json', encoding='utf-8'))
cards = P['cards']; R = random.Random(20261015); N = 20000
def pois(l):
    L, k, p = math.exp(-l), 0, 1.0
    while True:
        p *= R.random()
        if p <= L: return k
        k += 1
def color(n): return 'g' if n >= 5 else 'y' if n >= 4 else 'r'
for name, rate in (('ровно в план (порог/14)', lambda c: c['threshold'] / 14), ('+20% к плану', lambda c: 1.2 * c['threshold'] / 14),
                   ('без эффекта (база/7)', lambda c: c['u_wk_base'] / 7)):
    green = [0] * 14; flips = 0; flips37 = 0; final_g = 0; pass_ge5 = 0; agree = 0
    for _ in range(N):
        cum = [0] * len(cards); cols = []
        for d in range(14):
            for i, c in enumerate(cards): cum[i] += pois(rate(c))
            if d < 2: continue
            need = [round(c['threshold'] * (d + 1) / 14, 1) for c in cards]
            col = color(sum(f >= n for f, n in zip(cum, need))); cols.append(col)
            if col == 'g': green[d] += 1
        flips += sum(a != b for a, b in zip(cols, cols[1:])); flips37 += sum(a != b for a, b in zip(cols[:5], cols[1:5]))
        passed = sum(f >= c['threshold'] for f, c in zip(cum, cards)); pass_ge5 += passed >= 5
        final_g += cols[-1] == 'g'; agree += (cols[-1] == 'g') == (passed >= 5)
    print(f'{name}: P(зелёный) день 3/5/7/10/14 = ' + ' / '.join(f'{green[d] / N:.0%}' for d in (2, 4, 6, 9, 13))
          + f' | смен цвета дни 3-7 {flips37 / N:.1f}, дни 3-14 {flips / N:.1f} | день 14: зелёный {final_g / N:.0%}, прошли >= 5 {pass_ge5 / N:.0%},'
          f' спидометр = правило 29.10 в {agree / N:.0%}')
