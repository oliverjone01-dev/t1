"""ФЕНИКС, аудит стратегии OZON v2 (d276d9c): пробы к итерации 2.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/iter2.py
Модель floor.py не пересчитывается: берутся её строки floor_rows.json и её же формулы (проверка формулировок, не модели).
"""
import json, collections, math, pathlib, statistics as S

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
EP = ROOT / 'knowledge' / 'episodes' / '2026-10'


def nd(name):
    with open(D / name, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


orders = nd('orders_daily.ndjson')
nc = [r for r in orders if r['status'] != 'cancelled']
asd = nd('ads_sku_daily.ndjson')
cg = json.load(open(D / 'card_groups.json', encoding='utf-8'))
card_of, members = {}, {}
for g in cg['groups']:
    members[g['main']] = set(x['sku'] for x in g['skus'])
    for x in g['skus']:
        card_of[x['sku']] = g['main']


def n(a, b, skus=None, excl=()):
    return sum(1 for r in nc if a <= r['d'] <= b and r['d'] not in excl and (skus is None or r['sku'] in skus))


print('§1 Недели магазина (без отмен), воскресенье-суббота')
import datetime as dt
d0 = dt.date(2026, 6, 7)
ser = []
while d0 <= dt.date(2026, 10, 4):
    d1 = d0 + dt.timedelta(days=6)
    ser.append((d0.strftime('%d.%m'), n(d0.isoformat(), d1.isoformat())))
    d0 = d1 + dt.timedelta(days=1)
print('  ', ser)
print('   максимум', max(ser, key=lambda x: x[1]), '| «53 / 70 / 74 / 82» - недели с 13.09, не «с середины августа»')

print('\n§2 KONUX 6279981715: доля в заказах магазина и корзины GGT-35-5-1')
X = ('2026-10-08', '2026-10-09')
K = members['6279981715']
base_k, base_s = n('2026-09-13', '2026-10-10', K, X), n('2026-09-13', '2026-10-10', None, X)
last_k, last_s = n('2026-09-27', '2026-10-10', K, X), n('2026-09-27', '2026-10-10', None, X)
print('   база 13.09-10.10 без 08-09.10: %d из %d = %.1f%%; последние 2 недели: %d из %d = %.1f%% (%.0f%% к базе)' % (
    base_k, base_s, 100 * base_k / base_s, last_k, last_s, 100 * last_k / last_s, 100 * (last_k / last_s) / (base_k / base_s) - 100))
sku_konux = [s for s, o in ((r['sku'], r['offer']) for r in orders) if o == 'GGT-35-5-1-100-180'][0]
cart = collections.Counter()
with open(D / 'sku_views.ndjson', encoding='utf-8') as f:
    for l in f:
        r = json.loads(l)
        if r['sku'] == sku_konux and r['date'] >= '2026-08-16':
            cart[r['date']] += r.get('cart', 0) or 0
wk = lambda a, b: sum(v for d, v in cart.items() if a <= d <= b)
print('   корзины GGT-35-5-1 по неделям с 13.09:', [wk(a, b) for a, b in (('2026-09-13', '2026-09-19'), ('2026-09-20', '2026-09-26'), ('2026-09-27', '2026-10-03'), ('2026-10-04', '2026-10-10'))])
print('   тест 3 (отчёт Word): корзины дорогой 265 / дешёвой 39 в неделю -> при переводе на 8 ₽ ожидаемо %.0f%%' % (100 * 39 / 265 - 100))

print('\n§3 Карточка GGT-03 4756834245: кампании за клик с расходом с 01.10')
G = members['4756834245']
camp = collections.defaultdict(lambda: [None, None, 0.0])
for r in asd:
    if r['d'] >= '2026-10-01' and (r.get('sp') or 0) > 0 and r['sku'] in G:
        c = camp[r['cid']]
        c[0] = min(c[0] or r['d'], r['d']); c[1] = max(c[1] or r['d'], r['d']); c[2] += r['sp']
for k, v in sorted(camp.items(), key=lambda kv: kv[1][0]):
    print('  ', k, 'с', v[0], 'по', v[1], 'расход %.0f' % v[2])
print('   кампаний шага 1 (с 27.10 «по одной в неделю») в этой карточке: 40015169, 44989034, 44988191 ->',
      all(k in camp for k in ('40015169', '44989034', '44988191')))

print('\n§4 Пилот цены: группа «продаётся» из таблицы «Можно снизить цену» (правила table.py)')
rows = json.load(open(EP / 'ozon-price-floor' / 'floor_rows.json', encoding='utf-8'))
sel = []
for r in rows:
    t = r['p_10']
    head10 = (1 - t / r['p0']) * 100 if t else -999
    if head10 >= 5 and r['wk'] >= 0.5:
        sel.append(r)
print('   товаров', len(sel), 'заказов за 60 дней', sum(r['u60'] for r in sel), '-> %.1f в неделю на группу' % (sum(r['u60'] for r in sel) / 60 * 7))
need = []
for r in sel:
    k = 0.70 * (r['keep'] - 0.05) - 0.15 * r['s']; fx = r['cogs'] + r['shipn']
    pr0, pr1 = r['p0'] * k - fx, r['p0'] * 0.9 * k - fx
    if pr0 > 0 and pr1 > 0:
        need.append(pr0 / pr1 - 1)
print('   нужный рост заказов при -10%% (формула floor.py, только эта группа): медиана +%.0f%%, мин +%.0f%%, макс +%.0f%%' % (
    100 * S.median(need), 100 * min(need), 100 * max(need)))
lam = sum(r['u60'] for r in sel) / 60 * 14
thr = lam * 1.37


def pge(k, l):
    return 1 - sum(math.exp(-l) * l ** i / math.factorial(i) for i in range(k))


print('   за 2 недели база %.1f заказа на всю группу; шум даёт +37%% и больше с вероятностью %.0f%%' % (lam, 100 * pge(math.ceil(thr), lam)))
half = lam / 2
print('   на половине группы (%.1f заказа): шум даёт +37%% и больше с вероятностью %.0f%%; при истинных +37%% порог не взят с вероятностью %.0f%%' % (
    half, 100 * pge(math.ceil(half * 1.37), half), 100 * (1 - pge(math.ceil(half * 1.37), half * 1.37))))
offer_sel = set(r['art'] for r in sel)
acts = collections.defaultdict(set)
for r in nd('acts_daily.ndjson'):
    if r['date'] == '2026-10-11':
        acts[r['art']].add(r['title'].split('.')[0])
print('   из них в акциях на 11.10:', dict(collections.Counter(min(acts.get(a, {'нет'})) for a in offer_sel)))
print('   с рекламой за клик (поле ads):', sum(r['ads'] for r in sel))
t4 = set(json.load(open(ROOT / 'analytics-mvp' / 'tools' / 'tests' / 'tests.json', encoding='utf-8'))['тесты_цены'][0]['тест'])
print('   товары теста 4 среди них:', sorted(offer_sel & t4))
step1_cards = {'6279981715', '4756834245', '5728188877'}
print('   в карточках шага 1 (KONUX, GGT-03, GGT-47):', sum(1 for r in sel if card_of.get(r['sku']) in step1_cards))
