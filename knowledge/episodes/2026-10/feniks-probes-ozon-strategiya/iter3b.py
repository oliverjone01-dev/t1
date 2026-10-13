"""ФЕНИКС, итерация 3: потеря прибыли пилота цены -10% без роста заказов (формула блока «нужный рост» floor.py).
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter3b.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
cg = json.load(open(D / 'card_groups.json', encoding='utf-8'))
card_of = {x['sku']: g['main'] for g in cg['groups'] for x in g['skus']}
rows = json.load(open(ROOT / 'knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', encoding='utf-8'))
step1 = {'6279981715', '4756834245', '5728188877'}
sel = [r for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5
       and card_of.get(r['sku']) not in step1 and r['art'] != 'GGT-12-2']
loss = 0.0
for r in sel:
    k = 0.70 * (r['keep'] - 0.05) - 0.15 * r['s']
    loss += r['p0'] * 0.10 * k * r['wk']
print('15 товаров: потеря прибыли как в «Отчете» при -10%% без роста заказов %.0f ₽ в неделю на всех; на половине %.0f; за 4 недели на половине %.0f' % (
    loss, loss / 2, loss / 2 * 4))
