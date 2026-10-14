# ФЕНИКС, итерация 3, проба 10 (R4): П4 и П5 в одной единице теста. Доля KONUX 5-1 в заказах кабинета мебели в октябре
# и остаток 5-1 по каталогу (снимок 13.10). Только чтение. Запуск: python3 -I feniks_iter3_10_p4_p5_overlap.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
o = [json.loads(l) for l in open(D + 'orders.ndjson')]
cat = json.load(open(D + 'catalog.json', encoding='utf-8'))
items = cat.get('items', cat) if isinstance(cat, dict) else cat
F = '74986385'; S = 'GGT-35-5-1-100-180'
p = [r for r in o if not r['service'] and r['business'] == F]
for a, z in (('2026-09-14', '2026-10-01'), ('2026-10-02', '2026-10-12')):
    allc = [r for r in p if a <= r['created'] <= z and not r['status'].startswith('CANCELLED')]
    s51 = [r for r in allc if r['sku'] == S]
    print(f'{a[5:]}-{z[5:]}: заказы мебели без отмен {len(allc)}, из них KONUX 5-1 {len(s51)} ({len(s51) / len(allc):.0%})')
print('остаток 5-1 по каталогу на 13.10:', items[S].get('stock'), '; цена', items[S].get('price'))
d51 = sum(r['count'] for r in p if r['sku'] == S and '2026-10-02' <= r['created'] <= '2026-10-12')
print(f'темп 5-1 с 02.10: {d51} ед. за 11 дней = {d51 / 11:.1f} в день; остатка хватит на {items[S].get("stock") / (d51 / 11):.0f} дн. при этом темпе')
