# ФЕНИКС, итерация 3, проба 11 (R1, дополнение к пробе 1): у строк сентября «только деньги» (мебель) хватало ли баллов заказа
# на буст после списаний того же дня (размещение и прочее). Остаток = начислено по заказу до даты буста - списано по заказу
# до даты буста включительно (без самого буста, он деньгами). Только чтение. Запуск: python3 -I feniks_iter3_11_wallet_remainder.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); b = rd('bonuses_monthly.ndjson')
B = 'Буст продаж, оплата за продажи'; F = '74986385'
od = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание') and r['d'][:7] == '2026-09' and r['business'] == F:
        od[(r['order'], r['sku'], r['d'])][0 if r['type'] == 'Удержание' else 1] += abs(r['amount'])
ev = collections.defaultdict(list)
for r in b:
    if r['order'] and r['type'] in ('Начисление', 'Списание'):
        ev[(r['order'], r['sku'])].append((r['d'], r['amount'] if r['type'] == 'Начисление' else -abs(r['amount'])))
enough = short = 0; rows = []
for k, v in od.items():
    if not (v[0] > 0 and v[1] == 0):
        continue
    e = ev.get((k[0], k[1]), [])
    rem = sum(x[1] for x in e if x[1] > 0 and x[0] <= k[2]) - sum(-x[1] for x in e if x[1] < 0 and x[0] <= k[2])
    ok = rem >= v[0]
    enough += ok; short += (not ok)
    rows.append((round(v[0]), round(rem), ok))
big = [x for x in rows if x[0] >= 1000]
print(f'строк «только деньги»: {len(rows)}; остатка баллов заказа после списаний дня хватало на буст: {enough}, не хватало: {short}')
print(f'из них крупных (буст от 1 000 ₽): {len(big)}; хватало {sum(1 for x in big if x[2])}, не хватало {sum(1 for x in big if not x[2])}')
print('крупные строки (буст деньгами, остаток баллов заказа, хватало):', sorted(big, key=lambda x: -x[0]))
