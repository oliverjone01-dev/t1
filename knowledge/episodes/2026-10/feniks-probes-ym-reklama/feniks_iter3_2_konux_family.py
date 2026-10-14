# ФЕНИКС, итерация 3, проба 2 (R2, X2-повтор): З8 и П4. Контроль GGT-35-3-3 против всей модели KONUX D100/180.
# (а) показы в день 24.09-12.10 по всем вариантам KONUX 100/180: на какой день пришёлся скачок у каждого;
# (б) заказы октября по вариантам (статусы) и ставка буста по проведённым заказам; что значит порог П4
#     «у 5-1 заказов без отмен в неделю вдвое больше, чем у контроля» на текущих данных.
# Только чтение analytics-mvp/data-ym. Запуск: python3 -I feniks_iter3_2_konux_family.py
import json, collections, datetime
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
sv = rd('sku_views.ndjson'); o = rd('orders.ndjson'); n = rd('netting.ndjson')
B = 'Буст продаж, оплата за продажи'
fam = sorted({r['sku'] for r in sv if r['sku'].startswith('GGT-35-') and r['sku'].endswith('-100-180')})
days = [(datetime.date(2026, 9, 24) + datetime.timedelta(days=i)).isoformat() for i in range(19)]
v = collections.defaultdict(float)
for r in sv:
    if not r.get('aggregate') and r['sku'] in fam and r['date'] in days:
        v[(r['sku'], r['date'])] += r['views']
print('(а) показы в день, KONUX 100/180 (24.09-12.10); среднее 24-30.09 -> среднее 01.10 -> среднее 02-12.10; первый день с ростом больше 2x к среднему 24-30.09')
for s in fam:
    pre = [v[(s, d)] for d in days[:7]]; d1 = v[(s, days[7])]; post = [v[(s, d)] for d in days[8:]]
    mpre = sum(pre) / 7 if sum(pre) else 0
    jump = next((d[5:] for d in days[7:] if mpre and v[(s, d)] > 2 * mpre), '-')
    print(f'  {s}: {mpre:,.0f} -> {d1:,.0f} -> {sum(post) / len(post):,.0f} (x{(sum(post) / len(post)) / mpre if mpre else 0:.1f}); скачок с {jump}')
# (б) заказы с 13.09 по вариантам: по неделям создания, статус, платёж покупателя
p = [r for r in o if not r['service'] and r['sku'] in fam and r['created'] >= '2026-09-01']
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание'):
        bo[(r['order'], r['sku'])] += abs(r['amount'])
print('(б) заказы KONUX 100/180 с 01.09: вариант | сентябрь (всего / отмен) | октябрь до 12.10 (всего / отмен / доставлено / в пути) | ставка буста октябрьских проведённых | доля Маркета в цене октябрь')
for s in fam:
    sep = [r for r in p if r['sku'] == s and r['created'][:7] == '2026-09']
    octo = [r for r in p if r['sku'] == s and r['created'][:7] == '2026-10']
    st = collections.Counter('отм' if r['status'].startswith('CANCELLED') else 'дост' if r['status'] == 'DELIVERED' else 'путь' for r in octo)
    rates = [bo[(r['order'], r['sku'])] / (r['price'] * r['count']) for r in octo if bo.get((r['order'], r['sku']))]
    shares = [(r['price'] - r['p_buyer']) / r['price'] for r in octo if r['price']]
    print(f'  {s}: {len(sep)} / {sum(1 for r in sep if r["status"].startswith("CANCELLED"))} | {len(octo)} / {st["отм"]} / {st["дост"]} / {st["путь"]} | '
          f'{", ".join(f"{x:.1%}" for x in sorted(rates)) or "-"} | {min(shares):.0%}-{max(shares):.0%}' if shares else f'  {s}: {len(sep)} / {sum(1 for r in sep if r["status"].startswith("CANCELLED"))} | 0 | - | -')
# порог П4: заказы без отмен в неделю (создание 02.10-12.10, 11 дней) у 5-1 против контроля 3-3 и 1-3
nc = lambda s: sum(1 for r in p if r['sku'] == s and '2026-10-02' <= r['created'] <= '2026-10-12' and not r['status'].startswith('CANCELLED'))
w = 11 / 7
c51, c33, c13 = nc('GGT-35-5-1-100-180'), nc('GGT-35-3-3-100-180'), nc('GGT-35-1-3-100-180')
print(f'Порог П4 на данных 02-12.10 (заказы без отмен, в неделю): 5-1 {c51 / w:.1f}, 3-3 {c33 / w:.1f}, 1-3 {c13 / w:.1f}, 3-3 + 1-3 {(c33 + c13) / w:.1f};'
      f' «вдвое больше контроля» выполнен уже сейчас: против 3-3 {c51 > 2 * c33}, против 1-3 {c51 > 2 * c13}, против суммы {c51 > 2 * (c33 + c13)}')
