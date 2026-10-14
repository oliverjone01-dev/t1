# ФЕНИКС, итерация 3, проба 1 (R1, X4-повтор): З7 «кошелёк заказа» - проверка новой механики на тех же данных.
# (а) обобщение «24 заказа в месяц»: те же группы строк заказ-день буста за июль, август, сентябрь по обоим кабинетам;
# (б) хронология по заказу: сколько баллов заказа было доступно на дату списания буста
#     (начислено по заказу до этой даты включительно минус списано по заказу до этой даты), отдельно для групп.
# Только чтение analytics-mvp/data-ym. Запуск: python3 -I feniks_iter3_1_wallet_timing.py
import json, collections, statistics
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); b = rd('bonuses_monthly.ndjson')
B = 'Буст продаж, оплата за продажи'
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
# строки заказ-день буста: деньги (Удержание) и баллы (Списание) по реестру
od = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == B and r['type'] in ('Удержание', 'Списание') and r['d'][:7] in ('2026-07', '2026-08', '2026-09'):
        od[(r['business'], r['d'][:7], r['order'], r['sku'], r['d'])][0 if r['type'] == 'Удержание' else 1] += abs(r['amount'])
print('(а) строки заказ-день буста по месяцам: всего | и деньги, и баллы (деньгами) | только деньги (деньгами) | только баллы')
agg = collections.defaultdict(lambda: [0, 0, 0.0, 0, 0.0, 0])
for k, v in od.items():
    a = agg[(k[0], k[1])]; a[0] += 1
    if v[0] > 0 and v[1] > 0: a[1] += 1; a[2] += v[0]
    elif v[0] > 0: a[3] += 1; a[4] += v[0]
    else: a[5] += 1
for k in sorted(agg):
    a = agg[k]
    print(f'  {CAB[k[0]]} {k[1]}: {a[0]} | {a[1]} ({a[2]:,.0f}) | {a[3]} ({a[4]:,.0f}) | {a[5]}')
# (б) хронология баллов заказа: начисления и списания из отчёта по баллам с датой
ev = collections.defaultdict(list)  # (order, sku) -> [(d, +начислено | -списано, услуга)]
for r in b:
    if not r['order']:
        continue
    if r['type'] == 'Начисление':
        ev[(r['order'], r['sku'])].append((r['d'], r['amount'], 'acc'))
    elif r['type'] == 'Списание':
        ev[(r['order'], r['sku'])].append((r['d'], -abs(r['amount']), r['service'][:12]))
def avail(order, sku, d, strict):
    # баллы заказа, доступные на дату d: начислено до d (strict: строго раньше d) минус списано строго раньше d
    acc = sum(x[1] for x in ev.get((order, sku), []) if x[1] > 0 and (x[0] < d if strict else x[0] <= d))
    sp = sum(-x[1] for x in ev.get((order, sku), []) if x[1] < 0 and x[0] < d)
    return acc, sp, acc - sp
for cab in ('74986385',):
    for ym in ('2026-09', '2026-08', '2026-07'):
        rows = [(k, v) for k, v in od.items() if k[0] == cab and k[1] == ym]
        for lab, sel in (('только деньги', lambda v: v[0] > 0 and v[1] == 0), ('и деньги, и баллы', lambda v: v[0] > 0 and v[1] > 0)):
            xs = [(k, v) for k, v in rows if sel(v)]
            if not xs:
                continue
            first_acc = []; av_le = []; av_lt = []; no_acc = 0
            for k, v in xs:
                accs = sorted(x[0] for x in ev.get((k[2], k[3]), []) if x[1] > 0)
                if not accs:
                    no_acc += 1; continue
                first_acc.append((accs[0] > k[4]) - (accs[0] < k[4]))  # 1: начисление позже буста, 0: в тот же день, -1: раньше
                av_le.append(avail(k[2], k[3], k[4], False)[2]); av_lt.append(avail(k[2], k[3], k[4], True)[2])
            c = collections.Counter(first_acc)
            print(f'  мебель {ym}, {lab}: строк {len(xs)}, без начисления по заказу {no_acc}; первое начисление позже даты буста {c[1]}, в тот же день {c[0]}, раньше {c[-1]};'
                  f' доступно баллов заказа на дату буста (начисления по дату вкл.) медиана {statistics.median(av_le) if av_le else 0:,.0f},'
                  f' (только начисления до даты) медиана {statistics.median(av_lt) if av_lt else 0:,.0f}')
# детализация сентябрьских строк «только деньги»: дата буста, деньги, первое начисление, доступно до даты, что списано в тот же день
print('(б) сентябрь, мебель, строки «только деньги»: заказ | дата буста | деньги | начислено (дата) | доступно на утро даты | списано баллов по заказу в тот же день')
for k, v in sorted(od.items(), key=lambda kv: -kv[1][0]):
    if k[0] != '74986385' or k[1] != '2026-09' or not (v[0] > 0 and v[1] == 0):
        continue
    e = ev.get((k[2], k[3]), [])
    accs = [(x[0][5:], round(x[1])) for x in e if x[1] > 0]
    same = [(x[2], round(-x[1])) for x in e if x[1] < 0 and x[0] == k[4]]
    print(f'  {k[2]} | {k[4][5:]} | {v[0]:,.0f} | {accs} | {avail(k[2], k[3], k[4], True)[2]:,.0f} | {same}')
