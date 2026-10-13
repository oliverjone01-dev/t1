# ФЕНИКС проба P15: безубыточный рост заказов для полного сценария Ивана (цена ниже + дешёвая реклама 1 500 ₽/нед),
# товары БЕЗ рекламы за клик сейчас: q1*m1 - A >= q0*m0, m - вклад заказа по «Отчету» (V4: доля с 01.09, АДМ без рекламы,
# налог от оплаты). Реклама A = 1 500 ₽/нед целиком (в «Отчете» дни без продаж базу АДМ не уменьшают).
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
SP = '/tmp/feniks-floor/'; import os as _os; _os.makedirs(SP, exist_ok=True)
v0 = json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))
O = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
fee = C.defaultdict(lambda: [0, 0]); fee6 = C.defaultdict(lambda: [0, 0])
for o in O:
    if o['status'] != 'delivered' or o['revenue'] <= 0: continue
    if o['d'] >= '2026-09-01': f = fee[o['sku']]; f[0] += o['payout']; f[1] += o['revenue']
    if o['d'] >= '2026-06-01': f = fee6[o['sku']]; f[0] += o['payout']; f[1] += o['revenue']
sk09 = sum(v[0] for v in fee.values()) / sum(v[1] for v in fee.values()); sk06 = sum(v[0] for v in fee6.values()) / sum(v[1] for v in fee6.values())
keep4 = lambda r: fee[r['sku']][0] / fee[r['sku']][1] if fee[r['sku']][1] > 0 else r['keep'] * sk09 / sk06
A = 1500
for lo, hi, lab in ((0, 0.5, '<0,5'), (0.5, 1.5, '0,5-1,5'), (1.5, 99, '>1,5')):
    for c in (0.0, 0.05, 0.10):
        need = []; nn = 0
        for r in v0:
            if r['ads'] or not (lo <= r['wk'] < hi): continue
            nn += 1
            kp = keep4(r); fx = r['cogs'] + r['shipn']
            m0 = r['p0'] * (0.70 * kp - 0.05 - 0.15 * r['s'] * 0.914) - fx
            s1 = max(r['s'] - 0.065, 0.2)
            m1 = r['p0'] * (1 - c) * (0.70 * kp - 0.05 - 0.15 * s1 * 0.914) - fx
            q0 = r['wk']
            if m0 <= 0: continue
            need.append((q0 * m0 + A) / (q0 * m1) if m1 > 0 else float('inf'))
        fin = sorted(x for x in need if x != float('inf'))
        if fin:
            print('[P15] %-8s без рекламы сейчас n=%3d (с прибылью %3d) цена -%2d%% + реклама 1 500: нужно заказов x%.1f медиана (четверть x%.1f и больше), недостижимо (вклад<=0) у %d' % (
                lab, nn, len(need), c * 100, S.median(fin), fin[3 * len(fin) // 4], sum(x == float('inf') for x in need)))
