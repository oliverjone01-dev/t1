# v7: один файл для Ивана (14.10 «мне не нужно два файла»): книга «Рост показов» + листы «Цена вниз» и «Клик» из книги варианта 1.
# python3 -I merge_xlsx.py <рост.xlsx> <вариант1.xlsx> <out.xlsx>
import sys, copy
from openpyxl import load_workbook
A, Bf, OUT = sys.argv[1:4]
wa = load_workbook(A); wb = load_workbook(Bf)
for src, dst in (('Цена вниз', 'Цена вниз'), ('Клик', 'Все кампании')):
    s = wb[src]; d = wa.create_sheet(dst, index=3 if dst == 'Цена вниз' else 4)
    for row in s.iter_rows():
        for c in row:
            n = d.cell(row=c.row, column=c.column, value=c.value)
            if c.has_style:
                n.font = copy.copy(c.font); n.fill = copy.copy(c.fill); n.alignment = copy.copy(c.alignment); n.border = copy.copy(c.border)
    for k, dim in s.column_dimensions.items(): d.column_dimensions[k].width = dim.width
    d.freeze_panes = s.freeze_panes
# строка в «Все кампании»: решения по главным товарам и минимальному клику - на листах «Карточки» и «Минимальный клик»
d = wa['Все кампании']; d.insert_rows(1)
d.cell(1, 1, 'Решения по идущим кампаниям: красные - на минимум 15.10; жёлтые - не трогаем до 10.11. Повышение клика главным товарам и новый минимальный клик - листы «Карточки» и «Минимальный клик» (они главнее этого листа). Блок «Волна 2» ниже отменён: его заменяет минимальный клик в 10 карточках.')
e = wa['Этапы']; e.insert_rows(2, 3)
for i, r in enumerate((['15.10 чт, до 10:00', 'Цена вниз, часть 1', '16 артикулов (лист «Цена вниз», дата 15.10)', 'кабинет', 'цена на сайте ниже на 5-10%'],
                       ['22.10 чт', 'Цена вниз, часть 2', '10 артикулов (лист «Цена вниз», дата 22.10)', 'кабинет', 'если тест 4 продлят - 29.10'],
                       ['каждый день', 'Стоп-правило цены', 'артикулы со сниженной ценой', 'Катя', 'выпал из «Эластичного бустинга» - вернуть цену'])):
    for j, v in enumerate(r): e.cell(2 + i, 1 + j, v)
# ---------- единые цвета (Иван 14.10: «выдели чётко разными цветами заголовки, смешано и непонятно»)
from openpyxl.styles import PatternFill, Font
fill = lambda c: PatternFill('solid', fgColor=c)
HEAD, SECT = fill('1F4E78'), fill('D9D9D9')
GREEN, RED, YEL, PUR, BLUE = fill('C6EFCE'), fill('FFC7CE'), fill('FFEB9C'), fill('E4DFEC'), fill('BDD7EE')
old = lambda c: (c.fill.fgColor.rgb or '')[-6:] if c.fill and c.fill.fill_type == 'solid' else ''
LEG = {
    'Цель': 'Цвета: тёмно-синий - заголовок таблицы; серый - раздел.',
    'Этапы': 'Цвета: тёмно-синий - заголовок; фиолетовый - цена; зелёный - реклама вверх; красный - реклама на минимум; жёлтый - проверка и решения.',
    'Карточки': 'Цвета: тёмно-синий - заголовок; зелёный - карточки первой волны (с 15.10), белые - следующие.',
    'Цена вниз': 'Цвета: тёмно-синий - заголовок; фиолетовый - снижаем 15.10; голубой - снижаем 22.10.',
    'Все кампании': 'Цвета: тёмно-синий - заголовок; красный - на минимум 15.10; жёлтый - не трогаем до 10.11; белый - оставляем как есть; зелёный - отменённая волна 2 (не делаем).',
    'Минимальный клик': 'Цвета: тёмно-синий - заголовок; зелёный - включаем 15.10 (первая волна); белые - следующая волна, только если первая прошла порог.',
    'Прогноз': 'Цвета: тёмно-синий - заголовок; серый - раздел.',
    'Пути к 20 млн': 'Цвета: тёмно-синий - заголовок таблицы; серый - раздел.',
}
for ws in wa.worksheets:
    for row in ws.iter_rows():
        o = [old(c) for c in row]
        vals = [c.value for c in row if c.value not in (None, '')]
        if 'DDEBF7' in o:                                        # заголовок таблицы
            for c in row: c.fill = HEAD; c.font = Font(bold=True, color='FFFFFF')
        for c, oc in zip(row, o):
            if oc == 'E2EFDA': c.fill = PUR if ws.title == 'Цена вниз' else GREEN
            elif oc == 'FFF2CC': c.fill = BLUE if ws.title == 'Цена вниз' else YEL
            elif oc == 'FCE4D6': c.fill = RED
    # разделы: строка с одним текстом, жирным
    for row in ws.iter_rows():
        vals = [c for c in row if c.value not in (None, '')]
        if len(vals) == 1 and vals[0].font and vals[0].font.bold and old(vals[0]) != '1F4E78':
            for c in row[:6]: c.fill = SECT
    if ws.title == 'Этапы':
        for row in ws.iter_rows(min_row=2):
            t = str(row[1].value or '')
            f_ = PUR if 'Цена' in t or 'Стоп-правило' in t else GREEN if ('клик' in t.lower() or 'Главным' in t) and 'минимум' not in t and 'Итог' not in t else RED if 'минимум' in t else YEL if t and t != 'Распродажа' else None
            if f_:
                for c in row: c.fill = f_
    ws.insert_rows(1); ws.cell(1, 1, LEG.get(ws.title, '')); ws.cell(1, 1).font = Font(italic=True, bold=True, color='1F4E78')
wa.save(OUT); print(wa.sheetnames)
