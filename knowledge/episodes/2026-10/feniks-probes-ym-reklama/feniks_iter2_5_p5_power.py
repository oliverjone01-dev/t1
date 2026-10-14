# ФЕНИКС, итерация 2, проба 5: П5 и раздел 17 выдачи - ряд по неделям, MDE, порог стопа, база ставки 8,8%
import json, collections, statistics, datetime
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson')
B = 'Буст продаж, оплата за продажи'; F = '74986385'
p = [r for r in o if not r['service']]
dt = datetime.date.fromisoformat
canc = lambda r: r['status'].startswith('CANCELLED')
wk = lambda s: (dt(s) - datetime.timedelta(days=dt(s).weekday())).isoformat()
# 1) weekly furniture orders without cancellation, 29.06-27.09 (my own grouping), plus the weeks after
w_all = collections.Counter(); w_nc = collections.Counter()
for r in p:
    if r['business'] == F and '2026-06-22' <= r['created'] <= '2026-10-11':
        w_all[wk(r['created'])] += 1
        if not canc(r):
            w_nc[wk(r['created'])] += 1
print('week | all orders | without cancel')
for k in sorted(w_all):
    print(' ', k, w_all[k], w_nc[k])
base = [w_nc[k] for k in sorted(w_nc) if '2026-06-29' <= k <= '2026-09-21']
print('base weeks 29.06-21.09 (13):', base, 'n', len(base), 'mean', round(statistics.mean(base), 1), 'sd', round(statistics.stdev(base), 2))
dip = ('2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10')
nodip = [w_nc[k] for k in sorted(w_nc) if '2026-06-29' <= k <= '2026-09-21' and k not in dip]
print('without weeks starting 20.07-10.08:', nodip, 'min', min(nodip), 'mean', round(statistics.mean(nodip), 1), 'sd', round(statistics.stdev(nodip), 2))
sd = statistics.stdev(base); mu = statistics.mean(base)
z = 1.96 + 0.8416
for n1, n2, lab in ((4, 4, 'two arms 4+4 weeks (author formula)'), (8, 8, 'two arms 8+8'), (13, 4, 'before/after: 13 hist weeks vs 4 pilot weeks'), (13, 8, 'before/after 13 vs 8')):
    mde = z * sd * (1 / n1 + 1 / n2) ** 0.5
    print(f'  MDE {lab}: {mde:.1f} orders/week = {mde / mu:.0%}')
sd2 = statistics.stdev(nodip); mu2 = statistics.mean(nodip)
print(f'  MDE before/after 9 hist (no dip) vs 4 pilot: {z * sd2 * (1 / 9 + 1 / 4) ** 0.5:.1f} = {z * sd2 * (1 / 9 + 1 / 4) ** 0.5 / mu2:.0%}')
# 2) stop rule: how often would '2 consecutive weeks below 16' have fired in the base period?
ks = sorted(k for k in w_nc if '2026-06-29' <= k <= '2026-09-21')
fires = [(ks[i - 1], ks[i]) for i in range(1, len(ks)) if w_nc[ks[i - 1]] < 16 and w_nc[ks[i]] < 16]
print('stop rule (2 weeks in a row below 16) would have fired in base period at:', fires)
# 3) cancellation lag: share of eventual cancellations recorded within 7 / 14 days (maturity of a weekly count)
lag = [(dt(r['statusDate']) - dt(r['created'])).days for r in p if r['business'] == F and canc(r) and '2026-06-29' <= r['created'] <= '2026-09-27']
print('furniture cancellations lag days: n', len(lag), 'share <=7d', round(sum(1 for x in lag if x <= 7) / len(lag), 2), 'share <=14d', round(sum(1 for x in lag if x <= 14) / len(lag), 2))
# 4) base rate for the pilot: furniture orders created since 15.09, boost from ALL postings (incl. October)
bo = collections.defaultdict(float); first = {}
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание'):
        k = (r['order'], r['sku']); bo[k] += -r['amount']; first[k] = min(first.get(k, r['d']), r['d'])
po = {(r['order'], r['sku']): r for r in p}
def rates(sel):
    xs = [v / (po[k]['price'] * po[k]['count']) for k, v in bo.items() if k in po and po[k]['business'] == F and sel(k)]
    return len(xs), (round(statistics.median(xs) * 100, 2) if xs else None)
print('furniture rate, created 15.09-30.09, boost posted by 30.09:', rates(lambda k: '2026-09-15' <= po[k]['created'] <= '2026-09-30' and first[k] <= '2026-09-30'))
print('furniture rate, created 15.09-30.09, any posting date:', rates(lambda k: '2026-09-15' <= po[k]['created'] <= '2026-09-30'))
print('furniture rate, created 15.09-01.10 excl. KONUX 5-1, any posting:', rates(lambda k: '2026-09-15' <= po[k]['created'] <= '2026-10-01' and po[k]['sku'] != 'GGT-35-5-1-100-180'))
print('furniture rate, created 01.09-14.09, any posting:', rates(lambda k: '2026-09-01' <= po[k]['created'] <= '2026-09-14'))
print('furniture rate, created in October, any posting:', rates(lambda k: po[k]['created'] >= '2026-10-01'))
print('furniture rate, created in October excl. KONUX 5-1:', rates(lambda k: po[k]['created'] >= '2026-10-01' and po[k]['sku'] != 'GGT-35-5-1-100-180'))
# 5) savings arithmetic: 8.8% -> 6% is how much of furniture boost
print('cut 8.8 -> 6.0 =', round((8.8 - 6.0) / 8.8 * 100, 1), '% ; 25-30% of 641 325 =', round(641325 * 0.25), '-', round(641325 * 0.30))
