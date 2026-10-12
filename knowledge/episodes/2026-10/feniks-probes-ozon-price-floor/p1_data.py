# ФЕНИКС проба P1: семантика полей и покрытие входов floor.py (только чтение данных)
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
O = L('orders_daily.ndjson')
DO = L('delivery_orders.ndjson')
BD = L('buyer_delivery_orders.ndjson')
print('orders_daily: строк', len(O), 'даты', min(o['d'] for o in O), '..', max(o['d'] for o in O))
print('статусы', C.Counter(o['status'] for o in O).most_common())
# 1. deliv vs bd
bd = {x['order']: x.get('bd') for x in BD}
both = eq = 0; diffs = []
for x in DO:
    base = x['order'].rsplit('-', 1)[0]
    b = bd.get(base)
    if b is None or not x.get('deliv'):
        continue
    both += 1
    if abs(b - x['deliv']) < 1: eq += 1
    else: diffs.append((x['order'], x['deliv'], b))
print('\n[1] delivery_orders.deliv vs buyer_delivery_orders.bd: пар', both, 'совпало до рубля', eq, 'расхождений', len(diffs), diffs[:5])
print('    deliv>0 строк', sum(1 for x in DO if x.get('deliv')), 'из', len(DO), '; ship>0', sum(1 for x in DO if x.get('ship')))
# 2. ads и корзины в payout
dl = [o for o in O if o['status'] == 'delivered' and o['revenue'] > 0 and o['d'] >= '2026-06-01']
print('\n[2] доставленные с 01.06:', len(dl), 'ads!=0:', sum(1 for o in dl if o.get('ads')))
tot = C.Counter()
for o in dl:
    for k in ('revenue', 'commission', 'delivery', 'acquiring', 'storage', 'buyer_delivery', 'ads', 'partner', 'other', 'payout'):
        tot[k] += o.get(k) or 0
    tot['paid'] += o.get('paid') or 0
    tot['paid_n'] += 1 if o.get('paid') else 0
for k, v in tot.items(): print('   ', k, round(v), '%.3f' % (v / tot['revenue']) if k not in ('paid_n',) else '')
chk = sum(abs(o['payout'] - (o['revenue'] + o['commission'] + o['delivery'] + o['acquiring'] + o['storage'] + o['ads'] + o['partner'] + o['other'])) > 2 for o in dl)
print('    payout != revenue+сборы (без buyer_delivery):', chk)
# 3. схема доставки
print('\n[3] схема доставки (доставленные с 01.06):', C.Counter(o['scheme'] for o in dl).most_common())
# 4. ключи заказов floor.py:19-20
ship = {x['order']: x for x in DO}
hit = C.Counter()
for o in dl:
    s = ship.get(o['order']) or ship.get(o['order'] + '-1')
    hit[(o['scheme'], bool(s))] += 1
print('\n[4] доставленные с 01.06 со строкой ведомости (схема, найдено):', sorted(hit.items()))
# 5. многоштучные и мульти-SKU постинги (строка orders_daily несёт только top sku)
mu = [o for o in dl if o['units'] > 1]
print('\n[5] доставленных с 01.06 с units>1:', len(mu), 'из', len(dl))
