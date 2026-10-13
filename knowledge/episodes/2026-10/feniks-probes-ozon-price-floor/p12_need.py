# ФЕНИКС проба P12: «нужный рост заказов» и сценарий «реклама утроит заказы» при исправлениях K+A+T (V4)
# против floor.py (V0). Параметры товаров - из p9_variants (rows.json V0 и rows_v4.json V4 пересчитываются здесь же).
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
SP = '/tmp/feniks-floor/'; import os as _os; _os.makedirs(SP, exist_ok=True)
CPO = 0.05; TAX = 0.15; ADS_PP = 0.065
v0 = {r['sku']: r for r in json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))}
O = L('orders_daily.ndjson')
fee = C.defaultdict(lambda: [0, 0]); fee6 = C.defaultdict(lambda: [0, 0])
for o in O:
    if o['status'] != 'delivered' or o['revenue'] <= 0: continue
    if o['d'] >= '2026-09-01': f = fee[o['sku']]; f[0] += o['payout']; f[1] += o['revenue']
    if o['d'] >= '2026-06-01': f = fee6[o['sku']]; f[0] += o['payout']; f[1] += o['revenue']
sk09 = sum(v[0] for v in fee.values()) / sum(v[1] for v in fee.values()); sk06 = sum(v[0] for v in fee6.values()) / sum(v[1] for v in fee6.values())
def keep4(sku, k0):
    if fee[sku][1] > 0: return fee[sku][0] / fee[sku][1]
    return k0 * sk09 / sk06
def need(variant, cutp):
    out = []
    for sku, r in v0.items():
        s = r['s']; fx = r['cogs'] + r['shipn']
        if variant == 0: k = 0.70 * (r['keep'] - CPO) - TAX * s
        else: k = 0.70 * keep4(sku, r['keep']) - CPO - TAX * s * 0.905 * 1.01
        pr0 = r['p0'] * k - fx; pr1 = r['p0'] * (1 - cutp) * k - fx
        if pr0 > 0: out.append(pr0 / pr1 if pr1 > 0 else float('inf'))
    fin = sorted(x for x in out if x != float('inf'))
    return len(out), S.median(fin), fin[3 * len(fin) // 4], sum(x == float('inf') for x in out)
for v in (0, 4):
    for c in (0.05, 0.10, 0.20):
        n, med, q3, neg = need(v, c)
        print('[P12a] V%d цена -%d%%: товаров с прибылью без рекламы %d, медиана +%.0f%% заказов, четверть +%.0f%% и больше, в минус %d' % (v, c * 100, n, (med - 1) * 100, (q3 - 1) * 100, neg))
# утроение заказов: реклама на заказ / 3
for v in (0, 4):
    for lo, hi, lab in ((0, 0.5, '<0,5'), (0.5, 1.5, '0,5-1,5'), (1.5, 99, '>1,5')):
        zz = []
        for sku, r in v0.items():
            if not (lo <= r['wk'] < hi): continue
            cpc = r['cpc_o'] / 3; s_ads = r['s'] if r['ads'] else max(r['s'] - ADS_PP, 0.2)
            if v == 0: k = 0.70 * (r['keep'] - CPO) - TAX * s_ads; fx = r['cogs'] + r['shipn'] + 0.70 * cpc
            else: k = 0.70 * keep4(sku, r['keep']) - CPO - TAX * s_ads * 0.905 * 1.01; fx = r['cogs'] + r['shipn'] + cpc
            if k > 0: zz.append((1 - fx / k / r['p0']) * 100)
        print('[P12b] V%d утроение заказов %-8s запас до нуля медиана %.0f%%, <=0 у %d из %d' % (v, lab, S.median(zz), sum(x <= 0 for x in zz), len(zz)))
