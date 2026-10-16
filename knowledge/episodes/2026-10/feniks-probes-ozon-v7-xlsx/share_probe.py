import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
wave_cards = {'4755940427','6185355035','6185323281','4756842305','4756828433','4756853473','5997653416','4756838405','4755940419','4756846140','4755940400','4755941263'}
cut_cards = {P.camp_card(F.camp[k]) for k in (P.EXP - P.LAD_IDS)} | {'4756834245'}
o = C.Counter(); tot = 0
for r in F.L('orders_daily.ndjson'):
    if F.A <= r['d'] <= F.B and r['status'] != 'cancelled':
        cd = P.card.get(r['sku']); tot += r['units']
        g = 'price' if cd in P.PCARDS else 'wave2' if cd in wave_cards else 'cut' if cd in cut_cards else 'rest'
        o[g] += r['units']
print('заказы 14.09-11.10 без отмен', tot, dict(o))
rest_all = tot - o['price']
print('доля карточек волны 2 в «остальном магазине» (всё, кроме карточек цены):', f"{o['wave2'] / rest_all:.0%}", '| доля карточек цены в магазине:', f"{o['price'] / tot:.0%}")
print('cut cards', cut_cards, 'in PCARDS:', [c in P.PCARDS for c in cut_cards])
