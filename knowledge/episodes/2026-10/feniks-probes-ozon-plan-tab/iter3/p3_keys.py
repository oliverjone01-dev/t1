# iter3, B3: уникальность ключей источников блока (повтор iter2 на тех же data/).
import json
DD = '/home/user/t1/analytics-mvp/data/'
def nd(f): return [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
o = nd('orders_daily.ndjson'); a = nd('ads_sku_daily.ndjson'); d = nd('ads_daily.ndjson')
print('orders (order,sku)', len({(r['order'], str(r['sku'])) for r in o}), '/', len(o))
print('ads_sku_daily (cid,d,sku)', len({(str(r['cid']), r['d'], str(r['sku'])) for r in a}), '/', len(a))
print('ads_daily (id,d)', len({(str(r['id']), r['d']) for r in d}), '/', len(d))
print('orders с полем t:', sum(1 for r in o if r.get('t')), 'из', len(o))
