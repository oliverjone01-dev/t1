# iter2, G6: из каких кампаний складывается «клик главного» после правки (без CPO и без 11 на минимум), 08-12.10.
# python3 -I p2_main.py
import json, collections
DD = '/home/user/t1/analytics-mvp/data/'
def nd(f):
    return [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
CPO = '28753239'
plan = json.load(open(DD + 'plan_2026-10-15.json'))
tomin = {str(k['cid']) for k in plan['to_min']}
groups = json.load(open(DD + 'card_groups.json'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
ad = nd('ads_daily.ndjson')
title = {}
for r in ad: title[str(r['id'])] = r.get('off', '')
asd = nd('ads_sku_daily.ndjson')
A, B = '2026-10-08', '2026-10-12'
for c in plan['cards']:
    ms = off2sku.get(c['main_art'])
    by = collections.defaultdict(float)
    for r in asd:
        if A <= r['d'] <= B and str(r['sku']) == ms and str(r['cid']) != CPO: by[str(r['cid'])] += float(r['sp'] or 0)
    inc = {k: v for k, v in by.items() if k not in tomin}
    exc = {k: v for k, v in by.items() if k in tomin}
    print(f"{c['short']:12} click_now {c['click_now']:>6} click_new {c['click_new']:>6} | в строке (5 дн) {round(sum(inc.values())):>6}:",
          ', '.join(f"{k} «{title.get(k, '')[:22]}» {round(v)}" for k, v in sorted(inc.items(), key=lambda x: -x[1])),
          '| исключено (на минимум):', ', '.join(f"{k} {round(v)}" for k, v in exc.items()) or '-')
