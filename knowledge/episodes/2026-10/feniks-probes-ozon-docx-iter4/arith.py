import json, statistics as st
r = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/orders_daily.ndjson')]
k = [x for x in r if x['offer'] == 'GGT-35-5-1-100-180' and '2026-09-22' <= x['d'] <= '2026-10-10' and x['status'] != 'cancelled']
print('KONUX big orders n', len(k), 'units', sum(x['units'] for x in k), 'revenue/unit', [round(x['revenue'] / x['units']) for x in k])
print('median rev/unit', st.median(x['revenue'] / x['units'] for x in k))
p = 2.6 * 121898 * 0.126
print('2.6*121898*0.126 =', round(p), ' net range', round(35000 - p), round(50000 - p), ' with 0.097:', round(2.6 * 121898 * 0.097), round(35000 - 2.6 * 121898 * 0.097), round(50000 - 2.6 * 121898 * 0.097))
print('step1 saving 01-07 spend', (4291 + 3366) * 7 - 2 * 2000, ' with 09-10 spend', (4310 + 3366) * 7 - 2 * 2000)
print('step2 3 new per wk', (4802 + 3376 + 2190) * 7, ' x14', (4802 + 3376 + 2190) * 14, ' 4 incl O-20090 per wk', (3989 + 4802 + 3376 + 2190) * 7)
print('ratios 33.3/12.8 %.2f 51.9/12.8 %.2f 33.3/16 %.2f 51.9/16 %.2f' % (33.3 / 12.8, 51.9 / 12.8, 33.3 / 16, 51.9 / 16))
print('expensive 4: sum spend/day', 4802 + 3376 + 3366 + 2190)
# стоп шага 2 для трёх новых: база «2 недели до снижения» под дорогой кампанией vs после снижения на уровне до 08.10
import math
def pois_cdf(kk, lam):
    s = 0.0; t = math.exp(-lam)
    for i in range(kk + 1):
        if i > 0: t *= lam / i
        s += t
    return s
def p_trigger(lb, la):
    pp = 0.0; t = math.exp(-lb)
    for x in range(0, int(lb * 4 + 60)):
        if x > 0: t *= lb / x
        kk = math.ceil(0.7 * x) - 1
        if kk >= 0: pp += t * pois_cdf(kk, la)
    return pp
for name, before, after in (('O-18090', 7.5, 2.5), ('3-5-E-16080', 3.5, 2.57), ('47-3-5-90', 13.5, 4.0), ('3-3-O-20090 same', 15.2, 15.2)):
    print(name, 'P(stop fires | baskets return to pre-08.10 level, orders unchanged) = %.2f' % p_trigger(before * 14, after * 14))
