# ФЕНИКС, итерация 4, проба 5 (S2): таблица всех 7 вариантов KONUX D100/180 в З8 своим кодом.
# Окна как в подписи артефакта:111: показы в день 07.09-30.09 против 01.10-12.10 (отчёт показов, строки без aggregate),
# единицы отчёта показов за те же окна, заказы без отмен 02-12.10 (orders), остаток и цена каталога на 13.10 (catalog.json).
# Плюс то, что просил rework_tz итерации 3: цена 1-3 в заказах конца сентября, корзины 1-3 в день в октябре, темп 5-1.
# Только чтение. Запуск: python3 -I feniks_iter4_5_konux_table.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
sv = [json.loads(l) for l in open(D + 'sku_views.ndjson')]
o = [json.loads(l) for l in open(D + 'orders.ndjson')]
cat = json.load(open(D + 'catalog.json'))
V = sorted(k for k in cat['items'] if k.startswith('GGT-35-') and k.endswith('-100-180'))
agg = collections.defaultdict(lambda: collections.defaultdict(float))
for r in sv:
    if r.get('aggregate') or r['sku'] not in V:
        continue
    win = 'pre' if '2026-09-07' <= r['date'] <= '2026-09-30' else 'post' if '2026-10-01' <= r['date'] <= '2026-10-12' else None
    if win:
        for f in ('views', 'units', 'cart'):
            agg[(r['sku'], win)][f] += r[f]
days = {'pre': 24, 'post': 12}
ords = collections.Counter(r['sku'] for r in o if not r['service'] and r['sku'] in V and '2026-10-02' <= r['created'] <= '2026-10-12'
                           and not r['status'].startswith('CANCELLED'))
print('вариант | показы в день 07-30.09 -> 01-12.10 | единиц | заказов без отмен 02-12.10 | остаток 13.10 | цена каталога | последний seen')
su = {'pre': 0, 'post': 0}
for s in V:
    a, b2 = agg[(s, 'pre')], agg[(s, 'post')]
    su['pre'] += a['units']; su['post'] += b2['units']
    it = cat['items'][s]
    print(f"{s} | {a['views'] / 24:,.0f} -> {b2['views'] / 12:,.0f} | {a['units']:.0f} -> {b2['units']:.0f} | {ords.get(s, 0)} | {it.get('stock')} | {it.get('price'):,} | {it.get('seen', '')[:10]}")
print(f"модель целиком: единиц в день {su['pre'] / 24:.2f} -> {su['post'] / 12:.2f}")
c13 = agg[('GGT-35-1-3-100-180', 'post')]['cart']
print(f"GGT-35-1-3: корзин в день 01-12.10 {c13 / 12:.1f}, единиц {agg[('GGT-35-1-3-100-180', 'post')]['units']:.0f}")
pr = [(r['created'][5:], r['price'], r['status']) for r in o if not r['service'] and r['sku'] == 'GGT-35-1-3-100-180' and r['created'] >= '2026-09-20']
print('GGT-35-1-3, заказы с 20.09 (дата, цена, статус):', pr)
o51 = [r for r in o if not r['service'] and r['sku'] == 'GGT-35-5-1-100-180' and '2026-10-02' <= r['created'] <= '2026-10-12']
print(f"GGT-35-5-1, 02-12.10: заказов {len(o51)}, без отмен {sum(1 for r in o51 if not r['status'].startswith('CANCELLED'))}, "
      f"в день без отмен {sum(1 for r in o51 if not r['status'].startswith('CANCELLED')) / 11:.2f}, всех {len(o51) / 11:.2f}")
txt = open('/home/user/t1/knowledge/episodes/2026-10/ym-reklama-analiz-20261014.md', encoding='utf-8').read()
for t in ('86 433', '4,8 корзин', 'корзин'):
    print(f'в артефакте «{t}»: {txt.count(t)}')
