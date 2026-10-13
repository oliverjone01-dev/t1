#!/usr/bin/env python3
"""Fixture: Ivan re-exports September (same window) where one row changed (e.g. cancelled order re-priced).
Does build_cpo_card_orders.py double count? Runs the converter from b243b28 inside a /tmp sandbox."""
import os, subprocess, json, shutil
import openpyxl
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad/feniks-conv"
REPO = "/home/user/t1"
for sub in ("tools/cpo", "data/raw/ozon-cpo"):
    os.makedirs(os.path.join(S, "analytics-mvp", sub), exist_ok=True)
conv = os.path.join(S, "analytics-mvp/tools/cpo/build_cpo_card_orders.py")
open(conv, "wb").write(subprocess.run(["git", "-C", REPO, "show", "b243b28:analytics-mvp/tools/cpo/build_cpo_card_orders.py"], capture_output=True).stdout)
x1 = os.path.join(S, "analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx")
open(x1, "wb").write(subprocess.run(["git", "-C", REPO, "show", "b243b28:analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx"], capture_output=True).stdout)
# second export of the same month: identical except one row's Расход (and nothing else)
wb = openpyxl.load_workbook(x1)
ws = wb.worksheets[0]
ws.cell(row=10, column=13).value = 0  # row 10 (data row 7): Расход -> 0 (e.g. refund after cancellation)
x2 = os.path.join(S, "analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders_reexport.xlsx")
wb.save(x2)
r = subprocess.run(["python3", conv], capture_output=True, text=True)
print(r.stdout[-600:], r.stderr[-300:])
rows = [json.loads(l) for l in open(os.path.join(S, "analytics-mvp/data/cpo_card_orders.ndjson"), encoding="utf-8")]
print("rows", len(rows), "rev", sum(x["rev"] for x in rows), "n", sum(x["n"] for x in rows), "orders", len({x["order"] for x in rows}))
print("expected for one September: rows 191 rev 14992062 n 201 orders 190")
