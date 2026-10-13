"""ФЕНИКС, итерация 3 (18f699c): траектория расхода по календарю v3 и пересечение карточек пилота цены и партии.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter3.py
"""
import json, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
nd = lambda n: [json.loads(l) for l in open(D / n, encoding='utf-8') if l.strip()]

ads = nd('ads_daily.ndjson')
day = collections.defaultdict(dict)
for r in ads:
    if r['d'] in ('2026-10-09', '2026-10-10'):
        day[r['id']][r['d']] = r['sp']
rr = {k: (v.get('2026-10-09', 0) + v.get('2026-10-10', 0)) / 2 * 7 for k, v in day.items()}
cut = lambda ids, lim: sum(rr[i] for i in ids) - lim * len(ids)
konux = cut(['37675958', '44988572'], 2000)
steps = [('13.10 KONUX', -konux), ('27.10 O-20090 40015169 и партия +30 000', -cut(['40015169'], 2000) + 30000),
         ('03.11 GGT-47 44920406', -cut(['44920406'], 2000)), ('17.11 O-18090 44989034', -cut(['44989034'], 2000)),
         ('24.11 конец партии', -30000), ('01.12 3-5-E-16080 44988191', -cut(['44988191'], 2000))]
total = 0
print('§1 Расход в неделю к нынешнему темпу (09-10.10), по календарю v3:')
for name, delta in steps:
    total += delta
    print('   с %-40s %+8.0f  итого %+8.0f' % (name, delta, total))

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
pool_cards = set(card_of[s] for s in pool if s in card_of)
rows = json.load(open(ROOT / 'knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', encoding='utf-8'))
step1 = {'6279981715', '4756834245', '5728188877'}
sel = [r for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5
       and card_of.get(r['sku']) not in step1 and r['art'] != 'GGT-12-2']
print('\n§2 Пилот цены, 15 товаров: в карточках пула партии', sum(1 for r in sel if card_of.get(r['sku']) in pool_cards),
      '| в карточках KUVINO 4714207903 и GGT-46 4756832758', sum(1 for r in sel if card_of.get(r['sku']) in ('4714207903', '4756832758')),
      '| в карточках с рекламой за клик в октябре', sum(1 for r in sel if card_of.get(r['sku']) in ad_cards),
      '| вне карты карточек', sum(1 for r in sel if r['sku'] not in card_of))
cards15 = collections.Counter(card_of.get(r['sku'], 'solo') for r in sel)
print('   по карточкам:', dict(cards15))
