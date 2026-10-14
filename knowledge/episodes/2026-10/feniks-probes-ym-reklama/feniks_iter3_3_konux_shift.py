# ФЕНИКС, итерация 3, проба 3 (R2): перетекание заказов внутри модели KONUX D100/180 и ставка соседних вариантов.
# (а) все заказы KONUX (по названию) с 01.09 по SKU и дате создания: не ушёл ли спрос с 1-3 на 5-1 (каннибализация контроля П4);
# (б) ставка буста по дате создания заказа у вариантов 100/180: сентябрь против октября (видна ли смена ставки у соседей);
# (в) снимок заказов: последняя дата создания (чтобы ноль октября у 1-3 не был обрезкой выгрузки).
# Только чтение analytics-mvp/data-ym. Запуск: python3 -I feniks_iter3_3_konux_shift.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
o = rd('orders.ndjson'); n = rd('netting.ndjson')
B = 'Буст продаж, оплата за продажи'
p = [r for r in o if not r['service']]
print('(в) последняя дата создания в orders.ndjson:', max(r['created'] for r in p), '; заказов с 01.10:', sum(1 for r in p if r['created'] >= '2026-10-01'))
k = [r for r in p if 'KONUX' in r['name'].upper() and r['created'] >= '2026-09-01']
by = collections.defaultdict(lambda: collections.Counter())
for r in k:
    half = '09-01..15' if r['created'] <= '2026-09-15' else '09-16..30' if r['created'] <= '2026-09-30' else '10-01..12'
    by[r['sku']][half] += r['count']
print('(а) KONUX, единиц в заказах по периодам создания (16 дней / 15 дней / 12 дней):')
tot = collections.Counter()
for s in sorted(by):
    c = by[s]; tot.update(c)
    print(f'  {s}: {c["09-01..15"]} / {c["09-16..30"]} / {c["10-01..12"]}')
print(f'  итого KONUX: {tot["09-01..15"]} / {tot["09-16..30"]} / {tot["10-01..12"]}; в день: {tot["09-01..15"] / 15:.2f} / {tot["09-16..30"] / 15:.2f} / {tot["10-01..12"] / 12:.2f}')
fam = lambda s: s.startswith('GGT-35-') and s.endswith('-100-180')
f = collections.Counter()
for r in k:
    if fam(r['sku']):
        f['09' if r['created'][:7] == '2026-09' else '10'] += r['count']
print(f'  модель 100/180 (все варианты): сентябрь {f["09"]} ед. ({f["09"] / 30:.2f} в день), 01-12.10 {f["10"]} ед. ({f["10"] / 12:.2f} в день)')
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание'):
        bo[(r['order'], r['sku'])] += abs(r['amount'])
print('(б) ставка буста по дате создания (проведённые заказы), варианты 100/180: дата создания, ставка')
for s in sorted({r['sku'] for r in k if fam(r['sku'])}):
    xs = sorted((r['created'][5:], bo[(r['order'], r['sku'])] / (r['price'] * r['count'])) for r in k if r['sku'] == s and bo.get((r['order'], r['sku'])))
    print(f'  {s}: ' + ', '.join(f'{d} {x:.1%}' for d, x in xs))
# 1-3: последние заказы и их статусы
print('GGT-35-1-3-100-180, заказы с 20.09:', [(r['created'][5:], r['status'][:12], r['price'], r['p_buyer']) for r in sorted(k, key=lambda r: r['created']) if r['sku'] == 'GGT-35-1-3-100-180' and r['created'] >= '2026-09-20'])
print('GGT-35-5-1-100-180, платёж покупателя по датам создания с 20.09:', [(r['created'][5:], r['p_buyer']) for r in sorted(k, key=lambda r: r['created']) if r['sku'] == 'GGT-35-5-1-100-180' and r['created'] >= '2026-09-20'][:12])
