# ФЕНИКС iter3, @ 754cf5c. Эталоны спеки v3 по дню МСК: поле t есть у всех 3794 строк (a02b59d, 15.10 12:05 UTC),
# спека :51 обещает «по дню МСК - отдельный эталон после ночного сбора с полем t». Считаю, что было бы эталоном,
# и проверяю, может ли замороженная выборка теста его держать (есть ли в ней t). python3 -I g3_msk.py
import json, datetime as dt

DD = '/home/user/t1/analytics-mvp/data/'
FX = '/home/user/t1/analytics-mvp/src/scripts/__fixtures__/plan-golden-orders.ndjson'
MSK = dt.timezone(dt.timedelta(hours=3))
od = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
ms = off2sku['GGT-03-3-3-E-16080']
tr = {str(s['sku']) for g in groups if any(str(s['sku']) == ms for s in g['skus']) for s in g['skus']}


def msk(o):
    return dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')).astimezone(MSK).date().isoformat()


def net(a, b, skus=None, day=lambda o: o['d']):
    return sum(int(o.get('units') or 0) for o in od if a <= day(o) <= b and o['status'] != 'cancelled' and (skus is None or str(o.get('sku')) in skus))


print('магазин 01-13.10 без отмен: UTC', net('2026-10-01', '2026-10-13'), '| МСК', net('2026-10-01', '2026-10-13', day=msk))
print('TRUBIS 160 (', len(tr), 'товаров) 14.09-11.10 без отмен: UTC', net('2026-09-14', '2026-10-11', tr), '| МСК', net('2026-09-14', '2026-10-11', tr, day=msk))
fx = [json.loads(l) for l in open(FX, encoding='utf-8') if l.strip()]
print('замороженная выборка:', len(fx), 'строк, поля', sorted({k for r in fx for k in r}), '| с t', sum(1 for r in fx if r.get('t')))

# независимо по карточкам плана, день МСК, без отмен: 01-14.10 и база 14.09-11.10 (для g3_page.mts)
plan = json.load(open(DD + 'plan_2026-10-15.json', encoding='utf-8'))
print('магазин 01-14.10 без отмен МСК', net('2026-10-01', '2026-10-14', day=msk))
for c in plan['cards']:
    m0 = off2sku.get(c['main_art'])
    ss = {str(s['sku']) for g in groups if any(str(s['sku']) == m0 for s in g['skus']) for s in g['skus']}
    print(f"  {c['short']}: 01-14.10 {net('2026-10-01', '2026-10-14', ss, day=msk)} | 14.09-11.10 {net('2026-09-14', '2026-10-11', ss, day=msk)}")
