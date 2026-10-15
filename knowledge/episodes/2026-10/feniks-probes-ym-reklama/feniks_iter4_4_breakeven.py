# ФЕНИКС, итерация 4, проба 4 (S4, S6): экономика П5 своим кодом и влияние исключений П5 (KONUX 5-1 и пять карточек П2)
# на экономию, базу и MDE. Артефакт:127 и :135 исключают эти SKU из П5; выдача 17 и 19 считает по всему кабинету мебели.
# Только чтение. Запуск: python3 -I feniks_iter4_4_breakeven.py
import json, collections, statistics, datetime
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson')
F = '74986385'; B = 'Буст продаж, оплата за продажи'; Q = ('2026-07', '2026-08', '2026-09')
EXCL = {'GGT-35-5-1-100-180', 'GGT-35-2-3-100-180', 'GGT-35-3-2-100-180', 'GGT-03-2-2-O-20090', 'GGT-03-3-3-O-20090', 'GGT-20-1-5-20090'}
sep = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['business'] == F and r['d'][:7] == '2026-09' and r['type'] in ('Удержание', 'Списание'):
        sep[r['sku']] += abs(r['amount'])
tot = sum(sep.values()); ex = sum(v for k, v in sep.items() if k in EXCL)
f = 7 / 30 * (1 - 6 / 8.8)
w = tot * f
print(f'буст мебели сентябрь (деньги + баллы, по дате проводки): {tot:,.0f}; экономия недели 6% вместо 8,8%: {w:,.0f}; за 4 недели {4 * w:,.0f}; '
      f'деньгами от 25%: {0.25 * w:,.0f} в неделю; нижняя граница 0,3 × 25% × 4 недели: {0.3 * 0.25 * 4 * w:,.0f}')
print(f'из него SKU, исключённых из П5: {ex:,.0f} ({ex / tot:.1%}): ' + ', '.join(f'{k} {sep.get(k, 0):,.0f}' for k in sorted(EXCL)))
w2 = (tot - ex) * f
mm = sum(r['amount'] - r['cogs'] for r in pnl if r['business'] == F and r['d'][:7] in Q)
mu = sum(r['units'] for r in pnl if r['business'] == F and r['d'][:7] in Q)
mpu = mm / mu
print(f'маржа в деньгах мебели за квартал {mm:,.0f} на {mu:,.0f} единиц = {mpu:,.0f} на единицу')
dt = datetime.date.fromisoformat
wk = lambda s: dt(s) - datetime.timedelta(days=dt(s).weekday())
pa = [r for r in o if not r['service'] and r['business'] == F and not r['status'].startswith('CANCELLED')]
p = [r for r in pa if '2026-06-29' <= r['created'] <= '2026-09-27']
weeks = [dt('2026-06-29') + datetime.timedelta(days=7 * i) for i in range(13)]


def series(sel):
    c = collections.Counter(wk(r['created']) for r in p if sel(r))
    xs = [c.get(x, 0) for x in weeks]
    return xs[:3] + xs[7:]


for lab, sel, wv in (('весь кабинет (как в выдаче 17 и 19)', lambda r: True, w), ('без SKU, исключённых из П5', lambda r: r['sku'] not in EXCL, w2)):
    bs = series(sel); m_, s_ = statistics.mean(bs), statistics.stdev(bs); mde = 2.8 * s_ * 0.5 ** 0.5
    print(f'{lab}: база {m_:.1f} в неделю, SD {s_:.2f}, MDE {mde:.1f} ({mde / m_:.0%}); экономия недели {wv:,.0f}, деньгами 25% {0.25 * wv:,.0f}; '
          f'безубыточная потеря {0.25 * wv / mpu:.2f}-{wv / mpu:.2f} заказа в неделю; MDE больше в {mde / (wv / mpu):.1f}-{mde / (0.25 * wv / mpu):.1f} раза; '
          f'потеря на уровне MDE {mde * mpu:,.0f} маржи в неделю')
# текущий уровень единицы теста: заказы без отмен по неделям создания с 07.09, по группам SKU (снимок 14.10, две последние недели незрелые)
cur = collections.defaultdict(collections.Counter)
for r in pa:
    if '2026-09-07' <= r['created'] <= '2026-10-12':
        cur[wk(r['created'])]['искл' if r['sku'] in EXCL else 'ост'] += 1
print('недели с 07.09 (без отмен на снимок): ' + ', '.join(f"{k.strftime('%d.%m')} все {v['искл'] + v['ост']} / без исключённых {v['ост']}" for k, v in sorted(cur.items())))
oct_share = collections.Counter('исключённые' if r['sku'] in EXCL else 'остальные' for r in pa if '2026-10-02' <= r['created'] <= '2026-10-12')
bs = series(lambda r: r['sku'] not in EXCL); mde2 = 2.8 * statistics.stdev(bs) * 0.5 ** 0.5
print(f"заказы мебели без отмен 02-12.10 по группам SKU: {dict(oct_share)}; без исключённых {oct_share['остальные'] / 11 * 7:.1f} в неделю, "
      f"MDE {mde2:.1f} к этому уровню {mde2 / (oct_share['остальные'] / 11 * 7):.0%}")
mdeall = 2.8 * statistics.stdev(series(lambda r: True)) * 0.5 ** 0.5
print(f'экспозиция по марже при потере на уровне MDE: за 1 неделю 6% {mdeall * mpu:,.0f}; за 3 недели {3 * mdeall * mpu:,.0f}; за 4 недели {4 * mdeall * mpu:,.0f}')
