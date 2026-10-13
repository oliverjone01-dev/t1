import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
G = json.load(open(D + 'card_groups.json'))['groups']
members = {g['main']: [s['offer'] for s in g['skus']] for g in G}
kon = set(members['6279981715'])
T = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))['тесты'][0]['тест']
print('test1 SKUs total', len(T), '; in KONUX card:', sorted(set(T) & kon))
od = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
od = [o for o in od if o['status'] != 'cancelled']
print('orders date range', min(o['d'] for o in od), max(o['d'] for o in od))
allo = set(o['offer'] for o in od)
def u(arts, a, b):
    return sum(o['units'] for o in od if o['offer'] in arts and a <= o['d'] <= b)
import datetime as dt
def days(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1
testc = set(T) | kon
for g in G:
    if any(x in T for x in [s['offer'] for s in g['skus']]):
        testc |= {s['offer'] for s in g['skus']}
ctrl = allo - testc
W = [('2026-07-01', '2026-07-31'), ('2026-08-01', '2026-08-31'), ('2026-09-01', '2026-09-17'), ('2026-09-04', '2026-09-17'), ('2026-09-18', '2026-10-10'), ('2026-09-22', '2026-10-10')]
tk = set(T) & kon; rest = kon - tk
for a, b in W:
    n = days(a, b)
    print('%s..%s (%2d d): card %5.2f/d (%3d) | test-SKU %4.2f/d (%2d) | rest %4.2f/d (%2d) | store ctrl %5.2f/d' % (a, b, n, u(kon, a, b) / n, u(kon, a, b), u(tk, a, b) / n, u(tk, a, b), u(rest, a, b) / n, u(rest, a, b), u(ctrl, a, b) / n))
# per-sku in B and A windows
print('per SKU B(04-17.09) / A(18.09-10.10):')
for s in sorted(kon):
    print('   %-22s %s  B %2d  A %2d' % (s, 'TEST' if s in T else '    ', u({s}, '2026-09-04', '2026-09-17'), u({s}, '2026-09-18', '2026-10-10')))
# ads on card SKUs by month
offer = json.load(open(D + 'sku_offer.json')); o2s = {v: k for k, v in offer.items()}; s2o = {k: v for k, v in offer.items()}
ads = [json.loads(l) for l in open(D + 'ads_sku_daily.ndjson')]
print('ads_sku_daily keys', sorted(ads[0].keys()), 'range', min(r['d'] for r in ads), max(r['d'] for r in ads))
m = C.defaultdict(float)
for r in ads:
    o = s2o.get(r['sku'])
    if o in kon:
        m[(r['d'][:7], o)] += r['sp']
for k in sorted(m):
    if m[k] > 0: print('   ads', k, round(m[k]))
