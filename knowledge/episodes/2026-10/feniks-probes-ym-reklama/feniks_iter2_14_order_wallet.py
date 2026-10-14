# ФЕНИКС, итерация 2, проба 14: З7 - кошелёк баллов заказа. Для заказов мебели с бустом в сентябре:
# начислено баллов по заказу (отчёт по баллам) против списано баллов по заказу (все услуги), по группам «только деньги» / «оба» / «только баллы»
import json, collections, statistics
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); b = rd('bonuses_monthly.ndjson')
F = '74986385'; B = 'Буст продаж, оплата за продажи'
od = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание') and r['d'][:7] == '2026-09' and r['business'] == F:
        od[r['order']][0 if r['type'] == 'Удержание' else 1] += -r['amount']
acc = collections.defaultdict(float); spent = collections.defaultdict(float)
for r in b:
    if not r['order']:
        continue
    if r['type'] == 'Начисление':
        acc[r['order']] += r['amount']
    elif r['type'] == 'Списание':
        spent[r['order']] += -r['amount']
for lab, sel in (('only money', lambda v: v[0] > 0 and v[1] == 0), ('both', lambda v: v[0] > 0 and v[1] > 0), ('only points', lambda v: v[0] == 0 and v[1] > 0)):
    ks = [k for k, v in od.items() if sel(v)]
    if not ks:
        print(f'{lab}: orders 0 (на уровне заказа такие заказы уже попали в группы выше)')
        continue
    left = [acc[k] - spent[k] for k in ks]
    ratio = [spent[k] / acc[k] for k in ks if acc[k]]
    print(f'{lab}: orders {len(ks)}; points left on order (accrued - spent): median {statistics.median(left):,.0f}, min {min(left):,.0f}, max {max(left):,.0f}; spent/accrued median {statistics.median(ratio):.2f}')
