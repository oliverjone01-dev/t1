#!/usr/bin/env python3
"""Какая ставка буста нужна: по списаниям Маркета (второй аукцион) видно, что ставили конкуренты в выигранных аукционах.

Запуск: python3 -I stavka.py <корень репо>
Логика:
- Списанная ставка заказа = буст по заказу из реестра / (цена карточки x шт), доставленные заказы с бустом, созданные 16.09-15.10.
- Маркет списывает минимальную ставку, достаточную для победы: списание = уровень следующего конкурента + шаг. Значит
  список списаний по SKU = список ставок конкурентов в аукционах, которые мы выиграли. Проигранных аукционов в наших данных нет
  (их видно только по доле показов с бустом в кабинете).
- «Если бы ставка была X%»: сколько заказов из прошлых мы бы потеряли (списание > X) и сколько буста не потратили бы.
  Ставка ниже уровня конкурента не снижает списание по выигранным заказам, она только убирает дорогие аукционы.
- Сверка, две семьи: средняя списанная ставка по реестру против «Доля расходов на буст от выручки с бустом» из отчёта кабинета Маркета.
"""
import json, sys, collections, statistics as st, zipfile, re, io
root = sys.argv[1]; D = f'{root}/analytics-mvp/data-ym/'
D0, D1 = '2026-09-16', '2026-10-15'
rd = lambda f: [json.loads(l) for l in open(D + f, encoding='utf-8') if l.strip()]
n = rd('netting.ndjson'); o = rd('orders.ndjson'); cat = json.load(open(D + 'catalog.json'))['items']
BOOST = 'Буст продаж, оплата за продажи'
bo = collections.defaultdict(float)
for r in n:
    if r['service'] == BOOST and r['type'] in ('Списание', 'Удержание'): bo[(r['order'], r['sku'])] += abs(r['amount'])
dl = [r for r in o if not r['service'] and not r.get('fake') and r['status'] == 'DELIVERED' and D0 <= r['created'] <= D1]
rates = collections.defaultdict(list)
for r in dl:
    b = bo.get((r['order'], r['sku']))
    if b and r['price']: rates[r['sku']].append(100 * b / (r['price'] * r['count']))
assert all(0 < x <= 35 for xs in rates.values() for x in xs), 'списанная ставка вне 0-35%: проверить соответствие буста заказу'

# отчёт кабинета мебели (лист «Сводный отчет»): показы с бустом / все показы, доля расходов
cab = {}
try:
    import pandas as pd
    p = f'{root}/knowledge/episodes/2026-10/ym-reklama-scripts/kabinet-20261016/business_boost_consolidated_74986385_16-10-2026.xlsx'
    z = zipfile.ZipFile(p); buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zo:
        for nm in z.namelist():
            d = z.read(nm)
            if nm == 'xl/styles.xml': d = re.sub(rb'<family val="\d+"', b'<family val="2"', d)
            zo.writestr(nm, d)
    s = pd.read_excel(buf, sheet_name='Сводный отчет', header=3)
    for _, w in s.iterrows():
        if isinstance(w.iloc[0], str): cab[w.iloc[0]] = dict(vb=w.iloc[2], va=w.iloc[3], share=w.iloc[15], camp=w.iloc[20])
except Exception as e: print('кабинет не прочитан:', e, file=sys.stderr)

f1 = lambda x: f'{x:.1f}'
print(f'## Ставка буста по статистике списаний, доставленные заказы с бустом, созданы {D0}..{D1}')
print('Списание = уровень конкурента + шаг в выигранном аукционе. Проигранные аукционы в данных не видны. Все цифры [ДАННЫЕ], расчётная ставка [РАСЧЁТ].\n')
print('SKU | кампания (кабинет) | заказов с бустом | списано: медиана | 75-й перцентиль | максимум (потолок) | заказов на потолке | кабинет: доля расходов | кабинет: показы с бустом / все | ставка 10%: потеряли бы заказов / сэкономили ₽ | 12% | 15% | расчётная ставка')
print('|'.join(['---'] * 13))
LV = (10, 12, 15)
for sku in sorted(rates, key=lambda s: -sum(bo.get((r['order'], r['sku']), 0) for r in dl if r['sku'] == s)):
    xs = sorted(rates[sku]); k = len(xs)
    if k < 3: continue
    med = st.median(xs); p75 = xs[min(k - 1, int(round(0.75 * (k - 1))))]; mx = xs[-1]
    at_cap = sum(1 for x in xs if x >= mx - 0.3)
    spend = [bo[(r['order'], r['sku'])] for r in dl if r['sku'] == sku and bo.get((r['order'], r['sku']))]
    sim = []
    for L in LV:
        lost = sum(1 for x in xs if x > L); saved = sum(sp for x, sp in zip(rates[sku], spend) if x > L)
        sim.append(f'{lost} из {k} / {saved:,.0f}'.replace(',', ' '))
    rec = min(mx, (int(p75 * 2 + 0.999) / 2) + 1)   # 75-й перцентиль вверх до 0,5 плюс 1 п.п., не выше потолка
    c = cab.get(sku, {})
    cab_txt = (f"{c['share']:.1f}%" if c else 'н/д (зеркала)', f"{c['vb']:,.0f} / {c['va']:,.0f} = {100*c['vb']/c['va']:.0f}%".replace(',', ' ') if c and c['va'] else 'н/д')
    print(f"{sku} | {c.get('camp', 'зеркала')} | {k} | {f1(med)}% | {f1(p75)}% | {f1(mx)}% | {at_cap} | {cab_txt[0]} | {cab_txt[1]} | {sim[0]} | {sim[1]} | {sim[2]} | {rec:.1f}%")
print('\nКак читать расчётную ставку: 75-й перцентиль списаний, округлённый вверх до 0,5, плюс 1 п.п. запаса, не выше нынешнего потолка. Она перекрывает три четверти уровней конкурентов, которые мы видели, и отдаёт самые дорогие аукционы. Проверка после смены: доля показов с бустом в кабинете не должна упасть ниже 80%, иначе конкуренты в проигранных аукционах выше, чем видно по выигранным.')
