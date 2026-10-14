#!/usr/bin/env python3
"""Rows with Количество >= 2: is 'Стоимость продажи, ₽' a unit price or a line total? Check against Расход and Ставка."""
import sys
import openpyxl
root = sys.argv[1]
ws = openpyxl.load_workbook(root + "/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx", read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
H = [str(h or "") for h in rows[2]]
ix = {h: i for i, h in enumerate(H)}
tot_line = tot_unit = 0.0
spend_check_unit = spend_check_line = 0
multi = 0
for r in rows[3:]:
    if not r or not r[ix["Номер заказа"]]:
        continue
    n = r[ix["Количество"]]; sale = r[ix["Стоимость продажи, ₽"]]; cost = r[ix["Стоимость, ₽"]]
    pct = r[ix["Ставка, %"]]; bid = r[ix["Ставка, ₽"]]; sp = r[ix["Расход, ₽"]]
    tot_line += sale; tot_unit += sale * n
    # Which interpretation reproduces Расход?
    if abs(sp - bid * n) < 0.02:
        spend_check_unit += 1
    if abs(sp - bid) < 0.02:
        spend_check_line += 1
    if n >= 2:
        multi += 1
        print({k: r[ix[k]] for k in ("Дата", "Номер заказа", "SKU", "Артикул", "Количество", "Стоимость продажи, ₽", "Стоимость, ₽", "Ставка, %", "Ставка, ₽", "Расход, ₽")})
print("rows with n>=2:", multi)
print("Расход == Ставка₽ x Количество:", spend_check_unit, "| Расход == Ставка₽:", spend_check_line)
print("revenue as-is %.0f, revenue x Количество %.0f, delta %.0f" % (tot_line, tot_unit, tot_unit - tot_line))
