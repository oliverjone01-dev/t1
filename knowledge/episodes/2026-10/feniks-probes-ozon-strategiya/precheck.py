"""ФЕНИКС, предпроверка стратегии OZON (sessions/2026-10-12-ozon-strategiya-magazin.md @ 833e070).
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-strategiya/precheck.py
Только чтение analytics-mvp/data и tools/tests. Каждый раздел - одна строка evidence ledger.
"""
import json, collections, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
D = ROOT / 'analytics-mvp' / 'data'
T = ROOT / 'analytics-mvp' / 'tools' / 'tests'


def nd(name):
    with open(D / name, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


orders = nd('orders_daily.ndjson')
nc = [r for r in orders if r['status'] != 'cancelled']
ads = nd('ads_daily.ndjson')
asd = nd('ads_sku_daily.ndjson')
CPO = '28753239'


def n_orders(a, b, skus=None):
    return sum(1 for r in nc if a <= r['d'] <= b and (skus is None or r['sku'] in skus))


print('§1 Заказы без отмен (units / строки заказов)')
for m in ('2026-07', '2026-08', '2026-09'):
    rs = [r for r in nc if r['d'][:7] == m]
    allm = [r for r in orders if r['d'][:7] == m]
    print('  ', m, 'шт', sum(r['units'] for r in rs), 'заказов', len(rs),
          'доля отмен %.1f%%' % (100 * (len(allm) - len(rs)) / len(allm)))
wk = [r for r in orders if '2026-10-04' <= r['d'] <= '2026-10-10']
print('   04-10.10: заказов без отмен', n_orders('2026-10-04', '2026-10-10'), 'статусы', dict(collections.Counter(r['status'] for r in wk)))
print('   60 дней 12.08-10.10:', n_orders('2026-08-12', '2026-10-10'))
weeks = [('2026-09-13', '2026-09-19'), ('2026-09-20', '2026-09-26'), ('2026-09-27', '2026-10-03'), ('2026-10-04', '2026-10-10')]
print('   магазин по неделям 13.09-10.10:', [n_orders(a, b) for a, b in weeks])
print('   по дням 01-10.10:', [n_orders('2026-10-%02d' % i, '2026-10-%02d' % i) for i in range(1, 11)])


def camp(a, b):
    by = collections.defaultdict(lambda: [0.0, 0])
    for r in ads:
        if a <= r['d'] <= b:
            by[r['id']][0] += r['sp']
            by[r['id']][1] += r['cl']
    return by


print('\n§2 Реклама 04-10.10 (ads_daily)')
w = camp('2026-10-04', '2026-10-10')
tot = sum(v[0] for v in w.values())
exp = {k: v for k, v in w.items() if k != CPO and v[0] > 0 and v[1] and v[0] / v[1] > 14}
chp = {k: v for k, v in w.items() if k != CPO and v[0] > 0 and k not in exp}
print('   всего %.0f, за заказ %.0f, дорогих (клик >14 ₽) %d на %.0f, дешёвых %d на %.0f' % (
    tot, w[CPO][0], len(exp), sum(v[0] for v in exp.values()), len(chp), sum(v[0] for v in chp.values())))
day = collections.defaultdict(dict)
for r in ads:
    if '2026-10-01' <= r['d'] <= '2026-10-10':
        day[r['id']][r['d']] = r['sp']
stopped = [k for k in exp if day[k].get('2026-10-09', 0) == 0 and day[k].get('2026-10-10', 0) == 0]
print('   из 9 дорогих остановлены с 09.10:', stopped, 'на %.0f за неделю' % sum(exp[k][0] for k in stopped))
rr = {k: (day[k].get('2026-10-09', 0) + day[k].get('2026-10-10', 0)) / 2 * 7 for k in exp}
print('   темп недели по 09-10.10 у 7 активных: %.0f' % sum(v for k, v in rr.items() if k not in stopped))
for k in sorted(rr, key=lambda k: -rr[k]):
    if k not in stopped:
        print('     ', k, 'темп %.0f' % rr[k], 'клик %.1f ₽' % (exp[k][0] / exp[k][1]))
kb = w['37675958']
print('   KONUX 37675958 (GGT-35-5-1): %.0f за неделю, клик %.1f ₽ -> по правилу «>14 ₽» в 9 НЕ входит' % (kb[0], kb[0] / kb[1]))
clk = lambda d: sum(v.get(d, 0) for k, v in day.items() if k != CPO)
print('   реклама за клик в день: 01-07.10 ср. %.0f, 09-10.10 ср. %.0f' % (
    sum(clk('2026-10-0%d' % i) for i in range(1, 8)) / 7, (clk('2026-10-09') + clk('2026-10-10')) / 2))
print('   за заказ по дням 01-10.10:', [round(day[CPO].get('2026-10-%02d' % i, 0)) for i in range(1, 11)])

print('\n§3 Реклама на заказ')
s = camp('2026-09-01', '2026-09-30')
s_tot, s_cpo = sum(v[0] for v in s.values()), s[CPO][0]
s_units = sum(r['units'] for r in nc if r['d'][:7] == '2026-09')
s_ord = n_orders('2026-09-01', '2026-09-30')
o_wk = n_orders('2026-10-04', '2026-10-10')
transit = sum(1 for r in wk if r['status'] not in ('cancelled', 'delivered'))
cancelled_now = sum(1 for r in wk if r['status'] == 'cancelled')
print('   сентябрь: %.0f / %d шт = %.0f; / %d заказов = %.0f; за заказ в неделю %.0f' % (
    s_tot, s_units, s_tot / s_units, s_ord, s_tot / s_ord, s_cpo / 30 * 7))
print('   04-10.10: %.0f / %d заказов = %.0f' % (tot, o_wk, tot / o_wk))
for share in (0.147, 0.166):
    final = o_wk + cancelled_now - share * (o_wk + cancelled_now)
    print('     с поправкой на итоговую долю отмен %.1f%%: %.1f заказов -> %.0f ₽ на заказ' % (100 * share, final, tot / final))
print('   откуда «около 7 тыс.»: %.0f / (274/30*7 = %.1f) = %.0f' % (tot, 274 / 30 * 7, tot / (274 / 30 * 7)))
print('   за заказ на один заказ: сентябрь %.0f, 04-10.10 %.0f' % (s_cpo / s_ord, w[CPO][0] / o_wk))

print('\n§4 Товары')
nc60 = [r for r in nc if '2026-08-12' <= r['d'] <= '2026-10-10']
sold = collections.Counter(r['sku'] for r in nc60)
views = collections.Counter()
with open(D / 'sku_views.ndjson', encoding='utf-8') as f:
    for l in f:
        r = json.loads(l)
        if r['date'] >= '2026-10-01':
            views[r['sku']] += r.get('views', 0) or 0
ad_oct = set(r['sku'] for r in asd if r['d'] >= '2026-10-01' and (r.get('sp') or 0) > 0)
ad_60 = set(r['sku'] for r in asd if r['d'] >= '2026-08-12' and (r.get('sp') or 0) > 0)
zero = set(views) - set(sold)
print('   на витрине %d, продавались %d (на витрине %d), без заказов %d' % (len(views), len(sold), len(set(sold) & set(views)), len(zero)))
for nm, A in (('реклама за клик с 01.10 (как в черновике)', ad_oct), ('реклама за клик с 12.08 (то же окно, что заказы)', ad_60)):
    noad = [k for k in sold if k not in A]
    print('   без рекламы, %s: %d товаров, %d заказов из %d (%.0f%%)' % (nm, len(noad), sum(sold[k] for k in noad), len(nc60), 100 * sum(sold[k] for k in noad) / len(nc60)))
print('   без заказов, но с рекламой за клик с 01.10: %d; с >=100 показами за 01-10.10: %d' % (
    len(zero & ad_oct), sum(1 for k in zero if views[k] >= 100)))

print('\n§5 Девять дорогих кампаний и их карточки')
cg = json.load(open(D / 'card_groups.json', encoding='utf-8'))
card_of, members = {}, {}
for g in cg['groups']:
    members[g['main']] = set(x['sku'] for x in g['skus'])
    for x in g['skus']:
        card_of[x['sku']] = g['main']
camp_sku = collections.defaultdict(set)
for r in asd:
    if r['d'] >= '2026-09-13' and (r.get('sp') or 0) > 0:
        camp_sku[r['cid']].add(r['sku'])
cards = collections.defaultdict(list)
for k in exp:
    for sk in camp_sku[k]:
        cards[card_of.get(sk, 'solo')].append(k)
allc = set(sk for c in cards for sk in members.get(c, set()))
print('   карточек', len(cards), {c: sorted(set(v)) for c, v in cards.items()})
print('   заказы этих карточек по неделям', [n_orders(a, b, allc) for a, b in weeks], 'магазин', [n_orders(a, b) for a, b in weeks])
for c in ('6279981715', '4756834245', '4714207903'):
    print('   карточка', c, [n_orders(a, b, members[c]) for a, b in weeks])
act5 = ['40015169', '44989034', '44988191', '44988572', '44920406']
sk5 = set(x for k in act5 for x in camp_sku[k])
rev5 = [r['revenue'] for r in nc60 if r['sku'] in sk5]
print('   5 активных без KUVINO и GGT-46: заказы их товаров по неделям', [n_orders(a, b, sk5) for a, b in weeks],
      'средняя цена заказа %.0f' % (sum(rev5) / len(rev5)))


def pcdf(k, lam):
    return sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k + 1))


print('\n§6 Стоп-правило «заказы карточки за 2 недели ниже базы на 20%%» без эффекта (Пуассон)')
for c, base in (('KONUX 6279981715', 9.2), ('GGT-03 4756834245', 13.25), ('KUVINO 4714207903', 9.7)):
    lam = 2 * base
    thr = 0.8 * lam
    print('   %s база %.2f/нед: ложная тревога %.0f%%' % (c, base, 100 * pcdf(math.ceil(thr) - 1, lam)))
print('   KONUX последние 2 недели: (6+8)/2 = 7.0 при пороге 7,4 из отчёта Word')

print('\n§7 Тест 1, товары без заказов за 60 дней до старта')
t = json.load(open(T / 'tests.json', encoding='utf-8'))
for off in t['тесты'][0]['тест']:
    pre = sum(1 for r in nc if r['offer'] == off and '2026-07-20' <= r['d'] <= '2026-09-17')
    post = sum(1 for r in nc if r['offer'] == off and '2026-09-18' <= r['d'] <= '2026-10-10')
    if pre == 0:
        print('   ', off, 'до 0, после', post)
print('   минимальная ставка за заказ (tests.json тест 4):', 'минимум Ozon' in t['тесты_цены'][0]['гипотеза'])
