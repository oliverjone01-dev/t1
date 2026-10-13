# ФЕНИКС проба P2: дрейф доли «К выплате», комиссии и доли покупателя по месяцам; доставка
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
O = L('orders_daily.ndjson')
dl = [o for o in O if o['status'] == 'delivered' and o['revenue'] > 0]
M = C.defaultdict(C.Counter)
for o in dl:
    m = o['d'][:7]
    for k in ('revenue', 'commission', 'payout', 'delivery', 'other', 'partner'):
        M[m][k] += o.get(k) or 0
    if o.get('paid'):
        M[m]['rev_p'] += o['revenue']; M[m]['paid'] += o['paid']
    M[m]['n'] += 1
print('[P2a] по месяцу заказа (доставленные): n, доля К выплате, комиссия, логистика+прочее+партнёры, покупатель платит/цена')
for m in sorted(M):
    x = M[m]; r = x['revenue']
    print(' ', m, x['n'], 'keep %.3f' % (x['payout'] / r), 'ком %.3f' % (-x['commission'] / r),
          'фикс? %.3f' % (-(x['delivery'] + x['other'] + x['partner']) / r),
          'paid/rev %.3f' % (x['paid'] / x['rev_p'] if x['rev_p'] else 0))
# комиссия по ценовым корзинам (сентябрь-октябрь), чтобы увидеть шкалу от цены
B = C.defaultdict(lambda: [0, 0, 0])
for o in dl:
    if o['d'] < '2026-09-01': continue
    p = o['revenue'] / max(o['units'], 1)
    b = '<3k' if p < 3000 else '3-10k' if p < 10000 else '10-30k' if p < 30000 else '>30k'
    B[b][0] += -o['commission']; B[b][1] += o['revenue']; B[b][2] += 1
print('[P2b] комиссия / цена по ценовым корзинам, заказы с 01.09:', {k: ('%.3f' % (v[0] / v[1]), v[2]) for k, v in B.items()})
# фиксированные в рублях части выплаты: логистика OZON (delivery) и партнёры на штуку, по схеме
F = C.defaultdict(list)
for o in dl:
    if o['d'] < '2026-06-01': continue
    F[o['scheme']].append((-(o['delivery'] + o['partner']) / max(o['units'], 1), o['revenue'] / max(o['units'], 1)))
for sc, v in F.items():
    print('[P2c]', sc, 'n', len(v), 'логистика+партнёры на шт: медиана %.0f ₽, среднее %.0f ₽; доля от цены медиана %.3f' % (
        S.median(a for a, b in v), sum(a for a, b in v) / len(v), S.median(a / b for a, b in v)))
