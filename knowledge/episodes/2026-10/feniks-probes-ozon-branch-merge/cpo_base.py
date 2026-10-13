# Проба ФЕНИКСА: от какой цены считается ставка за заказ (CPO) - от предельной (revenue) или от оплаты покупателя (paid)?
# Источник: cpo_orders.ndjson (выгрузка кабинета «оплата за заказ», sp по заказу) x orders_daily.ndjson (revenue, paid).
import json, collections as C, statistics as S, sys
D = '/home/user/t1-v4/analytics-mvp/data/'
od = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
print('orders_daily keys:', sorted(od[0].keys()))
key = 'order'
print('posting key:', key, od[0][key])
by = C.defaultdict(list)
for o in od:
    p = str(o[key])
    base = '-'.join(p.split('-')[:2])
    by[base].append(o)
cpo = [json.loads(l) for l in open(D + 'cpo_orders.ndjson')]
r_rev, r_paid, months = [], [], C.defaultdict(list)
miss = 0
for c in cpo:
    os_ = by.get(c['order'])
    if not os_:
        miss += 1
        continue
    rev = sum(o['revenue'] for o in os_)
    paid = sum((o.get('paid') or 0) for o in os_)
    if rev > 0:
        r_rev.append(c['sp'] / rev)
        months[os_[0]['d'][:7]].append((c['sp'] / rev, c['sp'] / paid if paid else None))
    if paid > 0:
        r_paid.append(c['sp'] / paid)
print('cpo orders', len(cpo), 'matched', len(cpo) - miss, 'missing', miss)
q = lambda v: (S.median(v), sorted(v)[len(v) // 4], sorted(v)[3 * len(v) // 4])
print('sp / revenue (предельная): median %.4f IQR %.4f..%.4f' % q(r_rev))
print('sp / paid (оплата покупателя): median %.4f IQR %.4f..%.4f' % q(r_paid))
for m in sorted(months):
    v = months[m]
    a = [x for x, _ in v]
    b = [y for _, y in v if y]
    print(m, 'n=%d' % len(v), 'sp/rev med %.4f' % S.median(a), 'sp/paid med %.4f' % (S.median(b) if b else float('nan')))
