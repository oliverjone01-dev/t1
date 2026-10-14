# ФЕНИКС iter2, проба X3b: доля карточек нового пула в контроле замера цены 10.11 и проверка 03.12 при нулевом эффекте
import sys, json, math, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
D = F.D; A, B = '2026-09-14', '2026-10-11'
pool = json.load(open('/tmp/claude-0/-home-user-t1/76dea677-6fab-5e1c-b5c2-6cb8af229fe7/scratchpad/feniks-x2/pool2.json'))
card = {x['sku']: g['main'] for g in json.load(open(D + 'card_groups.json'))['groups'] for x in g['skus']}
T4 = {'GGT-03-1-3-E-12080', 'GGT-20-2-3-16080', 'GGT-03-3-5-L-90', 'GGM-16-2-3-LED', 'GGM-15-2-2', 'GGM-23-1-1', 'GGL-05-XL-slim-2',
      'GGM-18-1-1-LED', 'GGK-02-3-3-80', 'GGK-05-2-3-7040'}                       # как ctl_probe.py iter1 (pilot.py:2-3)
U = C.Counter(); off = {}
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l); off[o['sku']] = o['offer']
    if A <= o['d'] <= B and o['status'] != 'cancelled': U[card.get(o['sku'], o['sku'])] += o['units']
t4_cards = {card.get(s, s) for s, a in off.items() if a in T4}
p26 = {card.get(s, s) for s in F.lst}
Cc = sum(v for c, v in U.items() if c not in p26 and c not in t4_cards)
W = sum(U[c] for c in pool['WC']); K = sum(U[c] for c in pool['CC'])
print(f'контроль цены (остальной магазин без теста 4) {Cc} заказов за 14.09-11.10; карточки волны {W} ({W / Cc:.0%}), карточки контроля волны {K} ({K / Cc:.0%}), пул целиком {(W + K) / Cc:.0%}')
# 03.12: 2 недели, база карточек 1,0/нед в каждом плече (pool2_probe) -> Пуассон(2) против Пуассон(2)
def pois(m, k): return math.exp(-m) * m ** k / math.factorial(k)
def p_diff_ge(m1, m2, d):
    return sum(pois(m1, i) * pois(m2, j) for i in range(60) for j in range(60) if i - j >= d)
for lbl, add in (('эффекта нет', 0.0), ('перенос теста 1 30%', 0.3 * 0.55 * 6 * 2), ('перенос теста 1 100%', 0.55 * 6 * 2)):
    print(f'{lbl}: волна выше контроля {p_diff_ge(2 + add, 2, 1):.0%}; волна выше на 2+ заказа (прирост окупает 2 недели расхода) {p_diff_ge(2 + add, 2, 2):.0%}')
