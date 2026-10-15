# B3: уникальность ключей в листах (кампании, артикулы минимального клика, артикулы цены), пересечения между листами
import sys, openpyxl, collections as C
wb = openpyxl.load_workbook(sys.argv[1])
def col(ws, c, r0):
    return [ws.cell(r, c).value for r in range(r0, ws.max_row + 1) if ws.cell(r, c).value not in (None, '')]
camps = [str(x) for x in col(wb['Все кампании'], 2, 4) if str(x).isdigit()]
mk = col(wb['Минимальный клик'], 2, 3); mk_wave1 = [wb['Минимальный клик'].cell(r, 2).value for r in range(3, wb['Минимальный клик'].max_row + 1)
                                                   if wb['Минимальный клик'].cell(r, 1).fill.fill_type == 'solid' and wb['Минимальный клик'].cell(r, 2).value]
price = col(wb['Цена вниз'], 2, 3)[:-0 or None]
price = [x for x in price if isinstance(x, str) and x.startswith('G')]
mains = [x for x in col(wb['Карточки'], 2, 3)]
print('кампаний', len(camps), 'уникальных', len(set(camps)))
print('мин. клик строк', len(mk), 'уникальных', len(set(mk)), 'из них волна 1 (зелёные)', len(mk_wave1), 'уникальных', len(set(mk_wave1)))
print('цена вниз', len(price), 'уникальных', len(set(price)))
print('главные (Карточки)', len(mains), 'уникальных', len(set(mains)))
print('мин. клик волны 1, которые есть в «Цене вниз»:', sorted(set(mk_wave1) & set(price)))
print('мин. клик волны 1, которые главные:', sorted(set(mk_wave1) & set(mains)))
camp_arts = [str(wb['Все кампании'].cell(r, 3).value) for r in range(4, wb['Все кампании'].max_row + 1)]
print('мин. клик волны 1, у которых уже есть кампания в «Все кампании»:', sorted(set(mk_wave1) & set(camp_arts)))
