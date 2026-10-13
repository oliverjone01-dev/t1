#!/usr/bin/env python3
"""Print {date: [rev_as_converter, units, rev_line_total]} from the CPO xlsx, as JSON (input for the browser probe)."""
import json, sys, collections
import openpyxl
root = sys.argv[1]
ws = openpyxl.load_workbook(root + "/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx", read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
H = [str(h or "") for h in rows[2]]
ix = {h: i for i, h in enumerate(H)}
out = collections.defaultdict(lambda: [0, 0, 0])
for r in rows[3:]:
    if not r or not r[ix["Номер заказа"]]:
        continue
    dd, mm, yy = str(r[ix["Дата"]]).split(".")
    d = f"{yy}-{mm}-{dd}"
    out[d][0] += r[ix["Стоимость продажи, ₽"]]
    out[d][1] += r[ix["Количество"]]
    out[d][2] += r[ix["Стоимость, ₽"]]
print(json.dumps(out))
