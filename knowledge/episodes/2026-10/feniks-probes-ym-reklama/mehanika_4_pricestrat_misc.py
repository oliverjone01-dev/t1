#!/usr/bin/env python3
"""ФЕНИКС, проба 4: ценовая стратегия (раздел 6) и сверка чисел текста. Только чтение.
a) корреляция ставки и доли Маркета: внутри SKU (как у автора), внутри SKU x месяц, без 5-1, без GGM-01-1, бутстреп по SKU;
b) SYVONT GGM-29-4: заказы после июля, 45 тыс. в П11, буст деньгами;
c) маржа всех SKU с выручкой > 150 тыс. («остальные - маржа 34-56%»);
d) нижняя граница пересечения показов/полок с бустом по выручке (п. 8 «все они одновременно в бусте»)."""
import json, sys, collections, statistics, random
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson'); promo = rd('promo_monthly.ndjson')
BOOST = 'Буст продаж, оплата за продажи'
p = [r for r in o if not r['service']]; po = {(r['order'], r['sku']): r for r in p}
bo = collections.defaultdict(float); bom = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'):
        bo[(r['order'], r['sku'])] += abs(r['amount'])
        if r['type'] == 'Удержание': bom[(r['order'], r['sku'])] += abs(r['amount'])
obs = [(po[k]['sku'], po[k]['created'][:7], bo[k] / po[k]['price'], po[k]['p_mp'] / po[k]['price']) for k in bo if k in po and po[k]['price'] and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in ('2026-07', '2026-08', '2026-09', '2026-10')]
def corr(rows, key, minn=5):
    g = collections.defaultdict(list)
    for r in rows: g[key(r)].append(r)
    xs, ys = [], []
    for v in g.values():
        if len(v) < minn: continue
        mx = statistics.mean(r[2] for r in v); my = statistics.mean(r[3] for r in v)
        xs += [r[2] - mx for r in v]; ys += [r[3] - my for r in v]
    return (statistics.correlation(xs, ys) if len(xs) > 2 else float('nan')), len(xs)
skus5 = {s for s, c in collections.Counter(r[0] for r in obs).items() if c >= 5}
base = [r for r in obs if r[0] in skus5]
print('## a) ценовая стратегия')
print('  внутри SKU (как автор):', corr(base, lambda r: r[0]))
print('  внутри SKU x месяц (группы от 2):', corr(base, lambda r: (r[0], r[1]), 2))
print('  без 5-1:', corr([r for r in base if r[0] != 'GGT-35-5-1-100-180'], lambda r: r[0]))
print('  без 5-1 и GGM-01-1:', corr([r for r in base if r[0] not in ('GGT-35-5-1-100-180', 'GGM-01-1')], lambda r: r[0]))
random.seed(7); sl = sorted(skus5); bs = []
for _ in range(2000):
    pick = [random.choice(sl) for _ in sl]; rows = []
    for i, s in enumerate(pick): rows += [(f"{s}#{i}",) + r[1:] for r in base if r[0] == s]
    bs.append(corr(rows, lambda r: r[0])[0])
bs.sort(); print(f"  бутстреп по SKU (2000): 90% интервал {bs[100]:.2f} .. {bs[1899]:.2f}; доля <= 0: {sum(1 for x in bs if x <= 0) / len(bs):.1%}")
print('  по SKU (n, corr):', sorted([(s, len(v), round(statistics.correlation([r[2] for r in v], [r[3] for r in v]), 2)) for s in skus5 for v in [[r for r in base if r[0] == s]] if len({r[2] for r in v}) > 1 and len({r[3] for r in v}) > 1], key=lambda x: -x[1])[:12])
print('\n## b) SYVONT GGM-29-4')
g = [r for r in p if r['sku'] == 'GGM-29-4']
print('  заказы по месяцу создания и статусу:', dict(collections.Counter((r['created'][:7], r['status']) for r in g)))
q = [r for r in g if r['status'] == 'DELIVERED' and r['created'][:7] in ('2026-07', '2026-08', '2026-09')]
rev = sum(r['revenue'] for r in q); bst = sum(bo.get((r['order'], r['sku']), 0) for r in q); bsm = sum(bom.get((r['order'], r['sku']), 0) for r in q)
print(f"  квартал: доставлено {len(q)}, выручка {rev:,.0f}, буст {bst:,.0f} ({bst / rev:.1%}), буст деньгами {bsm:,.0f}; при 8%: буст {0.08 * rev:,.0f}, меньше на {bst - 0.08 * rev:,.0f}")
print('\n## c) маржа в деньгах, все SKU с выручкой > 150 тыс. (квартал)')
PS = collections.defaultdict(lambda: collections.defaultdict(float))
for r in pnl:
    if r['d'][:7] in ('2026-07', '2026-08', '2026-09') and r['basis'] == 'netting':
        for f in ('accruals', 'amount', 'cogs'): PS[r['sku']][f] += r[f]
SK = collections.defaultdict(lambda: [0.0, 0.0])
for r in p:
    if r['created'][:7] in ('2026-07', '2026-08', '2026-09') and r['status'] == 'DELIVERED': SK[r['sku']][0] += r['revenue']; SK[r['sku']][1] += bo.get((r['order'], r['sku']), 0)
rows = []
for s, (rv, b_) in SK.items():
    if rv < 150000: continue
    ps = PS.get(s); mg = (ps['amount'] - ps['cogs']) / ps['accruals'] if ps and ps['accruals'] and ps['cogs'] else None
    rows.append((s, b_ / rv, mg))
rest = [r for r in rows if r[0] not in ('GGM-29-4', 'GGM-01-1')]
mgs = [r[2] for r in rest if r[2] is not None]
print(f"  SKU {len(rows)}; остальные {len(rest)}: ставка макс {max(r[1] for r in rest):.1%}; маржа мин {min(mgs):.1%} макс {max(mgs):.1%}; без с/с {sum(1 for r in rest if r[2] is None)}")
print('  маржа ниже 34%:', [(s, f"{rt:.1%}", f"{mg:.1%}") for s, rt, mg in rest if mg is not None and mg < 0.34])
print('\n## d) пересечение показов и полок с бустом по выручке (нижняя граница = показы + полки - (revAll - буст))')
pm = {(r['ym'], r['business'], r['kind']): r for r in promo}
for (ym, bz, kd), r in sorted(pm.items()):
    if kd != 'boost' or ym < '2026-07' or not r.get('revAll'): continue
    sh = pm.get((ym, bz, 'shows'), {}).get('rev', 0) + pm.get((ym, bz, 'shelf'), {}).get('rev', 0)
    if sh: print(f"  {ym} {bz}: показы+полки {sh:,.0f}; не-буст выручка {r['revAll'] - r['rev']:,.0f}; в бусте не меньше {max(0, sh - max(0, r['revAll'] - r['rev'])) / sh:.0%}")
