# ФЕНИКС 14.10, итерация 2, проба U1: в каких ценах выручка рекламы по артикулам (ads_attr_daily om/omM) -
# цена продавца (как Начислено) или цена покупателя. Если покупателя - отдача добора в базе «Начислено» занижена в ~2,3 раза.
import json, collections
D = '/home/user/t1/analytics-mvp/data/'
od = collections.defaultdict(lambda: [0.0, 0])
for l in open(D + 'orders_daily.ndjson'):
    r = json.loads(l)
    if r['status'] == 'cancelled': continue
    a = od[(r['sku'], r['d'][:7])]; a[0] += r['revenue']; a[1] += r['units']
at = collections.defaultdict(lambda: [0.0, 0])
for l in open(D + 'ads_attr_daily.ndjson'):
    r = json.loads(l)
    a = at[(str(r['sku']), r['d'][:7])]; a[0] += (r.get('om') or 0) + (r.get('omM') or 0); a[1] += (r.get('sold') or 0) + (r.get('soldM') or 0)
ratios = sorted((om / s) / (od[k][0] / od[k][1]) for k, (om, s) in at.items()
                if k[1] in ('2026-07', '2026-08', '2026-09') and s and k in od and od[k][1])
print('пар артикул-месяц', len(ratios), '; цена в отчёте рекламы / цена в заказах: медиана', round(ratios[len(ratios) // 2], 3),
      'квартили', round(ratios[len(ratios) // 4], 3), round(ratios[3 * len(ratios) // 4], 3))
