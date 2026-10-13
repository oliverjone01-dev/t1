# ФЕНИКС проба P17: V5 = V4 + фактическая ставка за заказ сентября (CPO 818 149 / начислено 21 010 545 = 3,9%, P6/P7),
# чтобы поправки шли в обе стороны, а не только вниз.
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
CPO = 818149 / 21010545
print('CPO факт сентября %.4f' % CPO)
res = []
for r in v0:
    kp = keep4(r); s_ads = r['s'] if r['ads'] else max(r['s'] - 0.065, 0.2)
    k = 0.70 * kp - CPO - 0.15 * s_ads * 0.914; fixed = r['cogs'] + r['shipn'] + r['cpc_o']
    k10 = k - 0.10 * (kp - CPO); fixed10 = fixed - 0.10 * r['cpc_o']
    pz = fixed / k if k > 0 else None; p10 = fixed10 / k10 if k10 > 0 else None
    pr0 = r['p0'] * k - fixed; b0 = r['p0'] * (kp - CPO) - r['cpc_o']
    res.append(dict(wk=r['wk'], z=(1 - pz / r['p0']) * 100 if pz else -999, t=(1 - p10 / r['p0']) * 100 if p10 else -999, rent=pr0 / b0 if b0 else 0, pr0=pr0))
z = sorted(x['z'] for x in res); t = sorted(x['t'] for x in res)
print('[V5] рентаб. медиана %.0f%%, минус у %d | запас до 0 медиана %.0f%% (<=0 у %d) | до 10%% медиана %.0f%%, >=5%% у %d' % (
    S.median(x['rent'] for x in res) * 100, sum(x['pr0'] < 0 for x in res), S.median(z), sum(x <= 0 for x in z), S.median(t), sum(x >= 5 for x in t)))
for lo, hi, lab in ((0, 0.5, '<0,5'), (0.5, 1.5, '0,5-1,5'), (1.5, 99, '>1,5')):
    rr = [x for x in res if lo <= x['wk'] < hi]
    print('     %-8s n=%3d запас до 0 медиана %4.0f%%, до 10%% медиана %4.0f%%, до 10%% >=5%% у %d' % (lab, len(rr), S.median(x['z'] for x in rr), S.median(x['t'] for x in rr), sum(x['t'] >= 5 for x in rr)))
