# ФЕНИКС, итерация 2, проба 7: З8 / П4 - смешение ставки и цены для покупателя у KONUX GGT-35-5-1 около 02.10
# плюс П8 и потери на отменах: деньги против баллов
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); n = rd('netting.ndjson')
S = 'GGT-35-5-1-100-180'
print('KONUX 5-1 orders 10.09-12.10: created | price | p_buyer | p_mp | mp share | status')
for r in sorted((r for r in o if not r['service'] and r['sku'] == S and r['created'] >= '2026-09-10'), key=lambda r: r['created']):
    print(' ', r['created'], r['price'], r['p_buyer'], r['p_mp'], f"{r['p_mp'] / r['price']:.0%}", r['status'])
print('KONUX 5-1 daily views/pdp/units 22.09-12.10:')
dv = collections.defaultdict(lambda: [0, 0, 0])
for r in sv:
    if not r.get('aggregate') and r['sku'] == S and '2026-09-22' <= r['date'] <= '2026-10-12':
        dv[r['date']][0] += r['views']; dv[r['date']][1] += r['pdp']; dv[r['date']][2] += r['units']
print(' ', [(d[5:], v[0], v[1], v[2]) for d, v in sorted(dv.items())])
# other KONUX 100-180 variants: did their views also jump on 02.10 (no rate change known)?
for s in ('GGT-35-1-3-100-180', 'GGT-35-3-3-100-180', 'GGT-35-2-3-100-180'):
    pre = [0, 0]; post = [0, 0]
    for r in sv:
        if not r.get('aggregate') and r['sku'] == s and '2026-09-07' <= r['date'] <= '2026-10-12':
            t = pre if r['date'] < '2026-10-02' else post
            t[0] += r['views']; t[1] += 1
    print('  views/day', s, 'before 02.10', round(pre[0] / max(pre[1], 1)), 'from 02.10', round(post[0] / max(post[1], 1)))
# П8 and cancellation costs: money (Удержание) vs points (Списание), Q
Q = ('2026-07', '2026-08', '2026-09')
for s in ('Отгрузка или доставка не вовремя', 'Отмена заказа по вине продавца', 'Доставка (средняя миля)', 'Доставка невыкупов и возвратов'):
    m = sum(-r['amount'] for r in n if r['service'] == s and r['type'] == 'Удержание' and r['d'][:7] in Q)
    pt = sum(-r['amount'] for r in n if r['service'] == s and r['type'] == 'Списание' and r['d'][:7] in Q)
    print(f'  {s}: money {m:,.0f}, points {pt:,.0f}, total {m + pt:,.0f}')
