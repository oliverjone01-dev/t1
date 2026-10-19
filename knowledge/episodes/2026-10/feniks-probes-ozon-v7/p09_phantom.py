import sys
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
# A (all 26 prices, all click to minimum): v5 run() scales every order of a price-cut SKU by (1-step)^eps (incl. click-driven ones),
# then clicks() subtracts lost own click orders at the pre-cut profit and count. Residual = lost x [(1-st)^eps x pi(p1) - pi(p0)] per order.
for sc in F.SCN:
    eps, k = F.EPS[sc], F.K_CLK[sc]; tot = 0; rows = []
    for cid, c in F.camp.items():
        w = c['sp'] * F.wk_rate(c)
        if w <= 0: continue
        new = min(w, F.MIN_WK) if F.active(c) else 0
        if not F.active(c): continue                      # stopped campaigns: identical in A and in "as now"
        dl = c['o'] * F.wk_rate(c) * (1 - (new / w) ** F.E_SP) * k
        sku = F.art2sku.get(c['off'])
        if not sku or sku not in F.lst or dl == 0: continue
        r = F.rows[sku]; st = F.lst[sku]['step'] / 100
        m = (1 - st) ** eps; p1 = r['p0'] * (1 - st)
        res = dl * (m * F.pi(r, p1, 0.05, r['s']) - F.pi(r, r['p0'], 0.05, r['s']))
        tot += res; rows.append((c['off'], round(dl, 2), round(res)))
    print(f'{sc:8} phantom in A, RUB per month {tot * 4.33:+,.0f}; campaigns: {[x[0] for x in sorted(rows, key=lambda x: -abs(x[2]))[:3]]}'.replace(',', ' '))
