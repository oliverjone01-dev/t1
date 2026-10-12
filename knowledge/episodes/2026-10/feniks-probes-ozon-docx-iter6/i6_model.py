import json, collections as C, math
import numpy as np
R = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/ads_daily.ndjson')]

def build(lo='2026-09-22', hi='2026-10-07', minwk=500, drop=('28753239',)):
    agg = C.defaultdict(C.Counter); off = {}
    for r in R:
        if lo <= r['d'] <= hi and r['sp'] > 0:
            a = agg[r['id']]; a['sp'] += r['sp']; a['vw'] += r['vw']; a['cl'] += r['cl']; a['days'] += 1; off[r['id']] = r['off']
    rows = []
    for i, a in agg.items():
        if not a['vw'] or not a['cl'] or i in drop: continue
        k = 7 / a['days']
        rows.append(dict(id=i, off=off[i], sp=a['sp'] * k, vw=a['vw'] * k, cpc=a['sp'] / a['cl'], ctr=a['cl'] / a['vw'], days=a['days']))
    return [r for r in rows if r['sp'] > minwk]

def ols(rows, cols=('sp', 'cpc')):
    y = np.log([r['vw'] for r in rows])
    X = np.c_[np.ones(len(rows)), *[np.log([r[c] for r in rows]) for c in cols]]
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    e = y - X @ b; n, p = X.shape
    s2 = (e @ e) / (n - p)
    cov = s2 * np.linalg.inv(X.T @ X)
    se = np.sqrt(np.diag(cov))
    # HC1 robust
    XtXi = np.linalg.inv(X.T @ X)
    meat = (X * e[:, None]).T @ (X * e[:, None])
    hc1 = XtXi @ meat @ XtXi * n / (n - p)
    rse = np.sqrt(np.diag(hc1))
    r2 = 1 - (e @ e) / ((y - y.mean()) @ (y - y.mean()))
    return b, se, rse, r2, e

rows = build()
print('n', len(rows))
b, se, rse, r2, e = ols(rows)
print('coef', np.round(b, 3), 'se', np.round(se, 3), 'robust se', np.round(rse, 3), 'R2 %.3f' % r2)
for nm, j in (('spend', 1), ('cpc', 2)):
    lo, hi = b[j] - 1.96 * rse[j], b[j] + 1.96 * rse[j]
    print('  %s elasticity %.2f  95%%CI(robust) %.2f..%.2f  -> x2 effect %+.0f%% (CI %+.0f%%..%+.0f%%)' % (nm, b[j], lo, hi, (2 ** b[j] - 1) * 100, (2 ** lo - 1) * 100, (2 ** hi - 1) * 100))
b1, _, _, r2s, _ = ols(rows, ('sp',))
print('log vw ~ log sp only: coef %.3f R2 %.3f' % (b1[1], r2s))
# identity check: log vw == log sp - log cpc - log ctr
mx = max(abs(math.log(r['vw']) - (math.log(r['sp']) - math.log(r['cpc']) - math.log(r['ctr']))) for r in rows)
print('identity max abs err', mx)
# variance decomposition
lsp = np.log([r['sp'] for r in rows]); lcpc = np.log([r['cpc'] for r in rows]); lctr = np.log([r['ctr'] for r in rows]); lvw = np.log([r['vw'] for r in rows])
print('sd log sp %.2f, sd log cpc %.2f, sd log ctr %.2f, sd log vw %.2f' % (lsp.std(), lcpc.std(), lctr.std(), lvw.std()))
print('corr(log ctr, log sp) %.2f, corr(log ctr, log cpc) %.2f' % (np.corrcoef(lctr, lsp)[0, 1], np.corrcoef(lctr, lcpc)[0, 1]))
# rule of thumb: vw = sp / (cpc*0.04)
med = np.median([r['ctr'] for r in rows])
errs = []
for r in rows:
    rule = r['sp'] / (r['cpc'] * 0.04)
    reg = math.exp(b[0] + b[1] * math.log(r['sp']) + b[2] * math.log(r['cpc']))
    errs.append((r['off'], r['vw'], rule, reg, rule / r['vw'] - 1, reg / r['vw'] - 1))
ru = np.array([x[4] for x in errs]); rg = np.array([x[5] for x in errs])
print('median CTR %.4f' % med)
print('rule x0.04 error: median %+.0f%%, p10 %+.0f%%, p90 %+.0f%%, min %+.0f%%, max %+.0f%%, share within +-25%%: %d/%d' % (np.median(ru) * 100, np.percentile(ru, 10) * 100, np.percentile(ru, 90) * 100, ru.min() * 100, ru.max() * 100, (abs(ru) <= .25).sum(), len(ru)))
print('regression error: median %+.0f%%, p10 %+.0f%%, p90 %+.0f%%, within +-25%%: %d/%d' % (np.median(rg) * 100, np.percentile(rg, 10) * 100, np.percentile(rg, 90) * 100, (abs(rg) <= .25).sum(), len(rg)))
for x in errs:
    if x[0] in ('GGT-35-5-1-100-180', 'GGM-18-2-2'):
        print('  %s actual %.0f rule %.0f (%+.0f%%) regression %.0f (%+.0f%%)' % (x[0], x[1], x[2], x[4] * 100, x[3], x[5] * 100))
# implied elasticities of the rule vs regression: x2 budget
print('rule implies x2 budget -> +100%%, x2 cpc -> -50%%; regression says %+.0f%% and %+.0f%%' % ((2 ** b[1] - 1) * 100, (2 ** b[2] - 1) * 100))
# sensitivity
for lab, rr in (('incl small (minwk=0)', build(minwk=0)), ('drop GGT-48-5-1 (2 days)', [r for r in rows if r['id'] != '37676554']), ('min 7 active days', [r for r in rows if r['days'] >= 7]), ('drop top-3 spend', sorted(rows, key=lambda r: -r['sp'])[3:])):
    bb, _, rs, r2x, _ = ols(rr)
    print('  sens %-26s n=%2d spend %.2f (x2 %+.0f%%) cpc %.2f (x2 %+.0f%%) R2 %.2f' % (lab, len(rr), bb[1], (2 ** bb[1] - 1) * 100, bb[2], (2 ** bb[2] - 1) * 100, r2x))
# bootstrap
rng = np.random.default_rng(12)
bs = []
for _ in range(4000):
    idx = rng.integers(0, len(rows), len(rows))
    bb, *_ = ols([rows[i] for i in idx])
    bs.append(bb)
bs = np.array(bs)
for nm, j in (('spend', 1), ('cpc', 2)):
    lo, hi = np.percentile(bs[:, j], [2.5, 97.5])
    print('bootstrap %s %.2f..%.2f -> x2 %+.0f%%..%+.0f%%' % (nm, lo, hi, (2 ** lo - 1) * 100, (2 ** hi - 1) * 100))
# within-campaign daily FE regression (same 38 campaigns, same window)
ids = {r['id'] for r in rows}
D = [r for r in R if r['id'] in ids and '2026-09-22' <= r['d'] <= '2026-10-07' and r['sp'] > 0 and r['vw'] > 0 and r['cl'] > 0]
g = C.defaultdict(list)
for r in D: g[r['id']].append(r)
Y = []; Xs = []
for i, lst in g.items():
    if len(lst) < 3: continue
    ly = np.log([r['vw'] for r in lst]); ls = np.log([r['sp'] for r in lst]); lc = np.log([r['sp'] / r['cl'] for r in lst])
    Y += list(ly - ly.mean()); Xs += list(zip(ls - ls.mean(), lc - lc.mean()))
Y = np.array(Y); Xs = np.array(Xs)
bw, *_ = np.linalg.lstsq(Xs, Y, rcond=None)
ew = Y - Xs @ bw
print('within-campaign daily FE: n_days %d, spend %.2f (x2 %+.0f%%), cpc %.2f (x2 %+.0f%%), within R2 %.2f' % (len(Y), bw[0], (2 ** bw[0] - 1) * 100, bw[1], (2 ** bw[1] - 1) * 100, 1 - (ew @ ew) / (Y @ Y)))
