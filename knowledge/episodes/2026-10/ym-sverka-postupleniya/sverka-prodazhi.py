#!/usr/bin/env python3
"""Сверка продаж по 1С (реестр «Отчёт комиссионера» и реализации «ФИЗИЧЕСКОЕ ЛИЦО <договор>») с данными дашборда Маркета.

Запуск: python3 -I sverka-prodazhi.py <корень репо> <папка с файлами 1С> <выход.xlsx>
Спека:
  1С «Отчёт комиссионера» = документ на кампанию (магазин) Маркета за месяц. Найдено подбором: сумма документа равна деньгам
      покупателей (p_buyer x шт, без доставки) по ДОСТАВЛЕННЫМ заказам кампании за месяц даты fin (сбор за продажу) из выгрузки
      заказов дашборда - 16 документов из 30 до рубля. Остальные отличаются на заказы, попавшие у Маркета в соседний месяц.
  Дашборд = orders.ndjson (та же выгрузка, что блоки «Отчёта» по заказам), p_buyer по доставленным, месяц fin; по июлю-сентябрю
      ещё и по строкам отчёта о реализации Маркета (realization_orders: месяц отчёта и номер заказа) - это месяц самого Маркета.
  1С «Реализация ФИЗИЧЕСКОЕ ЛИЦО <договор>» (УПД) = по договору (54641824/26 зеркала, 54542918/26 мебель) за месяц, плюс
      корректировки к документам прошлого месяца. Ни одна база дашборда (деньги по реестру, по заказам, отчёт о реализации)
      с этими суммами не совпала - лист «УПД» показывает все базы рядом, вопрос к 1С, из чего собран документ.
Все цифры [ДАННЫЕ].
"""
import json, sys, re, glob, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
root, bdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}; CONTRACT = {'54641824/26': 'зеркала', '54542918/26': 'мебель'}
rd = lambda f: [json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/{f}', encoding='utf-8') if l.strip()]
orders = [r for r in rd('orders.ndjson') if not r.get('fake')]
ro = rd('realization_orders.ndjson'); rm = rd('realization_monthly.ndjson'); net = rd('netting.ndjson')
cat = json.load(open(f'{root}/analytics-mvp/data-ym/catalog.json'))['items']
camp_cab = {r['campaign']: CAB[r['business']] for r in orders}
# дашборд: деньги покупателей по доставленным, месяц fin, по кампаниям
dash = collections.defaultdict(float); dash_n = collections.defaultdict(int); dash_pts = collections.defaultdict(float)
for r in orders:
    if r['service'] or r['status'] != 'DELIVERED' or not r.get('fin'): continue
    k = (r['fin'][:7], r['campaign']); dash[k] += r['p_buyer'] * r['count']; dash_n[k] += 1; dash_pts[k] += r['p_mp'] * r['count']
# по отчёту о реализации Маркета (месяц Маркета), те же заказы
ok = {(r['order'], r['sku']): r for r in orders if not r['service']}
real = collections.defaultdict(float); real_n = collections.defaultdict(int); real_cov = collections.defaultdict(set)
for r in ro:
    if r['role'] != 'delivered': continue
    x = ok.get((r['order'], r['sku']))
    if x: real[(r['ym'], r['campaign'])] += x['p_buyer'] * x['count']; real_n[(r['ym'], r['campaign'])] += 1
    real_cov[r['ym']].add(r['campaign'])
# 1С: отчёты комиссионера
kom = []
for f in glob.glob(f'{bdir}/*.xlsx'):
    v = pd.read_excel(f, header=None)
    if 'комиссионера' not in str(v.iloc[1, 0]): continue
    for _, w in v.iloc[6:].iterrows():
        if isinstance(w[1], str) and re.match(r'\d\d\.\d\d\.\d{4}', w[1]):
            kom.append(dict(date=w[1], ym=w[1][6:] + '-' + w[1][3:5], num=str(w[3]), amount=float(w[6])))
# сопоставление: точное по (месяц, кампания), иначе ближайшая кампания месяца ещё не занятая
used = set(); rows_k = []
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    cands = [(c, dash[(d['ym'], c)]) for (m, c) in dash if m == d['ym'] and (d['ym'], c) not in used]
    exact = [c for c, v in cands if abs(v - d['amount']) <= 2]
    if exact: c = exact[0]
    else:
        near = sorted(cands, key=lambda cv: abs(cv[1] - d['amount']))
        c = near[0][0] if near and abs(near[0][1] - d['amount']) < 0.25 * d['amount'] else None
    if c: used.add((d['ym'], c))
    dv = dash.get((d['ym'], c), 0.0) if c else 0.0; rv = real.get((d['ym'], c)) if c and c in real_cov.get(d['ym'], set()) else None
    rows_k.append([d['ym'], d['date'], d['num'], d['amount'], c or 'не найдена', camp_cab.get(c, '') if c else '', round(dv, 2) if c else None, dash_n.get((d['ym'], c), 0) if c else None,
                   round(d['amount'] - dv, 2) if c else None, 'сошлось' if c and abs(d['amount'] - dv) <= 2 else ('переходящие заказы' if c else 'кампании нет в выгрузке заказов'),
                   round(rv, 2) if rv is not None else None, round(d['amount'] - rv, 2) if rv is not None else None, real_n.get((d['ym'], c), None) if rv is not None else None])
# кампании дашборда без документа 1С
have = set((r[0], r[4]) for r in rows_k)
rows_k2 = [[m, c, camp_cab.get(c, ''), round(v, 2), dash_n[(m, c)]] for (m, c), v in sorted(dash.items()) if (m, c) not in have and m <= max(d['ym'] for d in kom)]
# итог по месяцам
rows_m = []
for m in sorted(set(d['ym'] for d in kom)):
    k1 = sum(d['amount'] for d in kom if d['ym'] == m); d1 = sum(v for (mm, c), v in dash.items() if mm == m)
    dm = sum(v for (mm, c), v in dash.items() if mm == m and camp_cab.get(c) == 'мебель'); dz = d1 - dm
    km = sum(r[3] for r in rows_k if r[0] == m and r[5] == 'мебель'); kz = sum(r[3] for r in rows_k if r[0] == m and r[5] == 'зеркала'); kn = sum(r[3] for r in rows_k if r[0] == m and not r[5])
    rows_m.append([m, round(k1, 2), round(d1, 2), round(k1 - d1, 2), round(km, 2), round(dm, 2), round(km - dm, 2), round(kz, 2), round(dz, 2), round(kz - dz, 2), round(kn, 2)])
# УПД
upd = []
for f in glob.glob(f'{bdir}/*.xls'):
    v = pd.read_excel(f, header=0)
    for _, w in v.iterrows():
        c = str(w['Контрагент'])
        if not c.startswith('ФИЗИЧЕСКОЕ ЛИЦО'): continue
        m = re.search(r'(НФБУ-\d+) от (\d\d\.\d\d\.\d{4})', str(w['Документ отгрузки'])); od = m.group(2) if m else ''
        d = str(w['Дата']); ym = d[6:] + '-' + d[3:5]; oym = od[6:] + '-' + od[3:5] if od else ym
        upd.append(dict(date=d, ym=ym, num=str(w['Номер']), amount=float(w['Сумма']), contract=c[-11:], cab=CONTRACT.get(c[-11:], '?'), orig=m.group(1) + ' от ' + od if m else '', oym=oym, corr=oym != ym))
# базы дашборда по месяцу и кабинету
L = collections.defaultdict(lambda: collections.defaultdict(float))
for r in net:
    k = (r['d'][:7], CAB.get(r['business'], '?')); a = r['amount']
    if r['type'] == 'Начисление' and r['src'] == 'Платёж покупателя' and r['service'] != 'Доставка': L[k]['деньги за товар'] += a
    elif r['type'] == 'Возврат' and 'платежа' in r['src'] and r['service'] != 'Доставка': L[k]['возвраты денег'] += a
    elif r['type'] == 'Начисление' and 'Баллы' in r['src']: L[k]['баллы скидки'] += a
    elif r['type'] == 'Возврат' and 'баллов' in r['src'].lower(): L[k]['возвраты баллов'] += a
O = collections.defaultdict(lambda: collections.defaultdict(float))
for r in orders:
    if r['service'] or r['status'] != 'DELIVERED' or not r.get('fin'): continue
    k = (r['fin'][:7], CAB[r['business']]); O[k]['деньги покупателей'] += r['p_buyer'] * r['count']; O[k]['цена карточки'] += r['price'] * r['count']
R = collections.defaultdict(float)
for r in rm: R[(r['ym'], CAB.get(cat.get(r['sku'], {}).get('business'), '?'))] += r['amount']
rows_u = []
for m in sorted(set(u['ym'] for u in upd)):
    for cab in ('зеркала', 'мебель'):
        main = sum(u['amount'] for u in upd if u['ym'] == m and u['cab'] == cab and not u['corr']); corr = sum(u['amount'] for u in upd if u['ym'] == m and u['cab'] == cab and u['corr'])
        l = L[(m, cab)]; o = O[(m, cab)]
        rows_u.append([m, cab, round(main, 2), round(corr, 2), round(main + corr, 2), round(l['деньги за товар'], 2), round(l['возвраты денег'], 2), round(l['деньги за товар'] + l['возвраты денег'], 2),
                       round(l['деньги за товар'] + l['возвраты денег'] + l['баллы скидки'] + l['возвраты баллов'], 2), round(o['деньги покупателей'], 2), round(o['цена карточки'], 2), round(R.get((m, cab), 0.0), 2) or None])
rows_u2 = [[u['ym'], u['date'], u['num'], u['contract'], u['cab'], u['amount'], u['orig'], 'корректировка к ' + u['oym'] if u['corr'] else 'основной'] for u in sorted(upd, key=lambda u: (u['ym'], u['cab'], u['corr']))]

wb = Workbook(); bold = Font(bold=True); hdr = PatternFill('solid', fgColor='DDE7F0'); red = Font(color='B42318', bold=True); grey = PatternFill('solid', fgColor='EEEEEE')
def sheet(title, header, rows, widths, note):
    ws = wb.create_sheet(title); ws.cell(1, 1, note).alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(header)); ws.row_dimensions[1].height = 15 * (note.count('\n') + 2)
    for j, h in enumerate(header, 1): c = ws.cell(3, j, h); c.font = bold; c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='top')
    for i, row in enumerate(rows, 4):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v)
            if isinstance(v, (int, float)) and not isinstance(v, bool): c.number_format = '#,##0.00;[Red]-#,##0.00'
    for j in range(1, len(header) + 1): ws.column_dimensions[get_column_letter(j)].width = widths[j - 1] if j - 1 < len(widths) else 14
    ws.freeze_panes = ws.cell(4, 2); return ws
wb.remove(wb['Sheet'])
ws = wb.create_sheet('Как читать')
n_ok = sum(1 for r in rows_k if r[9] == 'сошлось'); n_near = sum(1 for r in rows_k if r[9] == 'переходящие заказы'); n_no = len(rows_k) - n_ok - n_near
txt = ['Сверка продаж: 1С (реестр «Отчёт комиссионера» и реализации по договорам Маркета) против данных дашборда Маркета. Все цифры [ДАННЫЕ].', '',
       '1. «Отчёт комиссионера» в 1С - один документ на кампанию (магазин) Маркета за месяц. Подбором по данным дашборда найдено, из чего он состоит:',
       '   деньги покупателей (оплата деньгами, без баллов скидки Маркета и без доставки) по ДОСТАВЛЕННЫМ заказам кампании за месяц.',
       f'   Из {len(rows_k)} документов {n_ok} сошлись с дашбордом до рубля, {n_near} отличаются на переходящие заказы (у Маркета заказ попал в соседний месяц, у нас - по дате сбора за продажу), {n_no} не нашли кампанию.',
       '   Лист «Отчёты комиссионера»: каждый документ, кампания, сумма дашборда, разница. Для июля-сентября есть столбец «по отчёту о реализации Маркета»: те же заказы, но месяц - как их поставил сам Маркет.',
       '   Лист «Кампании без документа»: месяцы и кампании, по которым в дашборде есть доставленные заказы, а документа в 1С нет.',
       '   Лист «Итог по месяцам»: суммы 1С против дашборда по месяцам и кабинетам.',
       '', '2. Реализации «ФИЗИЧЕСКОЕ ЛИЦО <договор>» (УПД) - по договору за месяц плюс корректировки к прошлому месяцу. 54641824/26 - зеркала, 54542918/26 - мебель (по сопоставлению платёжек).',
       '   Ни одна база дашборда с этими суммами не совпала: ни деньги за товар по реестру, ни деньги покупателей по доставленным заказам, ни отчёт о реализации Маркета.',
       '   Лист «УПД»: суммы 1С и все базы дашборда рядом. Нужен ответ 1С: из какого отчёта Маркета и по какому правилу собирается документ реализации.',
       '', 'Ограничения дашборда: выгрузка заказов зеркал неполная до июля (кампания 21985942 не отдаёт данные через API), отчёт о реализации Маркета добран частично (сентябрь - 3 магазина из 6).']
for i, t in enumerate(txt, 1): ws.cell(i, 1, t)
ws.column_dimensions['A'].width = 190
sheet('Итог по месяцам', ['месяц', '1С: отчёты комиссионера, всего', 'дашборд: деньги покупателей по доставленным, всего', 'разница', '1С мебель', 'дашборд мебель', 'разница мебель', '1С зеркала', 'дашборд зеркала', 'разница зеркала', '1С: документы без кампании'],
      rows_m, [10, 18, 20, 14, 16, 16, 14, 16, 16, 14, 18], 'Суммы документов «Отчёт комиссионера» против денег покупателей по доставленным заказам дашборда (месяц даты fin). Кабинет документа - по найденной кампании; «без кампании» - документы, которым не нашлась кампания (их сумма входит в «всего»).')
ws = sheet('Отчёты комиссионера', ['месяц', 'дата 1С', '№ документа', 'сумма 1С', 'кампания Маркета', 'кабинет', 'дашборд: деньги покупателей по доставленным (fin)', 'заказов', 'разница 1С - дашборд', 'статус', 'по отчёту о реализации Маркета (его месяц)', 'разница 1С - отчёт Маркета', 'заказов в отчёте'],
      rows_k, [10, 11, 10, 14, 14, 10, 20, 9, 16, 24, 20, 16, 10], 'Каждый документ 1С и его пара в дашборде. Пара ищется точно по сумме внутри месяца, иначе берётся ближайшая кампания месяца (разница меньше 25%). Столбцы «по отчёту о реализации Маркета» заполнены только там, где у дашборда есть строки отчёта о реализации за этот месяц и кампанию (июль-сентябрь, частично).')
for row in ws.iter_rows(min_row=4):
    if row[9].value != 'сошлось': row[8].font = red
sheet('Кампании без документа', ['месяц', 'кампания Маркета', 'кабинет', 'дашборд: деньги покупателей по доставленным', 'заказов'], rows_k2, [10, 14, 10, 22, 9], 'Месяцы и кампании, по которым в дашборде есть доставленные заказы, а документа «Отчёт комиссионера» в 1С на эту сумму нет (в том числе те, что ушли в «не найдена»).')
sheet('УПД', ['месяц', 'кабинет (по договору)', '1С: основной документ', '1С: корректировки к прошлому месяцу', '1С: итого', 'реестр: деньги за товар (месяц проводки)', 'реестр: возвраты денег', 'реестр: деньги нетто', 'реестр: цена карточки нетто (деньги + баллы скидки)', 'заказы: деньги покупателей по доставленным (fin)', 'заказы: цена карточки по доставленным', 'отчёт о реализации Маркета (сумма с скидками, частично)'],
      rows_u, [10, 12, 16, 18, 14, 18, 16, 16, 22, 20, 18, 20], 'Документы реализации 1С по договорам против всех баз дашборда. Совпадений нет ни с одной базой - см. «Как читать».')
sheet('УПД документы', ['месяц', 'дата', '№', 'договор', 'кабинет', 'сумма', 'документ отгрузки', 'тип'], rows_u2, [10, 11, 13, 13, 10, 14, 34, 22], 'Все документы реализации «ФИЗИЧЕСКОЕ ЛИЦО <договор>» из выгрузки 1С. Строки других контрагентов (23 шт.) не относятся к Маркету и не учтены.')
wb.save(out)
print('ok', out, 'ком:', len(rows_k), 'сошлось', n_ok, 'переходящие', n_near, 'не найдена', n_no)
for r in rows_k: print(r)
for r in rows_m: print(r)
