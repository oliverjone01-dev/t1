# ФЕНИКС: верхняя граница убытка шага 2 (если все заказы 4 товаров шага 2 давала дорогая реклама), для rework_tz
import json, statistics as st
D = '/home/user/t1/analytics-mvp/data/'
S2 = ['GGT-03-3-3-O-20090', 'GGT-03-3-3-O-18090', 'GGT-03-3-5-E-16080', 'GGT-47-3-5-90']
r = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
tot = 0.0
for a in S2:
    k = [x for x in r if x['offer'] == a and x['status'] != 'cancelled' and '2026-09-08' <= x['d'] <= '2026-10-10']
    w = [x for x in k if '2026-09-22' <= x['d'] <= '2026-10-10']
    price = st.median([x['revenue'] / x['units'] for x in k]) if k else None
    perwk = sum(x['units'] for x in w) / 19 * 7
    loss = perwk * price * 0.126 if price else 0
    tot += loss
    print(f"{a:22} orders/wk 22.09-10.10 {perwk:4.2f}  median price {price}  loss/wk at 0.126 {loss:8.0f}")
print('max loss/wk if all orders were ad-driven: %.0f; saving at 8 RUB + 2k/wk each: %.0f; profit 0.7-1x: %.0f-%.0f' % (tot, 100499 - 4 * 2000, 0.7 * (100499 - 8000), 100499 - 8000))
