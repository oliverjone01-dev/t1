# ФЕНИКС проба P8 (OZON v5): эластичность к НАШЕЙ цене против эластичности к доле витрины (доплата OZON),
# 23.09-11.10, где prices_daily.price = предельная. Пилот двигает только нашу цену.
import json, collections as C, math
import pandas as pd, statsmodels.api as sm
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
A, B = '2026-09-23', '2026-10-11'
P = {(p['offer'], p['d']): p['price'] for p in L('prices_daily.ndjson')}
obs = {}
for g in L('gap_daily.ndjson'):
    if A <= g['date'] <= B and (g['art'], g['date']) in P and g.get('site_to_seller'):
        obs[(g['sku'], g['date'])] = (P[(g['art'], g['date'])], g['site_to_seller'])
units = C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status'] != 'cancelled': units[(o['sku'], o['d'])] += o['units']
clk = set((r['sku'], r['d']) for r in L('ads_sku_daily.ndjson') if r['sp'] > 0)
df = pd.DataFrame([dict(sku=s, d=d, lp=math.log(p), ls=math.log(sh), u=units[(s, d)], clk=float((s, d) in clk)) for (s, d), (p, sh) in obs.items()])
tot = df.groupby('sku').u.sum(); df = df[df.sku.isin(tot[tot > 0].index)]
var_p = df.groupby('sku').lp.agg(lambda x: x.max() - x.min()); chg = var_p[var_p > 0.01].index
print('товаров с заказами', df.sku.nunique(), '; товаро-дней', len(df), '; заказов', int(df.u.sum()),
      '; товаров, где наша цена менялась >1%:', len(chg))
def fit(d, cols):
    X = pd.get_dummies(d[['sku', 'd']], drop_first=True).astype(float)
    for c in cols: X[c] = d[c]
    X = sm.add_constant(X)
    m = sm.GLM(d.u, X, family=sm.families.Poisson()).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(d.sku)[0]})
    return {c: (m.params[c], m.bse[c]) for c in cols}
df['lv'] = df.lp + df.ls
for lab, cols in (('витрина целиком', ['lv', 'clk']), ('наша цена и доля витрины раздельно', ['lp', 'ls', 'clk'])):
    r = fit(df, cols)
    print(lab + ':', '; '.join(f'{c} {b:+.2f} (95% {b - 1.96 * s:+.2f}..{b + 1.96 * s:+.2f})' for c, (b, s) in r.items() if c != 'clk'))
