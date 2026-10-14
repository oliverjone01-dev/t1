#!/usr/bin/env python3
"""FENIKS iter7: «Период:» header of the committed CPO export (read-only)."""
import openpyxl, os

P = "/home/user/t1/analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx"
wb = openpyxl.load_workbook(P, read_only=True)
for ws in wb.worksheets:
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        s = " | ".join(str(c) for c in row if c is not None)
        if "Период" in s or i in (0, 1, 2):
            print(ws.title, i, s[:200])
        if i >= 8:
            break
R = "/home/user/t1/analytics-mvp/tools/cpo/raw"
print("tools/cpo/raw exists:", os.path.isdir(R), sorted(os.listdir(R))[:6] if os.path.isdir(R) else "")
