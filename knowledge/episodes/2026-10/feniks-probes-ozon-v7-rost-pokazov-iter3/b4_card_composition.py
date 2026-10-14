# ФЕНИКС iter3, проба B4: состав карточки, по которому считан порог 29.10 (card_groups.json), против «все товары карточки из кабинета»
# (поле declared той же выгрузки). Заказы без отмен 14.09-11.10 по товарам в группе и по всем товарам магазина с тем же card_id, если есть.
# Без прибыли по артикулам. python3 -I -B b4_card_composition.py
import sys, os, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
G = {g['main']: g for g in json.load(open(F.D + 'card_groups.json'))['groups']}
o_all = C.Counter(); o_can = C.Counter()
for o in F.L('orders_daily.ndjson'):
    if F.A <= o['d'] <= F.B:
        (o_can if o['status'] == 'cancelled' else o_all)[o['sku']] += o['units']
print('ключи строки orders_daily:', sorted(next(iter(F.L('orders_daily.ndjson'))).keys()))
print(f"{'карточка':12} {'главный':22} {'в группе':>8} {'declared':>8} {'заказов 4нед':>12} {'порог':>5}")
for c in K.cards[:10]:
    g = G[c['card']]
    print(f"{c['card']:12} {c['main_art']:22} {len(g['skus']):8} {g.get('declared', '-')!s:>8} {sum(o_all[s['sku']] for s in g['skus']):12} {K.threshold(c):5}")
# товары магазина, у которых в заказах есть sku, не входящий ни в одну группу
in_groups = {s['sku'] for g in G.values() for s in g['skus']}
outside = {s: u for s, u in o_all.items() if s not in in_groups}
print('заказов 14.09-11.10 без отмен: всего', sum(o_all.values()), '; у товаров вне card_groups:', sum(outside.values()), 'шт,', len(outside), 'товаров')
print('сумма declared по 35 группам:', sum(g.get('declared', 0) for g in G.values()), '; товаров в группах:', len(in_groups))
