# v5: замер пилота цены (G2 ФЕНИКСА): опыт - карточки целиком (объединённые карточки card_groups.json, одиночный товар -
# сам себе карточка), в которых есть хотя бы один из 26 артикулов; контроль - остальные карточки магазина с заказами,
# без карточек теста 4. Переток внутри карточки остаётся внутри опыта. Мощность: разность разностей по Пуассону,
# se(log) = sqrt(1/T0 + 1/T1 + 1/C0 + 1/C1), MDE = exp((1,96 + 0,84) x se) - 1 (80% мощность, 5% двусторонний).
# Запуск: python3 -I pilot.py (после list26.py)
import json, collections as C, math
D = '/home/user/t1/analytics-mvp/data/'
A, B, WEEKS = '2026-09-14', '2026-10-11', 4
cg = json.load(open(D + 'card_groups.json'))['groups']
card = {}
for g in cg:
    for x in g['skus']: card[x['sku']] = g['main']
T4 = {'GGT-03-1-3-E-12080', 'GGT-20-2-3-16080', 'GGT-03-3-5-L-90', 'GGM-16-2-3-LED', 'GGM-15-2-2', 'GGM-23-1-1', 'GGL-05-XL-slim-2',
      'GGM-18-1-1-LED', 'GGK-02-3-3-80', 'GGK-05-2-3-7040'}                          # decisions.md 2026-10-01
lst = [o for o in json.load(open('/tmp/ozon-v5/list26.json')) if o['step'] > 0]
U = C.Counter(); off = {}
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l); off[o['sku']] = o['offer']
    if A <= o['d'] <= B and o['status'] != 'cancelled': U[card.get(o['sku'], o['sku'])] += o['units']
t4_cards = {card.get(s, s) for s, a in off.items() if a in T4}
both = [o['art'] for o in lst if card.get(o['sku'], o['sku']) in t4_cards]
print('артикулы из 26 в одной карточке с товарами теста 4 (ждут конца теста 4):', both)
all26 = {card.get(o['sku'], o['sku']) for o in lst}
share26 = sum(U[c] for c in all26) / sum(U.values())
print(f'карточки всех 26 артикулов: {len(all26)}, заказов {sum(U[c] for c in all26)} из {sum(U.values())} ({share26:.0%}) магазина')
lst = [o for o in lst if o['art'] not in both]
cut_cards = {card.get(o['sku'], o['sku']) for o in lst}
T = sum(U[c] for c in cut_cards); Cc = sum(v for c, v in U.items() if c not in cut_cards and c not in t4_cards)
print(f'снижаем сейчас {len(lst)}; карточек опыта {len(cut_cards)}: заказов за 4 недели {T}; контроль (остальной магазин без теста 4): {Cc}; карточки теста 4: {sum(U[c] for c in t4_cards)}')
res = {}
for w in (2, 4, 6):
    t, c = T / WEEKS * w, Cc / WEEKS * w
    se = math.sqrt(2 / t + 2 / c); mde = math.exp(2.8 * se) - 1
    res[w] = mde
    print(f'окно {w} нед до и {w} после: опыт ~{t:.0f} заказов, контроль ~{c:.0f}; заметный рост (MDE) +{mde:.0%}')
json.dump(dict(cards=len(cut_cards), T=T, C=Cc, mde=res, wait=both, n_now=len(lst), share26=share26, store=sum(U.values())), open('/tmp/ozon-v5/pilot.json', 'w'))
