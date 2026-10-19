# ФЕНИКС 14.10, аудит OZON v6: тексты книги - длинное тире, «верхняя граница», метки, ссылки на ячейки (B4, B5).
# python3 -I -B p_text.py <xlsx>
import sys, openpyxl
EMD = chr(0x2014)
wb = openpyxl.load_workbook(sys.argv[1])
wv = openpyxl.load_workbook(sys.argv[1], data_only=True)
texts = [(ws.title, c.coordinate, c.value) for ws in wb.worksheets for row in ws.iter_rows() for c in row
         if isinstance(c.value, str) and not c.value.startswith('=')]
allt = '\n'.join(t for *_, t in texts)
print('текстовых ячеек', len(texts), '| длинных тире:', allt.count(EMD))
for pat in ['верхн', 'граница', 'осторожная оценка', 'ШИРОКИЙ', 'к выплате', '9 из 26', 'перетяг', 'эластичн', 'строка 32', 'больше 30 млн']:
    print(f'{pat!r}:', [(sh, co) for sh, co, t in texts if pat in t])
for sh, ref in [('Прогноз', 'I4'), ('Прогноз', 'F6'), ('Рычаги', 'D22'), ('Прогноз', 'A40'), ('Чувствительность', 'A1'), ('Итог', 'A7'), ('Итог', 'A23'), ('Допущения', 'F7'), ('Допущения', 'F32'), ('Допущения', 'F48'), ('Рычаги', 'A25')]:
    print(f'{sh}!{ref}:', repr(wv[sh][ref].value)[:200])
