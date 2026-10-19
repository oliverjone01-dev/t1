# ФЕНИКС iter4. Проба V3d: остаток выводимых артикулов (skus_live_30d.json коммита) - кончатся ли они в окне 15-28.10.
# Если остаток мал, их спрос в окне уходит (замещение) и порог v3 пропускает «без эффекта» чаще (v4_subst.py).
# python3 -I v4_stock.py
import json
DD = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/data_753bf11/analytics-mvp/data/'
S = json.load(open(DD + 'skus_live_30d.json', encoding='utf-8'))
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
W = {off2sku[a]: a for a in P['withdrawn']}
items = None
for k, v in S.items():
    if isinstance(v, list) and v and isinstance(v[0], dict) and any(x in v[0] for x in ('sku', 'offer', 'offer_id')):
        items = v; print('массив товаров:', k, '| поля:', sorted(v[0].keys())[:30]); break
if items is None:
    print('ключи файла:', list(S.keys())); raise SystemExit
stock_keys = [k for k in items[0] if any(w in k.lower() for w in ('stock', 'fbo', 'ost', 'qty', 'present', 'oos', 'days'))]
print('поля остатка:', stock_keys)
hit = [x for x in items if str(x.get('sku')) in W or x.get('offer') in W.values() or x.get('offer_id') in W.values()]
print('выводимых в файле:', len(hit), 'из', len(W))
for x in hit[:30]:
    print(' ', x.get('offer') or x.get('offer_id') or W.get(str(x.get('sku'))), {k: x.get(k) for k in stock_keys}, 'units30', x.get('units'))
