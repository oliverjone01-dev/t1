# Фикстуры для live-проб блока: копия реальных data/ + синтетические дни после 13.10.
# python3 -I p_fixture.py <scenario> ; пишет только в scratchpad/fx_<scenario>/
import json, os, sys, shutil, datetime as dt
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
for f in os.listdir(DD):
    p = DD + f
    if os.path.isfile(p) and f not in ('orders_daily.ndjson', 'ads_sku_daily.ndjson', 'ads_daily.ndjson', 'sku_views.ndjson'):
        os.symlink(p, OUT + f)
def days(a, b):
    d = dt.date.fromisoformat(a)
    while d.isoformat() <= b:
        yield d.isoformat(); d += dt.timedelta(days=1)
def copy_plus(f, extra):
    with open(OUT + f, 'w', encoding='utf-8') as w:
        for l in open(DD + f, encoding='utf-8'):
            w.write(l if l.endswith('\n') else l + '\n')
        for r in extra: w.write(json.dumps(r, ensure_ascii=False) + '\n')
TR_MAIN = '3564841366'      # TRUBIS 160 главный
TR_MIN = '3564832479'       # TRUBIS 160 товар минимального клика
OZ_MAIN = '3492791902'      # OZEVIS главный
C_O18090 = '3564845759'     # SKU кампании 44989034 (на минимум)
OTHER = '9999999999'        # товар вне 10 карточек
orders, asd, ad, sv = [], [], [], []
n = 0
def order(d, sku, units=1, rev=70000, status='delivered'):
    global n; n += 1
    orders.append(dict(order=f'FX-{n}', d=d, status=status, scheme='FBO', sku=sku, offer='FX', units=units, revenue=rev))
if sc == 'day1':            # данные по 15.10, сборка 16.10
    last = '2026-10-15'
    for d in days('2026-10-14', last):
        for k in range(10): order(d, OTHER)
    order('2026-10-15', TR_MAIN); order('2026-10-15', OZ_MAIN)
elif sc == 'mid':           # данные по 17.10, сборка 18.10: магазин идёт ровно по пути цели
    last = '2026-10-17'
    plan = {'2026-10-14': 10, '2026-10-15': 11, '2026-10-16': 11, '2026-10-17': 12}
    for d, k in plan.items():
        for _ in range(k): order(d, OTHER)
    # реклама: своя кампания главного TRUBIS 160 ровно по плану 20 000/нед; 44989034 на минимум чуть выше плана,
    # но её последний день ещё не добран в ads_sku_daily (как 19 кампаний 13.10)
    for d in days('2026-10-14', last):
        asd.append(dict(d=d, cid='44988949', sku=TR_MAIN, sp=2857, om=0, ca=1))
        ad.append(dict(d=d, id='44988949', off='GGT-03-3-3-E-16080', sp=2857, o=0, om=0, vw=1000, cl=100, ca=1))
        asd.append(dict(d=d, cid='44989441', sku=TR_MAIN, sp=203, om=0, ca=0))   # на минимуме, 71% на главного
        asd.append(dict(d=d, cid='44989441', sku=OTHER, sp=83, om=0, ca=0))
        ad.append(dict(d=d, id='44989441', off='GGT-E-16080', sp=286, o=0, om=0, vw=100, cl=20, ca=0))
        ad.append(dict(d=d, id='44989034', off='GGT-03-3-3-O-18090', sp=330, o=0, om=0, vw=100, cl=20, ca=0))
        if d < last: asd.append(dict(d=d, cid='44989034', sku=C_O18090, sp=330, om=0, ca=0))
elif sc == 'nov':           # данные по 02.11, сборка 03.11: магазин без эффекта, база 9,7 в день
    last = '2026-11-02'
    for i, d in enumerate(days('2026-10-14', last)):
        for _ in range(10 if i % 3 else 9): order(d, OTHER)
else:
    sys.exit('scenario?')
copy_plus('orders_daily.ndjson', orders)
copy_plus('ads_sku_daily.ndjson', asd)
copy_plus('ads_daily.ndjson', ad)
# sku_views: реальные + пустые строки на новые дни (синк прошёл)
for d in days('2026-10-14', last): sv.append(dict(date=d, sku=OTHER, views=1000, vsearch=500, pdp=50, cart=5, units=1))
copy_plus('sku_views.ndjson', sv)
print('fixture', sc, 'по', last, 'заказов добавлено', len(orders), 'строк рекламы', len(asd), len(ad))
