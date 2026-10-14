#!/usr/bin/env python3
"""Анализ рекламы Яндекс Маркета, июль-сентябрь 2026 (цепочка «МЕА - Дашборд ЯМ» v19, итерация 2 по return ФЕНИКСА 6.50).
Источники (analytics-mvp/data-ym/): promo_monthly (отчёты Маркета по продвижению), netting (реестр
взаиморасчётов, деньги и баллы), bonuses_monthly (отчёт по баллам), services_monthly (акт услуг),
orders (заказы), sku_views (отчёт показов shows-sales, с 07.09), pnl_sku_netting_daily (разноска реестра по
SKU со страницы «Деньги», с себестоимостью). Запуск: python3 -I analiz.py [DATA_DIR].
Правила: ДРР от всей доставленной выручки (E006), товарные строки без услуг доставки, отмены по статусу,
ставка буста = буст / (цена × количество), перезаказы один к одному, Москва и МО по списку MSK."""
import json, sys, collections, datetime, statistics
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); b = rd('bonuses_monthly.ndjson')
svc = rd('services_monthly.ndjson'); promo = rd('promo_monthly.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson')
cogs = json.load(open(D + 'sku_cogs.json')); tax = json.load(open(D + 'sku_taxonomy.json'))
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}; M = ('2026-07', '2026-08', '2026-09')
BOOST = 'Буст продаж, оплата за продажи'
SHOWS_ACT = ('Буст продаж с оплатой за показы', 'Полка', 'Товарные баннеры')
p = [r for r in o if not r['service']]  # товарные строки (услуги доставки - отдельные строки заказа)
po = {(r['order'], r['sku']): r for r in p}
canc = lambda r: r['status'].startswith('CANCELLED')
line = lambda s: (tax.get(s) or {}).get('line') or 'прочее'
dt = datetime.date.fromisoformat
def pct(a, b): return f"{a / b:.1%}" if b else 'n/a'
def f0(x): return f"{x:,.0f}"
# буст по заказам: сумма списаний (деньги + баллы) за все даты проводки и отдельно за даты проводки в квартале
bo_all = collections.defaultdict(float); bo_q = collections.defaultdict(float); bo_money_all = collections.defaultdict(float); bo_first = {}
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'):
        k = (r['order'], r['sku']); bo_all[k] += abs(r['amount']); bo_first[k] = min(bo_first.get(k, r['d']), r['d'])
        if r['type'] == 'Удержание': bo_money_all[k] += abs(r['amount'])
        if r['d'][:7] in M: bo_q[k] += abs(r['amount'])
rate = lambda k, v: v / (po[k]['price'] * po[k]['count'])  # ставка = буст / (цена × количество)

print("## 1. Расход по инструментам, июль-сентябрь (отчёты Маркета promo_monthly; буст = деньги + баллы; revAll = вся доставленная выручка по Маркету, по дате доставки)")
print("месяц | кабинет | инструмент | расход | выручка с инструментом | заказов | ДРР по инструменту | revAll | ДРР как в блоке 5 (расход / revAll)")
for r in promo:
    if r['ym'] in M:
        print(f"{r['ym']} | {CAB[r['business']]} | {r['kind']} | {f0(r['spend'])} | {f0(r['rev'])} | {r['orders']} | {pct(r['spend'], r['rev'])} | {f0(r['revAll']) if r.get('revAll') else '-'} | {pct(r['spend'], r['revAll']) if r.get('revAll') else '-'}")

print("\n## 2. Сверка буста продаж: отчёт Маркета (BILLED_AMOUNT) против реестра (деньги «Удержание» + баллы «Списание») и отчёта по баллам, все месяцы")
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
    if r['kind'] == 'boost':
        k = (r['ym'], r['business']); print(f"{r['ym']} | {CAB[r['business']]} | {f0(r['spend'])} | {f0(money[k])} | {f0(pts[k])} | {f0(bpts[k])} | {r['spend'] - money[k] - pts[k]:,.0f}")

print("\n## 3. Показы, полки, баннеры: отчёт Маркета (REAL_COST) = деньги акта + баллы отчёта по баллам, июль-сентябрь")
A = collections.defaultdict(lambda: [0.0, 0.0])  # акт: (месяц, кабинет, услуга) -> [деньги, баллы акта]
for r in svc:
    if r['service'] in SHOWS_ACT and r['ym'] in M:
        A[(r['ym'], r['business'], r['service'])][0] += r['money']; A[(r['ym'], r['business'], r['service'])][1] += r['points']
BP = collections.defaultdict(float)  # отчёт по баллам: (месяц, кабинет, услуга) -> баллы
for r in b:
    if r['type'] == 'Списание' and r['service'] in ('Полки', 'Буст продаж, оплата за показы') and r['ym'] in M: BP[(r['ym'], r['business'], r['service'])] += abs(r['amount'])
print("месяц | кабинет | инструмент | REAL_COST отчёта | деньги акта | баллы отчёта по баллам | деньги + баллы | разница")
act_money = collections.defaultdict(float)  # (месяц, кабинет) -> деньги акта по трём услугам
for r in promo:
    if r['ym'] in M and r['kind'] in ('shows', 'shelf'):
        m, c = r['ym'], r['business']
        if r['kind'] == 'shows': am = A[(m, c, 'Буст продаж с оплатой за показы')][0] + A[(m, c, 'Товарные баннеры')][0]; bp = BP[(m, c, 'Буст продаж, оплата за показы')]; nm = 'показы + баннеры'
        else: am = A[(m, c, 'Полка')][0]; bp = BP[(m, c, 'Полки')]; nm = 'полки'
        print(f"{m} | {CAB[c]} | {nm} | {f0(r['spend'])} | {f0(am)} | {f0(bp)} | {f0(am + bp)} | {r['spend'] - am - bp:,.0f}")
for k in A: act_money[(k[0], k[1])] += A[k][0]
print("Акт по кампаниям (деньги / баллы акта):")
C = collections.defaultdict(lambda: [0.0, 0.0])
for r in svc:
    if r['service'] in SHOWS_ACT and r['ym'] in M: C[(r['ym'], r['business'], r['service'], r['campaign'])][0] += r['money']; C[(r['ym'], r['business'], r['service'], r['campaign'])][1] += r['points']
for k in sorted(C): print(f"  {k[0]} | {CAB[k[1]]} | {k[2]} | кампания {k[3]} | деньги {f0(C[k][0])} | баллы акта {f0(C[k][1])}")
print("Зеркала: показы и полки по акту за июль (отчёт продвижения зеркал за июль Маркет не отдаёт):", f0(act_money[('2026-07', '1023124')]))

print("\n## 4. Баллы: начислено и на что потрачено (отчёт по баллам)")
acc = collections.defaultdict(float); sp = collections.defaultdict(lambda: collections.defaultdict(float))
for r in b:
    k = (r['ym'], r['business'])
    if r['type'] == 'Начисление': acc[k] += r['amount']
    elif r['type'] == 'Списание': sp[k]['размещение' if r['service'] == 'Размещение товарных предложений' else 'буст' if r['service'] == BOOST else 'показы/полки' if r['service'] in ('Полки', 'Буст продаж, оплата за показы') else 'прочее'] += abs(r['amount'])
for k in sorted(acc):
    if k[0] in M: s = sp[k]; print(f"{k[0]} | {CAB[k[1]]} | начислено {f0(acc[k])} | размещение {f0(s['размещение'])} | буст {f0(s['буст'])} | показы/полки {f0(s['показы/полки'])} | прочее {f0(s['прочее'])} | потрачено всего {f0(sum(s.values()))}")
pmp9 = sum(r['p_mp'] * r['count'] for r in p if r['business'] == '74986385' and r['status'] == 'DELIVERED' and r['statusDate'][:7] == '2026-09')
print(f"сентябрь, мебель: начислено баллов {f0(acc[('2026-09', '74986385')])} против доли Маркета в цене доставленных в сентябре {f0(pmp9)} (разница {pct(acc[('2026-09', '74986385')] - pmp9, pmp9)})")

print("\n## 5. Динамика по месяцам (товарные заказы по дате заказа; буст по дате проводки; ДРР на трёх окнах и как в блоке 5)")
Mo = collections.defaultdict(lambda: collections.defaultdict(float))
for r in p:
    k = (r['created'][:7], r['business']); Mo[k]['orders'] += 1
    if canc(r): Mo[k]['canc'] += 1; Mo[k]['canc_sum'] += r['price']
    if r['status'] == 'DELIVERED': Mo[k]['deliv'] += 1; Mo[k]['rev'] += r['revenue']; Mo[k]['p_mp'] += r['p_mp']
    Mo[k]['price'] += r['price']
    if r['status'] == 'DELIVERED': Mo[(r['statusDate'][:7], r['business'])]['rev_dd'] += r['revenue']  # по дате доставки
for k, v in bo_all.items():
    if k in po: Mo[(po[k]['created'][:7], po[k]['business'])]['boost_same'] += v  # буст заказов месяца, любая дата проводки
revall = {(r['ym'], r['business']): r for r in promo if r['kind'] == 'boost'}
print("месяц | кабинет | заказов | отменено | сумма отмен | доставлено | выручка дост. (дата заказа) | средняя цена | доля Маркета в цене | буст (проводка) | ДРР буста | ДРР одна популяция (буст заказов месяца) | ДРР по дате доставки | revAll Маркета | ДРР как в блоке 5 | наша выручка по дате доставки к revAll")
for k in sorted(Mo):
    if k[0] < '2026-06' or k[0] > '2026-09': continue
    v = Mo[k]; bo = money[k] + pts[k]; ra = revall.get(k)
    print(f"{k[0]} | {CAB[k[1]]} | {v['orders']:.0f} | {v['canc']:.0f} ({pct(v['canc'], v['orders'])}) | {f0(v['canc_sum'])} | {v['deliv']:.0f} | {f0(v['rev'])} | {f0(v['price'] / v['orders'])} | {pct(v['p_mp'], v['rev'])} | {f0(bo)} | {pct(bo, v['rev'])} | {pct(v['boost_same'], v['rev'])} | {pct(bo, v['rev_dd'])} | {f0(ra['revAll']) if ra else '-'} | {pct(ra['spend'], ra['revAll']) if ra else '-'} | {pct(v['rev_dd'] - ra['revAll'], ra['revAll']) if ra else '-'}")
rev_q = sum(Mo[(m, c)]['rev'] for m in M for c in CAB); rev_dd_q = sum(Mo[(m, c)]['rev_dd'] for m in M for c in CAB)
bo_post_q = sum(money[(m, c)] + pts[(m, c)] for m in M for c in CAB); bo_same_q = sum(Mo[(m, c)]['boost_same'] for m in M for c in CAB)
bm_q = sum(money[(m, c)] for m in M for c in CAB)
print(f"Квартал: доставлено по дате заказа {f0(rev_q)}, по дате доставки {f0(rev_dd_q)}; буст по проводке {f0(bo_post_q)} (деньгами {f0(bm_q)}, баллами {f0(bo_post_q - bm_q)}), буст заказов квартала {f0(bo_same_q)}")
print(f"ДРР буста за квартал: по проводке / дата заказа {pct(bo_post_q, rev_q)}; одна популяция {pct(bo_same_q, rev_q)}; по дате доставки {pct(bo_post_q, rev_dd_q)}")
mb = [(m, '74986385') for m in M]
print(f"Проверка E006, мебель июль-сентябрь: наш ДРР (проводка / дата заказа) {pct(sum(money[k] + pts[k] for k in mb), sum(Mo[k]['rev'] for k in mb))} против блока 5 (spend / revAll) {pct(sum(revall[k]['spend'] for k in mb), sum(revall[k]['revAll'] for k in mb))}; наша выручка по дате доставки {f0(sum(Mo[k]['rev_dd'] for k in mb))} против revAll {f0(sum(revall[k]['revAll'] for k in mb))}")

print("\n## 6. Живые деньги на рекламу по месяцам: буст деньгами (реестр = акт) + показы, полки, баннеры деньгами (акт)")
print("месяц | кабинет | буст деньгами | показы + полки + баннеры деньгами (акт) | всего деньгами")
live = collections.defaultdict(float)
for m in M:
    for c in CAB:
        x = money[(m, c)] + act_money[(m, c)]; live[m] += x
        print(f"{m} | {CAB[c]} | {f0(money[(m, c)])} | {f0(act_money[(m, c)])} | {f0(x)}")
    print(f"{m} | оба кабинета | {f0(money[(m, '1023124')] + money[(m, '74986385')])} | {f0(act_money[(m, '1023124')] + act_money[(m, '74986385')])} | {f0(live[m])}")
print(f"Квартал живыми деньгами: {f0(sum(live.values()))}; из них буст {f0(bm_q)}, показы/полки/баннеры {f0(sum(act_money[(m, c)] for m in M for c in CAB))}; в месяц {f0(min(live.values()))}-{f0(max(live.values()))}")
act_boost = collections.defaultdict(float)
for r in svc:
    if r['service'] == 'Буст продаж' and r['ym'] in M: act_boost[(r['ym'], r['business'])] += r['money']
print("Буст деньгами, реестр против акта: " + '; '.join(f"{m[5:]} {CAB[c]} {f0(money[(m, c)])} / {f0(act_boost[(m, c)])}" for m in M for c in CAB))

print("\n## 7. Ставка буста по заказам (буст / (цена × количество)), проводки июль-сентябрь")
rates = {k: rate(k, v) for k, v in bo_q.items() if k in po and po[k]['price']}
xs = list(rates.values()); q = statistics.quantiles(xs, n=10)
print(f"заказов с бустом {len(xs)}: медиана {statistics.median(xs):.1%}, p10 {q[0]:.1%}, p90 {q[8]:.1%}, максимум {max(xs):.1%}; заказов со ставкой >= 20%: {sum(1 for x in xs if x >= 0.2)}; строк с количеством > 1: {sum(1 for k in rates if po[k]['count'] > 1)}")
for lab, sel in (('заказы, созданные до 15.09', lambda k: po[k]['created'] < '2026-09-15'), ('заказы, созданные с 15.09', lambda k: po[k]['created'] >= '2026-09-15')):
    ys = [v for k, v in rates.items() if sel(k)]; qq = statistics.quantiles(ys, n=10)
    print(f"  {lab}: {len(ys)} заказов, медиана {statistics.median(ys):.1%}, p90 {qq[8]:.1%}")
for c in CAB:
    for lab, sel in (('до 15.09', lambda k: po[k]['created'] < '2026-09-15'), ('с 15.09', lambda k: po[k]['created'] >= '2026-09-15')):
        ys = [v for k, v in rates.items() if sel(k) and po[k]['business'] == c]
        print(f"  {CAB[c]}, {lab}: {len(ys)} заказов, медиана {statistics.median(ys):.1%}")
print("Напольные зеркала EVELUM GGM-01-1/2/3 и SYVONT GGM-29-4, одна популяция (заказы, созданные в квартале, буст за любую дату проводки):")
S4 = ('GGM-01-1', 'GGM-01-2', 'GGM-01-3', 'GGM-29-4')
rev4 = sum(r['revenue'] for r in p if r['sku'] in S4 and r['created'][:7] in M and r['status'] == 'DELIVERED')
bo4 = sum(v for k, v in bo_all.items() if k in po and po[k]['sku'] in S4 and po[k]['created'][:7] in M)
bo4_money = sum(v for k, v in bo_money_all.items() if k in po and po[k]['sku'] in S4 and po[k]['created'][:7] in M)
print(f"  выручка {f0(rev4)}, буст {f0(bo4)} (деньгами {f0(bo4_money)}), ставка {pct(bo4, rev4)}; при 8% буст был бы {f0(rev4 * 0.08)}, разница {f0(bo4 - rev4 * 0.08)}; буст по проводкам квартала {f0(sum(abs(r['amount']) for r in n if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and r['sku'] in S4 and r['d'][:7] in M))}")
for s in S4:
    ks = sorted([k for k in bo_all if k in po and po[k]['sku'] == s and po[k]['created'] >= '2026-06-15'], key=lambda k: po[k]['created'])
    print(f"  {s}: " + ', '.join(f"{po[k]['created'][5:]} {rate(k, bo_all[k]):.0%}" for k in ks))
hi = [(po[k]['sku'], po[k]['created'][5:], v) for k, v in rates.items() if v >= 0.2]
print(f"Заказы со ставкой от 20% по месяцам создания: {dict(sorted(collections.Counter(x[1][:2] for x in hi).items()))}, по SKU: {dict(collections.Counter(x[0] for x in hi).most_common(6))}")

S = collections.defaultdict(lambda: collections.defaultdict(float)); names = {}
for r in p:
    if r['created'][:7] in M:
        k = (r['business'], r['sku']); names[r['sku']] = r['name']; S[k]['orders'] += 1
        if canc(r): S[k]['canc'] += 1
        if r['status'] == 'DELIVERED': S[k]['deliv'] += 1; S[k]['rev'] += r['revenue']; S[k]['units'] += r['count']
for k, v in bo_all.items():  # одна популяция: буст заказов, созданных в квартале
    if k in po and po[k]['created'][:7] in M: S[(po[k]['business'], po[k]['sku'])]['boost'] += v; S[(po[k]['business'], po[k]['sku'])]['boost_money'] += bo_money_all.get(k, 0)
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
print("\nSKU со ставкой буста >= 15% от доставленной выручки (одна популяция: заказы квартала, буст за любую дату проводки):")
for r in rows:
    if r['rate'] and r['rate'] >= 0.15: print(f"  {r['cab']} {r['sku']} {r['line']}: выручка {f0(r['rev'])}, буст {f0(r['boost'])}, ставка {r['rate']:.0%}, доставлено {r['deliv']:.0f} - {r['name'][:60]}")

print("\n## 8. По линиям, июль-сентябрь (буст одной популяции)")
L = collections.defaultdict(lambda: collections.defaultdict(float))
for r in rows:
    k = (r['cab'], r['line'])
    for f in ('orders', 'canc', 'deliv', 'rev', 'boost', 'boost_money', 'views', 'pdp', 'cart', 'fun_units'): L[k][f] += r[f]
print("кабинет | линия | заказов | отмен | доставлено | выручка | буст | деньгами | ДРР | показы 07.09-12.10 | заходы | корзины | единицы")
for k in sorted(L, key=lambda k: -L[k]['rev']):
    v = L[k]
    if v['orders'] < 5: continue
    print(f"{k[0]} | {k[1]} | {v['orders']:.0f} | {pct(v['canc'], v['orders'])} | {v['deliv']:.0f} | {f0(v['rev'])} | {f0(v['boost'])} | {f0(v['boost_money'])} | {pct(v['boost'], v['rev'])} | {f0(v['views'])} | {f0(v['pdp'])} | {f0(v['cart'])} | {v['fun_units']:.0f}")
mp = [r for r in p if r['business'] == '74986385' and r['created'][:7] in M]
print(f"Таксономия: заказов мебели за квартал {len(mp)}, из них в линии «прочее» {sum(1 for r in mp if line(r['sku']) == 'прочее')} ({pct(sum(1 for r in mp if line(r['sku']) == 'прочее'), len(mp))}); TRUBIS по таксономии {sum(1 for r in mp if line(r['sku']) == 'TRUBIS')}, по названию или префиксу GGT-03 {sum(1 for r in mp if 'TRUBIS' in r['name'].upper() or r['sku'].startswith('GGT-03-'))}")

print("\n## 9. Воронка 07.09-12.10 по неделям (отчёт показов)")
W = collections.defaultdict(lambda: collections.Counter())
for r in sv:
    if r.get('aggregate'): continue
    d = dt(r['date']); wk = (d - datetime.timedelta(days=d.weekday())).isoformat()
    for f in ('views', 'pdp', 'cart', 'units'): W[(CAB[r['business']], wk)][f] += r[f]
print("кабинет | неделя с | показы | заходы | корзины | единицы | CTR | корзина/заход | единицы/заход")
for k in sorted(W):
    v = W[k]; print(f"{k[0]} | {k[1]} | {v['views']:,} | {v['pdp']:,} | {v['cart']} | {v['units']} | {pct(v['pdp'], v['views'])} | {pct(v['cart'], v['pdp'])} | {v['units'] / v['pdp']:.2%}")
conv = {c: (sum(v['units'] for k, v in W.items() if k[0] == CAB[c]), sum(v['pdp'] for k, v in W.items() if k[0] == CAB[c])) for c in CAB}
print("Конверсия заход -> единица за окно: " + '; '.join(f"{CAB[c]} {conv[c][0]} / {conv[c][1]} = {conv[c][0] / conv[c][1]:.2%}" for c in CAB))

print("\n## 10. Варианты одной модели: показы почти равны, CTR разный (07.09-12.10; заказы июль-сент)")
def variants(prefix, flt=lambda s: True):
    for s in sorted([s for s in {k[1] for k in F} if s.startswith(prefix) and flt(s)], key=lambda s: -F[next(k for k in F if k[1] == s)]['views']):
        k = next(k for k in F if k[1] == s); f = F[k]; g = [r for r in p if r['sku'] == s and r['created'][:7] in M]
        print(f"  {s}: показы {f['views']:,} | заходы {f['pdp']:,} | CTR {pct(f['pdp'], f['views'])} | корзины {f['cart']} | единицы {f['units']} | заказов июль-сент {len(g)}, доставлено {sum(r['status'] == 'DELIVERED' for r in g)} | {names.get(s, '')[-45:]}")
print("KONUX D100/180:"); variants('GGT-35-', lambda s: s.endswith('-100-180'))
print("TRUBIS овал 200х90 и 180х90 (показы > 2 000):"); variants('GGT-03-', lambda s: ('O-20090' in s or 'O-18090' in s) and F[next(k for k in F if k[1] == s)]['views'] > 2000)

print("\n## 11. Показы без заходов: SKU с > 10 000 показов и CTR ниже 1,1% за 07.09-12.10 (набор для П2)")
low = [(k, f) for k, f in F.items() if f['views'] > 10000 and f['pdp'] / f['views'] < 0.011]
low.sort(key=lambda x: -x[1]['views'])
for k, f in low: print(f"  {CAB[k[0]]} {k[1]}: показы {f['views']:,}, заходы {f['pdp']}, CTR {pct(f['pdp'], f['views'])}, корзины {f['cart']}, единицы {f['units']} - {names.get(k[1], '')[:60]}")
lowm = [(k, f) for k, f in low if k[0] == '74986385']
lv = sum(f['views'] for _, f in lowm); lp = sum(f['pdp'] for _, f in lowm); lu = sum(f['units'] for _, f in lowm)
cm = conv['74986385'][0] / conv['74986385'][1]
print(f"Итого {len(lowm)} карточек мебели: показы {lv:,}, заходы {lp:,}, единицы {lu}. При CTR 3,8% (уровень GGT-35-1-3) заходов было бы {lv * 0.038:,.0f} (+{lv * 0.038 - lp:,.0f}); при конверсии мебели заход -> единица {cm:.2%} это +{(lv * 0.038 - lp) * cm:.0f} единиц за окно (5 недель), нижняя граница ×0,3: +{(lv * 0.038 - lp) * cm * 0.3:.0f}")
print("SKU с > 10 000 показов и 0 единиц: " + ', '.join(f"{k[1]} ({f['views']:,})" for k, f in sorted(F.items(), key=lambda x: -x[1]['views']) if f['views'] > 10000 and f['units'] == 0))

print("\n## 12. Отмены, июль-сентябрь (товарные заказы)")
Wn = [r for r in p if r['created'][:7] in M]
print("статус | заказов | дней до отмены (распределение, 14 = 14 и больше)")
for st in ('CANCELLED_BEFORE_PROCESSING', 'CANCELLED_IN_PROCESSING', 'CANCELLED_IN_DELIVERY'):
    g = [r for r in Wn if r['status'] == st]
    dd = collections.Counter(min((dt(r['statusDate']) - dt(r['created'])).days, 14) for r in g)
    print(f"{st} | {len(g)} | {sorted(dd.items())}")
grp = collections.defaultdict(list)
for r in Wn: grp[(r['created'], r['sku'], r['region'])].append(r)
reord = set()  # перезаказ один к одному: на каждый доставленный в группе (день, SKU, регион) не больше одного отменённого
for key, g in grp.items():
    cz = [r for r in g if canc(r)]; dl = [r for r in g if r['status'] == 'DELIVERED']
    for r in cz[:len(dl)]: reord.add((r['order'], r['sku']))
isre = lambda r: (r['order'], r['sku']) in reord
print(f"Отменено всего {sum(map(canc, Wn))} из {len(Wn)} ({pct(sum(map(canc, Wn)), len(Wn))}) на {f0(sum(r['price'] for r in Wn if canc(r)))} ₽; перезаказов один к одному {len(reord)} на {f0(sum(r['price'] for r in Wn if isre(r)))} ₽")
MSK = {'Москва', 'Зеленоград', 'Троицк', 'Московский', 'Щербинка', 'Балашиха', 'Химки', 'Мытищи', 'Подольск', 'Одинцово', 'Красногорск', 'Люберцы', 'Видное', 'Заречье', 'Развилка', 'Котельники', 'Дзержинский',
       'Королёв', 'Реутов', 'Долгопрудный', 'Щёлково', 'Пушкино', 'Раменское', 'Домодедово', 'Ногинск', 'Электросталь', 'Лобня', 'Ивантеевка', 'Фрязино', 'Жуковский', 'Серпухов', 'Коломна', 'Сергиев Посад',
       'Дмитров', 'Истра', 'Чехов', 'Наро-Фоминск', 'Звенигород', 'Апрелевка', 'Солнечногорск', 'Клин', 'Воскресенск', 'Егорьевск', 'Лыткарино', 'Дедовск', 'Голицыно', 'Сосенское', 'Мосрентген', 'Новоивановское',
       'Бутово', 'Власиха', 'Кокошкино', 'Краснознаменск', 'Старая Купавна', 'Электроугли', 'Обухово', 'Дрезна', 'Нахабино', 'Черноголовка', 'Протвино', 'Ромашково', 'Лайково', 'Немчиново', 'Битца', 'Марфино',
       'Митькино', 'Мисайлово', 'Дрожжино', 'Горки', 'Крёкшино', 'Кривцово', 'Жостово', 'Бакеево', 'Сапроново', 'Лопатино', 'Чёрное', 'Быково', 'Пески', 'Мартемьяново', 'Маслово', 'Алёшино', 'ИЦ Сколково',
       'Одинцовский район', 'Городской округ Подольск', 'Городской округ Мытищи', 'Городской округ Домодедово', 'Городской округ Истра', 'Городской округ Ступино', 'Дмитровский городской округ', 'Раменский район', 'Воскресенский район', 'Зименки'}
msk = lambda r: r['region'] in MSK
print("кабинет | зона | заказов | отменено | перезаказов 1:1 | чистые отмены | доля чистых | доля всех отмен")
eff = {}
for c in CAB:
    for lab, sel in (('Москва и МО', msk), ('регионы', lambda r: not msk(r)), ('всего', lambda r: True)):
        g = [r for r in Wn if r['business'] == c and sel(r)]; cz = [r for r in g if canc(r)]; rr = [r for r in cz if isre(r)]
        eff[(c, lab)] = (len(g), len(cz) - len(rr))
        print(f"{CAB[c]} | {lab} | {len(g)} | {len(cz)} | {len(rr)} | {len(cz) - len(rr)} | {pct(len(cz) - len(rr), len(g))} | {pct(len(cz), len(g))}")
for c in CAB:
    nr, cr = eff[(c, 'регионы')]; nm_, cmk = eff[(c, 'Москва и МО')]
    gain = cr - nr * cmk / nm_
    avg = statistics.mean(r['revenue'] for r in Wn if r['business'] == c and r['status'] == 'DELIVERED')
    print(f"Если бы регионы {CAB[c]} отменяли как Москва и МО ({pct(cmk, nm_)} вместо {pct(cr, nr)}): +{gain:.0f} заказов за квартал, по среднему доставленному {f0(avg)} это {f0(gain * avg)} ₽; нижняя граница ×0,3: +{gain * 0.3:.0f} заказов, {f0(gain * avg * 0.3)} ₽")
cancel_orders = {r['order'] for r in Wn if canc(r)}
PEN = ('Доставка (средняя миля)', 'Доставка невыкупов и возвратов', 'Отмена заказа по вине продавца', 'Отгрузка или доставка не вовремя')
for s in PEN:
    onc = sum(abs(r['amount']) for r in n if r['service'] == s and r['amount'] < 0 and r['order'] in cancel_orders)
    allq = sum(abs(r['amount']) for r in n if r['service'] == s and r['amount'] < 0 and r['d'][:7] in M)
    print(f"  «{s}»: по отменённым заказам квартала {f0(onc)}; все проводки квартала {f0(allq)}")
bc = sum(abs(r['amount']) for r in n if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and canc(po.get((r['order'], r['sku']), {'status': ''})))
print(f"буст, списанный по отменённым заказам (все месяцы): {f0(bc)} ₽")
late = [r for r in Wn if r['status'] == 'CANCELLED_IN_DELIVERY' and (dt(r['statusDate']) - dt(r['created'])).days >= 14]
print(f"отмены «в доставке» на 14-й день и позже: {len(late)}, из них регионы {sum(1 for r in late if not msk(r))}, по кабинетам {dict(collections.Counter(CAB[r['business']] for r in late))}")

print("\n## 13. Кабинет зеркал: заказы, цена и платёж покупателя (все товарные заказы)")
for m in ('2026-07', '2026-08', '2026-09', '2026-10'):
    g = [r for r in p if r['business'] == '1023124' and r['created'][:7] == m]
    print(f"{m}: заказов {len(g)}, отменено {pct(sum(map(canc, g)), len(g))}, средняя цена {f0(sum(r['price'] for r in g) / len(g))}, платил покупатель {f0(sum(r['p_buyer'] for r in g) / len(g))}")
for s in ('GGL-09-2', 'GGM-01-1', 'GGM-20-1'):
    print(f"  {s} ({line(s)}): " + ' | '.join(f"{m[5:]}: {len(g)} зак, отм {sum(map(canc, g))}, цена {f0(sum(r['price'] for r in g) / len(g))}, покупатель {f0(sum(r['p_buyer'] for r in g) / len(g))}" if (g := [r for r in p if r['sku'] == s and r['created'][:7] == m]) else f"{m[5:]}: 0" for m in ('2026-07', '2026-08', '2026-09', '2026-10')))
wk = collections.Counter()
for r in p:
    if r['business'] == '1023124' and r['created'] >= '2026-06-29': d = dt(r['created']); wk[(d - datetime.timedelta(days=d.weekday())).isoformat()[5:]] += 1
print("заказов зеркал по неделям (с понедельника): " + ', '.join(f"{k} {v}" for k, v in sorted(wk.items())))
g = [r for r in p if r['sku'] == 'GGL-09-2' and r['created'][:7] == '2026-10']
print(f"OSOLIS GGL-09-2, октябрь: {len(g)} заказов, статусы и день отмены: {sorted(collections.Counter((r['status'], (dt(r['statusDate']) - dt(r['created'])).days) for r in g).items())}")
osk = {s for s, v in tax.items() if (v or {}).get('line') == 'OSOLIS'}
dv = collections.Counter()
for r in sv:
    if not r.get('aggregate') and r['sku'] in osk: dv[r['date']] += r['views']
ds = sorted(dv.items())
print(f"OSOLIS показов в день: первая неделя {[v for _, v in ds[:7]]}, последняя полная неделя {[v for _, v in ds[-8:-1]]}; всего за окно {sum(dv.values()):,} из {sum(f['views'] for k, f in F.items() if k[0] == '1023124'):,} показов кабинета ({pct(sum(dv.values()), sum(f['views'] for k, f in F.items() if k[0] == '1023124'))})")

print("\n## 14. KONUX GGT-35-5-1-100-180: ставка с 02.10, показы до и после")
s = 'GGT-35-5-1-100-180'
oc = sorted([k for k in bo_all if k in po and k[1] == s and bo_first[k] >= '2026-10-02'], key=lambda k: po[k]['created'])
print("создан | цена | кол-во | буст | ставка | статус")
for k in oc: print(f"  {po[k]['created']} | {f0(po[k]['price'])} | {po[k]['count']} | {f0(bo_all[k])} | {rate(k, bo_all[k]):.1%} | {po[k]['status']}")
med = statistics.median([v for k, v in rates.items() if po[k]['created'] >= '2026-09-15'])
for lab, ks in (('все заказы с проводкой с 02.10', oc), ('только созданные с 02.10', [k for k in oc if po[k]['created'] >= '2026-10-02'])):
    sb = sum(bo_all[k] for k in ks); sp_ = sum(po[k]['price'] * po[k]['count'] for k in ks)
    print(f"итого, {lab}: {len(ks)} заказов, буст {f0(sb)} на {f0(sp_)} ₽ цены ({pct(sb, sp_)}); при медианной ставке с 15.09 ({med:.1%}) буст был бы {f0(sp_ * med)}, разница {f0(sb - sp_ * med)}, то есть {f0((sb - sp_ * med) / len(ks))} на заказ")
for m in ('2026-07', '2026-08', '2026-09', '2026-10'):
    g = [r for r in p if r['sku'] == s and r['created'][:7] == m]
    if g: print(f"  {m}: заказов {len(g)}, отменено {sum(map(canc, g))}, доставлено {sum(r['status'] == 'DELIVERED' for r in g)}, в пути {sum(r['status'] in ('DELIVERY', 'PROCESSING', 'PICKUP') for r in g)}, средняя цена {f0(sum(r['price'] for r in g) / len(g))}, платил покупатель {f0(sum(r['p_buyer'] for r in g) / len(g))}")
pre = collections.Counter(); post = collections.Counter(); dpre = set(); dpost = set()
for r in sv:
    if r.get('aggregate') or r['sku'] != s: continue
    t, dd_ = (pre, dpre) if r['date'] < '2026-10-02' else (post, dpost); dd_.add(r['date'])
    for f in ('views', 'pdp', 'units'): t[f] += r[f]
print(f"  показы до 02.10: {pre['views']:,} за {len(dpre)} дней ({pre['views'] / len(dpre):,.0f} в день), CTR {pct(pre['pdp'], pre['views'])}, единиц {pre['units']}; с 02.10: {post['views']:,} за {len(dpost)} дней ({post['views'] / len(dpost):,.0f} в день), CTR {pct(post['pdp'], post['views'])}, единиц {post['units']}")

print("\n## 15. Мебель: платёж покупателя и заказы, август против сентября (строки заказов)")
for m in ('2026-08', '2026-09'):
    for lab, sel in (('доставленные', lambda r: r['status'] == 'DELIVERED'), ('все', lambda r: True)):
        g = [r for r in p if r['business'] == '74986385' and r['created'][:7] == m and sel(r)]
        print(f"  {m} {lab}: строк {len(g)}, средняя цена {f0(sum(r['price'] for r in g) / len(g))}, платил покупатель {f0(sum(r['p_buyer'] for r in g) / len(g))}, доля Маркета {pct(sum(r['p_mp'] for r in g), sum(r['price'] for r in g))}")

print("\n## 16. Буст деньгами и баллами по дням, сентябрь, мебель (когда баллы кончаются, буст идёт деньгами)")
byd = collections.defaultdict(lambda: [0.0, 0.0]); od = collections.defaultdict(lambda: [0.0, 0.0])
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание') and r['d'][:7] == '2026-09' and r['business'] == '74986385':
        i = 0 if r['type'] == 'Удержание' else 1; byd[r['d']][i] += abs(r['amount']); od[(r['order'], r['sku'], r['d'])][i] += abs(r['amount'])
print(' '.join(f"{d[8:]}:{v[0]:.0f}/{v[1]:.0f}" for d, v in sorted(byd.items())))
both = [v for v in od.values() if v[0] > 0 and v[1] > 0]; mo = [v for v in od.values() if v[0] > 0 and v[1] == 0]; pon = [v for v in od.values() if v[0] == 0 and v[1] > 0]
print(f"строк заказ-день {len(od)}: и деньгами, и баллами {len(both)} (деньгами в них {f0(sum(v[0] for v in both))}, доля денег медиана {statistics.median(v[0] / (v[0] + v[1]) for v in both):.1%}), только деньгами {len(mo)} (деньгами {f0(sum(v[0] for v in mo))}), только баллами {len(pon)}")
print("дни с самыми большими списаниями деньгами: " + ', '.join(f"{d[8:]} {v[0]:,.0f} (баллами {v[1]:,.0f})" for d, v in sorted(byd.items(), key=lambda x: -x[1][0])[:5]))

print("\n## 17. Мощность тестов: заказы без отмен по неделям (29.06-27.09), разброс между неделями и минимальный различимый эффект")
def weekly(sel):
    w = collections.Counter()
    for r in p:
        if '2026-06-29' <= r['created'] <= '2026-09-27' and sel(r) and not canc(r):
            d = dt(r['created']); w[(d - datetime.timedelta(days=d.weekday())).isoformat()] += 1
    return [w.get(k, 0) for k in sorted(w)]
print("единица теста | заказов в неделю | разброс (SD) | MDE при 2 неделях на плечо | при 4 неделях | при 8 неделях (alpha 0,05, мощность 80%, MDE = 2,8 × SD × √(2/n))")
for lab, sel in (('кабинет мебель', lambda r: r['business'] == '74986385'), ('кабинет зеркала', lambda r: r['business'] == '1023124'), ('линия TRUBIS (по названию)', lambda r: 'TRUBIS' in r['name'].upper()), ('линия KONUX (по названию)', lambda r: 'KONUX' in r['name'].upper())):
    xs = weekly(sel); mu = statistics.mean(xs); sd = statistics.stdev(xs)
    print(f"{lab} | {mu:.1f} ({min(xs)}-{max(xs)}) | {sd:.1f} | " + ' | '.join(f"{2.8 * sd * (2 / k) ** 0.5:.0f} ({2.8 * sd * (2 / k) ** 0.5 / mu:.0%})" for k in (2, 4, 8)))
print("Для сравнения, если бы недели были пуассоновскими (SD = √среднего): мебель SD " + f"{statistics.mean(weekly(lambda r: r['business'] == '74986385')) ** 0.5:.1f}")

print("\n## 18. Маржа в деньгах после буста по главным SKU, проводки июль-сентябрь (разноска реестра со страницы «Деньги»: деньги к выплате минус себестоимость; буст баллами отдельно)")
PS = collections.defaultdict(lambda: collections.defaultdict(float))
for r in pnl:
    if r['d'][:7] in M and r['basis'] == 'netting':
        k = (r['business'], r['sku'])
        for f in ('units', 'accruals', 'amount', 'cogs', 'promo', 'points'): PS[k][f] += r[f]
        PS[k]['cogs_unknown'] += (0 if r['cogs_known'] else r['units'])
bpk = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] == 'Списание' and r['d'][:7] in M: bpk[(r['business'], r['sku'])] += abs(r['amount'])
print("кабинет | SKU | линия | штук | деньги покупателя | буст деньгами | к выплате деньгами | себестоимость | маржа в деньгах | маржа % от денег покупателя | буст баллами | маржа, если бы буст баллами был деньгами")
top = sorted(PS.items(), key=lambda x: -x[1]['accruals'])[:12]
for k, v in top:
    m_ = v['amount'] - v['cogs']
    print(f"{CAB[k[0]]} | {k[1]} | {line(k[1])} | {v['units']:.0f} | {f0(v['accruals'])} | {f0(-v['promo'])} | {f0(v['amount'])} | {f0(v['cogs'])}{' (нет себестоимости у ' + str(int(v['cogs_unknown'])) + ' шт)' if v['cogs_unknown'] else ''} | {f0(m_)} | {pct(m_, v['accruals'])} | {f0(bpk[k])} | {f0(m_ - bpk[k])} ({pct(m_ - bpk[k], v['accruals'])})")
tot = collections.defaultdict(float)
for k, v in PS.items():
    for f in ('units', 'accruals', 'amount', 'cogs', 'promo'): tot[f] += v[f]
print(f"Все SKU за квартал: штук {tot['units']:.0f}, деньги покупателя {f0(tot['accruals'])}, буст деньгами {f0(-tot['promo'])}, к выплате {f0(tot['amount'])}, себестоимость {f0(tot['cogs'])}, маржа в деньгах {f0(tot['amount'] - tot['cogs'])} ({pct(tot['amount'] - tot['cogs'], tot['accruals'])}); буст баллами {f0(sum(bpk.values()))}")
json.dump(rows, open(D.replace('analytics-mvp/data-ym/', '') + 'knowledge/episodes/2026-10/ym-reklama-scripts/sku_rows.json', 'w'), ensure_ascii=False, indent=0) if 'analytics-mvp/data-ym' in D else None
