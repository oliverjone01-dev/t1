# v5: как заказы реагируют на цену витрины (эластичность), панель товар x неделя, июнь-октябрь.
# Заказы - orders_daily без отмен по дате заказа (E033). Цена витрины: coinv_daily.site_listed (observed) до 18.09,
# с 19.09 prices_daily.price x gap_daily.site_to_seller. Пуассон с эффектами товара и недели; клик - доля дней
# с расходом за клик у товара в неделе (ads_sku_daily), чтобы надбавка OZON от клика не шла в цену.
# Запуск: python3 -I elastic.py
import json, collections as C, datetime as dt, math
import numpy as np, pandas as pd, statsmodels.api as sm
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
START, END = '2026-06-15', '2026-10-11'   # окно выбрано до просмотра результата: всё, где есть цена витрины; 12-14.06 - неполная неделя
wk = lambda d: dt.date.fromisoformat(d) - dt.timedelta(days=dt.date.fromisoformat(d).weekday())
vit = {}
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed') and r['date'] <= '2026-09-18': vit[(r['sku'], r['date'])] = r['site_listed']
P = {(p['offer'], p['d']): p['price'] for p in L('prices_daily.ndjson')}
for g in L('gap_daily.ndjson'):
    if g['date'] >= '2026-09-19' and (g['art'], g['date']) in P and g.get('site_to_seller'):
        vit[(g['sku'], g['date'])] = P[(g['art'], g['date'])] * g['site_to_seller']
units = C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status'] != 'cancelled': units[(o['sku'], o['d'])] += o['units']
clk = set((r['sku'], r['d']) for r in L('ads_sku_daily.ndjson') if r['sp'] > 0)
cpo = set()
# панель: товар x неделя, цена = средняя цена витрины наблюдённых дней, заказы - сумма по наблюдённым дням
agg = C.defaultdict(lambda: [0, 0.0, 0, 0])
for (sku, d), v in vit.items():
    if not START <= d <= END: continue
    a = agg[(sku, wk(d))]; a[0] += 1; a[1] += math.log(v); a[2] += units[(sku, d)]; a[3] += (sku, d) in clk
rows = [dict(sku=s, w=str(w), n=a[0], lp=a[1] / a[0], u=a[2], clk=a[3] / a[0]) for (s, w), a in agg.items() if a[0] >= 4]
df = pd.DataFrame(rows)
tot = df.groupby('sku').u.sum(); df = df[df.sku.isin(tot[tot > 0].index)]   # товары без заказов не дают информации в FE-пуассоне
df['lp_dm'] = df.lp - df.groupby('sku').lp.transform('mean')
print('товаров', df.sku.nunique(), 'товаро-недель', len(df), 'заказов', int(df.u.sum()),
      '; разброс цены внутри товара: sd log', round(df.lp_dm.std(), 3))
def fit(d, extra):
    X = pd.get_dummies(d[['sku', 'w']], drop_first=True).astype(float)
    X['lp'] = d.lp; 
    for e in extra: X[e] = d[e]
    X = sm.add_constant(X)
    m = sm.GLM(d.u, X, family=sm.families.Poisson(), offset=np.log(d.n)).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(d.sku)[0]})
    return m.params['lp'], m.bse['lp']
for name, extra in (('только цена', []), ('цена + клик', ['clk'])):
    b, se = fit(df, extra)
    print(f'{name:12} эластичность {b:+.2f}  95% {b-1.96*se:+.2f}..{b+1.96*se:+.2f}  (-10% цены -> заказы {math.exp(b*math.log(0.9))*100-100:+.0f}%)')
# устойчивость: до 18.09 (одна методика цены) и с 19.09
for lab, a, z in (('июнь-18.09', START, '2026-09-18'), ('19.09-11.10', '2026-09-19', END)):
    d = df[(df.w >= a[:8] + '01') & (df.w <= z)] if False else df[(df.w >= str(wk(a))) & (df.w <= z)]
    t = d.groupby('sku').u.sum(); d = d[d.sku.isin(t[t > 0].index)]
    b, se = fit(d, ['clk'])
    print(f'{lab:12} n={len(d)} заказов {int(d.u.sum())}: {b:+.2f}  95% {b-1.96*se:+.2f}..{b+1.96*se:+.2f}')
