#!/usr/bin/env python3
"""История действий в кабинете Маркета, восстановленная по статистике (сотрудник ушёл, записей нет), и закономерности скидки Маркета.
Запуск: python3 -I istoriya.py [DATA_DIR] > istoriya-output.md. Только чтение.

СПЕКА (подпись автора, 16.10.2026):
- Заказ = строка orders.ndjson без service; период = месяц/неделя СОЗДАНИЯ заказа. Доставлено = DELIVERED.
- Ставка кабинета читается по списаниям буста (реестр, услуга «Буст продаж, оплата за продажи», Списание+Удержание) по доставленным
  заказам: буст / (цена x шт). Повторы точных значений = ставка кабинета [ГИПОТЕЗА по механике, ДАННЫЕ по списаниям, mehanika 2].
- «Буст включён» для SKU в месяце = доля доставленных с бустом >= 50%; «выключен» = доставленные есть, с бустом 0.
- Инструменты по месяцам: отчёт по баллам bonuses_monthly (Списание по услуге) + реестр (Удержание = деньги) по кабинету.
- Скидка Маркета = p_mp / цена карточки по доставленным заказам (баллы покупателю за счёт Маркета; продавцу возвращаются баллами).
  Плюс/Спасибо (p_cashback, p_spasibo) отдельно. Размещение = реестр «Размещение товарных предложений» по заказу / цена.
- Цена карточки и цена для покупателя - медианы по доставленным заказам месяца. basicPrice/price из каталога - только текущие (16.10).
- Корреляции внутри SKU: отклонения от среднего по SKU, чтобы не ловить различие между товарами.
"""
import json, sys, collections, statistics, datetime
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f, encoding='utf-8')]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); b = rd('bonuses_monthly.ndjson'); svc = rd('services_monthly.ndjson')
cat = json.load(open(D + 'catalog.json', encoding='utf-8'))['items']
BOOST = 'Буст продаж, оплата за продажи'; PLACE = 'Размещение товарных предложений'; CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
MO = ('2026-07', '2026-08', '2026-09', '2026-10')
p = [r for r in o if not r['service']]; dl = [r for r in p if r['status'] == 'DELIVERED' and r['price']]
bo = collections.defaultdict(float); pl = collections.defaultdict(float)
for r in n:
    k = (r['order'], r['sku'])
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'): bo[k] += abs(r['amount'])
    if r['service'] == PLACE and r['type'] in ('Списание', 'Удержание'): pl[k] += abs(r['amount'])
K = lambda r: (r['order'], r['sku']); rate = lambda r: bo[K(r)] / (r['price'] * r['count'])
f0 = lambda x: f"{x:,.0f}".replace(',', ' '); pct = lambda a, b: f"{a / b:.1%}" if b else 'н/д'; md = statistics.median
wk = lambda s: (datetime.date.fromisoformat(s) - datetime.timedelta(days=datetime.date.fromisoformat(s).weekday())).isoformat()
short = lambda s: s[5:].replace('-', '.')

print("# Что делали в кабинете Маркета: история по статистике, и как устроена скидка Маркета (данные по 15.10.2026)\n")
print("Записей сотрудника нет, поэтому история восстановлена по следам в данных: списания буста показывают ставку по товару и дате, "
      "отчёт по баллам и реестр - какие инструменты работали в какой месяц, заказы - цены и скидки. Что по данным не видно: кто и когда нажимал кнопки, "
      "настройки без следа в деньгах (ставка на товар без продаж, стратегия, акции без заказов). Это снимает только кабинет (П10).\n")

# 1. Инструменты по месяцам
print("## 1. Какие инструменты работали, по месяцам (баллы по отчёту баллов + деньги по реестру)")
tools = collections.defaultdict(float); money = collections.defaultdict(float)
for r in b:
    if r['type'] == 'Списание' and r['ym'] >= '2026-05': tools[(r['ym'], r['business'], r['service'])] += abs(r['amount'])
for r in n:
    if r['type'] == 'Удержание' and r['d'][:7] >= '2026-05' and r['service'] in (BOOST, PLACE, 'Буст продаж, оплата за показы', 'Полки'): money[(r['d'][:7], r['business'], r['service'])] += abs(r['amount'])
names = {BOOST: 'буст', 'Буст продаж, оплата за показы': 'показы', 'Полки': 'полки', PLACE: 'размещение (комиссия)'}
print("месяц | кабинет | " + ' | '.join(f"{v} баллами" for v in names.values()) + " | буст деньгами | заказов доставлено | из них с бустом")
for m in ('2026-05', '2026-06') + MO:
    for c in CAB:
        g = [r for r in dl if r['business'] == c and r['created'][:7] == m]
        print(f"{m} | {CAB[c]} | " + ' | '.join(f0(tools.get((m, c, s), 0)) for s in names) + f" | {f0(money.get((m, c, BOOST), 0))} | {len(g)} | {pct(sum(1 for r in g if bo.get(K(r))), len(g))}")
other = collections.Counter()
for r in b:
    if r['type'] == 'Списание' and r['service'] not in names: other[r['service']] += abs(r['amount'])
print("Прочие списания баллов за всё время:", {k: f0(v) for k, v in other.most_common(5)} or 'нет')

# 2. Ставка по SKU во времени
print("\n## 2. Ставка буста по товарам во времени (списанная ставка по доставленным, по неделям создания заказа; в скобках число заказов)")
top = collections.Counter()
for r in dl:
    if r['created'][:7] in MO and bo.get(K(r)): top[r['sku']] += bo[K(r)]
weeks = sorted({wk(r['created']) for r in dl if r['created'] >= '2026-07-01'})
print("Товар | " + ' | '.join(short(w) for w in weeks))
for sku, _ in top.most_common(14):
    cells = []
    for w in weeks:
        g = [r for r in dl if r['sku'] == sku and wk(r['created']) == w]
        rs = [rate(r) for r in g if bo.get(K(r))]
        if not g: cells.append('')
        elif not rs: cells.append(f"0 ({len(g)})")
        else: cells.append((f"{md(rs):.1%}" if max(rs) - min(rs) < 0.01 else f"{min(rs):.0%}-{max(rs):.0%}") + f" ({len(g)})")
    print(f"{sku} | " + ' | '.join(cells))
print("\nСмены ставки по товарам (значение ставки, округлённое до 0,1%, первая и последняя дата заказа с ней, заказов):")
for sku, _ in top.most_common(14):
    g = sorted([r for r in dl if r['sku'] == sku and bo.get(K(r)) and r['created'] >= '2026-07-01'], key=lambda r: r['created'])
    runs = []
    for r in g:
        v = round(rate(r) * 1000)
        if runs and runs[-1][0] == v: runs[-1][2] = r['created']; runs[-1][3] += 1
        else: runs.append([v, r['created'], r['created'], 1])
    print(f"- {sku}: " + ' -> '.join(f"{v / 10:.1f}% ({short(a)}{'-' + short(z) if z != a else ''}, {c})" for v, a, z, c in runs))
offs = collections.defaultdict(list)
for sku in {r['sku'] for r in dl}:
    for m in MO:
        g = [r for r in dl if r['sku'] == sku and r['created'][:7] == m]
        if len(g) >= 2 and not any(bo.get(K(r)) for r in g): offs[m].append((sku, len(g)))
print("\nТовары с 2+ доставками в месяце и без буста вообще (буст выключен или не включался):", {m: v for m, v in offs.items()} or 'нет')

# 3. Цены по месяцам у топ-товаров
print("\n## 3. Цена карточки и цена для покупателя по месяцам (медианы по доставленным), топ-10 по бусту")
print("Товар | " + ' | '.join(f"{m}: карточка / покупатель / скидка Маркета" for m in MO) + " | каталог 16.10: до скидки продавца -> цена")
for sku, _ in top.most_common(10):
    cells = []
    for m in MO:
        g = [r for r in dl if r['sku'] == sku and r['created'][:7] == m]
        cells.append(f"{f0(md([r['price'] for r in g]))} / {f0(md([r['p_buyer'] for r in g]))} / {md([r['p_mp'] / r['price'] for r in g]):.0%}" if g else '-')
    c = cat.get(sku, {})
    print(f"{sku} | " + ' | '.join(cells) + f" | {f0(c['basicPrice']) if c.get('basicPrice') else 'н/д'} -> {f0(c['price']) if c.get('price') else 'н/д'}")

# 4. Скидка Маркета: закономерности
print("\n## 4. Скидка Маркета: от чего зависит")
print("Скидка Маркета - это баллы покупателю за счёт Маркета. Продавцу Маркет возвращает ту же сумму баллами, и этими баллами списывает размещение (комиссию) и буст. "
      "Поэтому для продавца деньгами остаётся примерно то, что заплатил покупатель, а скидка и комиссия гасят друг друга баллами.\n")
print("### 4.1 По месяцам и кабинетам (доставленные заказы): медиана скидки Маркета, Плюс/Спасибо, размещение (комиссия) в % от цены карточки")
print("месяц | кабинет | заказов | скидка Маркета, медиана | мин-макс (10-90 перцентиль) | заказов без скидки | Плюс+Спасибо, медиана | размещение / цена, медиана | скидка минус размещение, медиана")
for m in ('2026-05', '2026-06') + MO:
    for c in CAB:
        g = [r for r in dl if r['business'] == c and r['created'][:7] == m]
        if not g: continue
        d = sorted(r['p_mp'] / r['price'] for r in g); q = statistics.quantiles(d, n=10) if len(d) >= 10 else [d[0], d[-1]]
        plr = [pl[K(r)] / (r['price'] * r['count']) for r in g if pl.get(K(r))]
        diff = [r['p_mp'] / r['price'] - pl[K(r)] / (r['price'] * r['count']) for r in g if pl.get(K(r))]
        print(f"{m} | {CAB[c]} | {len(g)} | {md(d):.1%} | {q[0]:.0%}-{q[-1]:.0%} | {sum(1 for x in d if x == 0)} | {md([(r['p_cashback'] + r['p_spasibo']) / r['price'] for r in g]):.1%} | {md(plr):.1%} | {md(diff):+.1%}" if plr else f"{m} | {CAB[c]} | {len(g)} | {md(d):.1%} | {q[0]:.0%}-{q[-1]:.0%} | {sum(1 for x in d if x == 0)} | н/д | н/д | н/д")

print("\n### 4.2 По цене карточки (все доставленные июль-октябрь): скидка Маркета растёт с ценой?")
bands = [(0, 20000), (20000, 40000), (40000, 60000), (60000, 90000), (90000, 10 ** 9)]
print("цена карточки | заказов | скидка Маркета, медиана | 10-90 перцентиль | размещение / цена, медиана")
for lo, hi in bands:
    g = [r for r in dl if r['created'][:7] in MO and lo <= r['price'] < hi]
    if len(g) < 5: continue
    d = sorted(r['p_mp'] / r['price'] for r in g); q = statistics.quantiles(d, n=10) if len(d) >= 10 else [d[0], d[-1]]
    plr = [pl[K(r)] / (r['price'] * r['count']) for r in g if pl.get(K(r))]
    print(f"{f0(lo)}-{f0(hi) if hi < 10 ** 9 else '...'} | {len(g)} | {md(d):.1%} | {q[0]:.0%}-{q[-1]:.0%} | {md(plr):.1%}")

print("\n### 4.3 Внутри одного товара: связь скидки Маркета со ставкой буста и с ценой карточки (отклонения от среднего по SKU, SKU с 5+ доставками июль-октябрь)")
by = collections.defaultdict(list)
for r in dl:
    if r['created'][:7] in MO: by[r['sku']].append(r)
xr, yd, xp = [], [], []
for s, g in by.items():
    if len(g) < 5: continue
    mr = statistics.mean(rate(r) if bo.get(K(r)) else 0 for r in g); mdd = statistics.mean(r['p_mp'] / r['price'] for r in g); mp = statistics.mean(r['price'] for r in g)
    for r in g: xr.append((rate(r) if bo.get(K(r)) else 0) - mr); yd.append(r['p_mp'] / r['price'] - mdd); xp.append(r['price'] / mp - 1)
print(f"заказов {len(xr)} в {sum(1 for g in by.values() if len(g) >= 5)} товарах; корреляция «ставка выше среднего -> скидка Маркета выше среднего»: {statistics.correlation(xr, yd):.2f}; "
      f"«цена карточки выше среднего -> скидка Маркета выше»: {statistics.correlation(xp, yd):.2f} (0 = связи нет, 1 = полная)")
print("\n### 4.4 Скидка Маркета по месяцам внутри одного товара (медиана, %), топ-10 по бусту: стабильна или плавает")
print("Товар | " + ' | '.join(MO) + " | размах")
for sku, _ in top.most_common(10):
    vals = []
    for m in MO:
        g = [r for r in dl if r['sku'] == sku and r['created'][:7] == m]
        vals.append(md([r['p_mp'] / r['price'] for r in g]) if g else None)
    vv = [v for v in vals if v is not None]
    print(f"{sku} | " + ' | '.join(f"{v:.0%}" if v is not None else '-' for v in vals) + f" | {max(vv) - min(vv):.0%}" if len(vv) > 1 else f"{sku} | " + ' | '.join(f"{v:.0%}" if v is not None else '-' for v in vals) + " | -")
print("\n### 4.5 Пример одного заказа, как это выглядит в деньгах и баллах (5-1, заказ 62710061827 от 05.10)")
r = next(x for x in dl if x['order'] == '62710061827' and x['sku'] == 'GGT-35-5-1-100-180')
print(f"цена карточки {f0(r['price'])}; покупатель заплатил деньгами {f0(r['p_buyer'])} ({pct(r['p_buyer'], r['price'])}); скидка Маркета {f0(r['p_mp'])} ({pct(r['p_mp'], r['price'])}) пришла продавцу баллами; "
      f"баллами списано: размещение {f0(pl[K(r)])} ({pct(pl[K(r)], r['price'])}), буст {f0(bo[K(r)] - 183.66)}; деньгами удержано: буст 184, перевод платежа 2 709 + 126. "
      f"Итого деньгами продавцу около {f0(r['p_buyer'] - 184 - 2709 - 126)} при себестоимости 16 933.")
print("\nИсточники: analytics-mvp/data-ym/{orders,netting,bonuses_monthly,services_monthly}.ndjson, catalog.json (снимок 16.10, данные по 15.10). Все цифры [ДАННЫЕ]; чтение ставки кабинета по списаниям [ГИПОТЕЗА].")
