#!/usr/bin/env python3
"""Анализ рекламы Яндекс Маркета, июль-сентябрь 2026 (цепочка «МЕА - Дашборд ЯМ» v18, 14.10.2026).
Источники (analytics-mvp/data-ym/): promo_monthly (отчёты Маркета по продвижению), netting (реестр
взаиморасчётов, деньги и баллы), bonuses_monthly (отчёт по баллам), services_monthly (акт услуг),
orders (заказы), sku_views (отчёт показов shows-sales, с 07.09). Запуск: python3 -I analiz.py [DATA_DIR].
Правила: ДРР от всей доставленной выручки (E006), товарные строки без услуг доставки, отмены по статусу."""
import json, sys, collections, datetime, statistics
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); b = rd('bonuses_monthly.ndjson')
svc = rd('services_monthly.ndjson'); promo = rd('promo_monthly.ndjson')
cogs = json.load(open(D + 'sku_cogs.json')); tax = json.load(open(D + 'sku_taxonomy.json'))
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}; M = ('2026-07', '2026-08', '2026-09')
BOOST = 'Буст продаж, оплата за продажи'
p = [r for r in o if not r['service']]  # товарные строки (услуги доставки - отдельные строки заказа)
canc = lambda r: r['status'].startswith('CANCELLED')
line = lambda s: (tax.get(s) or {}).get('line') or 'прочее'
def pct(a, b): return f"{a / b:.1%}" if b else 'n/a'

print("## 1. Расход по инструментам, июль-сентябрь (отчёты Маркета promo_monthly; буст = деньги + баллы)")
print("месяц | кабинет | инструмент | расход | выручка с инструментом | заказов | ДРР по инструменту")
for r in promo:
    if r['ym'] in M:
        print(f"{r['ym']} | {CAB[r['business']]} | {r['kind']} | {r['spend']:,.0f} | {r['rev']:,.0f} | {r['orders']} | {pct(r['spend'], r['rev'])}")
print("\n## 2. Сверка буста: отчёт Маркета против реестра (деньги «Удержание» + баллы «Списание») и отчёта по баллам")
money = collections.defaultdict(float); pts = collections.defaultdict(float); bpts = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST:
        k = (r['d'][:7], r['business'])
        if r['type'] == 'Удержание': money[k] += abs(r['amount'])
        elif r['type'] == 'Списание': pts[k] += abs(r['amount'])
for r in b:
    if r['service'] == BOOST and r['type'] == 'Списание': bpts[(r['ym'], r['business'])] += abs(r['amount'])
print("месяц | кабинет | BILLED_AMOUNT | деньги | баллы реестра | баллы отчёта | разница")
for r in promo:
    if r['kind'] == 'boost' and r['ym'] >= '2026-06':
        k = (r['ym'], r['business']); print(f"{r['ym']} | {CAB[r['business']]} | {r['spend']:,.0f} | {money[k]:,.0f} | {pts[k]:,.0f} | {bpts[k]:,.0f} | {r['spend'] - money[k] - pts[k]:,.0f}")
print("\n## 3. Акт услуг (документ): кампании показов и полок по кабинетам, деньги / баллы")
A = collections.defaultdict(lambda: [0.0, 0.0])
for r in svc:
    if r['service'] in ('Буст продаж с оплатой за показы', 'Полка', 'Товарные баннеры') and r['ym'] >= '2026-07':
        A[(r['ym'], r['business'], r['service'])][0] += r['money']; A[(r['ym'], r['business'], r['service'])][1] += r['points']
for k in sorted(A): print(f"{k[0]} | {CAB[k[1]]} | {k[2]} | деньги {A[k][0]:,.0f} | баллы {A[k][1]:,.0f}")
print("\n## 4. Баллы: начислено и на что потрачено (отчёт по баллам)")
acc = collections.defaultdict(float); sp = collections.defaultdict(lambda: collections.defaultdict(float))
for r in b:
    k = (r['ym'], r['business'])
    if r['type'] == 'Начисление': acc[k] += r['amount']
    elif r['type'] == 'Списание': sp[k]['размещение' if r['service'] == 'Размещение товарных предложений' else 'буст' if r['service'] == BOOST else 'показы/полки' if r['service'] in ('Полки', 'Буст продаж, оплата за показы') else 'прочее'] += abs(r['amount'])
for k in sorted(acc):
    if k[0] in M: s = sp[k]; print(f"{k[0]} | {CAB[k[1]]} | начислено {acc[k]:,.0f} | размещение {s['размещение']:,.0f} | буст {s['буст']:,.0f} | показы/полки {s['показы/полки']:,.0f} | прочее {s['прочее']:,.0f}")
print("\n## 5. Динамика по месяцам (товарные заказы по дате заказа; буст по дате проводки)")
Mo = collections.defaultdict(lambda: collections.defaultdict(float))
for r in p:
    k = (r['created'][:7], r['business']); Mo[k]['orders'] += 1
    if canc(r): Mo[k]['canc'] += 1; Mo[k]['canc_sum'] += r['price']
    if r['status'] == 'DELIVERED': Mo[k]['deliv'] += 1; Mo[k]['rev'] += r['revenue']; Mo[k]['p_mp'] += r['p_mp']
    Mo[k]['price'] += r['price']
print("месяц | кабинет | заказов | отменено | сумма отмен | доставлено | выручка дост. | средняя цена | доля Маркета в цене | буст | ДРР буста")
for k in sorted(Mo):
    if k[0] < '2026-06' or k[0] > '2026-09': continue
    v = Mo[k]; bo = money[k] + pts[k]
    print(f"{k[0]} | {CAB[k[1]]} | {v['orders']:.0f} | {v['canc']:.0f} ({pct(v['canc'], v['orders'])}) | {v['canc_sum']:,.0f} | {v['deliv']:.0f} | {v['rev']:,.0f} | {v['price'] / v['orders']:,.0f} | {pct(v['p_mp'], v['rev'])} | {bo:,.0f} | {pct(bo, v['rev'])}")
print("\n## 6. Ставка буста по заказам (буст заказа / цена), июль-сентябрь")
S = collections.defaultdict(lambda: collections.defaultdict(float)); names = {}
po = {(r['order'], r['sku']): r for r in p}
rates = []
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and r['d'][:7] in M:
        k = (r['business'], r['sku']); S[k]['boost'] += abs(r['amount'])
        if r['type'] == 'Удержание': S[k]['boost_money'] += abs(r['amount'])
bo_ord = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and r['d'][:7] in M: bo_ord[(r['order'], r['sku'])] += abs(r['amount'])
for k, v in bo_ord.items():
    pr = po.get(k)
    if pr and pr['price']: rates.append(v / pr['price'])
q = statistics.quantiles(rates, n=10)
print(f"заказов с бустом {len(rates)}: медиана {statistics.median(rates):.1%}, p10 {q[0]:.1%}, p90 {q[8]:.1%}, максимум {max(rates):.1%}; заказов со ставкой >= 20%: {sum(1 for x in rates if x >= 0.2)}")
for r in p:
    if r['created'][:7] in M:
        k = (r['business'], r['sku']); names[r['sku']] = r['name']; S[k]['orders'] += 1
        if canc(r): S[k]['canc'] += 1
        if r['status'] == 'DELIVERED': S[k]['deliv'] += 1; S[k]['rev'] += r['revenue']; S[k]['units'] += r['count']
F = collections.defaultdict(lambda: collections.Counter())
for r in sv:
    if r.get('aggregate'): continue
    for f in ('views', 'pdp', 'cart', 'units'): F[(r['business'], r['sku'])][f] += r[f]
rows = []
for k, v in S.items():
    f = F.get(k, {}); c = cogs.get(k[1])
    rows.append(dict(cab=CAB[k[0]], sku=k[1], line=line(k[1]), orders=v['orders'], canc=v['canc'], deliv=v['deliv'], rev=v['rev'], boost=v['boost'], boost_money=v['boost_money'],
                     rate=v['boost'] / v['rev'] if v['rev'] else None, cogs=c, views=f.get('views', 0), pdp=f.get('pdp', 0), cart=f.get('cart', 0), fun_units=f.get('units', 0), name=names.get(k[1], '')))
rows.sort(key=lambda r: -r['rev'])
tot_rev = sum(r['rev'] for r in rows); tot_b = sum(r['boost'] for r in rows); tot_bm = sum(r['boost_money'] for r in rows)
print(f"\nИтого июль-сентябрь: доставлено {tot_rev:,.0f} ₽, буст {tot_b:,.0f} ₽ (деньгами {tot_bm:,.0f}, баллами {tot_b - tot_bm:,.0f}), ДРР буста от всей выручки {pct(tot_b, tot_rev)}")
print("\nSKU со ставкой буста >= 15% от доставленной выручки:")
for r in rows:
    if r['rate'] and r['rate'] >= 0.15: print(f"  {r['cab']} {r['sku']} {r['line']}: выручка {r['rev']:,.0f}, буст {r['boost']:,.0f}, ставка {r['rate']:.0%}, доставлено {r['deliv']:.0f} - {r['name'][:60]}")
print("\n## 7. По линиям, июль-сентябрь")
L = collections.defaultdict(lambda: collections.defaultdict(float))
for r in rows:
    k = (r['cab'], r['line'])
    for f in ('orders', 'canc', 'deliv', 'rev', 'boost', 'boost_money', 'views', 'pdp', 'cart', 'fun_units'): L[k][f] += r[f]
print("кабинет | линия | заказов | отмен | доставлено | выручка | буст | деньгами | ДРР | показы 07.09-12.10 | заходы | корзины | единицы")
for k in sorted(L, key=lambda k: -L[k]['rev']):
    v = L[k]
    if v['orders'] < 5: continue
    print(f"{k[0]} | {k[1]} | {v['orders']:.0f} | {pct(v['canc'], v['orders'])} | {v['deliv']:.0f} | {v['rev']:,.0f} | {v['boost']:,.0f} | {v['boost_money']:,.0f} | {pct(v['boost'], v['rev'])} | {v['views']:,.0f} | {v['pdp']:,.0f} | {v['cart']:,.0f} | {v['fun_units']:.0f}")
print("\n## 8. Воронка 07.09-12.10 по неделям (отчёт показов)")
W = collections.defaultdict(lambda: collections.Counter())
for r in sv:
    if r.get('aggregate'): continue
    d = datetime.date.fromisoformat(r['date']); wk = (d - datetime.timedelta(days=d.weekday())).isoformat()
    for f in ('views', 'pdp', 'cart', 'units'): W[(CAB[r['business']], wk)][f] += r[f]
print("кабинет | неделя с | показы | заходы | корзины | единицы | CTR | корзина/заход | единицы/заход")
for k in sorted(W):
    v = W[k]; print(f"{k[0]} | {k[1]} | {v['views']:,} | {v['pdp']:,} | {v['cart']} | {v['units']} | {pct(v['pdp'], v['views'])} | {pct(v['cart'], v['pdp'])} | {v['units'] / v['pdp']:.2%}")
print("\n## 9. Варианты одной модели: показы почти равны, CTR разный (07.09-12.10; заказы июль-сент)")
def variants(prefix, flt=lambda s: True):
    for s in sorted([s for s in {k[1] for k in F} if s.startswith(prefix) and flt(s)], key=lambda s: -F[next(k for k in F if k[1] == s)]['views']):
        k = next(k for k in F if k[1] == s); f = F[k]; g = [r for r in p if r['sku'] == s and r['created'][:7] in M]
        print(f"  {s}: показы {f['views']:,} | заходы {f['pdp']:,} | CTR {pct(f['pdp'], f['views'])} | корзины {f['cart']} | единицы {f['units']} | заказов июль-сент {len(g)}, доставлено {sum(r['status'] == 'DELIVERED' for r in g)} | {names.get(s, '')[-45:]}")
print("KONUX D100/180:"); variants('GGT-35-', lambda s: s.endswith('-100-180'))
print("TRUBIS овал 200х90 и 180х90:"); variants('GGT-03-', lambda s: 'O-20090' in s or 'O-18090' in s)
print("\n## 10. Показы без продаж: SKU с > 10 000 показов и 0 единиц за 07.09-12.10")
for k, f in sorted(F.items(), key=lambda x: -x[1]['views']):
    if f['views'] > 10000 and f['units'] == 0: print(f"  {CAB[k[0]]} {k[1]}: показы {f['views']:,}, заходы {f['pdp']}, CTR {pct(f['pdp'], f['views'])}, корзины {f['cart']} - {names.get(k[1], '')[:60]}")
print("\n## 11. Отмены, июль-сентябрь (товарные заказы)")
Wn = [r for r in p if r['created'][:7] in M]
print("статус | заказов | дней до отмены (распределение, 14 = 14 и больше)")
for st in ('CANCELLED_BEFORE_PROCESSING', 'CANCELLED_IN_PROCESSING', 'CANCELLED_IN_DELIVERY'):
    g = [r for r in Wn if r['status'] == st]
    dd = collections.Counter(min((datetime.date.fromisoformat(r['statusDate']) - datetime.date.fromisoformat(r['created'])).days, 14) for r in g)
    print(f"{st} | {len(g)} | {sorted(dd.items())}")
grp = collections.defaultdict(list)
for r in Wn: grp[(r['created'], r['sku'], r['region'])].append(r)
reorder = lambda r: any(x['status'] == 'DELIVERED' and x['order'] != r['order'] for x in grp[(r['created'], r['sku'], r['region'])])
for c in CAB:
    g = [r for r in Wn if r['business'] == c]; cz = [r for r in g if canc(r)]; rr = [r for r in cz if reorder(r)]
    print(f"{CAB[c]}: заказов {len(g)}, отменено {len(cz)} ({pct(len(cz), len(g))}) на {sum(r['price'] for r in cz):,.0f} ₽; из них перезаказ того же товара в тот же день в том же регионе с доставкой: {len(rr)} на {sum(r['price'] for r in rr):,.0f} ₽; чистые отмены {len(cz) - len(rr)} ({pct(len(cz) - len(rr), len(g))}) на {sum(r['price'] for r in cz if not reorder(r)):,.0f} ₽")
msk = {'Москва', 'Балашиха', 'Химки', 'Мытищи', 'Подольск', 'Одинцово', 'Красногорск', 'Люберцы'}
a = [r for r in Wn if r['region'] in msk]; z = [r for r in Wn if r['region'] not in msk]
print(f"Москва и МО: заказов {len(a)}, отмен {pct(sum(map(canc, a)), len(a))}; остальные регионы: заказов {len(z)}, отмен {pct(sum(map(canc, z)), len(z))}")
bc = sum(abs(r['amount']) for r in n if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and canc(po.get((r['order'], r['sku']), {'status': ''})))
print(f"буст, списанный по отменённым заказам (все месяцы): {bc:,.0f} ₽")
print("\n## 12. Кабинет зеркал: цена и платёж покупателя по месяцам (все товарные заказы)")
for m in ('2026-07', '2026-08', '2026-09', '2026-10'):
    g = [r for r in p if r['business'] == '1023124' and r['created'][:7] == m]
    print(f"{m}: заказов {len(g)}, отменено {pct(sum(map(canc, g)), len(g))}, средняя цена {sum(r['price'] for r in g) / len(g):,.0f}, платил покупатель {sum(r['p_buyer'] for r in g) / len(g):,.0f}")
for s in ('GGL-09-2', 'GGM-01-1', 'GGM-20-1'):
    print(f"  {s} ({line(s)}): " + ' | '.join(f"{m[5:]}: {len(g)} зак, отм {sum(map(canc, g))}, цена {sum(r['price'] for r in g) / len(g):,.0f}, покупатель {sum(r['p_buyer'] for r in g) / len(g):,.0f}" if (g := [r for r in p if r['sku'] == s and r['created'][:7] == m]) else f"{m[5:]}: 0" for m in ('2026-07', '2026-08', '2026-09', '2026-10')))
print("\n## 13. Буст деньгами и баллами по дням, сентябрь, мебель (когда баллы кончаются, буст идёт деньгами)")
byd = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and r['d'][:7] == '2026-09' and r['business'] == '74986385': byd[r['d']][0 if r['type'] == 'Удержание' else 1] += abs(r['amount'])
print(' '.join(f"{d[8:]}:{v[0]:.0f}/{v[1]:.0f}" for d, v in sorted(byd.items())))
json.dump(rows, open(D.replace('analytics-mvp/data-ym/', '') + 'knowledge/episodes/2026-10/ym-reklama-scripts/sku_rows.json', 'w'), ensure_ascii=False, indent=0) if 'analytics-mvp/data-ym' in D else None
