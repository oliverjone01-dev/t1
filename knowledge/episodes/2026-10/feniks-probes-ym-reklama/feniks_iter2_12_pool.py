# ФЕНИКС, итерация 2, проба 12: З7 / П5 - общий ли кошелёк баллов. В дни, когда буст мебели в сентябре списан только деньгами,
# чем платилось размещение (Удержание = деньги, Списание = баллы)? Плюс G5: единицы воронки против доставленных.
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); sv = rd('sku_views.ndjson')
F = '74986385'; B = 'Буст продаж, оплата за продажи'; P = 'Размещение товарных предложений'
day = collections.defaultdict(lambda: collections.defaultdict(float))
for r in n:
    if r['business'] == F and r['d'][:7] == '2026-09' and r['service'] in (B, P) and r['type'] in ('Удержание', 'Списание'):
        day[r['d']][(r['service'][:6], 'money' if r['type'] == 'Удержание' else 'pts')] += -r['amount']
print('day | boost money | boost pts | placement money | placement pts')
for d in sorted(day):
    v = day[d]
    print(' ', d[5:], round(v[('Буст п', 'money')]), round(v[('Буст п', 'pts')]), round(v[('Размещ', 'money')]), round(v[('Размещ', 'pts')]))
zero = [d for d in day if day[d][('Буст п', 'pts')] == 0 and day[d][('Буст п', 'money')] > 0]
print('days with boost only in money:', zero)
print('  placement on those days: money', round(sum(day[d][('Размещ', 'money')] for d in zero)), 'pts', round(sum(day[d][('Размещ', 'pts')] for d in zero)))
# G5: funnel units vs delivered for furniture over the window
u = sum(r['units'] for r in sv if not r.get('aggregate') and r['business'] == F)
dl = sum(r['deliv'] for r in sv if not r.get('aggregate') and r['business'] == F)
cn = sum(r['canc'] for r in sv if not r.get('aggregate') and r['business'] == F)
print('furniture funnel window: units', u, 'deliv', dl, 'canc', cn)
