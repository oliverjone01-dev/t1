# ФЕНИКС, проба по шагу 2: корзины и заказы товаров шага 2 до и после 08.10, мощность стопа -30%
import json, collections, math
D = '/home/user/t1/analytics-mvp/data/'
offer = json.load(open(D + 'sku_offer.json'))
S2 = ['GGT-03-3-3-O-20090', 'GGT-03-3-3-O-18090', 'GGT-03-3-5-E-16080', 'GGT-47-3-5-90']
K = ['GGT-35-5-1-100-180', 'GGT-35-2-3-100-180', 'GGT-48-5-1-100-180']
W = set(S2 + K)
V = collections.defaultdict(collections.Counter); last = ''
for l in open(D + 'sku_views.ndjson'):
    r = json.loads(l)
    if r['date'] < '2026-09-08': continue
    a = offer.get(str(r['sku']))
    last = max(last, r['date'])
    if a in W:
        V[a][(r['date'], 'cart')] += r.get('cart') or 0
        V[a][(r['date'], 'vs')] += r.get('vsearch') or 0
        V[a][(r['date'], 'units')] += r.get('units') or 0
od = collections.Counter()
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l)
    if o['status'] != 'cancelled' and o['offer'] in W and o['d'] >= '2026-09-08': od[(o['offer'], o['d'])] += o['units']
sp = collections.Counter()
for l in open(D + 'ads_sku_daily.ndjson'):
    x = json.loads(l); a = offer.get(x['sku'])
    if a in W and x['d'] >= '2026-09-08': sp[(a, x['d'])] += x['sp']
print('sku_views last date', last)

def days(a, b):
    import datetime as dt
    s = dt.date.fromisoformat(a); e = dt.date.fromisoformat(b)
    return [(s + dt.timedelta(n)).isoformat() for n in range((e - s).days + 1)]

def agg(a, f, t, k):
    ds = days(f, t)
    return sum(V[a][(d, k)] for d in ds) / len(ds)

for a in S2 + K:
    b = ('2026-09-24', '2026-10-07'); n = ('2026-10-09', '2026-10-10')
    cb, cn = agg(a, *b, 'cart'), agg(a, *n, 'cart')
    ob = sum(od[(a, d)] for d in days(*b)) / 14 * 7
    print(f"{a:22} cart/day {cb:5.2f} -> {cn:5.2f}  | vsearch/day {agg(a,*b,'vs'):7.0f} -> {agg(a,*n,'vs'):7.0f} | orders/wk 24.09-07.10 {ob:4.1f} | sp/day {sum(sp[(a,d)] for d in days(*b))/14:6.0f} -> {sum(sp[(a,d)] for d in days(*n))/2:6.0f}")

# мощность правила «корзины за 2 нед. упали >30% к 2 нед. до»: Пуассон, обе выборки случайны
def pois_cdf(k, lam):
    s = 0.0; t = math.exp(-lam)
    for i in range(k + 1):
        if i > 0: t *= lam / i
        s += t
    return s

def p_trigger(lam_before, lam_after):
    # P(after < 0.7 * before), before ~ Pois(lam_before), after ~ Pois(lam_after)
    p = 0.0; t = math.exp(-lam_before)
    for x in range(0, int(lam_before * 4 + 40)):
        if x > 0: t *= lam_before / x
        k = math.ceil(0.7 * x) - 1
        if k >= 0: p += t * pois_cdf(k, lam_after)
    return p

print('--- stop rule -30% on 2-week baskets: P(trigger)')
for lam in (5, 10, 20, 40, 80):
    print(f"lam2wk={lam:3d}: no change {p_trigger(lam, lam):.2f} | true -20% {p_trigger(lam, lam*0.8):.2f} | true -50% {p_trigger(lam, lam*0.5):.2f}")
