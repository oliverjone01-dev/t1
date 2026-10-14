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
wa.save(OUT); print(wa.sheetnames)
