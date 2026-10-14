# ФЕНИКС 14.10, предпроверка разбора: PPML (Пуассон, фикс. эффекты SKU и недели, тот же алгоритм, что в razbor.py) с контролем
# клика и без, на неделях с рядом ads_sku_daily (с 29.06). Плюс доля заказов топ-20 SKU панели.
import collections, sys, io, contextlib
import numpy as np
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-v7-razbor')
with contextlib.redirect_stdout(io.StringIO()):
    import p_elastic as E
sel = [r for r in E.rows if r['sku'] in E.mov and r['w'] >= '2026-06-29']
def ppml(ycol, ctrl):
    keep = collections.Counter()
    for r in sel: keep[r['sku']] += r[ycol]
    s2 = [r for r in sel if keep[r['sku']] > 0]
    sk = {s: i for i, s in enumerate(sorted({r['sku'] for r in s2}))}; ws = {w: i for i, w in enumerate(sorted({r['w'] for r in s2}))}
    i_ = np.array([sk[r['sku']] for r in s2]); t_ = np.array([ws[r['w']] for r in s2])
    med = {s: np.median([r['lp'] for r in s2 if r['sku'] == s]) for s in sk}
    X = np.column_stack([[r['lp'] - med[r['sku']] for r in s2]] + ([[r['c'] for r in s2]] if ctrl else []))
    y = np.array([r[ycol] for r in s2], float); ni, nt = i_.max() + 1, t_.max() + 1
    th = np.zeros(X.shape[1]); a = np.zeros(ni); g = np.zeros(nt)
    for _ in range(300):
        for __ in range(3):
            e = np.exp(g[t_] + X @ th); a = np.log(np.maximum(np.bincount(i_, y, ni), 1e-12) / np.bincount(i_, e, ni))
            e = np.exp(a[i_] + X @ th); g = np.log(np.maximum(np.bincount(t_, y, nt), 1e-12) / np.maximum(np.bincount(t_, e, nt), 1e-12))
        mu = np.exp(a[i_] + g[t_] + X @ th)
        Xm = X - np.column_stack([(np.bincount(i_, mu * X[:, k], ni) / np.maximum(np.bincount(i_, mu, ni), 1e-12))[i_] for k in range(X.shape[1])])
        step = np.linalg.solve((Xm * mu[:, None]).T @ Xm, Xm.T @ (y - mu)); th += step
        if np.abs(step).max() < 1e-7: break
    return th, len(sk), len(s2)
for yc, nm in (('u', 'заказы'), ('v', 'показы')):
    t0, n0, m0 = ppml(yc, False); t1, _, _ = ppml(yc, True)
    print(f'{nm}: PPML с 29.06 без контроля {t0[0]:+.2f}, с контролем клика {t1[0]:+.2f} (клик {t1[1]:+.2f}); SKU {n0}, SKU-недель {m0}')
u_by = collections.Counter()
for r in sel: u_by[r['sku']] += r['u']
tot = sum(u_by.values()); top = sum(v for _, v in u_by.most_common(20))
print(f'заказы в панели с 29.06: {tot} шт; топ-20 SKU - {top} ({top / tot:.0%})')
