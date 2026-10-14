# ФЕНИКС iter2, проба Q02: кампания 44988572 (GGT-48-5-1) лежит в карточке KONUX 6279981715.
# Что она даёт карточке (показы, заказы по отчёту рекламы) и меняются ли показы поиска соседей по карточке с её запуском 08.10.
# Прибыль не считает.
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
g = json.load(open(D + 'card_groups.json'))['groups']
card = [x for x in g if x['main'] == '6279981715'][0]
skus = {s['sku']: s['offer'] for s in card['skus']}
ads = L('ads_daily.ndjson')
print('== кампании с товаром карточки 6279981715, 01-11.10: день | id | артикул | расход | показы | заказы по отчёту')
camp_ids = set()
for a in ads:
    if a['off'] in skus.values() and '2026-10-01' <= a['d'] <= '2026-10-11' and a.get('sp', 0) > 0:
        camp_ids.add(a['id'])
for cid in sorted(camp_ids):
    rows = sorted((a['d'], round(a.get('sp', 0)), a.get('vw', 0), a.get('o', 0)) for a in ads if a['id'] == cid and '2026-10-01' <= a['d'] <= '2026-10-11')
    off = next(a['off'] for a in ads if a['id'] == cid)
    tot = [sum(r[i] for r in rows if r[0] >= '2026-10-08') for i in (1, 2, 3)]
    print(' ', cid, off, '08-11.10: расход', tot[0], 'показы', tot[1], 'заказы', tot[2])
sv = L('sku_views.ndjson')
tot = C.Counter(); per = C.defaultdict(C.Counter)
for r in sv:
    tot[r['date']] += r.get('vsearch', 0) or 0
    if r['sku'] in skus: per[r['sku']][r['date']] += r.get('vsearch', 0) or 0
before = [d for d in tot if '2026-10-01' <= d <= '2026-10-07']
after = [d for d in tot if '2026-10-08' <= d <= '2026-10-11']
print('\n== доля товара в показах поиска магазина: 01-07.10 против 08-11.10 (медиана по дням), и показы кампании 44988572')
vwq = C.Counter()
for a in ads:
    if a['id'] == '44988572': vwq[a['d']] += a.get('vw', 0)
for sku, off in sorted(skus.items(), key=lambda x: x[1]):
    b = S.median(per[sku][d] / tot[d] for d in before) if before else 0
    a_ = S.median(per[sku][d] / tot[d] for d in after) if after else 0
    print(f'  {off:22} до {b*100:.3f}%  после {a_*100:.3f}%  ', 'показы поиска 08-11.10', sum(per[sku][d] for d in after))
print('  показы кампании 44988572 08-11.10:', sum(vwq[d] for d in after), 'по дням', [(d, vwq[d]) for d in sorted(after)])
print('  дни в sku_views:', min(tot), max(tot))
