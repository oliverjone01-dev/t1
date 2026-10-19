# iter3: утро решения 29.10. dec28 - ночной сбор прошёл (заказы по 28.10); dec27 - сбор 29.10 не прошёл (заказы по 27.10).
# TRUBIS 160: 2 заказа в день 15-28.10 + 3 заказа 28.10 = 31 = порог; магазин - 12 в день.
# python3 -I p3_fixture_dec.py <dec28|dec27>
import json, os, sys, shutil, datetime as dt
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it3/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
OVR = ('orders_daily.ndjson', 'sku_views.ndjson')
for f in os.listdir(DD):
    if os.path.isfile(DD + f) and f not in OVR: os.symlink(DD + f, OUT + f)
def days(a, b):
    d = dt.date.fromisoformat(a)
    while d.isoformat() <= b:
        yield d.isoformat(); d += dt.timedelta(days=1)
real = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
TR_MAIN = '3564841366'; OTHER = '9999999999'
last = '2026-10-28' if sc == 'dec28' else '2026-10-27'
rows, n = [], 0
def order(d, sku):
    global n; n += 1
    rows.append(dict(order=f'FX-{n}', d=d, t=f'{d}T12:00:00.000Z', status='delivered', scheme='FBO', sku=sku, offer='FX', units=1, revenue=70000))
for r in real: r['t'] = r['d'] + 'T12:00:00.000Z'
for d in days('2026-10-14', last):
    for _ in range(12): order(d, OTHER)
    if d >= '2026-10-15':
        order(d, TR_MAIN); order(d, TR_MAIN)
        if d == '2026-10-28':
            for _ in range(3): order(d, TR_MAIN)
with open(OUT + 'orders_daily.ndjson', 'w', encoding='utf-8') as w:
    for r in real + rows: w.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(OUT + 'sku_views.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'sku_views.ndjson', encoding='utf-8'): w.write(l if l.endswith('\n') else l + '\n')
    for d in days('2026-10-14', last): w.write(json.dumps(dict(date=d, sku=OTHER, views=1000, vsearch=500, pdp=50, cart=5, units=12)) + '\n')
print('fixture', sc, 'заказы по', last, '+', len(rows))
