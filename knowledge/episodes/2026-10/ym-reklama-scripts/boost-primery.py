#!/usr/bin/env python3
"""Буст продаж Маркета на примерах SKU: ставка, расход, выручка, показы, корзина, заказы, конверсии, ДРР, CPO.
Запуск: python3 -I boost-primery.py [DATA_DIR] > boost-primery-output.md. Только чтение.

СПЕКА МЕТРИК (подпись автора, 16.10.2026):
- Заказ = строка orders.ndjson без service (строки «Доставка» того же заказа не считаются). Период = месяц СОЗДАНИЯ заказа.
- Создано = все такие строки; доставлено = status DELIVERED; отменено = status начинается с CANCELLED.
- Буст = реестр netting.ndjson, услуга «Буст продаж, оплата за продажи», тип Списание (баллы) + Удержание (деньги),
  привязка к заказу по (order, sku); относится к месяцу создания заказа. Деньгами = только Удержание.
- Списанная ставка = буст заказа / (цена карточки x шт) по доставленным заказам с бустом; показываем медиану и мин-макс.
- Цена карточки = price; покупатель заплатил деньгами = p_buyer; скидка Маркета = p_mp (возвращается продавцу баллами).
- Выручка = сумма revenue доставленных (цена карточки x шт). Деньги покупателей = сумма p_buyer доставленных.
- Себестоимость = sku_cogs.json x шт доставленных.
- Показы, в карточку, в корзину = sku_views.ndjson (отчёт показов Маркета), поля views / pdp / cart, сумма по всем строкам
  SKU за день (несколько магазинов). Есть с 31.08.2026: первая строка - агрегат 31.08-06.09, дальше по дням. До 31.08 = н/д.
- CR = в корзину / показы; корзина -> заказ = создано / в корзину (заказы наши, корзина из отчёта: разные источники, оценка).
- ДРР буста = буст / выручка доставленных. CPO = буст / доставлено. По октябрю данные по 15.10, месяц не закрыт.
- Сверка (две семьи источников): буст из реестра по кабинету за сентябрь против promo_monthly (отчёт Маркета «Буст», spend).
"""
import json, sys, collections, statistics, datetime
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f, encoding='utf-8')]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); sv = rd('sku_views.ndjson'); promo = rd('promo_monthly.ndjson')
cogs = json.load(open(D + 'sku_cogs.json', encoding='utf-8')); cat = json.load(open(D + 'catalog.json', encoding='utf-8'))['items']
BOOST = 'Буст продаж, оплата за продажи'; CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
MO = ('2026-07', '2026-08', '2026-09', '2026-10')
p = [r for r in o if not r['service']]
bo = collections.defaultdict(float); bom = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'):
        k = (r['order'], r['sku']); bo[k] += abs(r['amount'])
        if r['type'] == 'Удержание': bom[k] += abs(r['amount'])
f0 = lambda x: f"{x:,.0f}".replace(',', ' '); pct = lambda a, b: f"{a / b:.1%}" if b else 'н/д'
md = lambda xs: statistics.median(xs) if xs else None
views = collections.defaultdict(lambda: [0, 0, 0, 0])  # (sku, date) -> views, pdp, cart, units
for r in sv:
    v = views[(r['sku'], r['date'])]; v[0] += r['views']; v[1] += r['pdp']; v[2] += r['cart']; v[3] += r['units']
SV_FROM = '2026-08-31'

EX = [('GGT-35-5-1-100-180', 'KONUX 5-1: ставку меняли 8,8% -> 14% -> 13-19%, остаток 7'),
      ('GGT-35-1-3-100-180', 'KONUX 1-3: самый большой буст квартала'),
      ('GGT-35-3-3-100-180', 'KONUX 3-3: ставка около 9%, половина буста деньгами'),
      ('GGM-01-1', 'EVELUM GGM-01-1, зеркала: ставка 20%'),
      ('GGL-09-2', 'OSOLIS GGL-09-2, зеркала: много показов, половина заказов отменяется'),
      ('GGM-29-4', 'SYVONT GGM-29-4, зеркала: ставка 31% при марже минус 6,8%')]

def block(sku, rows, d1, d2, label):
    """Одна строка таблицы за окно [d1, d2] по дате создания заказа."""
    g = [r for r in rows if d1 <= r['created'] <= d2]
    dl = [r for r in g if r['status'] == 'DELIVERED']; cn = [r for r in g if r['status'].startswith('CANCELLED')]
    keys = [(r['order'], r['sku']) for r in dl]
    bsum = sum(bo.get(k, 0) for k in keys); bmon = sum(bom.get(k, 0) for k in keys)
    rates = [bo[k] / (r['price'] * r['count']) for k, r in zip(keys, dl) if bo.get(k) and r['price']]
    rev = sum(r['revenue'] for r in dl); buyer = sum(r['p_buyer'] for r in dl); mp = sum(r['p_mp'] for r in dl)
    cg = cogs.get(sku, 0) * sum(r['count'] for r in dl)
    if d2 >= SV_FROM:
        lo = max(d1, SV_FROM); vv = [views[(sku, d)] for (s, d) in views if s == sku and lo <= d <= d2]
        V = [sum(x[i] for x in vv) for i in range(4)]; vtxt = [f0(V[0]), f0(V[1]), f0(V[2]), pct(V[2], V[0]), pct(len(g), V[2]) if V[2] else 'н/д']
        if d1 < SV_FROM: vtxt[0] += '*'
    else: vtxt = ['н/д'] * 5
    rate_txt = f"{md(rates):.1%} ({min(rates):.1%}-{max(rates):.1%})" if rates else ('нет буста' if dl else '-')
    price = md([r['price'] for r in dl]) or md([r['price'] for r in g])
    return (f"{label} | {len(g)} | {len(dl)} | {len(cn)} | {sum(1 for k in keys if bo.get(k))} | {rate_txt} | {f0(bsum)} | {f0(bmon)} | "
            f"{f0(price) if price else '-'} | {f0(md([r['p_buyer'] for r in dl])) if dl else '-'} | {f0(rev)} | {f0(buyer)} | {f0(mp)} | {f0(cg)} | "
            f"{pct(bsum, rev)} | {f0(bsum / len(dl)) if dl else '-'} | " + ' | '.join(vtxt))

HDR = ("окно | создано | доставлено | отменено | с бустом | ставка списанная, медиана (мин-макс) | буст всего | из них деньгами | "
       "цена карточки, медиана | покупатель платит, медиана | выручка доставл. | деньги покупателей | скидка Маркета (баллы продавцу) | себестоимость | "
       "ДРР буста | CPO | показы | в карточку | в корзину | CR показы->корзина | корзина->заказ")
print("# Буст продаж на примерах: что платим и что получаем (данные по 15.10.2026)\n")
print("Как читать: «ставка списанная» - сколько Маркет списал за заказ в процентах от цены карточки; по ней видно ставку кабинета (повторы точных значений). "
      "Буст списывается только с доставленных заказов, с отменённых - нет. Баллы и деньги - два кошелька: скидку Маркета покупателю Маркет возвращает продавцу баллами, "
      "и ими же списывается буст; деньгами списывается, когда баллов на день не хватает. Показы и корзина - из отчёта показов Маркета, он есть только с 31.08 (звёздочка = окно обрезано по 31.08); "
      "заказы и буст - из выгрузки заказов и реестра. Октябрь не закрыт: буст по заказам последних дней ещё может быть не проведён.\n")
for sku, note in EX:
    rows = [r for r in p if r['sku'] == sku]; c = cat.get(sku, {})
    biz = rows[0]['business'] if rows else c.get('business', '?')
    print(f"## {sku} - {note}")
    print(f"{c.get('name', rows[0]['name'] if rows else '')[:90]}; кабинет {CAB.get(biz, biz)}; цена в каталоге 15.10 {f0(c['price']) if c.get('price') else 'н/д'}, остаток {c.get('stock', 'н/д')}, себестоимость за шт {f0(cogs.get(sku, 0))}\n")
    print(HDR); print('|'.join(['---'] * (HDR.count('|') + 1)))
    for m in MO:
        y, mm = int(m[:4]), int(m[5:]); last = (datetime.date(y + (mm == 12), mm % 12 + 1, 1) - datetime.timedelta(days=1)).isoformat()
        print(block(sku, rows, m + '-01', min(last, '2026-10-15'), m + (' (по 15.10)' if m == '2026-10' else '')))
    if sku == 'GGT-35-5-1-100-180':
        print("\nОкна по смене ставки (из списаний): до 13.09 буста на доставленных нет; 13-30.09 списания 8,8% (один заказ 16.09 на 14%); с 02.10 13-19%.\n")
        print(HDR); print('|'.join(['---'] * (HDR.count('|') + 1)))
        for d1, d2, lb in (('2026-08-31', '2026-09-12', '31.08-12.09 без буста'), ('2026-09-13', '2026-09-30', '13-30.09 ставка 8,8%'), ('2026-10-01', '2026-10-15', '01-15.10 ставка 13-19%')):
            print(block(sku, rows, d1, d2, lb))
        print("\nПо дням, октябрь (показы, в карточку, в корзину из отчёта показов; создано заказов и буст по доставленным - наши данные):")
        print("день | показы | в карточку | в корзину | создано | доставлено из созданных | буст по ним | ставки")
        for d in sorted({dd for (s, dd) in views if s == sku and dd >= '2026-10-01'}):
            v = views[(sku, d)]; g = [r for r in rows if r['created'] == d]; dl = [r for r in g if r['status'] == 'DELIVERED']
            ks = [(r['order'], r['sku']) for r in dl]
            print(f"{d[5:]} | {v[0]} | {v[1]} | {v[2]} | {len(g)} | {len(dl)} | {f0(sum(bo.get(k, 0) for k in ks))} | " + ', '.join(f"{bo[k] / (r['price'] * r['count']):.1%}" if bo.get(k) else '0' for k, r in zip(ks, dl)))
    print()

print("## Сверка: буст из реестра против отчёта Маркета «Буст» (две семьи источников), по месяцу проводки")
pm = {(r['ym'], r['business'], r['kind']): r for r in promo}
bym = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'): bym[(r['d'][:7], r['business'])] += abs(r['amount'])
print("месяц | кабинет | реестр (баллы+деньги) | отчёт Маркета spend | разница")
for m in ('2026-07', '2026-08', '2026-09', '2026-10'):
    for c in CAB:
        a = bym.get((m, c), 0); b = pm.get((m, c, 'boost'), {}).get('spend')
        print(f"{m} | {CAB[c]} | {f0(a)} | {f0(b) if b is not None else 'нет отчёта'} | {f0(a - b) if b is not None else '-'}")
print("\nИсточники: analytics-mvp/data-ym/{orders,netting,sku_views,promo_monthly}.ndjson, sku_cogs.json, catalog.json (снимок 16.10, данные по 15.10). Все цифры [ДАННЫЕ], кроме чтения ставки кабинета по списаниям [ГИПОТЕЗА, см. mehanika-output 2].")
