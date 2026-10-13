# ФЕНИКС проба P9: чувствительность вывода floor.py @ e4988f5 к трём расхождениям с «Отчетом» (P8):
#  K - доля «К выплате» за сентябрь-октябрь вместо 01.06-10.10 (комиссия росла ступенями, P2a);
#  A - база АДМ без вычета рекламы (как «Отчет» на деле: дни без продаж с минусом обнуляются, P7/P8);
#  T - база налога = оплата покупателя (s x 0,905 по P3c, x1,01 на G) вместо цены на витрине.
# V0 обязан воспроизвести floor_out.txt (медиана запаса 7%, <=0 у 73 из 171).
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
CPO = 0.05; ADM = 0.30; TAX = 0.15; ADS_PP = 0.065; CPC_WK = 1500; RENT = 0.10
cogs = json.load(open(D + 'sku_cogs.json'))
O = L('orders_daily.ndjson')
ship = {x['order']: x for x in L('delivery_orders.ndjson')}
bd = {x['order']: x['bd'] for x in L('buyer_delivery_orders.ndjson')}
def fees(since):
    fee = C.defaultdict(lambda: [0, 0])
    for o in O:
        if o['status'] != 'delivered' or o['revenue'] <= 0 or o['d'] < since: continue
        f = fee[o['sku']]; f[0] += o['payout']; f[1] += o['revenue']
    tot = [sum(v[0] for v in fee.values()), sum(v[1] for v in fee.values())]
    return fee, tot[0] / tot[1]
fee06, sk06 = fees('2026-06-01'); fee09, sk09 = fees('2026-09-01')
sn = C.defaultdict(list)
for o in O:
    if o['status'] != 'delivered' or o['revenue'] <= 0 or o['d'] < '2026-06-01': continue
    s = ship.get(o['order']) or ship.get(o['order'] + '-1')
    if s: sn[o['sku']].append((s['ship'] - (bd.get(o['order'].rsplit('-', 1)[0]) or bd.get(o['order']) or s.get('deliv') or 0)) / max(o['units'], 1))
store_sn = S.median([x for v in sn.values() for x in v])
units = C.Counter()
for o in O:
    if o['status'] != 'cancelled' and o['d'] >= '2026-08-12': units[o['sku']] += o['units']
P = {}
for p in L('prices_daily.ndjson'): P[p['offer']] = (p['d'], p['price'])
G = {}
for g in L('gap_daily.ndjson'): G[g['sku']] = (g['date'], g['site_to_seller'], g['art'])
ads = set(r['sku'] for r in L('ads_sku_daily.ndjson') if r['d'] >= '2026-10-01' and r['sp'] > 0)
print('доля к выплате: с 01.06 %.3f, с 01.09 %.3f; товаров с заказами с 01.09: %d' % (sk06, sk09, sum(1 for v in fee09.values() if v[1] > 0)))
def run(K=False, A=False, T=False, label=''):
    rows = []
    for sku, u in units.items():
        if sku not in G or sku not in cogs: continue
        art = G[sku][2]
        if art not in P: continue
        p0 = P[art][1]; s = G[sku][1]
        s_ads = s if sku in ads else max(s - ADS_PP, 0.2)
        if K:
            # доля за сентябрь-октябрь: своя, если по товару есть доставленные с 01.09, иначе своя с 01.06 x (магазин 09/06)
            keep = fee09[sku][0] / fee09[sku][1] if fee09[sku][1] > 0 else (fee06[sku][0] / fee06[sku][1] * sk09 / sk06 if fee06[sku][1] > 0 else sk09)
        else:
            keep = fee06[sku][0] / fee06[sku][1] if fee06[sku][1] > 0 else sk06
        shipn = S.median(sn[sku]) if sn[sku] else store_sn
        wk = u / 60 * 7; cpc_o = CPC_WK / wk
        tf = 0.905 * 1.01 if T else 1.0
        if A:   # реклама не режет базу АДМ: прибыль = 0,7*p*keep - CPO*p - cpc - С/С - доставка - налог
            k = 0.70 * keep - CPO - TAX * s_ads * tf; fixed = cogs[sku] + shipn + cpc_o
            k10 = k - RENT * (keep - CPO); fixed10 = fixed - RENT * cpc_o
            pr0 = p0 * k - fixed; b0 = p0 * (keep - CPO) - cpc_o
        else:
            k = 0.70 * (keep - CPO) - TAX * s_ads * tf; fixed = cogs[sku] + shipn + 0.70 * cpc_o
            k10 = k - RENT * (keep - CPO); fixed10 = fixed - RENT * cpc_o
            pr0 = p0 * k - fixed; b0 = p0 * (keep - CPO) - cpc_o
        pz = fixed / k if k > 0 else None; p10 = fixed10 / k10 if k10 > 0 else None
        rows.append(dict(sku=sku, art=art, p0=p0, wk=wk, keep=keep, pz=pz, p10=p10, pr0=pr0, rent=pr0 / b0 if b0 else 0, k=k))
    cut = lambda r, p: (1 - p / r['p0']) * 100 if p else -999
    z = sorted(cut(r, r['pz']) for r in rows); t = sorted(cut(r, r['p10']) for r in rows)
    out = '%-34s n=%d рентаб. медиана %3.0f%%, минус у %3d | запас до 0: медиана %4.0f%%, <=0 у %3d | до 10%%: медиана %4.0f%%, >=5%% у %3d' % (
        label, len(rows), S.median(r['rent'] for r in rows) * 100, sum(r['pr0'] < 0 for r in rows), S.median(z), sum(x <= 0 for x in z), S.median(t), sum(x >= 5 for x in t))
    print(out)
    for lo, hi, lab in ((0, 0.5, '<0,5'), (0.5, 1.5, '0,5-1,5'), (1.5, 99, '>1,5')):
        rr = [r for r in rows if lo <= r['wk'] < hi]
        print('      %-8s n=%3d запас до 0 медиана %5.0f%%, до 10%% медиана %5.0f%%' % (lab, len(rr), S.median(cut(r, r['pz']) for r in rr), S.median(cut(r, r['p10']) for r in rr)))
    return rows
r0 = run(label='V0 как floor.py @ e4988f5')
run(K=True, label='V1 доля К выплате с 01.09')
run(A=True, label='V2 база АДМ без рекламы')
run(T=True, label='V3 налог от оплаты покупателя')
rows_all = run(K=True, A=True, T=True, label='V4 = V1+V2+V3')
json.dump(rows_all, open('/tmp/feniks-floor/rows_v4.json', 'w'))
