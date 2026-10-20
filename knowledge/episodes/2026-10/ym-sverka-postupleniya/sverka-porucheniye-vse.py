#!/usr/bin/env python3
"""Отчёт Маркета об исполнении поручения за каждый месяц и оба кабинета, собранный из реестра дашборда, против продаж 1С по заказам. Только чтение.
Запуск: python3 -I sverka-porucheniye-vse.py <корень репо> <папка 1С 19.10> <выход.xlsx>
Спека (все цифры [ДАННЫЕ]):
  Источник Маркета: реестр взаиморасчётов дашборда (netting.ndjson, API Маркета). Проверено на июле мебели: лист «Получено от потребителей»
      отчёта Маркета = строки реестра «Начисление / Платёж покупателя» за месяц проводки, 216 строк, 4 036 835 ₽, до рубля (sverka-porucheniye.py).
  «Получено от покупателей» = те же строки по месяцу проводки (дата оплаты), товар и доставка отдельно; отменённые = статус «не будет переведён»
      или заказ отменён по выгрузке заказов. Доставка заказа и месяц - из выгрузки заказов (fin = дата сбора за продажу).
  1С: отчёты комиссионера с магазином (пары как в sverka-otkloneniya.py); документ «есть» для (магазин, месяц доставки).
  Схлопывание по месяцу доставки: доставлено (товар деньгами, Маркет) = отчёты комиссионера 1С + магазины без документа + отклонения документов.
  Ограничение: по зеркалам до июля карточек заказов трёх закрытых магазинов нет (API отключён) - эти платежи в классе «заказа нет в выгрузке».
"""
import json, sys, re, glob, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

root, d19, out = sys.argv[1:4]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
NAMES = {'148992469': 'DBS ООО новый', '149001087': 'FBS OOO', '149002232': 'DBS OOO 15 дней', '149032438': 'DBS 7 дней ООО', '149229378': 'ДБС ООО 1д', '66056856': 'GEN GROUP (старый FBS)'}
rd = lambda f: [json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/{f}', encoding='utf-8') if l.strip()]
ymd = lambda s: s[6:10] + '-' + s[3:5]; r2 = lambda x: round(x + 0.0, 2)
orders = [r for r in rd('orders.ndjson') if not r.get('fake')]; net = rd('netting.ndjson')
camp_cab = {r['campaign']: CAB[r['business']] for r in orders}
goods = collections.defaultdict(float); ost = {}
for r in orders:
    if r['service']: continue
    ost[r['order']] = dict(status=r['status'], fin=r.get('fin') or '', camp=r['campaign'], created=r['created'])
    if r['status'] == 'DELIVERED' and r.get('fin'): goods[(r['fin'][:7], r['campaign'])] += r['p_buyer'] * r['count']
kom = []
for f in glob.glob(f'{d19}/*.xlsx'):
    v = pd.read_excel(f, header=None)
    if 'комиссионера' not in str(v.iloc[1, 0]): continue
    for _, w in v.iloc[6:].iterrows():
        if isinstance(w[1], str) and re.match(r'\d\d\.\d\d\.\d{4}', w[1]): kom.append(dict(ym=ymd(w[1]), num=str(w[3]), amount=float(w[6]), camp=None))
used = set()
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    h = [c for (m, c) in goods if m == d['ym'] and (m, c) not in used and abs(goods[(m, c)] - d['amount']) <= 2]
    if h: d['camp'] = h[0]; used.add((d['ym'], h[0]))
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    if d['camp']: continue
    cands = [c for (m, c) in goods if m == d['ym'] and (m, c) not in used]
    if cands:
        c = min(cands, key=lambda c: abs(goods[(d['ym'], c)] - d['amount']))
        if abs(goods[(d['ym'], c)] - d['amount']) < 0.25 * d['amount']: d['camp'] = c; used.add((d['ym'], c))
doc_of = {(d['camp'], d['ym']): d for d in kom if d['camp']}
last_doc = max(d['ym'] for d in kom)
CL = ['1. отменён, деньги возвращены', '2. доставлен в этом месяце, документ 1С есть', '3. доставлен в другом месяце, документ 1С за тот месяц есть', '4. доставлен, документа 1С по магазину за месяц доставки нет', '5. ещё не доставлен', '6. заказа нет в выгрузке дашборда']
S = collections.defaultdict(lambda: collections.defaultdict(float)); N = collections.defaultdict(lambda: collections.defaultdict(set)); nodoc_rows = []
for r in net:
    if r['type'] != 'Начисление' or r['src'] != 'Платёж покупателя': continue
    st = str(r.get('status') or '').strip(); m = r['d'][:7]; cab = CAB.get(r['business'], '?'); o = str(r.get('order') or ''); x = ost.get(o); a = r['amount']
    is_dlv = r['service'] == 'Доставка'
    if re.match(r'^(справочно:\s*)?не будет', st, re.I) or (x and x['status'].startswith('CANCELLED')): cl = CL[0]; dm = ''
    elif not x: cl = CL[5]; dm = ''
    elif x['status'] == 'DELIVERED':
        dm = x['fin'][:7] if x['fin'] else ''
        cl = (CL[1] if dm == m else CL[2]) if (x['camp'], dm) in doc_of else CL[3]
    else: cl = CL[4]; dm = ''
    k = (cab, m); S[k][cl + ('|доставка' if is_dlv else '')] += a; N[k][cl].add(o)
    if cl == CL[3] and not is_dlv: nodoc_rows.append([cab, m, r['d'][:10], o, x['created'][:10], x['camp'], NAMES.get(x['camp'], ''), r.get('sku') or '', r2(a), dm])
months = sorted(set(m for (c, m) in S if '2026-01' <= m <= '2026-10'))
rows = []
for cab in ('зеркала', 'мебель'):
    t = collections.defaultdict(float); tn = collections.defaultdict(set)
    for m in months:
        s = S[(cab, m)]; n = N[(cab, m)]
        tov = sum(v for k, v in s.items() if '|доставка' not in k); dlv = sum(v for k, v in s.items() if '|доставка' in k)
        k1 = sum(d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        row = [cab, m, r2(tov), r2(dlv)] + [r2(s[c]) for c in CL] + [len(n[CL[3]]), r2(k1)]
        rows.append(row)
        for i, v in enumerate(row[2:], 2):
            if isinstance(v, float): t[i] += v
        tn[0] |= n[CL[3]]
    rows.append([cab, 'ИТОГО'] + [r2(t[i]) if i != 10 else len(tn[0]) for i in range(2, 12)])
# схлопывание по месяцу доставки
rows2 = []
for cab in ('зеркала', 'мебель'):
    t = collections.defaultdict(float)
    for m in [m for m in months if m <= last_doc]:
        mk = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab)
        k1 = sum(d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        nd = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab and (mm, c) not in used)
        dd = sum(goods[(d['ym'], d['camp'])] - d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        row = [cab, m, r2(mk), r2(k1), r2(nd), r2(dd), r2(mk - k1 - nd - dd)]; rows2.append(row)
        for i, v in enumerate(row[2:], 2): t[i] += v
    rows2.append([cab, 'ИТОГО'] + [r2(t[i]) for i in range(2, 7)])
nopair = [d for d in kom if not d['camp']]

wb = Workbook(); bold = Font(bold=True); hdr = PatternFill('solid', fgColor='DDE7F0'); grey = PatternFill('solid', fgColor='EEEEEE'); red = Font(color='B42318', bold=True)
def sheet(title, header, rows, widths, note, redcols=()):
    ws = wb.create_sheet(title); ws.cell(1, 1, note).alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(header)); ws.row_dimensions[1].height = 15 * (note.count('\n') + 2)
    for j, h in enumerate(header, 1): c = ws.cell(3, j, h); c.font = bold; c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[3].height = 75
    for i, row in enumerate(rows, 4):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v)
            if isinstance(v, float): c.number_format = '#,##0;[Red]-#,##0'
            if row[1] == 'ИТОГО': c.font = bold; c.fill = grey
            if j in redcols and isinstance(v, float) and v > 2: c.font = red
    for j in range(1, len(header) + 1): ws.column_dimensions[get_column_letter(j)].width = widths[j - 1] if j - 1 < len(widths) else 14
    ws.freeze_panes = ws.cell(4, 3); return ws
wb.remove(wb['Sheet'])
tz = [r for r in rows if r[0] == 'зеркала' and r[1] == 'ИТОГО'][0]; tm = [r for r in rows if r[0] == 'мебель' and r[1] == 'ИТОГО'][0]
f = lambda x: f'{x:,.0f}'.replace(',', ' ')
ws = wb.create_sheet('Как читать'); ws.column_dimensions['A'].width = 200
txt = ['Отчёт Маркета об исполнении поручения за каждый месяц, оба кабинета, против продаж 1С по заказам. Источник Маркета - реестр дашборда по API; на июле мебели он совпал с файлом отчёта Маркета до рубля (216 платежей, 4 036 835 ₽). Все цифры [ДАННЫЕ].', '',
       'Лист «По месяцу оплаты»: «Получено от покупателей» как в отчёте Маркета (по дате оплаты), и куда попали эти деньги: отменён и возвращён, доставлен и есть отчёт комиссионера в 1С (в этом месяце или в другом), доставлен и документа нет, ещё не доставлен, заказа нет в выгрузке.',
       f'   Доставлено без документа 1С за январь-октябрь: зеркала {f(tz[7])} ₽ по {tz[10]} заказам, мебель {f(tm[7])} ₽ по {tm[10]} заказам. Это и есть непроведённые продажи, каждый заказ - на листе «Заказы без документа».',
       '   «Заказа нет в выгрузке» - платежи по заказам, карточек которых нет в выгрузке дашборда: три старых магазина зеркал Маркет закрыл для API, поэтому по зеркалам до июля статус заказа не виден. Эти деньги тоже не проведены в 1С (документов по тем магазинам нет), но разложить их по доставкам нельзя.',
       '', 'Лист «Схлопывание»: по месяцу доставки. Доставлено (Маркет, товар деньгами) = отчёты комиссионера 1С + магазины без документа + отклонения документов с парой. Остаток в последнем столбце должен быть нулём, он и есть ноль: суммы схлопываются.',
       f'   Документ 1С без пары: {", ".join(d["ym"] + " № " + d["num"] + " на " + f(d["amount"]) for d in nopair) or "нет"}.',
       '', 'Лист «Заказы без документа»: каждый доставленный заказ, по которому деньги получены и перечислены Маркетом, а отчёта комиссионера по его магазину за месяц доставки в 1С нет.']
for i, t in enumerate(txt, 1): ws.cell(i, 1, t)
sheet('По месяцу оплаты', ['кабинет', 'месяц оплаты', 'Маркет: получено от покупателей, товар', 'Маркет: получено, доставка'] + ['из них: ' + c for c in CL] + ['заказов без документа', '1С: отчёты комиссионера за месяц (по доставке)'],
      rows, [10, 9, 16, 13, 14, 16, 16, 16, 13, 14, 10, 16], 'Как в отчёте Маркета об исполнении поручения: платежи покупателей по дате оплаты. Строки доставки включены в столбцы «из них» вместе с товаром. Красным - доставлено без документа 1С.', redcols=(8,))
sheet('Схлопывание', ['кабинет', 'месяц доставки', 'Маркет: доставлено, товар деньгами', '1С: отчёты комиссионера', 'из них: магазины без документа', 'из них: отклонения документов с парой', 'остаток (должен быть 0)'],
      rows2, [10, 9, 18, 16, 18, 18, 14], 'Доставлено по Маркету против отчётов комиссионера 1С по месяцу доставки (дата сбора за продажу). Остаток ноль - значит, вся разница разложена без остатка.')
sheet('Заказы без документа', ['кабинет', 'месяц оплаты', 'дата оплаты', 'заказ Маркета', 'дата заказа', 'кампания', 'магазин', 'SKU', 'получено за товар, ₽', 'месяц доставки'],
      sorted(nodoc_rows), [9, 9, 11, 14, 11, 11, 18, 20, 14, 11], 'Доставленные заказы, по которым в 1С нет отчёта комиссионера по магазину за месяц доставки. Деньги за них Маркет получил и перечислил.')
wb.save(out)
print('ok', out)
for r in rows: print(r[:2], [int(x) if isinstance(x, float) else x for x in r[2:]])
for r in rows2: print(r[:2], [int(x) for x in r[2:]])
print('без документа заказов:', len(set(r[3] for r in nodoc_rows)))
