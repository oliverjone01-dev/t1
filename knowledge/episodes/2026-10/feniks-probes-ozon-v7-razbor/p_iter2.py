# ФЕНИКС 14.10, разбор падения заказов, итерация 2: (1) заказы в окне 29.08-03.09 против соседних недель; (2) PPML зеркал с контролем клика;
# (3) шаг цены >=+15% у SKU без клика в обеих неделях (с 29.06): медиана изменения показов против SKU без изменения цены.
import json, math, collections, datetime as dt, sys, io, contextlib
import numpy as np
D = '/home/user/t1/analytics-mvp/data/'
u = collections.Counter()
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l)
    if o['status'] != 'cancelled': u[o['d']] += o['units']
def per_day(a, b):
    d0 = dt.date.fromisoformat(a); n = (dt.date.fromisoformat(b) - d0).days + 1
    return sum(u[(d0 + dt.timedelta(i)).isoformat()] for i in range(n)) / n, n
for a, b in (('2026-08-22', '2026-08-28'), ('2026-08-29', '2026-09-03'), ('2026-09-04', '2026-09-10')):
    v, n = per_day(a, b); print(f'заказы {a}..{b}: {v:.1f} шт/день ({n} дн.)')
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-v7-razbor')
with contextlib.redirect_stdout(io.StringIO()):
    import p_elastic as E
    import p_ppml as PP
tax = json.load(open(D + 'sku_taxonomy.json'))
names = {}
for l in open(D + 'sku_views.ndjson'):
    r = json.loads(l); names[r['sku']] = (r.get('line'), r.get('name', ''))
def is_mir(s):
    t = tax.get(s)
    if t: return t['category'] == 'Зеркала'
    ln, nm = names.get(s, (None, ''))
    return ln in ('зеркала', 'NOLVIS', 'OSOLIS') or 'Зеркал' in nm
full = PP.sel
PP.sel = [r for r in full if is_mir(r['sku'])]
for yc, nm in (('v', 'показы'), ('u', 'заказы')):
    t0, n0, m0 = PP.ppml(yc, False); t1, _, _ = PP.ppml(yc, True)
    print(f'зеркала {nm}: PPML без контроля {t0[0]:+.2f}, с контролем клика {t1[0]:+.2f}; SKU {n0}, SKU-недель {m0}')
PP.sel = full
by = collections.defaultdict(dict)
for r in E.rows:
    if r['sku'] in E.mov and r['w'] >= '2026-06-29': by[r['sku']][r['w']] = r
steps = []
for s, d in by.items():
    ws = sorted(d)
    for w0, w1 in zip(ws, ws[1:]):
        if (dt.date.fromisoformat(w1) - dt.date.fromisoformat(w0)).days != 7: continue
        a, b = d[w0], d[w1]
        if a['c'] > 0 or b['c'] > 0: continue
        steps.append((w1, b['lp'] - a['lp'], math.log((b['v'] + 1) / (a['v'] + 1)), is_mir(s)))
base = collections.defaultdict(list)
for w, dp, dv, m in steps:
    if abs(dp) <= 0.02: base[w].append(dv)
med = {w: float(np.median(v)) for w, v in base.items()}
for lab, lo, hi in (('>= +15%', math.log(1.15), 9), ('+5..+15%', math.log(1.05), math.log(1.15))):
    x = [dv - med[w] for w, dp, dv, m in steps if lo <= dp < hi and w in med]
    xm = [dv - med[w] for w, dp, dv, m in steps if lo <= dp < hi and w in med and m]
    print(f'шаг {lab}: n={len(x)}, медиана показов {math.exp(np.median(x)) - 1:+.0%}; зеркала n={len(xm)} {math.exp(np.median(xm)) - 1 if xm else float("nan"):+.0%}')
