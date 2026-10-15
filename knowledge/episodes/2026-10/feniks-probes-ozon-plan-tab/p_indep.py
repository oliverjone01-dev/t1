# Независимый пересчёт (B1/B3/B4) чисел блока «План с 15.10» из сырых файлов, без кода plan-tab.ts.
import json, collections, datetime as dt
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
PD = json.load(open(SP + 'pd.json'))
P = json.load(open(DD + 'plan_2026-10-15.json'))
def nd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
G = json.load(open(DD + 'card_groups.json'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
card_skus = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = [g for g in G if any(str(s['sku']) == ms for s in g['skus'])][0]
    card_skus.append(set(str(s['sku']) for s in g['skus']))
allsku = [s for cs in card_skus for s in cs]
print('товаров в 10 карточках', len(allsku), 'уникальных', len(set(allsku)))
od = nd('orders_daily.ndjson')
# B3: дедуп ключа заказа (order, sku)
k = collections.Counter((o['order'], str(o['sku'])) for o in od)
print('orders_daily строк', len(od), 'уникальных (order,sku)', len(k), 'дублей', sum(v - 1 for v in k.values() if v > 1))
def in_(d, a, b): return a <= d <= b
# база 14.09-11.10 по карточкам: u_wk_base
for i, c in enumerate(P['cards']):
    n = sum(float(o['units']) for o in od if o['status'] != 'cancelled' and str(o['sku']) in card_skus[i] and in_(o['d'], '2026-09-14', '2026-10-11'))
    print(f"{c['short']:<12} база 4 нед без отмен {n:>5.0f}  в неделю {n/4:>6.2f}  в плане u_wk_base {c['u_wk_base']:>6}  PD base2 {PD['cards'][i]['base2']}")
# магазин
st = lambda a, b, canc=False: sum(float(o['units']) for o in od if (canc or o['status'] != 'cancelled') and in_(o['d'], a, b))
rv = lambda a, b: sum(float(o['revenue'] or 0) for o in od if o['status'] != 'cancelled' and in_(o['d'], a, b))
print('магазин 01-13.10: без отмен', st('2026-10-01', '2026-10-13'), 'с отменами', st('2026-10-01', '2026-10-13', True))
b = st('2026-09-14', '2026-10-11'); print('магазин база без отмен', b, '×30/28 =', round(b * 30 / 28, 1), '×31/28 =', round(b * 31 / 28, 1), 'цель lo окт', P['goal']['units']['oct']['lo'])
r = rv('2026-09-14', '2026-10-11'); print('оборот база', round(r / 1e6, 2), '×30/28 =', round(r * 30 / 28 / 1e6, 2), '×31/28 =', round(r * 31 / 28 / 1e6, 2), 'цель lo окт', P['goal']['turn_mln']['oct']['lo'], 'mid', P['goal']['turn_mln']['oct']['mid'])
sv = nd('sku_views.ndjson')
u = sum(float(r.get('units') or 0) for r in sv if in_(r['date'], '2026-10-01', '2026-10-13'))
c_ = sum(float(r.get('canc') or 0) for r in sv if in_(r['date'], '2026-10-01', '2026-10-13'))
print('sku_views units 01-13.10', u, 'canc', c_)
# по дням: orders_daily c отменами против sku_views units
byd_o = collections.Counter(); byd_s = collections.Counter()
for o in od:
    if in_(o['d'], '2026-09-28', '2026-10-13'): byd_o[o['d']] += float(o['units'])
for r in sv:
    if in_(r['date'], '2026-09-28', '2026-10-13'): byd_s[r['date']] += float(r.get('units') or 0)
print('день  od(с отм)  sv.units  разн')
cum = 0
for d in sorted(set(byd_o) | set(byd_s)):
    cum += byd_o[d] - byd_s[d]
    print(d, int(byd_o[d]), int(byd_s[d]), int(byd_o[d] - byd_s[d]), 'накоп', int(cum))
# дыры в днях orders_daily
days = sorted(set(o['d'] for o in od if o['d'] >= '2026-08-01'))
d0 = dt.date.fromisoformat(days[0]); allg = []
while d0.isoformat() <= days[-1]:
    if d0.isoformat() not in days: allg.append(d0.isoformat())
    d0 += dt.timedelta(days=1)
print('дней без строк orders_daily с 01.08:', allg)
# отмены по дню заказа (лаг отмен)
cr = collections.defaultdict(lambda: [0, 0])
for o in od:
    if in_(o['d'], '2026-09-01', '2026-10-13'):
        wk = o['d'][:8] + ('01-10' if o['d'][8:] <= '10' else '11-20' if o['d'][8:] <= '20' else '21-31')
        cr[wk][0] += float(o['units']); cr[wk][1] += float(o['units']) if o['status'] == 'cancelled' else 0
for wk in sorted(cr): print('отмены', wk, f"{cr[wk][1]:.0f}/{cr[wk][0]:.0f} = {cr[wk][1]/cr[wk][0]*100:.1f}%")
