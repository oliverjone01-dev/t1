# ФЕНИКС проба X3: контроль замера цены 10.11 («остальной магазин без теста 4», pilot.py) и волна 2
import sys, json, math, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
D = F.D; A, B = '2026-09-14', '2026-10-11'
card = {x['sku']: g['main'] for g in json.load(open(D + 'card_groups.json'))['groups'] for x in g['skus']}
T4 = {'GGT-03-1-3-E-12080', 'GGT-20-2-3-16080', 'GGT-03-3-5-L-90', 'GGM-16-2-3-LED', 'GGM-15-2-2', 'GGM-23-1-1', 'GGL-05-XL-slim-2',
      'GGM-18-1-1-LED', 'GGK-02-3-3-80', 'GGK-05-2-3-7040'}
U = C.Counter(); off = {}
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l); off[o['sku']] = o['offer']
    if A <= o['d'] <= B and o['status'] != 'cancelled': U[card.get(o['sku'], o['sku'])] += o['units']
t4_cards = {card.get(s, s) for s, a in off.items() if a in T4}
p26 = {card.get(s, s) for s in F.lst}
wave_cards = {'4755940427','6185355035','6185323281','4756842305','4756828433','4756853473','5997653416','4756838405','4755940419','4756846140','4755940400','4755941263'}
T = sum(U[c] for c in p26); Cc = sum(v for c, v in U.items() if c not in p26 and c not in t4_cards)
Wc = sum(U[c] for c in wave_cards if c not in p26 and c not in t4_cards)
print(f'опыт (26 артикулов, карточки) {T} заказов за 4 нед; контроль без теста 4 {Cc}; из них карточки волны 2 вне теста 4 {Wc} ({Wc/Cc:.0%}); волна 2 в карточке теста 4: {sorted(wave_cards & t4_cards)}')
T2, C2 = T / 2, Cc / 2                      # 2 недели, как doc_data.py:82
se2 = math.sqrt(2 / T2 + 2 / C2); N = lambda z: 0.5 * (1 + math.erf(z / math.sqrt(2)))
print(f'ложный откат при нулевом эффекте цены, без волны 2: {N(math.log(0.5) / se2):.0%}')
for lbl, add_wk in (('волна 2 = 40% эффекта теста 1 (база слабее)', 0.4 * 12.6 / 23 * 7 / 7 * 20), ('волна 2 = тест 1 на товар', 12.6 / 23 * 7 / 7 * 20)):
    L = (Cc / 4 + add_wk) / (Cc / 4)
    print(f'{lbl}: +{add_wk:.1f} заказа/нед к контролю {Cc/4:.1f}/нед -> контроль x{L:.2f}; ложный откат {N((math.log(0.5) + math.log(L)) / se2):.0%}')
