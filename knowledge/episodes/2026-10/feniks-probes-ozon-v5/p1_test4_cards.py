# ФЕНИКС проба P1 (OZON v5): общие объединённые карточки у 26 снижаемых и 25 контрольных (переток из контроля в опыт
# завышает разницу пилота) и мощность замера «+25% к контролю за 14 дней» (Пуассон, разница-в-разнице лог-отношений).
# Вход: /tmp/ozon-v5/list26.json (выход list26.py автора), card_groups.json, orders_daily.ndjson.
import json, collections as C, math
R = '/home/user/t1/'
lst = json.load(open('/tmp/ozon-v5/list26.json'))
T = {o['art'] for o in lst if o['step'] > 0}; K = {o['art'] for o in lst if o['step'] == 0}
print('опыт', len(T), 'контроль', len(K))
cg = json.load(open(R + 'analytics-mvp/data/card_groups.json'))['groups']
off2g = {s['offer']: g['model'] for g in cg for s in g['skus']}
gT = C.defaultdict(list); gK = C.defaultdict(list)
for a in T: gT[off2g.get(a, 'нет карточки')].append(a)
for a in K: gK[off2g.get(a, 'нет карточки')].append(a)
shared = [g for g in gT if g in gK and g != 'нет карточки']
print('карточек у опыта', len([g for g in gT if g != 'нет карточки']), '; у контроля', len([g for g in gK if g != 'нет карточки']),
      '; общих', len(shared))
O = [json.loads(l) for l in open(R + 'analytics-mvp/data/orders_daily.ndjson')]
off = json.load(open(R + 'analytics-mvp/data/sku_offer.json'))
sku2off = off if all(isinstance(v, str) for v in list(off.values())[:5]) else {k: v.get('offer') for k, v in off.items()}
U = C.Counter()
for o in O:
    if '2026-09-14' <= o['d'] <= '2026-10-11' and o['status'] != 'cancelled':
        U[sku2off.get(str(o['sku'])) or str(o['sku'])] += o['units']
uT = sum(U[a] for a in T); uK = sum(U[a] for a in K)
print('заказы за 4 недели базы: опыт', uT, '(%.1f в нед)' % (uT / 4), '; контроль', uK, '(%.1f в нед)' % (uK / 4))
print('заказы контроля в общих с опытом карточках:', sum(U[a] for g in shared for a in gK[g]), 'из', uK)
t2, k2 = uT / 2, uK / 2
for lift in (0.10, 0.25):
    se = math.sqrt(1 / t2 + 1 / (t2 * (1 + lift)) + 2 / k2)
    print(f'  2 нед до/после: опыт {t2:.1f} шт, контроль {k2:.1f} шт; эффект +{lift:.0%}: z={math.log(1 + lift) / se:.2f}; '
          f'MDE (80%, 5%) = +{math.exp(2.8 * se) - 1:.0%}')
