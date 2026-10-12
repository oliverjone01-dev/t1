# ФЕНИКС проба P3: что такое p0 (prices_daily.price) и s (gap_daily.site_to_seller) относительно
# выручки заказа (revenue = цена в постинге) и оплаты покупателя (paid)
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
P = L('prices_daily.ndjson'); G = L('gap_daily.ndjson'); O = L('orders_daily.ndjson')
pk = {(r['d'], r['offer']): r for r in P}
cmp = C.defaultdict(list)
for g in G:
    p = pk.get((g['date'], g['art']))
    if not p: continue
    s = g['site_to_seller']
    cmp['s / (price/before)'].append(s / (p['price'] / p['before']))
    if p.get('paid'):
        cmp['s / (paid/price)'].append(s / (p['paid'] / p['price']))
        cmp['s / (paid/before)'].append(s / (p['paid'] / p['before']))
for k, v in cmp.items():
    v.sort(); print('[P3a]', k, 'n', len(v), 'медиана %.3f, p10 %.3f, p90 %.3f' % (v[len(v)//2], v[len(v)//10], v[9*len(v)//10]))
# revenue/units заказа против price и before снимка в день заказа (заказы с 19.09)
rr = C.defaultdict(list)
for o in O:
    if o['d'] < '2026-09-19' or o['status'] == 'cancelled' or o['units'] != 1: continue
    p = pk.get((o['d'], o['offer']))
    if not p: continue
    rr['revenue/price'].append(o['revenue'] / p['price'])
    rr['revenue/before'].append(o['revenue'] / p['before'])
    if o.get('paid'):
        rr['paid/(price*s)'].append(o['paid'])
for k in ('revenue/price', 'revenue/before'):
    v = sorted(rr[k]); print('[P3b]', k, 'n', len(v), 'медиана %.3f, p10 %.3f, p90 %.3f, доля в [0.98,1.02]: %.2f' % (
        v[len(v)//2], v[len(v)//10], v[9*len(v)//10], sum(0.98 <= x <= 1.02 for x in v) / len(v)))
# оплата покупателя к revenue против s из gap_daily в день заказа
gk = {(g['date'], g['art']): g['site_to_seller'] for g in G}
q = []
for o in O:
    if o['status'] == 'cancelled' or not o.get('paid') or o['units'] != 1: continue
    s = gk.get((o['d'], o['offer']))
    if s is None: continue
    q.append((o['paid'] / o['revenue']) / s)
q.sort(); print('[P3c] (paid/revenue)/s в день заказа: n', len(q), 'медиана %.3f p10 %.3f p90 %.3f' % (q[len(q)//2], q[len(q)//10], q[9*len(q)//10]) if q else '')
# сколько из 171 товаров floor_rows имеют price < before (сейчас в акции продавца) в последнем снимке
rows = json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))
last = {}
for r in P: last[r['offer']] = r
lt = [last[r['art']] for r in rows]
print('[P3d] 171 товар: дата снимка цены', C.Counter(x['d'] for x in lt).most_common(3),
      '; price<before у', sum(x['price'] < x['before'] for x in lt), '; медиана price/before %.3f' % S.median(x['price'] / x['before'] for x in lt))
lg = {}
for g in G: lg[g['sku']] = g
print('[P3e] 171 товар: дата s', C.Counter(lg[r['sku']]['date'] for r in rows).most_common(3), '; s>=0.95 у', sum(r['s'] >= 0.95 for r in rows), '; медиана s %.3f' % S.median(r['s'] for r in rows))
