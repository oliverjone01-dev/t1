# ФЕНИКС, PR #477 @ 889c35b. Фикстуры блока «План» (перенос p3_fixture_dec.py iter3 + сверка с кабинетом).
#   dec28 - утро 29.10, ночной сбор прошёл (заказы по 28.10); dec27 - не прошёл (заказы по 27.10).
#     TRUBIS 160: 2 заказа в день 15-28.10 + 3 заказа 28.10 = 31 = порог; магазин 12 в день (sku-заглушка).
#   cabok  - заказы по 20.10 (TRUBIS 160 главный sku 2/день, второй sku той же карточки 1/день), файл кабинета совпадает.
#   caboff - те же заказы; кабинет по TRUBIS +3 шт, по второй карточке -3 шт: у каждой карточки мимо, в сумме ноль.
#   cabcov - те же заказы; кабинет выгрузил только главный sku карточки (1 из 2 товаров с заказами).
# python3 -I c6_fixture_plan.py <dec28|dec27|cabok|caboff|cabcov>
import json, os, sys, shutil, datetime as dt

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fxp_' + sc + '/'
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
OVR = ('orders_daily.ndjson', 'sku_views.ndjson', 'cabinet_orders_check.ndjson')
for f in os.listdir(DD):
    if os.path.isfile(DD + f) and f not in OVR:
        os.symlink(DD + f, OUT + f)


def days(a, b):
    d = dt.date.fromisoformat(a)
    while d.isoformat() <= b:
        yield d.isoformat()
        d += dt.timedelta(days=1)


real = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
plan = json.load(open(DD + 'plan_2026-10-15.json', encoding='utf-8'))
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
TR_MAIN = off2sku['GGT-03-3-3-E-16080']
tr_group = next(g for g in groups if any(str(s['sku']) == TR_MAIN for s in g['skus']))
TR_SECOND = next(str(s['sku']) for s in tr_group['skus'] if str(s['sku']) != TR_MAIN)
c2 = next(c for c in plan['cards'] if c['main_art'] != 'GGT-03-3-3-E-16080')
C2_MAIN = off2sku[c2['main_art']]
OTHER = '9999999999'
rows, n = [], 0


def order(d, sku, k=1):
    global n
    for _ in range(k):
        n += 1
        rows.append(dict(order=f'FX-{n}', d=d, t=f'{d}T12:00:00.000Z', status='delivered', scheme='FBO', sku=sku, offer='FX', units=1, revenue=70000))


for r in real:
    r['t'] = r['d'] + 'T12:00:00.000Z'
cab = []
if sc in ('dec28', 'dec27'):
    last = '2026-10-28' if sc == 'dec28' else '2026-10-27'
    for d in days('2026-10-14', last):
        order(d, OTHER, 12)
        if d >= '2026-10-15':
            order(d, TR_MAIN, 2)
            if d == '2026-10-28':
                order(d, TR_MAIN, 3)
else:
    last = '2026-10-20'
    for d in days('2026-10-14', last):
        order(d, OTHER, 12)
        if d >= '2026-10-15':
            order(d, TR_MAIN, 2); order(d, TR_SECOND, 1); order(d, C2_MAIN, 2)
            if sc == 'cabok':
                cab += [(d, TR_MAIN, 2), (d, TR_SECOND, 1), (d, C2_MAIN, 2)]
            elif sc == 'caboff':
                cab += [(d, TR_MAIN, 2 + (3 if d == '2026-10-15' else 0)), (d, TR_SECOND, 1), (d, C2_MAIN, 2 - (2 if d == '2026-10-15' else 0) - (1 if d == '2026-10-16' else 0))]
            elif sc == 'cabcov':
                cab += [(d, TR_MAIN, 2), (d, C2_MAIN, 2)]
with open(OUT + 'orders_daily.ndjson', 'w', encoding='utf-8') as w:
    for r in real + rows:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(OUT + 'sku_views.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
        w.write(l if l.endswith('\n') else l + '\n')
    for d in days('2026-10-14', last):
        w.write(json.dumps(dict(date=d, sku=OTHER, views=1000, vsearch=500, pdp=50, cart=5, units=12)) + '\n')
if cab:
    with open(OUT + 'cabinet_orders_check.ndjson', 'w', encoding='utf-8') as w:
        for d, s, u in cab:
            w.write(json.dumps(dict(date=d, sku=s, art='FX', ordered_units=u, source='cabinet', ts=f'{d}T08:00:00+03:00'), ensure_ascii=False) + '\n')
print('fixture', sc, 'заказы по', last, '+', len(rows), '| кабинет строк', len(cab), '| TR_MAIN', TR_MAIN, 'TR_SECOND', TR_SECOND, 'C2', c2['short'], C2_MAIN)
