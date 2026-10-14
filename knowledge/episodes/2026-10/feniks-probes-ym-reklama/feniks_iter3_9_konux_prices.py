# ФЕНИКС, итерация 3, проба 9 (R2): цена продавца вариантов KONUX 100/180 - каталог на 13.10 против цены в заказах сентября;
# есть ли история цен (history.ndjson). Только чтение. Запуск: python3 -I feniks_iter3_9_konux_prices.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
cat = json.load(open(D + 'catalog.json', encoding='utf-8'))
items = cat.get('items', cat) if isinstance(cat, dict) else cat
o = [json.loads(l) for l in open(D + 'orders.ndjson')]
fam = lambda s: s.startswith('GGT-35-') and s.endswith('-100-180')
print('вариант | каталог 13.10: цена / basicPrice / остаток | цена в заказах сентября (мин-макс) | цена в заказах 01-12.10 (мин-макс)')
for s in sorted(k for k in items if fam(k)):
    c = items[s]
    sep = [r['price'] for r in o if not r['service'] and r['sku'] == s and r['created'][:7] == '2026-09']
    octo = [r['price'] for r in o if not r['service'] and r['sku'] == s and r['created'][:7] == '2026-10']
    rng = lambda xs: f'{min(xs):,}-{max(xs):,}' if xs else '-'
    print(f'  {s} | {c.get("price"):,} / {c.get("basicPrice"):,} / {c.get("stock")} | {rng(sep)} | {rng(octo)}')
# история: какие поля и есть ли цена по дням
h = [json.loads(l) for l in open(D + 'history.ndjson')]
print('history.ndjson: строк', len(h), '; ключи первой строки:', sorted(h[0].keys())[:25])
hs = [r for r in h if any(fam(str(v)) for v in r.values() if isinstance(v, str))]
print('строк истории с вариантами KONUX 100/180:', len(hs))
for r in hs[:5]:
    print('  ', {k: r[k] for k in list(r)[:12]})
