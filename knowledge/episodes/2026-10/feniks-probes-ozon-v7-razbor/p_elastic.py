# ФЕНИКС 14.10, предпроверка разбора: устойчивость эластичности к контролю рекламы за клик (в razbor.py её нет).
# Панель как в razbor.py: coinv_daily observed site_listed (лог, среднее за неделю, >=3 дн.), sku_views, orders_daily без отмен,
# недели 15.06-14.09, SKU с размахом цены >3% и показами в >=половине недель. TWFE (фикс. эффекты SKU и недели), y = log(1+шт)
# и log(1+показы); вариант с контролем доли дней с расходом за клик у SKU в неделе (ads_sku_daily) - на неделях, где ряд клика есть.
import json, math, collections, datetime as dt
import numpy as np
D = '/home/user/t1/analytics-mvp/data/'
nd = lambda f: (json.loads(l) for l in open(D + f) if l.strip())
wk = lambda d: (dt.date.fromisoformat(d) - dt.timedelta(dt.date.fromisoformat(d).weekday())).isoformat()
W0, W1 = '2026-06-15', '2026-09-21'
pw = collections.defaultdict(list)
for r in nd('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed') and W0 <= wk(r['date']) < W1: pw[(r['sku'], wk(r['date']))].append(math.log(r['site_listed']))
vw = collections.Counter()
for r in nd('sku_views.ndjson'):
    if W0 <= wk(r['date']) < W1: vw[(r['sku'], wk(r['date']))] += r['views']
uw = collections.Counter()
for o in nd('orders_daily.ndjson'):
    if o['status'] != 'cancelled' and W0 <= wk(o['d']) < W1: uw[(o['sku'], wk(o['d']))] += o['units']
clk_days = collections.defaultdict(set); first_clk = None
for r in nd('ads_sku_daily.ndjson'):
    first_clk = r['d'] if first_clk is None or r['d'] < first_clk else first_clk
    if (r.get('sp') or 0) > 0 and W0 <= wk(r['d']) < W1: clk_days[(r['sku'], wk(r['d']))].add(r['d'])
rows = [dict(sku=s, w=w, lp=float(np.mean(lp)), v=vw.get((s, w), 0), u=uw.get((s, w), 0), c=len(clk_days.get((s, w), ())) / 7)
        for (s, w), lp in pw.items() if len(lp) >= 3]
by = collections.defaultdict(list)
for r in rows: by[r['sku']].append(r)
mov = {s for s, rs in by.items() if max(x['lp'] for x in rs) - min(x['lp'] for x in rs) > 0.03 and sum(x['v'] > 0 for x in rs) >= len(rs) / 2}
def demean(cols, si, ti):
    cols = [c.copy() for c in cols]
    for _ in range(40):
        for g in (si, ti):
            cnt = np.bincount(g).astype(float); cnt[cnt == 0] = 1
            cols = [c - (np.bincount(g, c) / cnt)[g] for c in cols]
    return cols
def twfe(sel, ycol, ctrl):
    sk = {s: i for i, s in enumerate(sorted({r['sku'] for r in sel}))}; ws = {w: i for i, w in enumerate(sorted({r['w'] for r in sel}))}
    si = np.array([sk[r['sku']] for r in sel]); ti = np.array([ws[r['w']] for r in sel])
    y = np.array([math.log(1 + r[ycol]) for r in sel]); x = np.array([r['lp'] for r in sel]); c = np.array([r['c'] for r in sel])
    if ctrl:
        y, x, c = demean([y, x, c], si, ti); X = np.column_stack([x, c])
    else:
        y, x = demean([y, x], si, ti); X = x[:, None]
    b = np.linalg.lstsq(X, y, rcond=None)[0]
    return b
print('первый день ads_sku_daily:', first_clk)
for lab, wfrom in (('15.06-14.09 (как razbor.py)', W0), ('с недели ряда клика', wk(first_clk))):
    sel = [r for r in rows if r['sku'] in mov and r['w'] >= wfrom]
    out = []
    for yc in ('u', 'v'):
        b0 = twfe(sel, yc, False); b1 = twfe(sel, yc, True)
        out.append(f'{"заказы" if yc == "u" else "показы"}: без контроля {b0[0]:+.2f}, с контролем клика {b1[0]:+.2f} (клик {b1[1]:+.2f})')
    print(f'{lab}: SKU {len({r["sku"] for r in sel})}, SKU-недель {len(sel)}, недели с кликом у SKU {sum(r["c"] > 0 for r in sel)} | ' + ' | '.join(out))
# насколько летний подъём цены - общий для магазина: доля дисперсии лог-цены, которую снимают эффекты недели
sel = [r for r in rows if r['sku'] in mov]
lp = np.array([r['lp'] for r in sel]); si = np.array([sorted({r['sku'] for r in sel}).index(r['sku']) for r in sel])
lp_sku = lp - (np.bincount(si, lp) / np.bincount(si))[si]
ws = sorted({r['w'] for r in sel}); ti = np.array([ws.index(r['w']) for r in sel])
lp_both = demean([lp], si, ti)[0]
print(f'дисперсия лог-цены внутри SKU {lp_sku.var():.4f}; после снятия эффектов недели {lp_both.var():.4f} -> общий для магазина сдвиг объясняет {1 - lp_both.var() / lp_sku.var():.0%}')
