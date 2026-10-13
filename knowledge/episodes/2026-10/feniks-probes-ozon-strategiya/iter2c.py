"""ФЕНИКС, итерация 2: пересечение пилота цены (28 товаров) с пулом партии дешёвой рекламы (условия шага 3 Word).
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter2c.py
"""
import json, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
nd = lambda n: [json.loads(l) for l in open(D / n, encoding='utf-8') if l.strip()]
orders = nd('orders_daily.ndjson')
sold = collections.Counter(r['sku'] for r in orders if r['status'] != 'cancelled' and '2026-08-12' <= r['d'] <= '2026-10-10')
offer = {r['sku']: r['offer'] for r in orders}
asd = nd('ads_sku_daily.ndjson')
ad_sep = set(r['sku'] for r in asd if r['d'] >= '2026-09-01' and (r.get('sp') or 0) > 0)
ad_oct = set(r['sku'] for r in asd if r['d'] >= '2026-10-01' and (r.get('sp') or 0) > 0)
cg = json.load(open(D / 'card_groups.json', encoding='utf-8'))
card_of = {x['sku']: g['main'] for g in cg['groups'] for x in g['skus']}
t = json.load(open(ROOT / 'analytics-mvp/tools/tests/tests.json', encoding='utf-8'))
tests = set()
def walk(x):
    if isinstance(x, str) and x.startswith('GG'): tests.add(x)
    elif isinstance(x, list): [walk(y) for y in x]
    elif isinstance(x, dict): [walk(v) for v in x.values()]
for k in ('тесты', 'тесты_ставок', 'тесты_цены'): walk(t[k])
test_cards = set(card_of[s] for s, o in offer.items() if o in tests and s in card_of)
ad_cards = set(card_of[s] for s in ad_oct if s in card_of)
pool = [s for s in sold if s not in ad_sep and card_of.get(s) not in ad_cards and offer.get(s) not in tests and card_of.get(s) not in test_cards]
rows = json.load(open(ROOT / 'knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', encoding='utf-8'))
sel = set(r['sku'] for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5)
print('пул партии по условиям шага 3:', len(pool), '| пилот цены:', len(sel), '| пересечение:', len(sel & set(pool)), sorted(offer.get(s, s) for s in sel & set(pool)))
