"""ФЕНИКС, итерация 2: размер пилота цены вне карточек шага 1 и без товара партии; доля GGT-03 для правила отката.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter2d.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
cg = json.load(open(D / 'card_groups.json', encoding='utf-8'))
card_of = {x['sku']: g['main'] for g in cg['groups'] for x in g['skus']}
members = {g['main']: set(x['sku'] for x in g['skus']) for g in cg['groups']}
rows = json.load(open(ROOT / 'knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', encoding='utf-8'))
sel = [r for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5]
step1 = {'6279981715', '4756834245', '5728188877'}
rest = [r for r in sel if card_of.get(r['sku']) not in step1 and r['art'] != 'GGT-12-2']
print('пилот цены вне карточек шага 1 и без GGT-12-2: товаров', len(rest), 'заказов в неделю %.1f' % (sum(r['u60'] for r in rest) / 60 * 7),
      '| GGT-12-2 в карточках шага 1:', any(r['art'] == 'GGT-12-2' and card_of.get(r['sku']) in step1 for r in sel))
orders = [json.loads(l) for l in open(D / 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
nc = [r for r in orders if r['status'] != 'cancelled']
X = ('2026-10-08', '2026-10-09')
def n(a, b, s=None):
    return sum(1 for r in nc if a <= r['d'] <= b and r['d'] not in X and (s is None or r['sku'] in s))
G = members['4756834245']
print('GGT-03 доля: 13.09-10.10 без 08-09.10 %.1f%%, 27.09-10.10 без 08-09.10 %.1f%%' % (
    100 * n('2026-09-13', '2026-10-10', G) / n('2026-09-13', '2026-10-10'), 100 * n('2026-09-27', '2026-10-10', G) / n('2026-09-27', '2026-10-10')))
