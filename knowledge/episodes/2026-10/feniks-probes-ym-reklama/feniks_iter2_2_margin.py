# ФЕНИКС, итерация 2, проба 2: раздел 2.4 / выдача 18 (маржа по SKU из pnl_sku_netting_daily) - популяция и полнота
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson'); svc = rd('services_monthly.ndjson'); o = rd('orders.ndjson')
Q = ('2026-07', '2026-08', '2026-09'); CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
B = 'Буст продаж, оплата за продажи'
# 1) boost money: registry vs pnl promo
reg = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['type'] == 'Удержание' and r['d'][:7] in Q:
        reg[(r['d'][:7], r['business'])] += -r['amount']
pp = collections.defaultdict(float)
for r in pnl:
    if r['d'][:7] in Q:
        pp[(r['d'][:7], r['business'])] += -r['promo']
print('boost money registry vs pnl promo (by posting month, cabinet):')
for k in sorted(set(reg) | set(pp)):
    print('  ', k, round(reg[k]), round(pp[k]), 'diff', round(reg[k] - pp[k]))
print('  total', round(sum(reg.values())), round(sum(pp.values())), 'diff', round(sum(reg.values()) - sum(pp.values())))
# 2) where is the missing boost money: registry rows by sku presence in pnl and by order status
pnl_skus = {(r['business'], r['sku']) for r in pnl if r['d'][:7] in Q}
miss = collections.defaultdict(float); miss_rows = []
for r in n:
    if r['service'] == B and r['type'] == 'Удержание' and r['d'][:7] in Q:
        if (r['business'], r['sku']) not in pnl_skus:
            miss[(r['business'], r['sku'])] += -r['amount']; miss_rows.append(r)
print('registry boost money on SKUs absent from pnl Q:', {k: round(v) for k, v in miss.items()}, 'sum', round(sum(miss.values())))
# per-sku comparison registry vs pnl promo (top deltas)
regs = collections.defaultdict(float); pps = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['type'] == 'Удержание' and r['d'][:7] in Q:
        regs[(r['business'], r['sku'])] += -r['amount']
for r in pnl:
    if r['d'][:7] in Q:
        pps[(r['business'], r['sku'])] += -r['promo']
dl = sorted(((k, regs[k] - pps[k]) for k in set(regs) | set(pps)), key=lambda x: -abs(x[1]))
print('top per-SKU deltas registry - pnl promo:', [(k[1], round(v)) for k, v in dl[:12]])
# per-day check for the biggest delta sku
if dl:
    ks = dl[0][0]
    rd_ = collections.defaultdict(float); pd_ = collections.defaultdict(float)
    for r in n:
        if r['service'] == B and r['type'] == 'Удержание' and r['d'][:7] in Q and (r['business'], r['sku']) == ks:
            rd_[r['d']] += -r['amount']
    for r in pnl:
        if r['d'][:7] in Q and (r['business'], r['sku']) == ks:
            pd_[r['d']] += -r['promo']
    print('  daily for', ks, [(d, round(rd_[d]), round(pd_[d])) for d in sorted(set(rd_) | set(pd_)) if abs(rd_[d] - pd_[d]) > 1][:15])
# 3) does pnl amount = sum of components?
comp = ('accruals', 'commission', 'delivery', 'acquiring', 'storage', 'cofin', 'promo', 'otherSvc')
bad = [r for r in pnl if abs(r['amount'] - sum(r[c] for c in comp)) > 1]
print('pnl rows where amount != sum(components):', len(bad), 'example', {c: bad[0][c] for c in comp + ('amount', 'points')} if bad else None)
tot = collections.defaultdict(float)
for r in pnl:
    if r['d'][:7] in Q:
        for c in comp + ('amount', 'points', 'cogs', 'units'):
            tot[c] += r[c]
print('pnl Q totals:', {c: round(v) for c, v in tot.items()})
# 4) COGS coverage
unk = collections.defaultdict(float)
for r in pnl:
    if r['d'][:7] in Q and not r['cogs_known'] and r['units']:
        unk[(r['business'], r['sku'])] += r['units']
print('units without COGS in Q:', round(sum(unk.values())), dict(list({k[1]: v for k, v in unk.items()}.items())[:15]))
# 5) netting money flows in Q by (type, service) - what is outside pnl
nm = collections.defaultdict(float)
for r in n:
    if r['d'][:7] in Q:
        nm[(r['type'], r['service'])] += r['amount']
print('netting Q by (type, service):')
for k, v in sorted(nm.items(), key=lambda x: -abs(x[1])):
    print('   ', k, round(v))
# 6) act services in Q that are money and not SKU-bound
na = collections.defaultdict(float)
for r in svc:
    if r['ym'] in Q and not r['sku']:
        na[r['service']] += r['money']
print('act money rows without sku in Q:', {k: round(v) for k, v in na.items()})
sub = [r for r in svc if r['service'] == 'Подписка']
print('Подписка rows:', [(r['ym'], CAB.get(r['business']), r['d'], r['money'], r['campaign']) for r in sub])
rev_ = [r for r in svc if r['service'] in ('Баллы за отзыв', 'Баллы за фото к отзыву') and r['ym'] in Q]
print('Баллы за отзыв (money) in Q by cab:', {c: round(sum(r['money'] for r in rev_ if r['business'] == c)) for c in CAB})
