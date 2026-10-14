# ФЕНИКС, итерация 2, проба 6 (G3): зоны отмен, полнота списка МО, устойчивость вывода «регионы хуже только у зеркал»
import json, collections, sys, re, datetime
sys.path.insert(0, '/nonexistent')
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
o = rd('orders.ndjson')
Q = ('2026-07', '2026-08', '2026-09'); CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
p = [r for r in o if not r['service']]
W = [r for r in p if r['created'][:7] in Q]
canc = lambda r: r['status'].startswith('CANCELLED')
dt = datetime.date.fromisoformat
# список автора берётся из analiz.py текстом (без импорта, чтобы не исполнять чужой код)
src = open('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-scripts/analiz.py', encoding='utf-8').read()
blk = src[src.index('MSK = {'):src.index('}', src.index('MSK = {')) + 1]
MSK = set(re.findall(r"'([^']+)'", blk))
print('author MSK list size', len(MSK))
regs = collections.Counter(r['region'] for r in W)
print('regions in Q orders:', len(regs), 'in MSK list:', sum(1 for x in regs if x in MSK), 'MSK entries absent in data:', sorted(x for x in MSK if x not in regs)[:20])
print('NOT in MSK list, all names with counts (for manual MO review):')
print('  ', sorted(((x, c) for x, c in regs.items() if x not in MSK), key=lambda t: -t[1]))
# reorders 1:1 (own implementation: per group pair cancelled with delivered, min of the two)
grp = collections.defaultdict(list)
for r in W:
    grp[(r['created'], r['sku'], r['region'])].append(r)
re_ = set()
for g in grp.values():
    cz = [r for r in g if canc(r)]; dl = [r for r in g if r['status'] == 'DELIVERED']
    for r in cz[:len(dl)]:
        re_.add((r['order'], r['sku']))
def tab(zone_fn, sel=lambda r: True, lab=''):
    out = {}
    for c in CAB:
        for z in (True, False):
            g = [r for r in W if r['business'] == c and zone_fn(r) == z and sel(r)]
            cz = [r for r in g if canc(r)]; net = [r for r in cz if (r['order'], r['sku']) not in re_]
            out[(CAB[c], 'MSK' if z else 'reg')] = (len(g), len(net), round(len(net) / len(g) * 100, 1) if g else None)
    print(lab, out)
inmsk = lambda r: r['region'] in MSK
tab(inmsk, lab='author list:')
AMBIG = {'Заречье', 'Горки', 'Пески', 'Быково', 'Маслово', 'Марфино', 'Лопатино', 'Алёшино', 'Обухово', 'Зименки', 'Митькино', 'Московский', 'Чёрное', 'Кривцово'}
print('ambiguous names present in data:', {x: regs[x] for x in AMBIG if x in regs})
tab(lambda r: r['region'] in MSK and r['region'] not in AMBIG, lab='author list minus ambiguous names:')
tab(inmsk, sel=lambda r: r['sku'] != 'GGL-09-2', lab='author list, mirrors without OSOLIS GGL-09-2:')
# SKU mix: share of OSOLIS among mirror orders by zone
for z in (True, False):
    g = [r for r in W if r['business'] == '1023124' and inmsk(r) == z]
    print('mirrors zone', 'MSK' if z else 'reg', 'orders', len(g), 'OSOLIS share', round(sum(1 for r in g if r['sku'] == 'GGL-09-2') / len(g) * 100, 1), 'avg price', round(sum(r['price'] for r in g) / len(g)))
# late in-delivery cancellations: mirrors x region
late = [r for r in W if r['status'] == 'CANCELLED_IN_DELIVERY' and (dt(r['statusDate']) - dt(r['created'])).days >= 14]
print('late in-delivery cancels (>=14d):', len(late), 'by cab x zone', dict(collections.Counter((CAB[r['business']], 'MSK' if inmsk(r) else 'reg') for r in late)))
# counterfactual check: regions mirrors at MSK rate
g_reg = [r for r in W if r['business'] == '1023124' and not inmsk(r)]; g_msk = [r for r in W if r['business'] == '1023124' and inmsk(r)]
net = lambda g: sum(1 for r in g if canc(r) and (r['order'], r['sku']) not in re_)
gain = net(g_reg) - len(g_reg) * net(g_msk) / len(g_msk)
avg = sum(r['revenue'] for r in W if r['business'] == '1023124' and r['status'] == 'DELIVERED') / sum(1 for r in W if r['business'] == '1023124' and r['status'] == 'DELIVERED')
print('mirrors counterfactual gain', round(gain, 1), 'orders; x avg delivered', round(avg), '=', round(gain * avg))
# П7: regional mirrors not cancelled
print('regional mirrors not cancelled (any status):', sum(1 for r in g_reg if not canc(r)), 'delivered:', sum(1 for r in g_reg if r['status'] == 'DELIVERED'))
