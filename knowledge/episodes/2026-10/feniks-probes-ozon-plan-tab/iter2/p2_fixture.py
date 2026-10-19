# iter2: фикстуры для live-проб блока. Копия реальных data/ (чтение по symlink) + синтетические дни после 13.10.
# Переопределяемые файлы пишутся НОВЫМИ файлами (symlink на них не создаётся), реальные data/ не меняются.
# python3 -I p2_fixture.py <day1|mid2|nov|msk_t|msk_not|wipe>
import json, os, sys, shutil, datetime as dt
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it2/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
OVR = ('orders_daily.ndjson', 'ads_sku_daily.ndjson', 'ads_daily.ndjson', 'sku_views.ndjson', 'ads_sku_state.json')
for f in os.listdir(DD):
    p = DD + f
    if os.path.isfile(p) and f not in OVR:
        os.symlink(p, OUT + f)
def days(a, b):
    d = dt.date.fromisoformat(a)
    while d.isoformat() <= b:
        yield d.isoformat(); d += dt.timedelta(days=1)
def nd(f):
    return [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
def write(f, rows):
    with open(OUT + f, 'w', encoding='utf-8') as w:
        for r in rows: w.write(json.dumps(r, ensure_ascii=False) + '\n')
TR_MAIN = '3564841366'; OZ_MAIN = '3492791902'; C_O18090 = '3564845759'; OTHER = '9999999999'
real_orders = nd('orders_daily.ndjson')
orders, asd, ad, sv = [], [], [], []
state = json.load(open(DD + 'ads_sku_state.json'))
n = 0
def order(d, sku, units=1, rev=70000, status='delivered', t=None):
    global n; n += 1
    r = dict(order=f'FX-{n}', d=d, status=status, scheme='FBO', sku=sku, offer='FX', units=units, revenue=rev)
    if t is not None: r['t'] = t
    orders.append(r)
last = None
if sc == 'day1':            # данные по 15.10, сборка 16.10
    last = '2026-10-15'
    for d in days('2026-10-14', last):
        for k in range(10): order(d, OTHER)
    order('2026-10-15', TR_MAIN); order('2026-10-15', OZ_MAIN)
elif sc in ('mid2', 'wipe'):  # данные по 17.10, сборка 18.10: магазин 15-17.10 = 34 при пути 32,7
    last = '2026-10-17'
    for d, k in {'2026-10-14': 10, '2026-10-15': 11, '2026-10-16': 11, '2026-10-17': 12}.items():
        for _ in range(k): order(d, OTHER)
    for d in days('2026-10-14', last):
        asd.append(dict(d=d, cid='44988949', sku=TR_MAIN, sp=2857, om=0, ca=1))          # своя кампания главного ровно по плану
        ad.append(dict(d=d, id='44988949', off='GGT-03-3-3-E-16080', sp=2857, o=0, om=0, vw=1000, cl=100, ca=1))
        asd.append(dict(d=d, cid='44989441', sku=TR_MAIN, sp=203, om=0, ca=0))           # на минимуме, рубли на главном
        asd.append(dict(d=d, cid='44989441', sku=OTHER, sp=83, om=0, ca=0))
        ad.append(dict(d=d, id='44989441', off='GGT-E-16080', sp=286, o=0, om=0, vw=100, cl=20, ca=0))
        ad.append(dict(d=d, id='44989034', off='GGT-03-3-3-O-18090', sp=330, o=0, om=0, vw=100, cl=20, ca=0))
        if d < last: asd.append(dict(d=d, cid='44989034', sku=C_O18090, sp=330, om=0, ca=0))
    for k in list(state): state[k] = '2026-10-18'
    for k in ('44988949', '44989441'): state[k] = '2026-10-18'
    state['44989034'] = '2026-10-17'          # последний день 44989034 ещё не собран
    if sc == 'wipe':
        # сбой отчёта у своей кампании TRUBIS 160 (reportRows -> []): строки за окно стёрты, state = сегодня (ad-sku-daily.ts:72-83)
        asd = [r for r in asd if r['cid'] != '44988949']
        state['44988949'] = '2026-10-18'
elif sc == 'nov':           # данные по 02.11, сборка 03.11
    last = '2026-11-02'
    for i, d in enumerate(days('2026-10-14', last)):
        for _ in range(10 if i % 3 else 9): order(d, OTHER)
elif sc in ('msk_t', 'msk_not'):
    # ночной сбор orders-daily: окно до вчера 23:59:59 UTC (orders-daily.ts:24, ozon-seller.ts:372) = 02:59 МСК сегодня.
    # Данные по 20.10 UTC, сборка утром 21.10. Магазин и TRUBIS 160 идут ровно по пути; один заказ в 01:30 МСК 21.10.
    last = '2026-10-20'
    withT = sc == 'msk_t'
    for r in real_orders:
        if withT: r['t'] = r['d'] + 'T12:00:00.000Z'   # реальные заказы - днём, день не меняется
    for d in days('2026-10-14', last):
        for _ in range(10): order(d, OTHER, t=(d + 'T12:00:00.000Z') if withT else None)
    for d in ('2026-10-17',):
        for _ in range(4): order(d, OTHER, t=(d + 'T12:00:00.000Z') if withT else None)   # прирост с 17.10
    for d in days('2026-10-15', last):
        order(d, TR_MAIN, t=(d + 'T12:00:00.000Z') if withT else None)
        if d in ('2026-10-15', '2026-10-17', '2026-10-19', '2026-10-20'): order(d, TR_MAIN, t=(d + 'T12:00:00.000Z') if withT else None)
    order('2026-10-20', OTHER, t='2026-10-20T22:30:00.000Z' if withT else None)       # 01:30 МСК 21.10
else:
    sys.exit('scenario?')
write('orders_daily.ndjson', real_orders + orders)
write('ads_sku_daily.ndjson', nd('ads_sku_daily.ndjson') + asd)
write('ads_daily.ndjson', nd('ads_daily.ndjson') + ad)
with open(OUT + 'ads_sku_state.json', 'w') as w: json.dump(state, w)
with open(OUT + 'sku_views.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
        w.write(l if l.endswith('\n') else l + '\n')
    for d in days('2026-10-14', last): w.write(json.dumps(dict(date=d, sku=OTHER, views=1000, vsearch=500, pdp=50, cart=5, units=1)) + '\n')
print('fixture', sc, 'по', last, 'заказов +', len(orders), 'реклама +', len(asd), len(ad), 'symlink-ов', len([f for f in os.listdir(OUT) if os.path.islink(OUT + f)]))
