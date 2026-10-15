# выгрузка листов в текст (в scratch, вне репо)
import sys, os, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); out = sys.argv[2]
for n in wb.sheetnames:
    ws = wb[n]
    lines = []
    for r in range(1, ws.max_row + 1):
        vals = []
        for c in range(1, ws.max_column + 1):
            cell = ws.cell(r, c); v = cell.value
            if v is None: continue
            fill = cell.fill.fgColor.rgb if cell.fill and cell.fill.fill_type else ''
            vals.append(f'{cell.coordinate}={v!r}' + (f'[{fill[-6:]}]' if fill else ''))
        if vals: lines.append(' | '.join(vals))
    with open(os.path.join(out, n + '.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(n, ws.max_row, ws.max_column)
