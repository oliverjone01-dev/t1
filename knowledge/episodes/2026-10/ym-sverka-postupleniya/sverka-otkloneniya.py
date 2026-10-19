#!/usr/bin/env python3
"""Отклонения 1С против Маркета реальными цифрами, по документам и по месяцам. Только чтение.
Запуск: python3 -I sverka-otkloneniya.py <корень репо> <папка с файлами 1С> <выход.xlsx>
Спека (все цифры [ДАННЫЕ], деньги без баллов):
  1С «Отчёт комиссионера» - сумма документа из реестра 1С (столбец «Сумма»), одна строка на документ.
  Маркет, три базы на (месяц, магазин): товар = деньги покупателей (p_buyer x шт) по ДОСТАВЛЕННЫМ заказам, месяц даты сбора за продажу (fin),
      без строк доставки; доставка = те же заказы, строки доставки; отчёт о реализации Маркета = те же заказы, но месяц как в отчёте Маркета
      (realization_orders, есть за июль-сентябрь, не по всем магазинам).
  Пара документу ищется в его месяце: сначала точное равенство (до 2 ₽) товару, потом товару с доставкой, потом отчёту о реализации,
      потом ближайший свободный магазин месяца (отклонение меньше 25%). Отклонение = 1С − Маркет, со знаком.
  По месяцам: не проведено в 1С = товар по заказам − 1С; разложено на магазины без документа, отклонения документов с парой, документы без пары.
  Сборы для актов: удержания Маркета деньгами по месяцу проводки реестра (статус не «не будет»), группы по услуге; баллами - справочно.
"""
import json, sys, re, glob, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

root, bdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
rd = lambda f: [json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/{f}', encoding='utf-8') if l.strip()]
orders = [r for r in rd('orders.ndjson') if not r.get('fake')]
ro = rd('realization_orders.ndjson'); net = rd('netting.ndjson')
camp_cab = {r['campaign']: CAB[r['business']] for r in orders}
r2 = lambda x: round(x + 0.0, 2)

# --- базы Маркета по (месяц, магазин)
goods = collections.defaultdict(float); dlv = collections.defaultdict(float); n_ord = collections.defaultdict(set)
for r in orders:
    if r['status'] != 'DELIVERED' or not r.get('fin'): continue
    k = (r['fin'][:7], r['campaign'])
    if r['service']: dlv[k] += r['p_buyer'] * r['count']
    else: goods[k] += r['p_buyer'] * r['count']; n_ord[k].add(r['order'])
ok = {(r['order'], r['sku']): r for r in orders if not r['service']}
real = collections.defaultdict(float); real_cov = set()
for r in ro:
    real_cov.add((r['ym'], r['campaign']))
    if r['role'] != 'delivered': continue
    x = ok.get((r['order'], r['sku']))
    if x: real[(r['ym'], r['campaign'])] += x['p_buyer'] * x['count']

# --- 1С: реестр отчётов комиссионера
kom = []
for f in glob.glob(f'{bdir}/*.xlsx'):
    v = pd.read_excel(f, header=None)
    if 'комиссионера' not in str(v.iloc[1, 0]): continue
    for _, w in v.iloc[6:].iterrows():
        if isinstance(w[1], str) and re.match(r'\d\d\.\d\d\.\d{4}', w[1]):
            kom.append(dict(date=w[1], ym=w[1][6:] + '-' + w[1][3:5], num=str(w[3]), amount=float(w[6])))
last_ym = max(d['ym'] for d in kom)

# --- пара документу: точные совпадения вперёд, потом ближайшие
used = set()
def free(ym): return [c for (m, c) in goods if m == ym and (ym, c) not in used]
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    d['camp'] = None; d['how'] = 'пары нет'
    for base, name in ((lambda k: goods[k], 'равен товару без доставки'), (lambda k: goods[k] + dlv.get(k, 0.0), 'равен товару с доставкой'),
                       (lambda k: real[k] if k in real_cov else None, 'равен отчёту о реализации Маркета')):
        hit = [c for c in free(d['ym']) if base((d['ym'], c)) is not None and abs(base((d['ym'], c)) - d['amount']) <= 2]
        if hit: d['camp'] = hit[0]; d['how'] = name; break
    if d['camp']: used.add((d['ym'], d['camp']))
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    if d['camp']: continue
    near = sorted(free(d['ym']), key=lambda c: abs(goods[(d['ym'], c)] - d['amount']))
    if near and abs(goods[(d['ym'], near[0])] - d['amount']) < 0.25 * d['amount']:
        d['camp'] = near[0]; d['how'] = 'ближайший магазин месяца'; used.add((d['ym'], near[0]))

rows_d = []
for d in sorted(kom, key=lambda d: (d['ym'], d['num'].zfill(4))):
    c = d['camp']; k = (d['ym'], c)
    if c:
        g, dl = goods[k], dlv.get(k, 0.0); rv = real.get(k) if k in real_cov else None
        rows_d.append([d['ym'], d['date'], d['num'], d['amount'], c, camp_cab[c], r2(g), r2(dl), r2(g + dl), r2(d['amount'] - g), r2(d['amount'] - g - dl),
                       r2(rv) if rv is not None else None, r2(d['amount'] - rv) if rv is not None else None, len(n_ord[k]), d['how']])
    else:
        rows_d.append([d['ym'], d['date'], d['num'], d['amount'], 'не найден', '', None, None, None, None, None, None, None, None, d['how']])

# --- магазины без документа
rows_nd = [[m, c, camp_cab[c], r2(v), r2(dlv.get((m, c), 0.0)), len(n_ord[(m, c)])] for (m, c), v in sorted(goods.items()) if (m, c) not in used and m <= last_ym]

# --- реестр Маркета: продажи деньгами по месяцу проводки, сборы деньгами по группам
def cancelled(r): return bool(re.match(r'^(справочно:\s*)?не будет', str(r.get('status') or '').strip(), re.I))
GRP = [('Приём платежа', 'приём платежа'), ('Перевод платежа', 'перевод платежа'), ('Размещение товарных предложений', 'размещение (комиссия)'), ('Буст продаж', 'буст продаж'),
       ('Доставка', 'доставка и логистика Маркета'), ('', 'прочее (штрафы, отзывы, без услуги)')]
grp = lambda s: next(n for p, n in GRP if s.startswith(p))
GN = [n for _, n in GRP]
reg_sales = collections.defaultdict(float); fees = collections.defaultdict(lambda: collections.defaultdict(float)); pts_fees = collections.defaultdict(float); other_acc = collections.defaultdict(float)
for r in net:
    if cancelled(r): continue
    st = str(r.get('status') or '').strip(); k = (r['d'][:7], CAB.get(r['business'], '?')); a = r['amount']
    if r['type'] in ('Списание', 'Возврат списания'): pts_fees[k] += a; continue
    if st.lower().startswith('справочно') or not st or 'балл' in r['src'].lower(): continue
    if r['type'] == 'Начисление' and r['src'] == 'Платёж покупателя' and r['service'] != 'Доставка': reg_sales[k] += a
    elif r['type'] == 'Возврат' and r['service'] != 'Доставка': reg_sales[k] += a
    elif r['type'] == 'Начисление': other_acc[k] += a
    elif r['type'] == 'Удержание': fees[k][grp(r['service'] or '')] += a

# --- по месяцам
months = sorted(set(m for (m, c) in goods if '2026-01' <= m <= last_ym) | set(d['ym'] for d in kom))
rows_m = []; tot = collections.defaultdict(float)
for cab in ('зеркала', 'мебель'):
    for m in months:
        k1 = sum(d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        mk = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab)
        nd = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab and (mm, c) not in used)
        dd = sum(goods[(d['ym'], d['camp'])] - d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        dl_all = sum(v for (mm, c), v in dlv.items() if mm == m and camp_cab[c] == cab)
        rs = reg_sales[(m, cab)]
        row = [cab, m, r2(k1), r2(mk), r2(mk - k1), r2(nd), r2(dd), r2(dl_all), r2(rs), r2(rs - k1)]
        rows_m.append(row)
        for i, v in enumerate(row[2:], 2): tot[(cab, i)] += v
    rows_m.append([cab, 'ИТОГО'] + [r2(tot[(cab, i)]) for i in range(2, 10)])
nopair = [d for d in kom if not d['camp']]
for d in nopair: rows_m.append(['без магазина', d['ym'], d['amount'], None, -d['amount'], None, None, None, None, None])

rows_f = []
for cab in ('зеркала', 'мебель'):
    t = collections.defaultdict(float)
    for m in months:
        f = fees[(m, cab)]; s = sum(f.values())
        row = [cab, m] + [r2(-f[n]) for n in GN] + [r2(-s), None, None, r2(-pts_fees[(m, cab)]), r2(other_acc[(m, cab)])]
        rows_f.append(row)
        for i, v in enumerate(row[2:], 2):
            if v is not None: t[i] += v
    rows_f.append([cab, 'ИТОГО'] + [r2(t[i]) if i not in (9, 10) else None for i in range(2, 13)])

# --- Excel
wb = Workbook(); bold = Font(bold=True); hdr = PatternFill('solid', fgColor='DDE7F0'); grey = PatternFill('solid', fgColor='EEEEEE'); red = Font(color='B42318', bold=True); green = Font(color='067647')
def sheet(title, header, rows, widths, note, hl=None):
    ws = wb.create_sheet(title); ws.cell(1, 1, note).alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(header)); ws.row_dimensions[1].height = 15 * (note.count('\n') + 2)
    for j, h in enumerate(header, 1): c = ws.cell(3, j, h); c.font = bold; c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[3].height = 60
    for i, row in enumerate(rows, 4):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v)
            if isinstance(v, (int, float)) and not isinstance(v, bool): c.number_format = '#,##0;[Red]-#,##0'
            if row[1] == 'ИТОГО': c.font = bold; c.fill = grey
        if hl: hl(ws, i, row)
    for j in range(1, len(header) + 1): ws.column_dimensions[get_column_letter(j)].width = widths[j - 1] if j - 1 < len(widths) else 14
    ws.freeze_panes = ws.cell(4, 3); return ws
wb.remove(wb['Sheet'])
n_eq = sum(1 for d in kom if d['how'].startswith('равен')); n_g = sum(1 for d in kom if d['how'] == 'равен товару без доставки'); n_gd = sum(1 for d in kom if d['how'] == 'равен товару с доставкой')
n_r = sum(1 for d in kom if d['how'] == 'равен отчёту о реализации Маркета'); n_near = sum(1 for d in kom if d['how'] == 'ближайший магазин месяца')
tz = tot[('зеркала', 4)]; tm = tot[('мебель', 4)]
ws = wb.create_sheet('Как читать'); ws.column_dimensions['A'].width = 200
txt = ['Отклонения 1С против Маркета, январь-сентябрь 2026. Деньги без баллов. Источники: реестр 1С «Отчёт комиссионера» (суммы документов), выгрузка заказов Маркета (та же, что вкладка «Отчет»), отчёт о реализации Маркета за июль-сентябрь, реестр взаиморасчётов Маркета. Все цифры [ДАННЫЕ].', '',
       f'1. Лист «По документам»: каждый из {len(kom)} документов 1С и его магазин Маркета. {n_eq} документов равны данным Маркета до 2 ₽: {n_g} - деньгам за товар без доставки, {n_gd} - с доставкой, {n_r} - отчёту о реализации Маркета (его месяц).',
       f'   {n_near} документов совпадений не дали, для них взят ближайший по сумме магазин месяца и показано отклонение со знаком (1С минус Маркет). {len(nopair)} документ без пары: магазина с такой суммой в выгрузке заказов нет.',
       '   Столбцы «доставка» и «товар + доставка» показывают, сколько доставки покупатели оплатили по этому магазину за месяц и какой была бы сумма с ней. Там, где документ равен товару без доставки, доставка в сумму документа не входит - это столбец «Сумма» реестра 1С, внутри документа её не видно.',
       '', f'2. Лист «По месяцам»: не проведено в 1С = товар по доставленным заказам Маркета минус отчёты комиссионера. Итого зеркала {tz:,.0f} ₽, мебель {tm:,.0f} ₽.'.replace(',', ' '),
       '   Разложено: магазины, по которым документа нет вообще (лист «Магазины без документа»), и отклонения документов с парой (сумма столбца «отклонение» по документам месяца).',
       '   Справочно: доставка деньгами по заказам месяца и продажи по реестру Маркета (месяц проводки, другая семья источников). Выгрузка заказов зеркал до июля неполная: три магазина зеркал Маркет закрыл для API, поэтому по зеркалам до июля реестр больше, чем заказы.',
       '', '3. Лист «Сборы для актов»: удержания Маркета деньгами по месяцу проводки, по группам услуг, со знаком минус. Это то, с чем сравнивать акты услуг 1С, если акты проведены за минусом баллов. Реестра актов в выгрузке 1С нет, столбцы «1С: акты» пустые - пришлите реестр документов поступления услуг от ЯНДЕКС МАРКЕТ ООО за январь-октябрь, и отклонения по актам посчитаются тем же скриптом.',
       '   Баллами списано - справочно, в деньгах этого нет. Премии и компенсации деньгами - начисления Маркета, которые не продажи и не сборы.']
for i, t in enumerate(txt, 1): ws.cell(i, 1, t)
def hl_d(ws, i, row):
    ws.cell(i, 15).font = green if str(row[14]).startswith('равен') else red
    for j in (10, 11, 13):
        if isinstance(row[j - 1], (int, float)) and abs(row[j - 1]) > 2: ws.cell(i, j).font = red
sheet('По документам', ['месяц', 'дата 1С', '№ док.', '1С: сумма документа', 'магазин Маркета', 'кабинет', 'Маркет: товар деньгами по доставленным (месяц сбора)', 'Маркет: доставка деньгами', 'Маркет: товар + доставка',
       'отклонение 1С − товар', 'отклонение 1С − (товар + доставка)', 'Маркет: отчёт о реализации (его месяц)', 'отклонение 1С − отчёт о реализации', 'заказов', 'вывод'],
      rows_d, [9, 11, 7, 14, 12, 9, 18, 14, 16, 15, 17, 18, 17, 8, 30], 'Каждый документ 1С против трёх баз Маркета по его магазину и месяцу. Отклонение = 1С минус Маркет. Зелёный вывод - документ равен одной из баз до 2 ₽.', hl_d)
sheet('Магазины без документа', ['месяц', 'магазин Маркета', 'кабинет', 'Маркет: товар деньгами по доставленным', 'Маркет: доставка деньгами', 'заказов'], rows_nd, [9, 14, 9, 22, 16, 8],
      'Месяцы и магазины, где у Маркета есть доставленные заказы, а документа «Отчёт комиссионера» в 1С нет.')
def hl_m(ws, i, row):
    if isinstance(row[4], (int, float)) and abs(row[4]) > 2 and row[1] != 'ИТОГО': ws.cell(i, 5).font = red
sheet('По месяцам', ['кабинет', 'месяц', '1С: отчёты комиссионера', 'Маркет: товар деньгами по доставленным заказам', 'НЕ ПРОВЕДЕНО в 1С = Маркет − 1С', 'из них: магазины без документа', 'из них: отклонения документов с парой',
       'справочно: доставка деньгами по заказам', 'справочно: реестр Маркета, продажи деньгами (месяц проводки)', 'справочно: реестр − 1С'],
      rows_m, [12, 9, 16, 20, 18, 16, 16, 16, 20, 14], 'Не проведено в 1С = товар по доставленным заказам Маркета (месяц сбора за продажу) минус суммы отчётов комиссионера за месяц. Строка «без магазина» - документ 1С, которому пара не нашлась, он уменьшает отклонение.', hl_m)
sheet('Сборы для актов', ['кабинет', 'месяц проводки'] + ['Маркет деньгами: ' + n for n in GN] + ['Маркет деньгами: итого удержано', '1С: акты услуг (нет в выгрузке)', 'отклонение 1С − Маркет', 'справочно: оплачено баллами', 'справочно: премии и компенсации деньгами'],
      rows_f, [12, 9, 13, 13, 14, 13, 16, 16, 16, 16, 14, 14, 16], 'Удержания Маркета деньгами по месяцу проводки реестра взаиморасчётов, без отменённых. Со знаком минус. Столбцы «1С: акты» заполнятся, когда будет реестр поступлений услуг от Маркета.')
wb.save(out)
print('ok', out, 'документов', len(kom), 'равны', n_eq, f'(товар {n_g}, с доставкой {n_gd}, отчёт {n_r})', 'ближайшие', n_near, 'без пары', len(nopair))
for r in rows_d: print(r[0], r[2], int(r[3]), r[4], r[9], r[10], r[12], r[14])
for r in rows_m: print(r)
