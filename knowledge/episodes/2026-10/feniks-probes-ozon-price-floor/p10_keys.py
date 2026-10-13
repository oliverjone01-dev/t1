# ФЕНИКС проба P10: дедуп ключей (B3), покрытие товаров, свежесть снимков (B6), средняя против медианы доставки
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
O = L('orders_daily.ndjson'); DO = L('delivery_orders.ndjson'); BD = L('buyer_delivery_orders.ndjson')
print('[B3] orders_daily: строк', len(O), 'уникальных order', len(set(o['order'] for o in O)))
print('[B3] delivery_orders: строк', len(DO), 'уникальных', len(set(x['order'] for x in DO)), '; buyer_delivery_orders: строк', len(BD), 'уникальных', len(set(x['order'] for x in BD)))
# несколько постингов одного заказа: bd по номеру заказа вычитается у каждого постинга (floor.py:20)
dl = [o for o in O if o['status'] == 'delivered' and o['revenue'] > 0 and o['d'] >= '2026-06-01']
ship = {x['order']: x for x in DO}; bd = {x['order']: x['bd'] for x in BD}
base_cnt = C.Counter(o['order'].rsplit('-', 1)[0] for o in dl)
multi = [o for o in dl if base_cnt[o['order'].rsplit('-', 1)[0]] > 1 and (ship.get(o['order']) or ship.get(o['order'] + '-1')) and bd.get(o['order'].rsplit('-', 1)[0])]
print('[B3] доставленных постингов с 01.06, у которых в заказе >1 постинга, есть ведомость и bd по заказу:', len(multi),
      '; заказов', len(set(o['order'].rsplit('-', 1)[0] for o in multi)))
for o in multi[:6]:
    b = o['order'].rsplit('-', 1)[0]; s = ship.get(o['order']) or ship.get(o['order'] + '-1')
    print('    ', o['order'], o['sku'], 'ship', s['ship'], 'deliv', s.get('deliv'), 'bd заказа', bd.get(b))
# покрытие: товары с заказами за 60 дней и почему выпали
units = C.Counter()
for o in O:
    if o['status'] != 'cancelled' and o['d'] >= '2026-08-12': units[o['sku']] += o['units']
cogs = json.load(open(D + 'sku_cogs.json'))
G = {}; P = {}
for g in L('gap_daily.ndjson'): G[g['sku']] = (g['date'], g['site_to_seller'], g['art'])
for p in L('prices_daily.ndjson'): P[p['offer']] = (p['d'], p['price'])
why = C.Counter(); lost_u = C.Counter()
for sku, u in units.items():
    if sku not in G: why['нет в gap_daily'] += 1; lost_u['нет в gap_daily'] += u; continue
    if sku not in cogs: why['нет С/С'] += 1; lost_u['нет С/С'] += u; continue
    if G[sku][2] not in P: why['нет цены'] += 1; lost_u['нет цены'] += u; continue
    why['в модели'] += 1; lost_u['в модели'] += u
print('[cov] товаров с заказами за 60 дн', len(units), dict(why), 'штук:', dict(lost_u))
# свежесть: товары модели со снимком цены/доли старше 11.10
old = [(sku, G[sku][0], P[G[sku][2]][0], G[sku][2]) for sku in units if sku in G and sku in cogs and G[sku][2] in P and (G[sku][0] < '2026-10-11' or P[G[sku][2]][0] < '2026-10-11')]
print('[B6] в модели со снимком старше 11.10:', len(old), old)
# доставка: средняя против медианы по товару (floor берёт медиану)
sn = C.defaultdict(list)
for o in dl:
    s = ship.get(o['order']) or ship.get(o['order'] + '-1')
    if s: sn[o['sku']].append((s['ship'] - (bd.get(o['order'].rsplit('-', 1)[0]) or bd.get(o['order']) or s.get('deliv') or 0)) / max(o['units'], 1))
big = [(k, round(S.median(v)), round(sum(v) / len(v)), len(v)) for k, v in sn.items() if abs(sum(v) / len(v) - S.median(v)) > 1000]
print('[ship] товаров с ведомостью', len(sn), '; |средняя - медиана| > 1000 ₽ у', len(big), sorted(big, key=lambda x: -abs(x[2] - x[1]))[:6])
# отмены за 60 дней
o60 = [o for o in O if o['d'] >= '2026-08-12']
print('[canc] за 60 дн: заказов', len(o60), 'отменено', sum(o['status'] == 'cancelled' for o in o60), 'в пути', sum(o['status'] not in ('cancelled', 'delivered') for o in o60))
