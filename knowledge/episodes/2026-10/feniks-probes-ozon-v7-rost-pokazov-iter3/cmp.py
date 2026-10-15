# R1: сравнить две книги ячейка в ячейку (значения и заливка)
import sys, openpyxl
a = openpyxl.load_workbook(sys.argv[1]); b = openpyxl.load_workbook(sys.argv[2])
print('sheets a', a.sheetnames); print('sheets b', b.sheetnames)
diff = 0
for n in a.sheetnames:
    if n not in b.sheetnames: print('нет листа', n); continue
    x, y = a[n], b[n]
    R = max(x.max_row, y.max_row); Cn = max(x.max_column, y.max_column)
    for r in range(1, R + 1):
        for c in range(1, Cn + 1):
            v1, v2 = x.cell(r, c).value, y.cell(r, c).value
            f1 = x.cell(r, c).fill.fgColor.rgb if x.cell(r, c).fill and x.cell(r, c).fill.fill_type else None
            f2 = y.cell(r, c).fill.fgColor.rgb if y.cell(r, c).fill and y.cell(r, c).fill.fill_type else None
            if v1 != v2 or f1 != f2:
                diff += 1
                if diff <= 200: print(n, r, c, repr(v1)[:80], '|', repr(v2)[:80], f1, f2)
print('различающихся ячеек', diff)
