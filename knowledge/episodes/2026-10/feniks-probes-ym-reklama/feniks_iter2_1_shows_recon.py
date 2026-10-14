# ФЕНИКС, итерация 2, проба 1: сверка раздела 3 выдачи (REAL_COST показов и полок = деньги акта + баллы отчёта по баллам)
# Логика своя: суммирую по дате проводки акта и по ym отчёта по баллам, независимо от analiz.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
promo = rd('promo_monthly.ndjson'); svc = rd('services_monthly.ndjson'); b = rd('bonuses_monthly.ndjson')
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
MS = ('2026-06', '2026-07', '2026-08', '2026-09', '2026-10')
act = collections.defaultdict(lambda: [0.0, 0.0])  # (ym, cab, group) -> money, act points
for r in svc:
    s = r['service']
    g = 'shows' if s in ('Буст продаж с оплатой за показы', 'Товарные баннеры') else 'shelf' if s == 'Полка' else None
    if g:
        act[(r['ym'], r['business'], g)][0] += r['money']; act[(r['ym'], r['business'], g)][1] += r['points']
bp = collections.defaultdict(float); bsrc = collections.defaultdict(lambda: collections.Counter())
for r in b:
    s = r['service']
    g = 'shows' if s == 'Буст продаж, оплата за показы' else 'shelf' if s == 'Полки' else None
    if g and r['type'] in ('Списание', 'Возврат списания'):
        bp[(r['ym'], r['business'], g)] += -r['amount']
        bsrc[(r['ym'], r['business'], g)][r['src']] += -r['amount']
print('ym | cab | kind | promo REAL_COST | act money | act points | bonus-report points | money+bonus | diff | money+act points | diff2')
for r in sorted(promo, key=lambda r: (r['ym'], r['business'], r['kind'])):
    if r['kind'] not in ('shows', 'shelf'):
        continue
    k = (r['ym'], r['business'], r['kind'])
    am, ap = act[k]; bb = bp[k]
    print(f"{r['ym']} | {CAB[r['business']]} | {r['kind']} | {r['spend']:.2f} | {am:.2f} | {ap:.2f} | {bb:.2f} | {am + bb:.2f} | {r['spend'] - am - bb:.2f} | {am + ap:.2f} | {r['spend'] - am - ap:.2f}")
print('\nMonths/cabinets with act or bonus spend but NO promo row:')
pk = {(r['ym'], r['business'], r['kind']) for r in promo}
for k in sorted(set(act) | set(bp)):
    if k not in pk and k[0] in MS:
        print('  ', k, 'act money/points', [round(x) for x in act[k]], 'bonus', round(bp[k]))
print('\nBonus-report src breakdown for shows/shelf, Q:')
for k in sorted(bsrc):
    if k[0] in ('2026-07', '2026-08', '2026-09'):
        print('  ', k, {s: round(v) for s, v in bsrc[k].items()})
# 90-day window: act daily dates for July furniture shows/shelf vs promo July furniture
print('\nJuly furniture act rows (shows/banners/shelf) by date:')
byd = collections.defaultdict(lambda: [0.0, 0.0])
for r in svc:
    if r['ym'] == '2026-07' and r['business'] == '74986385' and r['service'] in ('Буст продаж с оплатой за показы', 'Товарные баннеры', 'Полка'):
        byd[(r['d'], r['service'][:5], r['campaign'])][0] += r['money']; byd[(r['d'], r['service'][:5], r['campaign'])][1] += r['points']
for k in sorted(byd):
    print('  ', k, [round(x, 2) for x in byd[k]])
print('\nJuly furniture bonus-report shows/shelf rows by date:')
byb = collections.defaultdict(float)
for r in b:
    if r['ym'] == '2026-07' and r['business'] == '74986385' and r['service'] in ('Буст продаж, оплата за показы', 'Полки'):
        byb[(r['d'], r['service'], r['type'])] += r['amount']
for k in sorted(byb):
    print('  ', k, round(byb[k], 2))
# do bonus shows rows carry order/sku?
x = [r for r in b if r['service'] in ('Буст продаж, оплата за показы', 'Полки')]
print('\nbonus shows/shelf rows:', len(x), 'with sku', sum(1 for r in x if r['sku']), 'with order', sum(1 for r in x if r['order']))
print('sample', x[:2])
# act points: what are they? compare act points per month-cabinet with bonus report totals
print('\nAct points vs bonus points, shows group, by month-cabinet:')
for k in sorted(set(act) | set(bp)):
    if k[2] == 'shows' and k[0] in MS:
        print('  ', k, 'act points', round(act[k][1]), 'bonus points', round(bp[k]))
