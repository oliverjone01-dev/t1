# ФЕНИКС, итерация 4, проба 2 (S1, строка 1.1 артефакта под [ДАННЫЕ]): распределение, а не медиана.
# Утверждение артефакта:23: «у 91 строки из 121 баллы заказа исчерпаны и остаток ушёл деньгами, у 24 строк буст
# списан деньгами целиком при живых баллах заказа и кабинета». Строка = (заказ, SKU, день) буста в реестре, мебель, сентябрь.
# Кошелёк заказа на день строки: начислено по заказу (отчёт по баллам, «Начисление» минус «Возврат») до дня строки,
# минус списано по заказу («Списание» минус «Возврат списания») до дня строки включительно.
# Два варианта начисления: (в) до дня включительно, (с) строго до дня (порядок событий внутри дня неизвестен).
# Третий вариант (ж) - как в скрипте автора (analiz.py, раздел 16): начислено и списано за всю жизнь заказа.
# Только чтение. Запуск: python3 -I feniks_iter4_2_wallet_rows.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); b = rd('bonuses_monthly.ndjson')
B = 'Буст продаж, оплата за продажи'; F = '74986385'
row = collections.defaultdict(lambda: [0.0, 0.0])  # (заказ, sku, день) -> [деньги, баллы]
for r in n:
    if r['service'] == B and r['business'] == F and r['d'][:7] == '2026-09' and r['type'] in ('Удержание', 'Списание'):
        row[(r['order'], r['sku'], r['d'])][0 if r['type'] == 'Удержание' else 1] += abs(r['amount'])
acc = collections.defaultdict(list); spent = collections.defaultdict(list)
day_cab = collections.defaultdict(float)  # списания баллов кабинета по дням, любые услуги
for r in b:
    if r['business'] != F:
        continue
    k = (r['order'], r['sku'])
    if r['type'] == 'Начисление' and r['order']:
        acc[k].append((r['d'], r['amount']))
    elif r['type'] == 'Возврат' and r['order']:
        acc[k].append((r['d'], -abs(r['amount'])))
    elif r['type'] == 'Списание':
        day_cab[r['d']] += abs(r['amount'])
        if r['order']:
            spent[k].append((r['d'], abs(r['amount'])))
    elif r['type'] == 'Возврат списания' and r['order']:
        spent[k].append((r['d'], -abs(r['amount'])))


def wallet(o, s, d, mode):
    if mode == 'life':
        a = sum(x for dd, x in acc[(o, s)]); sp = sum(x for dd, x in spent[(o, s)])
    else:
        a = sum(x for dd, x in acc[(o, s)] if (dd < d if mode == 'strict' else dd <= d))
        sp = sum(x for dd, x in spent[(o, s)] if dd <= d)
    return a, a - sp


mix, money_only, pts_only = [], [], []
for (o, s, d), (m, pt) in row.items():
    rec = dict(o=o, s=s, d=d, m=m, pt=pt)
    for mode in ('day', 'strict', 'life'):
        rec['acc_' + mode], rec['rem_' + mode] = wallet(o, s, d, mode)
    (mix if m > 0 and pt > 0 else money_only if m > 0 else pts_only).append(rec)
print(f'строк заказ-день: {len(row)}; и деньгами, и баллами {len(mix)}; только деньгами {len(money_only)}; только баллами {len(pts_only)}')
left = lambda xs, mode: [x for x in xs if x['acc_' + mode] > 0 and x['rem_' + mode] > max(1.0, 0.01 * x['acc_' + mode])]
for lab, mode in (('(в) на день буста, начисления до дня включительно', 'day'), ('(с) на день буста, начисления строго до дня', 'strict'),
                  ('(ж) за жизнь заказа, как в скрипте автора', 'life')):
    lf = left(mix, mode)
    print(f'«и деньгами, и баллами» {len(mix)}, {lab}: остаток кошелька заказа больше 1% начисленного у {len(lf)} строк '
          f'(деньгами в них {sum(x["m"] for x in lf):,.0f} из {sum(x["m"] for x in mix):,.0f}); исчерпан у {len(mix) - len(lf)}')
lf = left(mix, 'day')
print('   крупнейшие остатки (в): ' + ', '.join(f"{x['d'][5:]} ост {x['rem_day']:,.0f} из {x['acc_day']:,.0f} (деньгами {x['m']:,.0f})" for x in sorted(lf, key=lambda x: -x['rem_day'])[:8]))
mshare = sorted(x['m'] / (x['m'] + x['pt']) for x in mix)
print(f'   доля денег в строке: медиана {mshare[len(mshare) // 2]:.1%}, максимум {mshare[-1]:.1%}, строк с долей денег больше 10%: {sum(1 for v in mshare if v > 0.10)}')
for lab, mode in (('(в)', 'day'), ('(с)', 'strict'), ('(ж)', 'life')):
    pos = [x for x in money_only if x['rem_' + mode] > 1]; enough = [x for x in money_only if x['rem_' + mode] >= x['m']]
    print(f'«только деньгами» {len(money_only)} {lab}: остаток баллов заказа больше 0 у {len(pos)} (деньгами {sum(x["m"] for x in pos):,.0f} из {sum(x["m"] for x in money_only):,.0f}), '
          f'хватало на весь буст строки у {len(enough)}')
days = sorted(set(x['d'] for x in money_only))
print('   дни строк «только деньгами» и списания баллов кабинета в этот день (все услуги): ' +
      ', '.join(f'{d[5:]} {day_cab.get(d, 0):,.0f}' for d in days))
print(f'   дней без списаний баллов кабинета: {sum(1 for d in days if day_cab.get(d, 0) == 0)} из {len(days)}')
