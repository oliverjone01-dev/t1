#!/usr/bin/env python3
"""Сверка поступлений от Яндекс Маркета (реестр банковских документов 1С) с вкладкой «Отчет» дашборда Маркета, блок 7 «Движение денег».

Запуск: python3 -I sverka.py <корень репо> <папка с xlsx банка> <выход.xlsx>
Спека:
  Банк      = «Поступление на расчетный счет» от ЯНДЕКС МАРКЕТ ООО, по дате поступления; договор 54641824/26 = кабинет зеркал 1023124,
              54542918/26 = кабинет мебели 74986385 (по сопоставлению платёжек, 59 из 59).
  Дашборд   = «Перевёл на счёт» блока 7: проводки реестра взаиморасчётов, у которых есть номер платёжного поручения Маркета (po),
              по МЕСЯЦУ ПРОВОДКИ и кабинету (REPY.flow[7] со страницы katya-report.html; здесь пересчитано из netting.ndjson тем же правилом
              и сверено со страницей до копейки). «В пути» = проводки без п/п (REPY.flow[8]).
  Мост      = платёжка Маркета: сумма проводок с одним номером п/п равна одному поступлению в банке.
  Разница по месяцу = поступления по дате банка минус «Перевёл» по месяцу проводки = перенос между месяцами + платёжки без поступления в выписке.
  Статьи    = по проводкам внутри платёжки: платёж покупателя, возврат платежа, удержания по услугам (размещение, перевод и приём платежа,
              доставка Маркета, буст, штрафы и прочее), возвраты услуг, премия, внесено продавцом, компенсации, удержания без заказа.
Все цифры [ДАННЫЕ]. Баллы (проводки «Справочно…») и отменённые («Не будет…») в деньги не входят, как на дашборде.
"""
import json, sys, re, glob, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
root, bdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
CONTRACT = {'54641824/26': '1023124', '54542918/26': '74986385'}
net = [json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/netting.ndjson', encoding='utf-8') if l.strip()]
html = open(f'{root}/analytics-mvp/public/market/katya-report.html', encoding='utf-8').read()
i = html.index('"flow":'); flow = json.loads(html[i + 7:html.index(']],', i) + 2])
k = html.index('"flowMeta":'); meta = json.loads(html[k + 11:html.index('}', html.index('"frozenBefore"', k)) + 1])
ACC_TO = meta['at']

def cancelled(r): return bool(re.match(r'^не будет', str(r.get('status') or '').strip(), re.I))
def group(r):
    t, src, svc = r['type'], r['src'], (r['service'] or '').lower()
    if t == 'Начисление' and src == 'Платёж покупателя': return 'Платёж покупателя'
    if t == 'Возврат': return 'Возврат платежа покупателю'
    if src == 'Премия': return 'Премия Маркета'
    if src == 'Внесено продавцом': return 'Внесено продавцом'
    if t == 'Начисление' and src == 'Оплата услуг Маркета': return 'Возврат услуг Маркета'
    if t == 'Начисление': return 'Компенсации (утеря, порча)'
    if not r['order']: return 'Удержания без заказа (кампании, подписка)'
    if svc.startswith('размещение'): return 'Размещение (комиссия)'
    if 'платеж' in svc or 'платёж' in svc: return 'Перевод и приём платежа'
    if 'доставка' in svc or 'миля' in svc: return 'Доставка Маркета'
    if svc.startswith('буст'): return 'Буст'
    return 'Штрафы и прочие услуги'
GROUPS = ['Платёж покупателя', 'Возврат платежа покупателю', 'Размещение (комиссия)', 'Перевод и приём платежа', 'Доставка Маркета', 'Буст',
          'Штрафы и прочие услуги', 'Возврат услуг Маркета', 'Компенсации (утеря, порча)', 'Премия Маркета', 'Внесено продавцом', 'Удержания без заказа (кампании, подписка)']

# проводки деньгами, как в блоке 7
money = []
for r in net:
    if r['d'] > ACC_TO or cancelled(r): continue
    st = str(r.get('status') or '').strip()
    if not st or st.lower().startswith('справочно'): continue
    money.append(r)
po_sum = collections.defaultdict(float); po_rows = collections.defaultdict(list)
for r in money:
    if (r.get('po') or '').strip(): po_sum[r['po']] += r['amount']; po_rows[r['po']].append(r)
# проверка: мой «Перевёл» и «В пути» по дням = REPY.flow
mine = collections.defaultdict(lambda: [0.0, 0.0])
for r in money: mine[(r['d'], r['business'])][0 if (r.get('po') or '').strip() else 1] += r['amount']
bad = [(f[0], f[1], f[7], round(mine[(f[0], f[1])][0], 2)) for f in flow if abs(mine[(f[0], f[1])][0] - f[7]) > 0.011 or abs(mine[(f[0], f[1])][1] - f[8]) > 0.011]
assert not bad, f'пересчёт «Перевёл»/«В пути» не равен странице: {bad[:5]}'

# банк
bank = []
for f in sorted(glob.glob(f'{bdir}/*.xlsx')):
    v = pd.read_excel(f, header=None).iloc[6:]
    for _, w in v.iterrows():
        if isinstance(w[1], str) and re.match(r'\d\d\.\d\d\.\d{4}', w[1]):
            m = re.search(r'договору (\S+?)\.', str(w[7])); c = m.group(1) if m else ''
            d = w[1][6:] + '-' + w[1][3:5] + '-' + w[1][:2]
            bank.append(dict(date=d, ym=d[:7], num=str(w[3]), innum=str(w[5]), amount=round(float(w[6]), 2), contract=c, business=CONTRACT.get(c, '?')))
used = set()
for b in bank:
    cand = [p for p, s in po_sum.items() if abs(s - b['amount']) < 0.011 and p not in used and po_rows[p][0]['business'] == b['business']]
    b['po'] = cand[0] if cand else None
    if cand: used.add(cand[0])
unpaid = [p for p in po_sum if p not in used]
assert all(b['po'] for b in bank), 'есть поступления без платёжки Маркета: ' + str([b for b in bank if not b['po']])

def by_month(rows):
    m = collections.defaultdict(float)
    for r in rows: m[r['d'][:7]] += r['amount']
    return m
def by_group(rows):
    g = collections.defaultdict(float)
    for r in rows: g[group(r)] += r['amount']
    return g
months = sorted(set([r['d'][:7] for r in money] + [b['ym'] for b in bank]))
r2 = lambda x: round(x + 0.0, 2)

wb = Workbook(); bold = Font(bold=True); hdr = PatternFill('solid', fgColor='DDE7F0'); grey = PatternFill('solid', fgColor='EEEEEE'); red = Font(color='B42318', bold=True)
def sheet(title, header, rows, widths=None, note=None):
    ws = wb.create_sheet(title); r0 = 1
    if note:
        ws.cell(1, 1, note).alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(header)); ws.row_dimensions[1].height = 15 * (note.count('\n') + 2); r0 = 3
    for j, h in enumerate(header, 1): c = ws.cell(r0, j, h); c.font = bold; c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='top')
    for i, row in enumerate(rows, r0 + 1):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v)
            if isinstance(v, (int, float)) and not isinstance(v, bool): c.number_format = '#,##0.00;[Red]-#,##0.00'
    for j in range(1, len(header) + 1): ws.column_dimensions[get_column_letter(j)].width = (widths[j - 1] if widths and j - 1 < len(widths) else 14)
    ws.freeze_panes = ws.cell(r0 + 1, 2); return ws

# Лист 1: итог по месяцам и кабинетам
rows1 = []
for b_id, cab in CAB.items():
    for m in months:
        dash = sum(po_sum_r for p, rs in po_rows.items() if rs[0]['business'] == b_id for po_sum_r in [sum(r['amount'] for r in rs if r['d'][:7] == m)])
        bank_m = sum(b['amount'] for b in bank if b['business'] == b_id and b['ym'] == m)
        out_other = 0.0; in_other = 0.0; unp = 0.0
        for b in bank:
            if b['business'] != b_id: continue
            bm = by_month(po_rows[b['po']])
            if b['ym'] == m: in_other += sum(v for mm, v in bm.items() if mm != m)
            else: out_other -= bm.get(m, 0.0)
        for p in unpaid:
            if po_rows[p][0]['business'] == b_id: unp -= by_month(po_rows[p]).get(m, 0.0)
        transit = sum(r['amount'] for r in money if r['business'] == b_id and r['d'][:7] == m and not (r.get('po') or '').strip())
        if not (dash or bank_m or transit): continue
        diff = bank_m - dash
        rows1.append([cab, m, r2(bank_m), r2(dash), r2(diff), r2(in_other), r2(out_other), r2(unp), r2(diff - in_other - out_other - unp), r2(transit)])
    rows1.append([cab, 'ИТОГО', r2(sum(x[2] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[3] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[4] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')),
                  r2(sum(x[5] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[6] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[7] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[8] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО')), r2(sum(x[9] for x in rows1 if x[0] == cab and x[1] != 'ИТОГО'))])
ws = sheet('Итог по месяцам', ['кабинет', 'месяц', 'Банк: поступило (по дате поступления)', 'Дашборд: «Перевёл на счёт» (по месяцу проводки)', 'Разница = банк - дашборд',
    'из неё: проводки ДРУГИХ месяцев, оплаченные в этом месяце (+)', 'из неё: проводки ЭТОГО месяца, оплаченные в других месяцах (-)', 'из неё: платёжки Маркета, которых нет в выписке (-)', 'необъяснённый остаток', 'справочно: «В пути» на дашборде (проводки без платёжки)'],
    rows1, [12, 10, 18, 20, 16, 24, 24, 24, 14, 22],
    'Сверка поступлений от Яндекс Маркета (реестр банковских документов 1С, 20.02-12.10.2026, 59 платежей) с блоком 7 «Движение денег» вкладки «Отчет» (снимок реестра взаиморасчётов на ' + ACC_TO + ').\n'
    'Каждое поступление в банке равно сумме проводок одной платёжки Маркета до копейки (59 из 59). Разница по месяцу - только из-за того, что дашборд считает по месяцу ПРОВОДКИ, а банк - по дате ПОСТУПЛЕНИЯ, плюс платёжки, которых в выписке нет (см. лист «Нет в выписке»).')
for row in ws.iter_rows(min_row=4):
    if row[1].value == 'ИТОГО':
        for c in row: c.font = bold; c.fill = grey
    if isinstance(row[8].value, (int, float)) and abs(row[8].value) > 0.011: row[8].font = red
wb.remove(wb['Sheet'])

# Лист 2: по платёжкам
rows2 = []
for b in sorted(bank, key=lambda b: (b['business'], b['date'])):
    rs = po_rows[b['po']]; bm = by_month(rs); g = by_group(rs)
    rows2.append([CAB[b['business']], b['date'], b['num'], b['innum'], b['contract'], b['amount'], b['po'], r2(po_sum[b['po']]), r2(b['amount'] - po_sum[b['po']]), min(r['d'] for r in rs), max(r['d'] for r in rs),
                  '; '.join(f'{m}: {v:,.2f}'.replace(',', ' ') for m, v in sorted(bm.items())), len(rs)] + [r2(g.get(x, 0.0)) for x in GROUPS])
sheet('По платёжкам', ['кабинет', 'дата поступления', '№ документа', '№ вх. (банк)', 'договор', 'сумма в банке', '№ платёжки Маркета', 'сумма проводок платёжки', 'разница', 'проводки с', 'проводки по', 'проводки по месяцам', 'проводок'] + GROUPS,
      rows2, [10, 12, 10, 12, 13, 14, 12, 14, 10, 11, 11, 40, 9] + [16] * len(GROUPS),
      'Каждое поступление в банке и состав платёжки Маркета по статьям. «№ вх. (банк)» у 40 из 59 платежей совпадает с номером платёжки Маркета, у остальных сопоставление по сумме и кабинету. Сумма статей = сумма проводок = сумма в банке.')

# Лист 3: нет в выписке
rows3 = []
for p in sorted(unpaid, key=lambda p: min(r['d'] for r in po_rows[p])):
    rs = po_rows[p]; g = by_group(rs)
    rows3.append([CAB[rs[0]['business']], p, r2(po_sum[p]), min(r['d'] for r in rs), max(r['d'] for r in rs), '; '.join(f'{m}: {v:,.2f}'.replace(',', ' ') for m, v in sorted(by_month(rs).items())), len(rs),
                  collections.Counter(str(r.get('status') or '') for r in rs).most_common(1)[0][0]] + [r2(g.get(x, 0.0)) for x in GROUPS])
sheet('Нет в выписке', ['кабинет', '№ платёжки Маркета', 'сумма проводок', 'проводки с', 'проводки по', 'по месяцам', 'проводок', 'статус проводок'] + GROUPS, rows3, [10, 12, 14, 11, 11, 40, 9, 30] + [16] * len(GROUPS),
      'Платёжки Маркета (проводки с номером п/п), для которых в реестре банка нет поступления. Первое поступление в реестре 20.02, хотя реестр за январь-октябрь: четыре платёжки за проводки января - начала февраля (около 2,1 млн ₽) должны были прийти в конце января - феврале. Три небольшие платёжки: 477353 (мебель, премия + компенсация за утерю, статус «Переведён»), 478322 (зеркала, премия, «Переведён»), 537805 (зеркала, взнос продавца, удержан целиком). Проверить в банке: другой счёт, другой плательщик или зачёт. Проводки декабря без статуса платежа (старая схема реестра) здесь и на дашборде не считаются.')

# Лист 4: статьи по месяцам (Перевёл и В пути), как в блоке 7
rows4 = []
for b_id, cab in CAB.items():
    for m in months:
        for lbl, cond in (('Перевёл (есть платёжка)', lambda r: bool((r.get('po') or '').strip())), ('В пути (без платёжки)', lambda r: not (r.get('po') or '').strip())):
            rs = [r for r in money if r['business'] == b_id and r['d'][:7] == m and cond(r)]
            if not rs: continue
            g = by_group(rs); rows4.append([cab, m, lbl, r2(sum(r['amount'] for r in rs))] + [r2(g.get(x, 0.0)) for x in GROUPS])
sheet('Статьи по месяцам', ['кабинет', 'месяц проводки', 'строка дашборда', 'итого'] + GROUPS, rows4, [10, 12, 22, 14] + [16] * len(GROUPS),
      'Те же проводки, что в блоке 7 «Движение денег», по статьям. «Перевёл» = проводки с платёжкой (по месяцу проводки, как на дашборде), «В пути» = без платёжки. Итого строки «Перевёл» равно столбцу «Дашборд» на листе «Итог по месяцам». Удержания со знаком минус, как в реестре.')

# Лист 5: перенос между месяцами (матрица)
rows5 = []
for b_id, cab in CAB.items():
    mat = collections.defaultdict(float)
    for b in bank:
        if b['business'] != b_id: continue
        for m, v in by_month(po_rows[b['po']]).items(): mat[(m, b['ym'])] += v
    for p in unpaid:
        if po_rows[p][0]['business'] == b_id:
            for m, v in by_month(po_rows[p]).items(): mat[(m, 'нет в выписке')] += v
    cols = sorted(set(c for _, c in mat))
    rows5.append([cab, 'месяц проводки \\ месяц поступления'] + cols + ['итого = дашборд «Перевёл»'])
    for m in months:
        vals = [r2(mat.get((m, c), 0.0)) for c in cols]
        if any(vals): rows5.append([cab, m] + vals + [r2(sum(vals))])
    rows5.append([cab, 'итого = банк'] + [r2(sum(mat.get((m, c), 0.0) for m in months)) for c in cols] + [r2(sum(mat.values()))]); rows5.append([])
sheet('Перенос по месяцам', ['кабинет', 'месяц проводки'], rows5, [10, 30] + [14] * 14, 'Сколько денег из проводок каждого месяца (строки) пришло в банк в каждом месяце (столбцы). Строка «итого» = банк, столбец «итого» = дашборд «Перевёл».')

# Лист 6: как читать
ws = wb.create_sheet('Как читать', 0)
txt = ['Сверка поступлений от Яндекс Маркета с вкладкой «Отчет» дашборда (блок 7 «Движение денег»).',
       '',
       'Источники: реестр банковских документов 1С за январь-октябрь 2026 (два договора: 54641824/26 - зеркала, 54542918/26 - мебель), 59 поступлений на ' + f"{sum(b['amount'] for b in bank):,.2f}".replace(',', ' ') + ' ₽;',
       'реестр взаиморасчётов Маркета (API, снимок ' + ACC_TO + ', проводки по 15.10) - те же данные, что на вкладке «Отчет».',
       '',
       'Главный результат: каждое поступление в банке равно сумме проводок одной платёжки Маркета до копейки (59 из 59). Расхождений в деньгах нет.',
       'Разница по месяцам на листе «Итог по месяцам» объясняется двумя вещами:',
       '  1. Дашборд показывает «Перевёл на счёт» по месяцу ПРОВОДКИ (когда Маркет провёл платёж или удержание), а банк - по дате ПОСТУПЛЕНИЯ. Платёжка собирает проводки за 1-5 недель и приходит через 1-3 недели после них.',
       '  2. Платёжки, которых нет в выписке (лист «Нет в выписке»): ' + str(sum(1 for p in unpaid if min(r['d'] for r in po_rows[p]) < '2026-02-01')) + ' платёжки за проводки января - начала февраля на ' + f"{sum(po_sum[p] for p in unpaid if min(r['d'] for r in po_rows[p]) < '2026-02-01'):,.2f}".replace(',', ' ') + ' ₽ (в выписке нет поступлений раньше 20.02) и ' + str(sum(1 for p in unpaid if min(r['d'] for r in po_rows[p]) >= '2026-02-01')) + ' небольшие платёжки на '
       + f"{sum(po_sum[p] for p in unpaid if min(r['d'] for r in po_rows[p]) >= '2026-02-01'):,.2f}".replace(',', ' ') + ' ₽.',
       '',
       'Листы: «Итог по месяцам» - банк против дашборда по кабинетам и месяцам с разложением разницы; «По платёжкам» - каждое поступление и состав платёжки по статьям;',
       '«Нет в выписке» - платёжки Маркета без поступления; «Статьи по месяцам» - блок 7 по статьям («Перевёл» и «В пути»); «Перенос по месяцам» - матрица месяц проводки × месяц поступления.',
       '',
       'Статьи: удержания со знаком минус. «Перевод и приём платежа» - эквайринг Маркета. «Удержания без заказа» - кампании (полка, баннеры), подписка. «Возврат услуг Маркета» - начисления «Оплата услуг Маркета» (возврат удержанного).',
       'Баллы (проводки «Справочно: пополнен / списан с баланса») и проводки отменённых заказов («Не будет переведён / удержан») в деньги не входят - как на дашборде.',
       'Все цифры [ДАННЫЕ]. Проверка: пересчёт «Перевёл» и «В пути» по дням равен странице katya-report.html до копейки.']
for i, t in enumerate(txt, 1): ws.cell(i, 1, t).alignment = Alignment(wrap_text=False)
ws.column_dimensions['A'].width = 180
wb.save(out)
print('ok', out, 'банк', len(bank), 'платёжек без поступления', len(unpaid), 'необъяснённый остаток по месяцам:', max(abs(x[8]) for x in rows1 if x[1] != 'ИТОГО'))
for x in rows1: print(x)
