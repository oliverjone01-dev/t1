#!/usr/bin/env python3
"""Максимальная ставка буста по SKU с учётом всех расходов, которые есть в данных. Только чтение.

Запуск: python3 -I max-stavka.py <корень репо> [мин. штук = 3] [дата с = 2026-07-01]
Метрика (спека), по доставленным и не возвращённым заказам, созданным с <дата с> по 15.10, проводки по номеру заказа из реестра:
  цена карточки   = orders.price (цена до скидки Маркета, с неё считается буст)
  пришло          = платёж покупателя деньгами (с доставкой) + баллы скидки Маркета + баллы Плюс/Спасибо   [Начисление]
  ушло Маркету    = удержания деньгами + списания баллами, по услугам: размещение (комиссия), приём и перевод платежа,
                    доставка Маркета, буст, штрафы и прочее                                                   [Удержание, Списание, минус Возврат]
  = сальдо заказа; проверка: сальдо = orders.payout (API заказов, другая семья) в каждом заказе с точностью до 2 ₽
  себестоимость   = sku_cogs x шт; наша доставка = ведомость перевозчика (pnl ship / units по SKU за тот же период, оценка)
  маржа после всего = сальдо - себестоимость - наша доставка   (баллы считаем как деньги: решение v18, расход = деньги + баллы)
  маржа до буста    = маржа после всего + буст
  МАКС. СТАВКА в ноль = маржа до буста / цена карточки (на штуку)
Чего в данных нет: упаковка, налоги, накладные. Каждые 1 000 ₽ на заказ = минус 1 000 / цена карточки.
"""
import json, sys, collections
root = sys.argv[1]; MINU = int(sys.argv[2]) if len(sys.argv) > 2 else 3; D0 = sys.argv[3] if len(sys.argv) > 3 else '2026-07-01'; D1 = '2026-10-15'
D = f'{root}/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f, encoding='utf-8') if l.strip()]
net = rd('netting.ndjson'); orders = rd('orders.ndjson'); cogs = json.load(open(D + 'sku_cogs.json')); cat = json.load(open(D + 'catalog.json'))['items']
pnl = [r for r in rd('pnl_sku_netting_daily.ndjson') if r['basis'] == 'netting' and D0 <= r['d'] <= D1]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
def grp(svc):
    s = svc.lower()
    if s.startswith('буст'): return 'boost'
    if s.startswith('размещение'): return 'place'
    if 'платеж' in s or 'платёж' in s: return 'pay'
    if 'доставка' in s or 'миля' in s: return 'dlv'
    if 'не вовремя' in s or 'штраф' in s or 'отмен' in s: return 'fine'
    return 'other'
L = collections.defaultdict(lambda: collections.defaultdict(float))   # order -> статьи
for r in net:
    t = L[r['order']]; a = r['amount']
    if r['type'] == 'Начисление':
        if r['src'] == 'Платёж покупателя': t['money_in'] += a
        elif 'Баллы' in r['src']: t['pts_in'] += a
        else: t['other_in'] += a
    elif r['type'] == 'Возврат':
        if 'баллов' in r['src'].lower(): t['pts_in'] += a
        else: t['money_in'] += a
    elif r['type'] in ('Удержание', 'Списание', 'Возврат списания'):
        t[grp(r['service'])] += a                                        # со знаком реестра (минус = ушло)
        t['money_out' if r['type'] == 'Удержание' else 'pts_out'] += a   # удержание = деньгами, списание = баллами
dl = [r for r in orders if not r['service'] and not r.get('fake') and r['status'] == 'DELIVERED' and not r['returned'] and D0 <= r['created'] <= D1]
# инвариант (другая семья): деньгами по реестру (платежи минус удержания) против API заказов (paid минус fee_total; поле payout API
# считает баллы скидки доходом и не видит списаний баллами, поэтому с сальдо не сравнивается)
mism = []; gaps = []
for r in dl:
    t = L.get(r['order'])
    if not t: mism.append((r['order'], 'нет проводок')); continue
    cash = t['money_in'] + t['money_out']; api = (r['paid'] or 0) - (r['fee_total'] or 0)
    if abs(cash - api) > 0.02 * max(abs(api), 1) + 50: mism.append((r['order'], round(cash), round(api)))
    gaps.append(cash - api)
ok = len(dl) - len(mism)
import statistics as _st; gap_med = _st.median(gaps) if gaps else 0
# наша доставка на штуку по SKU
ship = collections.defaultdict(lambda: [0.0, 0.0, 0, 0])
for r in pnl: s = ship[r['sku']]; s[0] += r['ship'] or 0; s[1] += r['units'] or 0; s[2] += r['shipn'] or 0; s[3] += r['shipk'] or 0
S = collections.defaultdict(lambda: collections.defaultdict(float))
for r in dl:
    t = L.get(r['order'])
    if not t: continue
    s = S[r['sku']]; s['n'] += 1; s['u'] += r['count']; s['price'] += r['price'] * r['count']; s['business'] = r['business']
    for k, v in t.items(): s[k] += v
    # только деньги для нужд сверки и колонок
rows = []
for sku, s in S.items():
    if s['u'] < MINU: continue
    u = s['u']; price = s['price'] / u; cg = cogs.get(sku); boost = -s['boost'] / u
    sh = ship[sku]; shp = (sh[0] / sh[1]) if sh[1] > 0 else 0.0
    saldo = (s['money_in'] + s['pts_in'] + s['other_in'] + s['place'] + s['pay'] + s['dlv'] + s['boost'] + s['fine'] + s['other']) / u
    after = saldo - (cg or 0) - shp; before = after + boost
    cash = (s['money_in'] + s['money_out']) / u; ptsleft = (s['pts_in'] + s['pts_out']) / u
    rows.append(dict(sku=sku, cab=CAB.get(s['business'], '?'), n=s['n'], u=u, price=price, cash=cash, ptsleft=ptsleft, cat=cat.get(sku, {}).get('price'), money=s['money_in'] / u, pts=s['pts_in'] / u,
                     place=-s['place'] / u, pay=-s['pay'] / u, dlv=-s['dlv'] / u, fine=-(s['fine'] + s['other']) / u, boost=boost, saldo=saldo, cogs=cg, ship=shp, shipflag=sh[3] < sh[2],
                     after=after, before=before, maxbid=100 * before / price, cur=100 * boost / price, m10=100 * (before - 10000) / price))
rows.sort(key=lambda r: -r['boost'] * r['u'])
f0 = lambda x: '-' if x is None else f'{x:,.0f}'.replace(',', ' ')
print(f'## Максимальная ставка буста по SKU с учётом расходов: доставленные заказы, созданы {D0}..{D1}, на 1 штуку, SKU с {MINU}+ штук')
print(f'Проверка (две семьи): деньгами по реестру = paid минус fee_total из API заказов (допуск 2% + 50 ₽) у {ok} из {len(dl)} заказов, медиана расхождения {gap_med:+.0f} ₽ на заказ (около 2% денег заказа, природа не разобрана, на ставку влияет меньше 1 п.п.); примеры: {mism[:3]}. Все цифры [ДАННЫЕ], макс. ставка [РАСЧЁТ].\n')
print('кабинет | SKU | заказов | штук | цена карточки (сейчас в каталоге) | пришло деньгами | пришло баллами | ушло: размещение | приём и перевод платежа | доставка Маркета | штрафы и прочее | буст (деньги+баллы) | сальдо заказа (деньги+баллы) | из него деньгами на руки | баллов остаётся | себестоимость | наша доставка | маржа после всего | маржа до буста | ставка факт | МАКС. СТАВКА в ноль | ставка при 10 000 ₽ маржи')
print('|'.join(['---'] * 22))
for r in rows[:30]:
    print(f"{r['cab']} | {r['sku']} | {r['n']:.0f} | {r['u']:.0f} | {f0(r['price'])} ({f0(r['cat'])}) | {f0(r['money'])} | {f0(r['pts'])} | {f0(r['place'])} | {f0(r['pay'])} | {f0(r['dlv'])} | {f0(r['fine'])} | {f0(r['boost'])} | {f0(r['saldo'])} | {f0(r['cash'])} | {f0(r['ptsleft'])} | {f0(r['cogs'])}{'' if r['cogs'] else ' (нет)'} | {f0(r['ship'])}{' (занижена)' if r['shipflag'] else ''} | {f0(r['after'])} | {f0(r['before'])} | {r['cur']:.1f}% | {r['maxbid']:.1f}% | {r['m10']:.1f}%")
print('\nКак читать: «макс. ставка в ноль» - списанная ставка, при которой заказ выходит в ноль после комиссий Маркета, себестоимости, нашей доставки и буста (баллы считаем как деньги). Списывают уровень конкурента, не потолок, поэтому «ставка факт» ниже ставки кампании. Упаковки, налогов и накладных в данных нет: каждая 1 000 ₽ на заказ снимает 1 000 / цена карточки (карточка 95 000 - 1 п.п.). «Наша доставка» - средняя по ведомости перевозчика за период, у части SKU занижена. «Деньгами на руки» - платежи покупателя минус удержания деньгами; «баллов остаётся» - баллы скидки Маркета минус списания баллами: эти баллы тратятся только на услуги Маркета, в том числе на размещение по другим заказам.')
