#!/usr/bin/env python3
"""Механика рекламы Маркета по справке (текст пользователя 15.10) против наших данных. Дополнение к analiz.py.
Источники (analytics-mvp/data-ym/, снимки 13-14.10.2026): netting (реестр), orders, bonuses_monthly (отчёт по баллам),
promo_monthly (отчёты продвижения), sku_views (отчёт показов с 07.09), pnl_sku_netting_daily (разноска «Денег»), catalog.
Запуск: python3 -I mehanika.py [DATA_DIR] > mehanika-output.md. Только чтение."""
import json, sys, collections, statistics, datetime
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); b = rd('bonuses_monthly.ndjson')
promo = rd('promo_monthly.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson'); cat = json.load(open(D + 'catalog.json'))['items']
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}; M = ('2026-07', '2026-08', '2026-09'); MO = M + ('2026-10',)
BOOST = 'Буст продаж, оплата за продажи'; SHOWS_PTS = 'Буст продаж, оплата за показы'; SHELF_PTS = 'Полки'
p = [r for r in o if not r['service']]; po = {(r['order'], r['sku']): r for r in p}
f0 = lambda x: f"{x:,.0f}"; pct = lambda a, b: f"{a / b:.1%}" if b else 'n/a'; dt = datetime.date.fromisoformat
bo = collections.defaultdict(float); bom = collections.defaultdict(float); bod = collections.defaultdict(set)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'):
        k = (r['order'], r['sku']); bo[k] += abs(r['amount']); bod[k].add(r['d'])
        if r['type'] == 'Удержание': bom[k] += abs(r['amount'])
acc = collections.defaultdict(float)
for r in b:
    if r['type'] == 'Начисление' and r['order']: acc[(r['order'], r['sku'])] += r['amount']
pm = {(r['ym'], r['business'], r['kind']): r for r in promo}
rate = lambda k: bo[k] / (po[k]['price'] * po[k]['count'])

print("## 1. Буст списывается с доставленного заказа: доставленные заказы с бустом и без, по месяцу создания")
print("месяц | кабинет | доставлено | с бустом | без буста | доля с бустом | выручка без буста")
for m in MO:
    for c in CAB:
        g = [r for r in p if r['business'] == c and r['created'][:7] == m and r['status'] == 'DELIVERED']
        nb = [r for r in g if not bo.get((r['order'], r['sku']))]
        print(f"{m} | {CAB[c]} | {len(g)} | {len(g) - len(nb)} | {len(nb)} | {pct(len(g) - len(nb), len(g))} | {f0(sum(r['revenue'] for r in nb))}")
lags = [(dt(min(ds)) - dt(po[k]['statusDate'])).days for k, ds in bod.items() if k in po and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in M]
print(f"Лаг «доставлен -> первая проводка буста», квартал: медиана {statistics.median(lags):.0f} дн., p90 {statistics.quantiles(lags, n=10)[8]:.0f}, мин {min(lags)}, макс {max(lags)} (минус = проводка раньше статуса доставки в заказе)")
bc = sum(bo[k] for k in bo if k in po and po[k]['status'].startswith('CANCELLED'))
print(f"Буст по отменённым заказам за всё время: {f0(bc)} ₽")
gm = [r for r in p if r['business'] == '74986385' and r['status'] == 'DELIVERED' and r['created'][:7] in M]
nbm = [r for r in gm if not bo.get((r['order'], r['sku']))]
S = collections.defaultdict(lambda: [0, 0])
for r in gm: S[r['sku']][0] += 1; S[r['sku']][1] += 1 if bo.get((r['order'], r['sku'])) else 0
print(f"Мебель, квартал: доставлено {len(gm)}, без буста {len(nbm)} ({pct(len(nbm), len(gm))}), выручка без буста {f0(sum(r['revenue'] for r in nbm))} ({pct(sum(r['revenue'] for r in nbm), sum(r['revenue'] for r in gm))})")
print(f"  SKU с 2+ доставками и без буста вообще: {[(s, v[0]) for s, v in S.items() if v[1] == 0 and v[0] >= 2]}")
print(f"  SKU, где часть доставок с бустом, часть без: {sorted([(s, v[1], v[0]) for s, v in S.items() if 0 < v[1] < v[0]], key=lambda x: -x[2])} (с бустом из доставленных)")
print("Зеркала, квартал, доставленные без буста:")
for r in p:
    if r['business'] == '1023124' and r['created'][:7] in M and r['status'] == 'DELIVERED' and not bo.get((r['order'], r['sku'])):
        print(f"  {r['sku']} создан {r['created']} доставлен {r['statusDate']} {r['region']} цена {f0(r['price'])}")

print("\n## 2. Аукцион второй цены: разброс списанной ставки внутри одного SKU (доставленные заказы с бустом, июль-октябрь)")
grp = collections.defaultdict(list); wk = collections.defaultdict(list)
for k in bo:
    r = po.get(k)
    if r and r['price'] and r['created'][:7] in MO and r['status'] == 'DELIVERED':
        grp[(r['sku'], r['created'])].append(rate(k)); d = dt(r['created']); wk[(r['sku'], (d - datetime.timedelta(days=d.weekday())).isoformat())].append(rate(k))
multi = {k: v for k, v in grp.items() if len(v) >= 2}; sp = [max(v) - min(v) for v in multi.values()]
print(f"SKU-дней с 2+ заказами: {len(multi)}; разброс ставки внутри дня: медиана {statistics.median(sp):.1%}, максимум {max(sp):.1%}; дней с разбросом > 2 п.п.: {sum(1 for s in sp if s > 0.02)}, < 0,5 п.п.: {sum(1 for s in sp if s < 0.005)}")
for k, v in sorted(multi.items(), key=lambda x: -(max(x[1]) - min(x[1])))[:6]: print(f"  {k[0]} {k[1]}: " + ', '.join(f"{x:.1%}" for x in sorted(v)))
mw = {k: v for k, v in wk.items() if len(v) >= 3}
print(f"SKU-недель с 3+ заказами: {len(mw)}; разброс внутри недели: медиана {statistics.median(max(v) - min(v) for v in mw.values()):.1%}; недель с разбросом > 3 п.п.: {sum(1 for v in mw.values() if max(v) - min(v) > 0.03)}")
mx = collections.defaultdict(float)
for k in bo:
    r = po.get(k)
    if r and r['price'] and r['status'] == 'DELIVERED' and r['created'] >= '2026-09-15': mx[r['sku']] = max(mx[r['sku']], rate(k))
rk = collections.Counter(); per = collections.defaultdict(set)
for k in bo:
    r = po.get(k)
    if r and r['price'] and r['status'] == 'DELIVERED' and r['created'][:7] in MO: v = round(rate(k) * 10000); rk[v] += 1; per[v].add(r['sku'])
rep = {v: c for v, c in rk.items() if c >= 3}
print(f"Повторы точной списанной ставки (до 0,01%): заказов на значениях с 3+ повторами {sum(rep.values())} из {sum(rk.values())}; топ: " + ', '.join(f"{v / 100:.2f}% x{c} ({len(per[v])} SKU)" for v, c in sorted(rep.items(), key=lambda x: -x[1])[:6]) + "; заказов с «1» в сотых (признак +0,01%): " + str(sum(c for v, c in rk.items() if v % 10 == 1)))
g9 = [k for k in bo if k in po and po[k]['business'] == '74986385' and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] == '2026-09' and po[k]['price']]
b9 = sum(bo[k] for k in g9); s9 = sum(max(bo[k] - 0.06 * po[k]['price'] * po[k]['count'], 0) for k in g9)
print(f"Мебель, доставленные заказы сентября с бустом: {len(g9)}, буст {f0(b9)}; если бы каждое списание выше 6% стало 6%: экономия {f0(s9)} ({pct(s9, b9)}) против {1 - 6 / 8.8:.1%} в дизайне П5; заказов со списанием выше 6%: {sum(1 for k in g9 if rate(k) > 0.06)} из {len(g9)}")
print("Максимум списанной ставки по SKU с 15.09 (ставка в кабинете не ниже этого): " + ', '.join(f"{s} {v:.0%}" for s, v in sorted(mx.items(), key=lambda x: -x[1])[:8]))

print("\n## 3. Атрибуция: один заказ у нескольких инструментов. Сумма «выручки с инструментом» против всей выручки (revAll) по отчётам Маркета")
print("месяц | кабинет | revAll | буст | показы | полки | сумма / revAll | заказов: буст / показы / полки по отчётам | доставлено по нашим данным (дата доставки)")
for m in MO:
    for c in CAB:
        bst = pm.get((m, c, 'boost')); sh = pm.get((m, c, 'shows'), {}); sf = pm.get((m, c, 'shelf'), {})
        if not bst or not bst.get('revAll'): continue
        dl = sum(1 for r in p if r['business'] == c and r['status'] == 'DELIVERED' and r['statusDate'][:7] == m)
        print(f"{m} | {CAB[c]} | {f0(bst['revAll'])} | {f0(bst['rev'])} | {f0(sh.get('rev', 0))} | {f0(sf.get('rev', 0))} | {pct(bst['rev'] + sh.get('rev', 0) + sf.get('rev', 0), bst['revAll'])} | {bst['orders']} / {sh.get('orders', 0)} / {sf.get('orders', 0)} | {dl}")

print("\n## 4. Полки с 30.09: баллы по показам и полкам по дням, мебель (отчёт по баллам), 15.09-12.10")
day = collections.defaultdict(lambda: [0.0, 0.0])
for r in b:
    if r['business'] == '74986385' and r['type'] == 'Списание' and '2026-09-15' <= r['d'] <= '2026-10-12':
        if r['service'] == SHOWS_PTS: day[r['d']][0] += abs(r['amount'])
        elif r['service'] == SHELF_PTS: day[r['d']][1] += abs(r['amount'])
print(' '.join(f"{d[5:]}:{v[0]:.0f}/{v[1]:.0f}" for d, v in sorted(day.items())) + "  (показы/полки, баллы в день)")
pre = [v[0] for d, v in day.items() if d <= '2026-09-29' and v[0] > 0]; post = [v[0] for d, v in day.items() if d >= '2026-09-30']
print(f"показы баллами в день: до 29.09 медиана {statistics.median(pre):,.0f} (дней {len(pre)}), с 30.09 медиана {statistics.median(post):,.0f} (дней {len(post)}); полки баллами в день до 29.09 {statistics.median([v[1] for d, v in day.items() if d <= '2026-09-29' and v[1] > 0]):,.0f}, последняя проводка полок {max(d for d, v in day.items() if v[1] > 0)}")
for c in CAB:
    for kind in ('shows', 'shelf'):
        r = pm.get(('2026-10', c, kind)); r9 = pm.get(('2026-09', c, kind))
        print(f"  отчёт Маркета {CAB[c]} {kind}: сентябрь {f0(r9['spend']) if r9 else '-'}; октябрь (снимок 13.10) {f0(r['spend'])} = {f0(r['spend'] / 13)} в день за 13 дней, заказов {r['orders']}")
ps10 = sum(abs(r['amount']) for r in b if r['business'] == '74986385' and r['type'] == 'Списание' and r['service'] == SHOWS_PTS and r['d'] >= '2026-10-01')
print(f"  мебель, октябрь: баллы по показам 01-12.10 {f0(ps10)} против отчёта Маркета {f0(pm[('2026-10', '74986385', 'shows')]['spend'])} (в сентябре отчёт = деньги акта + баллы до рубля, analiz-output 3); октябрь не закрыт, деньги акта за октябрь ещё нет")
print("  максимальные даты в данных: реестр", max(r['d'] for r in n), "баллы", max(r['d'] for r in b), "заказы", max(r['created'] for r in p), "показы", max(r['date'] for r in sv))

print("\n## 5. Возвраты: буст не возвращается")
print("типы проводок буста в реестре:", dict(collections.Counter((r['type'], r['src']) for r in n if r['service'] == BOOST)))
ret = [r for r in p if r.get('returned') or r['status'] == 'RETURNED']; ro = {r['order'] for r in ret}
print(f"возвращённых заказов за всё время: {len(ret)} (статусы {dict(collections.Counter(r['status'] for r in ret))}); с бустом {sum(1 for r in ret if bo.get((r['order'], r['sku'])))}, буст по ним {f0(sum(bo.get((r['order'], r['sku']), 0) for r in ret))} (деньгами {f0(sum(bom.get((r['order'], r['sku']), 0) for r in ret))}); обратных проводок буста (не Списание/Удержание): 0")
agg = collections.defaultdict(float)
for r in n:
    if r['order'] in ro: agg[(r['service'] if r['service'] in (BOOST, 'Скидка за лояльность', 'Размещение товарных предложений', 'Доставка (средняя миля)', 'Доставка невыкупов и возвратов', 'Доставка покупателю') else ('товар' if r['src'] in ('Платёж покупателя', 'Возврат платежа покупателя', 'Баллы за скидку Маркета', 'Возврат баллов за скидку Маркета') else 'прочее'), r['type'])] += r['amount']
print("что Маркет проводит по возвращённым заказам (услуга, тип: сумма):", {f"{k[0]} / {k[1]}": f0(v) for k, v in sorted(agg.items(), key=lambda x: -abs(x[1]))})
rq = [r for r in ret if r['created'][:7] in M]; rqo = {r['order'] for r in rq}
lg = sum(abs(r['amount']) for r in n if r['order'] in rqo and r['service'] in ('Доставка (средняя миля)', 'Доставка невыкупов и возвратов', 'Доставка покупателю') and r['type'] in ('Удержание', 'Списание'))
lgm = sum(abs(r['amount']) for r in n if r['order'] in rqo and r['service'] in ('Доставка (средняя миля)', 'Доставка невыкупов и возвратов', 'Доставка покупателю') and r['type'] == 'Удержание')
print(f"Квартал (заказы июль-сентябрь): возвратов {len(rq)} ({dict(collections.Counter(CAB[r['business']] for r in rq))}), цена {f0(sum(r['price'] for r in rq))}; буст по ним {f0(sum(bo.get((r['order'], r['sku']), 0) for r in rq))} (деньгами {f0(sum(bom.get((r['order'], r['sku']), 0) for r in rq))}); логистика по ним {f0(lg)} (деньгами {f0(lgm)})")
loy_o = {r['order'] for r in n if r['service'] == 'Скидка за лояльность'}
print(f"«Скидка за лояльность» в реестре: заказов {len(loy_o)}, из них возвращённых {len(loy_o & ro)}; типы: {dict(collections.Counter((r['type'], r['src']) for r in n if r['service'] == 'Скидка за лояльность'))}; суммы: возврат списания {f0(sum(r['amount'] for r in n if r['service'] == 'Скидка за лояльность' and r['type'] == 'Возврат списания'))}, начисление {f0(sum(r['amount'] for r in n if r['service'] == 'Скидка за лояльность' and r['type'] == 'Начисление'))}")

print("\n## 6. Ценовая стратегия: ставка выше -> скидка Маркета больше? Внутри SKU (доставленные с бустом, июль-октябрь, SKU с 5+ заказами)")
bysku = collections.defaultdict(list)
for k in bo:
    r = po.get(k)
    if r and r['price'] and r['status'] == 'DELIVERED' and r['created'][:7] in MO: bysku[r['sku']].append((rate(k), r['p_mp'] / r['price']))
xs = []; ys = []
for s, v in bysku.items():
    if len(v) >= 5:
        mr = statistics.mean(x[0] for x in v); mm = statistics.mean(x[1] for x in v)
        for x in v: xs.append(x[0] - mr); ys.append(x[1] - mm)
bym = collections.defaultdict(list)
for k in bo:
    r = po.get(k)
    if r and r['price'] and r['status'] == 'DELIVERED' and r['created'][:7] in MO: bym[(r['sku'], r['created'][:7])].append((rate(k), r['p_mp'] / r['price']))
xm = []; ym = []
for v in bym.values():
    if len(v) >= 3:
        mr = statistics.mean(x[0] for x in v); mm = statistics.mean(x[1] for x in v)
        for x in v: xm.append(x[0] - mr); ym.append(x[1] - mm)
print(f"внутри SKU и месяца (группы с 3+ заказами, n={len(xm)}): корреляция {statistics.correlation(xm, ym):.3f} - связь между месяцами, не внутри месяца")
print(f"n={len(xs)} заказов в {sum(1 for v in bysku.values() if len(v) >= 5)} SKU: корреляция отклонений ставки и доли Маркета от средних по SKU {statistics.correlation(xs, ys):.2f}")
bk = collections.defaultdict(list)
for i, x in enumerate(xs): bk['ниже средней по SKU на 2+ п.п.' if x < -0.02 else 'выше на 2+ п.п.' if x > 0.02 else 'около средней'].append(ys[i])
for k in ('ниже средней по SKU на 2+ п.п.', 'около средней', 'выше на 2+ п.п.'): print(f"  ставка {k}: n={len(bk[k])}, доля Маркета относительно средней по SKU: медиана {statistics.median(bk[k]):+.1%}")
def tbl(sku, a, bnd):
    g = [k for k in po if k[1] == sku and po[k]['status'] == 'DELIVERED' and bo.get(k) and a <= po[k]['created'] <= bnd]
    if not g: return
    av = lambda f: statistics.mean(f(k) for k in g)
    print(f"  {sku} {a[5:]}..{bnd[5:]}: заказов {len(g)}; цена {f0(av(lambda k: po[k]['price']))}; платил покупатель {f0(av(lambda k: po[k]['p_buyer']))}; скидка Маркета {f0(av(lambda k: po[k]['p_mp']))} ({av(lambda k: po[k]['p_mp'] / po[k]['price']):.0%}); буст {f0(av(lambda k: bo[k]))} ({av(lambda k: bo[k] / po[k]['price']):.1%}); баллов начислено {f0(av(lambda k: acc.get(k, 0)))}; к выплате деньгами {f0(av(lambda k: po[k]['payout']))}; комиссия деньгами {f0(av(lambda k: po[k]['fees'].get('Комиссия за продажу', 0)))}")
print("Два товара с резкой сменой ставки (средние на заказ):")
tbl('GGT-35-5-1-100-180', '2026-09-01', '2026-10-01'); tbl('GGT-35-5-1-100-180', '2026-10-02', '2026-10-31')
tbl('GGM-01-1', '2026-07-01', '2026-07-31'); tbl('GGM-01-1', '2026-08-01', '2026-09-30')

print("\n## 7. Ставка против маржи в деньгах по SKU (квартал, выручка > 150 тыс.; маржа из разноски «Денег», analiz-output 18)")
PS = collections.defaultdict(lambda: collections.defaultdict(float))
for r in pnl:
    if r['d'][:7] in M and r['basis'] == 'netting':
        for f in ('accruals', 'amount', 'cogs'): PS[r['sku']][f] += r[f]
SK = collections.defaultdict(lambda: collections.defaultdict(float))
for r in p:
    if r['created'][:7] in M and r['status'] == 'DELIVERED': SK[r['sku']]['rev'] += r['revenue']; SK[r['sku']]['boost'] += bo.get((r['order'], r['sku']), 0); SK[r['sku']]['n'] += 1
rows = []
for s, v in SK.items():
    if v['rev'] < 150000: continue
    ps = PS.get(s); mg = (ps['amount'] - ps['cogs']) / ps['accruals'] if ps and ps['accruals'] and ps['cogs'] else None
    rows.append((s, v['n'], v['rev'], v['boost'] / v['rev'], mg, cat.get(s, {}).get('stock')))
rows.sort(key=lambda x: -x[3])
print("SKU | доставлено | выручка | ставка буста | маржа в деньгах | остаток 13.10")
for s, nn, rv, rt, mg, stk in rows: print(f"{s} | {nn:.0f} | {f0(rv)} | {rt:.1%} | {f'{mg:.1%}' if mg is not None else 'нет с/с'} | {stk}")
mgs = [mg for s, nn, rv, rt, mg, stk in rows if mg is not None]
print(f"Маржа по {len(mgs)} SKU с себестоимостью: от {min(mgs):.1%} до {max(mgs):.1%}; ниже 34%: {[(s, f'{mg:.1%}', f'ставка {rt:.1%}') for s, nn, rv, rt, mg, stk in rows if mg is not None and mg < 0.34]}")
print(f"SKU с выручкой > 150 тыс.: {len(rows)}; ставка > 10% при марже < 40%: {[(s, f'{rt:.0%}', f'{mg:.0%}') for s, nn, rv, rt, mg, stk in rows if rt > 0.10 and mg is not None and mg < 0.40]}")
sy = [k for k in bo if k in po and k[1] == 'GGM-29-4' and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in M]
syb = sum(bo[k] for k in sy); syr = sum(po[k]['revenue'] for k in sy)
print(f"GGM-29-4, одна база (доставленные заказы квартала): {len(sy)} заказов, выручка {f0(syr)}, буст {f0(syb)} ({pct(syb, syr)}); при ставке 8% буст {f0(syr * 0.08)}, разница {f0(syb - syr * 0.08)} за квартал, {f0((syb - syr * 0.08) / 3)} в месяц; буст деньгами {f0(sum(bom.get(k, 0) for k in sy))}")
print("GGM-29-4 в каталоге 13.10:", {k: cat.get('GGM-29-4', {}).get(k) for k in ('name', 'price', 'stock', 'seen')})

print("\n## 8. Товары без остатка: показы 06-12.10 и буст октября у SKU с остатком 0 (catalog 13.10)")
v7 = collections.Counter()
for r in sv:
    if not r.get('aggregate') and '2026-10-06' <= r['date'] <= '2026-10-12': v7[r['sku']] += r['views']
stock = {s: v.get('stock') for s, v in cat.items()}
z = sum(v for s, v in v7.items() if stock.get(s) == 0); lo = [(s, v, stock[s]) for s, v in v7.items() if stock.get(s) is not None and 0 < stock[s] <= 3]
print(f"показов всего {sum(v7.values()):,}; у SKU с остатком 0: {z:,} ({pct(z, sum(v7.values()))}); у SKU с остатком 1-3: {sum(v for _, v, _ in lo):,} ({pct(sum(v for _, v, _ in lo), sum(v7.values()))}) в {len(lo)} SKU, топ: " + ', '.join(f"{s} ({st} шт, {v:,})" for s, v, st in sorted(lo, key=lambda x: -x[1])[:5]))
print("KONUX D100/180 остатки: " + ', '.join(f"{s} {stock.get(s)}" for s in sorted(cat) if s.startswith('GGT-35-') and s.endswith('-100-180')))

print("\n## 9. Лимит показов «1% доставленного за 30 дней в день, не меньше 1000 ₽» (справка для иностранных продавцов) против факта")
for m in MO:
    for c in CAB:
        sh = pm.get((m, c, 'shows'))
        if not sh or not sh['spend']: continue
        if m == '2026-10': lo_, hi_, days = '2026-09-13', '2026-10-12', 13
        else: lo_, hi_, days = m + '-01', m + '-31', 30
        rev = sum(r['revenue'] for r in p if r['business'] == c and r['status'] == 'DELIVERED' and lo_ <= r['statusDate'] <= hi_)
        print(f"{m} | {CAB[c]} | показы {f0(sh['spend'])} = {f0(sh['spend'] / days)} в день (снимок, {days} дн.) | 1% доставленного за {lo_}..{hi_} / 30 = {f0(rev * 0.01 / 30)} в день, не меньше 1 000")
print("Толкование правила (1% за 30 дней, делённый на 30, как дневной лимит) - наше; текста справки в репо нет")

print("\n## 10. Размещение деньгами, а не баллами (реестр «Размещение товарных предложений»: Удержание = деньги, Списание = баллы), мебель")
pl = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['business'] == '74986385' and r['service'] == 'Размещение товарных предложений' and r['type'] in ('Удержание', 'Списание') and r['d'][:7] in MO: pl[r['d'][:7]][0 if r['type'] == 'Удержание' else 1] += abs(r['amount'])
for m in MO: print(f"  {m}: деньгами {f0(pl[m][0])}, баллами {f0(pl[m][1])}, доля денег {pct(pl[m][0], pl[m][0] + pl[m][1])}")
g51 = sorted([k for k in po if k[1] == 'GGT-35-5-1-100-180' and po[k]['status'] == 'DELIVERED' and po[k]['created'] >= '2026-10-02'], key=lambda k: po[k]['created'])
print("  5-1, октябрь, комиссия деньгами по заказам: " + ', '.join(f"{po[k]['created'][5:]} {f0(po[k]['fees'].get('Комиссия за продажу', 0))}" for k in g51))
