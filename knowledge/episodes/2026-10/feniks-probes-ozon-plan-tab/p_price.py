# Проба цены: шкала prices_daily.price против price_now/price_new плана; gap_daily; revenue на шт до/после 23.09.
import json, collections
DD = '/home/user/t1/analytics-mvp/data/'
P = json.load(open(DD + 'plan_2026-10-15.json'))
def nd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
pr = nd('prices_daily.ndjson')
last = {}; hist = collections.defaultdict(dict)
for r in pr:
    hist[r['offer']][r['d']] = r
    if r['d'] >= last.get(r['offer'], ('',))[0]: last[r['offer']] = (r['d'], r)
print('prices_daily поля:', sorted(pr[-1].keys()), 'max d', max(r['d'] for r in pr))
gp = nd('gap_daily.ndjson'); gl = {}
for r in gp:
    if r['date'] >= gl.get(r['art'], ('',))[0]: gl[r['art']] = (r['date'], r)
print(f"{'art':<20}{'when':<6}{'plan now':>9}{'plan new':>9}{'pd.price':>9}{'pd.before':>10}{'paid':>8}  {'site_now':>8}{'gap%':>7}  статус_сборки")
for p in P['price']:
    d, r = last.get(p['art'], ('', {}))
    g = gl.get(p['art'], ('', {}))[1]
    print(f"{p['art']:<20}{p['when']:<6}{p['price_now']:>9}{p['price_new']:>9}{str(r.get('price')):>9}{str(r.get('before')):>10}{str(r.get('paid')):>8}  {str(p.get('site_now')):>8}{str(g.get('gap_pct')):>7}  {d}")
# сдвиг price 23.09 у одного оффера
for off in ['GGM-02-1-2', 'GGT-35-5-1-100-180']:
    h = hist[off]; print(off, [(d, h[d].get('price'), h[d].get('before')) for d in sorted(h) if '2026-09-19' <= d <= '2026-09-26'])
od = nd('orders_daily.ndjson')
rp = collections.defaultdict(list)
for o in od:
    if o['status'] != 'cancelled' and o['units']:
        rp[(o['offer'], 'до 23.09' if o['d'] < '2026-09-23' else 'с 23.09')].append(float(o['revenue']) / float(o['units']))
for off in ['GGT-35-5-1-100-180', 'GGM-18-2-2', 'GGT-03-3-3-E-16080', 'GGM-02-1-2']:
    for per in ['до 23.09', 'с 23.09']:
        v = [x for x in rp.get((off, per), [])]
        if v: print('revenue/шт', off, per, 'n', len(v), 'медиана', sorted(v)[len(v) // 2])
