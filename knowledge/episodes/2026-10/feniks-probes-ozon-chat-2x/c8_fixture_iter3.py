# Копия p3_fixture.py (iter3) с путём scratch этого аудита. Каталог фикстуры: scratch/fx_<сценарий>.
# iter3: фикстуры для live-проб блока (база - p2_fixture.py iter2, те же сценарии + новые).
# Копия реальных data/ (symlink на чтение) + синтетические дни после 13.10. Реальные data/ не меняются.
# python3 -I p3_fixture.py <day1|mid2|nov|msk_t|msk_not|wipe|mid3|wipep|wipe3|msk_r|msk_r_not>
#   mid3   - mid2, но 13.10 «досчитан» (к 18.10 сбор кампаний за 13.10 закончен): иначе 95%-порог режет 13.10 и сценарий не про то
#   wipep  - mid3 + сбой отчёта своей кампании TRUBIS 160 (44988949): стёрты строки 14-17.10, state = сегодня (как wipe iter2)
#   wipe3  - mid3 + тот же сбой, но как в коде сборщика: стёрто ВСЁ окно 62 дня кампании (ad-sku-daily.ts kept/processed)
#   msk_r  - ночной сбор с полем t: время заказа псевдослучайно по 24 часам UTC (часть заказов уходит в следующий день МСК)
#   msk_r_not - те же заказы без t
import json, os, sys, shutil, datetime as dt, hashlib
SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/'
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
real_asd = nd('ads_sku_daily.ndjson'); real_ad = nd('ads_daily.ndjson')
orders, asd, ad, sv = [], [], [], []
state = json.load(open(DD + 'ads_sku_state.json'))
n = 0
def order(d, sku, units=1, rev=70000, status='delivered', t=None):
    global n; n += 1
    r = dict(order=f'FX-{n}', d=d, status=status, scheme='FBO', sku=sku, offer='FX', units=units, revenue=rev)
    if t is not None: r['t'] = t
    orders.append(r)
def hh(key):   # детерминированный «час» заказа 0..23 и минуты
    h = int(hashlib.sha1(key.encode()).hexdigest()[:8], 16)
    return h % 24, (h // 24) % 60
last = None
if sc == 'day1':
    last = '2026-10-15'
    for d in days('2026-10-14', last):
        for k in range(10): order(d, OTHER)
    order('2026-10-15', TR_MAIN); order('2026-10-15', OZ_MAIN)
elif sc in ('mid2', 'wipe', 'mid3', 'wipep', 'wipe3'):
    last = '2026-10-17'
    for d, k in {'2026-10-14': 10, '2026-10-15': 11, '2026-10-16': 11, '2026-10-17': 12}.items():
        for _ in range(k): order(d, OTHER)
    for d in days('2026-10-14', last):
        asd.append(dict(d=d, cid='44988949', sku=TR_MAIN, sp=2857, om=0, ca=1))
        ad.append(dict(d=d, id='44988949', off='GGT-03-3-3-E-16080', sp=2857, o=0, om=0, vw=1000, cl=100, ca=1))
        asd.append(dict(d=d, cid='44989441', sku=TR_MAIN, sp=203, om=0, ca=0))
        asd.append(dict(d=d, cid='44989441', sku=OTHER, sp=83, om=0, ca=0))
        ad.append(dict(d=d, id='44989441', off='GGT-E-16080', sp=286, o=0, om=0, vw=100, cl=20, ca=0))
        ad.append(dict(d=d, id='44989034', off='GGT-03-3-3-O-18090', sp=330, o=0, om=0, vw=100, cl=20, ca=0))
        if d < last: asd.append(dict(d=d, cid='44989034', sku=C_O18090, sp=330, om=0, ca=0))
    for k in list(state): state[k] = '2026-10-18'
    state['44989034'] = '2026-10-17'
    if sc in ('mid3', 'wipep', 'wipe3'):
        # 13.10 досчитан: недостающий расход кампаний за 13.10 - строкой на товар вне карточек (на карточки не влияет)
        camp, got = {}, {}
        for r in real_ad:
            if r['d'] == '2026-10-13': camp[str(r['id'])] = camp.get(str(r['id']), 0) + float(r.get('sp') or 0)
        for r in real_asd:
            if r['d'] == '2026-10-13': got[str(r['cid'])] = got.get(str(r['cid']), 0) + float(r.get('sp') or 0)
        filled = 0
        for c, v in camp.items():
            if v > 0 and got.get(c, 0) < v:
                asd.append(dict(d='2026-10-13', cid=c, sku=OTHER, sp=round(v - got.get(c, 0)), om=0, ca=0)); filled += 1
        print('13.10 досчитано кампаний:', filled)
    if sc in ('wipe', 'wipep'):
        asd = [r for r in asd if r['cid'] != '44988949']
        state['44988949'] = '2026-10-18'
    if sc == 'wipe3':
        frm = (dt.date.fromisoformat('2026-10-17') - dt.timedelta(days=61)).isoformat()
        before = len(real_asd)
        real_asd = [r for r in real_asd if not (str(r['cid']) == '44988949' and frm <= r['d'] <= '2026-10-17')]
        asd = [r for r in asd if r['cid'] != '44988949']
        state['44988949'] = '2026-10-18'
        print('wipe3: стёрто реальных строк 44988949 в окне', frm, '..17.10:', before - len(real_asd))
elif sc == 'nov':
    last = '2026-11-02'
    for i, d in enumerate(days('2026-10-14', last)):
        for _ in range(10 if i % 3 else 9): order(d, OTHER)
elif sc in ('msk_t', 'msk_not'):
    last = '2026-10-20'
    withT = sc == 'msk_t'
    for r in real_orders:
        if withT: r['t'] = r['d'] + 'T12:00:00.000Z'
    for d in days('2026-10-14', last):
        for _ in range(10): order(d, OTHER, t=(d + 'T12:00:00.000Z') if withT else None)
    for d in ('2026-10-17',):
        for _ in range(4): order(d, OTHER, t=(d + 'T12:00:00.000Z') if withT else None)
    for d in days('2026-10-15', last):
        order(d, TR_MAIN, t=(d + 'T12:00:00.000Z') if withT else None)
        if d in ('2026-10-15', '2026-10-17', '2026-10-19', '2026-10-20'): order(d, TR_MAIN, t=(d + 'T12:00:00.000Z') if withT else None)
    order('2026-10-20', OTHER, t='2026-10-20T22:30:00.000Z' if withT else None)
elif sc in ('msk_r', 'msk_r_not'):
    last = '2026-10-20'
    withT = sc == 'msk_r'
    for r in real_orders:
        if withT:
            h, m = hh(r['order'] + '|' + str(r['sku'])); r['t'] = f"{r['d']}T{h:02d}:{m:02d}:00.000Z"
    k = 0
    for d in days('2026-10-14', last):
        for _ in range(12):
            k += 1; h, m = hh(f'S{k}'); order(d, OTHER, t=f'{d}T{h:02d}:{m:02d}:00.000Z' if withT else None)
        for _ in range(2):
            k += 1; h, m = hh(f'T{k}'); order(d, TR_MAIN, t=f'{d}T{h:02d}:{m:02d}:00.000Z' if withT else None)
        k += 1; h, m = hh(f'C{k}'); order(d, OTHER, status='cancelled', t=f'{d}T{h:02d}:{m:02d}:00.000Z' if withT else None)
else:
    sys.exit('scenario?')
write('orders_daily.ndjson', real_orders + orders)
write('ads_sku_daily.ndjson', real_asd + asd)
write('ads_daily.ndjson', real_ad + ad)
with open(OUT + 'ads_sku_state.json', 'w') as w: json.dump(state, w)
with open(OUT + 'sku_views.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
        w.write(l if l.endswith('\n') else l + '\n')
    for d in days('2026-10-14', last): w.write(json.dumps(dict(date=d, sku=OTHER, views=1000, vsearch=500, pdp=50, cart=5, units=1)) + '\n')
print('fixture', sc, 'по', last, 'заказов +', len(orders), 'реклама +', len(asd), len(ad), 'symlink-ов', len([f for f in os.listdir(OUT) if os.path.islink(OUT + f)]))
