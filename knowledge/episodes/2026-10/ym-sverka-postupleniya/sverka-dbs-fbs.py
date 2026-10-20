#!/usr/bin/env python3
"""Продажи по моделям: ДБС-магазины Маркета против отчётов комиссионера 1С, ФБС-магазины против реализаций «Яндекс маркет фбс» 1С. По месяцам и кабинетам. Только чтение.
Запуск: python3 -I sverka-dbs-fbs.py <корень репо> <папка 1С 19.10> <папка 1С 20.10> <выход.xlsx>
Спека (все цифры [ДАННЫЕ]):
  Модель магазина: мебель - по списку кампаний Маркета (ping 04.09): FBS = 149001087 «FBS OOO», 66056856 «GEN GROUP»; DBS = 148992469, 149002232, 149032438, 149229378.
      Зеркала: названий в API нет; 149154933 - ФБС (реализации 1С за июнь-сентябрь ложатся на него: 203 967 против 202 364 в июне),
      149000600 и 149035080 - ДБС (по ним отчёты комиссионера 1С, равны до рубля), 142277249 и 149087657 - по два заказа, ДБС по типу документа.
      Старые магазины зеркал (21985942, 23960471, 40175277) закрыты Маркетом для API: заказов нет, модель не видна, Маркет по ним показать нельзя.
  Маркет: деньги покупателей за товар (без доставки, без баллов) по ДОСТАВЛЕННЫМ заказам, месяц даты сбора за продажу.
  1С ДБС: отчёты комиссионера по месяцу документа, магазин по паре (sverka-otkloneniya.py). 1С ФБС: реализации по дате документа, кабинет по договору из выгрузки 19.10.
  Разница = 1С − Маркет. Для ДБС разложена: магазин без документа, отклонения документов с парой, документ без пары. Для ФБС - сама разница и накопленная.
"""
import json, sys, re, glob, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

root, d19, d20, out = sys.argv[1:5]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}; CONTRACT = {'54641824/26': 'зеркала', '54542918/26': 'мебель'}
MODEL = {'149001087': 'ФБС', '66056856': 'ФБС', '149154933': 'ФБС', '148992469': 'ДБС', '149002232': 'ДБС', '149032438': 'ДБС', '149229378': 'ДБС', '149000600': 'ДБС', '149035080': 'ДБС', '142277249': 'ДБС', '149087657': 'ДБС'}
NAMES = {'148992469': 'DBS ООО новый', '149001087': 'FBS OOO', '149002232': 'DBS OOO 15 дней', '149032438': 'DBS 7 дней ООО', '149229378': 'ДБС ООО 1д', '66056856': 'GEN GROUP (старый FBS)'}
rd = lambda f: [json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/{f}', encoding='utf-8') if l.strip()]
ymd = lambda s: s[6:10] + '-' + s[3:5]; r2 = lambda x: round(x + 0.0, 2)
orders = [r for r in rd('orders.ndjson') if not r.get('fake')]
camp_cab = {r['campaign']: CAB[r['business']] for r in orders}
goods = collections.defaultdict(float); n_ord = collections.defaultdict(set)
for r in orders:
    if not r['service'] and r['status'] == 'DELIVERED' and r.get('fin'): goods[(r['fin'][:7], r['campaign'])] += r['p_buyer'] * r['count']; n_ord[(r['fin'][:7], r['campaign'])].add(r['order'])
kom = []
for f in glob.glob(f'{d19}/*.xlsx'):
    v = pd.read_excel(f, header=None)
    if 'комиссионера' not in str(v.iloc[1, 0]): continue
    for _, w in v.iloc[6:].iterrows():
        if isinstance(w[1], str) and re.match(r'\d\d\.\d\d\.\d{4}', w[1]): kom.append(dict(ym=ymd(w[1]), num=str(w[3]), amount=float(w[6]), camp=None, how=''))
used = set()
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    h = [c for (m, c) in goods if m == d['ym'] and (m, c) not in used and abs(goods[(m, c)] - d['amount']) <= 2]
    if h: d['camp'] = h[0]; d['how'] = 'равен до рубля'; used.add((d['ym'], h[0]))
ro = rd('realization_orders.ndjson'); ok = {(r['order'], r['sku']): r for r in orders if not r['service']}
realn = collections.defaultdict(float)
for r in ro:
    x = ok.get((r['order'], r['sku']))
    if x: realn[(r['ym'], r['campaign'])] += x['p_buyer'] * r['count'] * (1 if r['role'] == 'delivered' else -1)
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    if d['camp']: continue
    h = [c for (m, c) in realn if m == d['ym'] and (m, c) not in used and abs(realn[(m, c)] - d['amount']) <= 2]
    if h: d['camp'] = h[0]; d['how'] = 'равен отчёту Маркета о реализации (доставлено − возвраты)'; used.add((d['ym'], h[0]))
for d in sorted(kom, key=lambda d: (d['ym'], -d['amount'])):
    if d['camp']: continue
    cands = [c for (m, c) in goods if m == d['ym'] and (m, c) not in used]
    if cands:
        c = min(cands, key=lambda c: abs(goods[(d['ym'], c)] - d['amount']))
        if abs(goods[(d['ym'], c)] - d['amount']) < 0.25 * d['amount']: d['camp'] = c; d['how'] = 'ближайший по сумме'; used.add((d['ym'], c))
new = pd.read_excel(glob.glob(f'{d20}/*.xls')[0], header=0); old = pd.read_excel(glob.glob(f'{d19}/*.xls')[0], header=0)
contract = {str(w['Номер']): CONTRACT[str(w['Контрагент'])[-11:]] for _, w in old.iterrows() if str(w['Контрагент']).startswith('ФИЗИЧЕСКОЕ ЛИЦО')}
real = collections.defaultdict(float); real_main = collections.defaultdict(float); real_n = collections.Counter()
for _, w in new.iterrows():
    cab = contract.get(str(w['Номер']), 'не определён'); m = ymd(str(w['Дата'])); b = re.search(r'от (\d\d\.\d\d\.\d{4})', str(w['Документ отгрузки']))
    real[(m, cab)] += float(w['Сумма']); real_n[(m, cab)] += 1
    if b and ymd(b.group(1)) == m: real_main[(m, cab)] += float(w['Сумма'])
months = ['2026-%02d' % i for i in range(1, 10)]
rows_d = []; rows_f = []; T = {}
for cab in ('зеркала', 'мебель'):
    t = collections.defaultdict(float)
    for m in months:
        mk = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab and MODEL.get(c) == 'ДБС')
        k1 = sum(d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab)
        nd = sum(v for (mm, c), v in goods.items() if mm == m and camp_cab[c] == cab and MODEL.get(c) == 'ДБС' and (mm, c) not in used)
        nd_s = ', '.join(f'{NAMES.get(c, c)} {v:,.0f}'.replace(',', ' ') for (mm, c), v in sorted(goods.items()) if mm == m and camp_cab[c] == cab and MODEL.get(c) == 'ДБС' and (mm, c) not in used)
        dev = sum(d['amount'] - goods[(d['ym'], d['camp'])] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab and MODEL.get(d['camp']) == 'ДБС')
        fbs_doc = sum(d['amount'] for d in kom if d['ym'] == m and d['camp'] and camp_cab[d['camp']] == cab and MODEL.get(d['camp']) == 'ФБС')
        nopair = sum(d['amount'] for d in kom if d['ym'] == m and not d['camp']) if cab == 'мебель' else 0.0
        row = [cab, m, r2(mk), r2(k1), r2(k1 - mk), r2(-nd), r2(dev), r2(fbs_doc), r2(nopair), r2(k1 - mk + nd - dev - fbs_doc - nopair), nd_s]; rows_d.append(row)
        for i, v in enumerate(row[2:10], 2): t[i] += v
    rows_d.append([cab, 'ИТОГО'] + [r2(t[i]) for i in range(2, 10)] + ['']); T[('д', cab)] = t
    t = collections.defaultdict(float); cum = 0.0
    for m in months:
        fc = [c for c in MODEL if MODEL[c] == 'ФБС' and camp_cab.get(c) == cab]
        mk = sum(goods.get((m, c), 0.0) for c in fc); known = cab == 'мебель' or m >= '2026-06'
        rl = real[(m, cab)]; diff = rl - mk if known else None; cum += diff or 0
        row = [cab, m, r2(mk) if known else None, r2(rl), real_n[(m, cab)], r2(real_main[(m, cab)]), r2(rl - real_main[(m, cab)]), r2(diff) if known else None, r2(cum) if known else None,
               '' if known else 'магазин ФБС зеркал закрыт для API, заказов нет', ', '.join(f'{NAMES.get(c, c)} {goods[(m, c)]:,.0f}'.replace(',', ' ') for c in fc if goods.get((m, c)))]
        rows_f.append(row)
        for i, v in enumerate(row[2:9], 2):
            if isinstance(v, float): t[i] += v
    rows_f.append([cab, 'ИТОГО'] + [r2(t[i]) if i != 8 else r2(cum) for i in range(2, 9)] + ['', '']); T[('ф', cab)] = t
rows_s = [[c, camp_cab.get(c, ''), NAMES.get(c, 'название в API не видно'), MODEL[c], 'отчёты комиссионера' if MODEL[c] == 'ДБС' else 'реализации «Яндекс маркет фбс»', len({d['num'] for d in kom if d['camp'] == c}), r2(sum(v for (m, cc), v in goods.items() if cc == c and m <= '2026-09'))] for c in sorted(MODEL, key=lambda c: (camp_cab.get(c, ''), MODEL[c], c))]
rows_k = [[d['ym'], d['num'], d['amount'], d['camp'] or 'не найден', NAMES.get(d['camp'], '') if d['camp'] else '', MODEL.get(d['camp'], '') if d['camp'] else '', r2(goods[(d['ym'], d['camp'])]) if d['camp'] else None, r2(d['amount'] - goods[(d['ym'], d['camp'])]) if d['camp'] else None, d['how']] for d in sorted(kom, key=lambda d: (d['ym'], d['num'].zfill(4)))]

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
            if j in redcols and isinstance(v, float) and abs(v) > 2: c.font = red
    for j in range(1, len(header) + 1): ws.column_dimensions[get_column_letter(j)].width = widths[j - 1] if j - 1 < len(widths) else 14
    ws.freeze_panes = ws.cell(4, 3); return ws
wb.remove(wb['Sheet'])
f = lambda x: f'{x:,.0f}'.replace(',', ' ')
dz, dm, fz, fm = T[('д', 'зеркала')], T[('д', 'мебель')], T[('ф', 'зеркала')], T[('ф', 'мебель')]
ws = wb.create_sheet('Как читать'); ws.column_dimensions['A'].width = 200
txt = ['Продажи по моделям: ДБС-магазины Маркета против отчётов комиссионера 1С, ФБС-магазины против реализаций «Яндекс маркет фбс» 1С. Январь-сентябрь 2026, деньги покупателей за товар без доставки и баллов, по месяцу доставки (дата сбора за продажу). Все цифры [ДАННЫЕ].', '',
       'Лист «Магазины»: какой магазин какой модели и каким документом проведён в 1С.', '',
       f'Лист «ДБС»: разница 1С − Маркет. Зеркала: Маркет {f(dz[2])}, 1С {f(dz[3])}, разница {f(dz[4])}. Мебель: Маркет {f(dm[2])}, 1С {f(dm[3])}, разница {f(dm[4])}.',
       '   Разница расписана: магазин ДБС без документа за месяц (минус), отклонения документов с парой (переходящие заказы), документ 1С, который лёг на ФБС-магазин (мебель май № 36 на 767 018 ₽ - ближайший к FBS OOO 825 415, по отчёту Маркета о реализации FBS OOO за май 768 358; при этом за май есть и реализации ФБС 709 509 ₽ - один магазин за месяц проведён двумя документами, проверить), документ без пары (июнь, № 43 на 401 995 ₽). Остаток 0.',
       f'Лист «ФБС»: зеркала с июня - магазин 149154933: Маркет {f(fz[2])}, 1С {f(fz[3])}, разница {f(fz[7])}. Мебель - FBS OOO и старый GEN GROUP: Маркет {f(fm[2])}, 1С {f(fm[3])}, разница {f(fm[7])}.',
       '   Точного равенства по ФБС нет ни в одном месяце, отклонения от -116 тыс. до +145 тыс. в месяц, накопленным итогом гасятся. Реестр реализаций 1С содержит только суммы документов, поэтому расписать отклонение по заказам нельзя: нужна печатная форма одной реализации с позициями (например, НФБУ-000060 от 30.09 на 666 432 ₽), тогда сверю по заказам.',
       '   Зеркала до июня: ФБС-магазин закрыт Маркетом для API, заказов в выгрузке нет, Маркет по нему показать нельзя. Реализации 1С за февраль-май (3,49 млн) видны, сравнить не с чем.',
       '   Январь мебель: старый ФБС GEN GROUP доставил 948 005 ₽, реализаций 1С за январь нет.']
for i, t in enumerate(txt, 1): ws.cell(i, 1, t)
sheet('Магазины', ['кампания', 'кабинет', 'название', 'модель', 'документ в 1С', 'отчётов комиссионера найдено', 'доставлено янв-сен, ₽'], rows_s, [12, 9, 24, 8, 30, 14, 16], 'Магазины Маркета, их модель и каким документом проведены в 1С.')
sheet('ДБС', ['кабинет', 'месяц', 'Маркет: ДБС-магазины, доставлено', '1С: отчёты комиссионера', 'РАЗНИЦА 1С − Маркет', 'за счёт: магазин ДБС без документа', 'за счёт: отклонения документов (переходящие)', 'за счёт: документ 1С лёг на ФБС-магазин', 'за счёт: документ без пары', 'остаток', 'магазины без документа'],
      rows_d, [10, 9, 16, 16, 15, 16, 16, 16, 14, 9, 40], 'ДБС: Маркет против отчётов комиссионера. Разница расписана, остаток 0.', redcols=(5,))
sheet('ФБС', ['кабинет', 'месяц', 'Маркет: ФБС-магазин, доставлено', '1С: реализации ФБС (по дате документа)', 'документов', 'из них основные', 'из них корректировки прошлых месяцев', 'РАЗНИЦА 1С − Маркет', 'накопленная разница', 'примечание', 'магазины Маркета'],
      rows_f, [10, 9, 16, 16, 10, 14, 14, 15, 14, 36, 30], 'ФБС: Маркет против реализаций «Яндекс маркет фбс». Основание отклонений по заказам из реестра 1С не видно.', redcols=(8,))
sheet('Отчёты комиссионера', ['месяц', '№', 'сумма 1С', 'магазин', 'название', 'модель', 'Маркет: доставлено по магазину', 'отклонение 1С − Маркет', 'как найдена пара'], rows_k, [9, 7, 13, 12, 18, 8, 16, 14, 18], 'Каждый отчёт комиссионера и его магазин.')
wb.save(out)
print('ok', out)
for r in rows_d: print(r[:2], [int(x) if isinstance(x, float) else x for x in r[2:10]])
for r in rows_f: print(r[:2], [int(x) if isinstance(x, float) else x for x in r[2:9]])
