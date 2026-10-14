#!/usr/bin/env python3
"""FENIKS iter8 O2 fixtures against the branch collectors (sandbox p8, temp dirs only).
F1 browser duplicate name: '2026-09_cpo_orders.xlsx' (first download: A=100, B=50) and '2026-09_cpo_orders (1).xlsx'
   (second, corrected download: A=100, C=70). Which file wins?
F2 stale order: previous outputs hold Sep orders A=100, B=50; new Sep re-export holds A only.
   cpo_sku_daily rewrites the window; does cpo_orders.ndjson drop B?
F3 cross-month order: previous outputs hold order X=80 dated 31.08 (August export); September export holds X=20 dated 01.09.
   cpo_sku_daily keeps 31.08 (outside window) + 01.09; what does cpo_orders.ndjson keep for X?
"""
import importlib.util, json, os, shutil, sys, tempfile
import openpyxl

T = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8/p8/analytics-mvp/tools"
sys.path.insert(0, T + "/cpo")
from cpo_raw import read_raw  # noqa: E402

HDR = ["Дата", "ID заказа", "Номер заказа", "SKU", "Артикул", "Расход, ₽"]


def xlsx(path, period, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Statistics"
    ws.append([f"Период: {period}"])
    ws.append(["Оплата за заказ (все товары). Отчёт по заказам"])
    ws.append(HDR)
    for r in rows:
        ws.append(r)
    wb.save(path)


def load(p, n):
    s = importlib.util.spec_from_file_location(n, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


def run(raw, data):
    jo = load(T + "/orders/build_order_joins.py", "jo")
    jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = raw, os.path.join(data, "cpo_orders.ndjson"), True
    jo.main()
    sk = load(T + "/cpo/build_cpo_sku_daily.py", "sk")
    sk.RAW, sk.OUT = raw, os.path.join(data, "cpo_sku_daily.ndjson")
    sk.main()
    co = {r["order"]: r["sp"] for r in map(json.loads, open(jo.OUT_CPO))}
    sd = [json.loads(l) for l in open(sk.OUT)]
    return co, sd


def nd(path, rows):
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


root = tempfile.mkdtemp(prefix="fz8o2_", dir="/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8")
res = {}
try:
    # F1
    raw = os.path.join(root, "f1raw"); os.makedirs(raw)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026",
         [["03.09.2026", "1", "A-1", 111, "GGM-01", 100.0], ["10.09.2026", "2", "B-1", 222, "GGM-02", 50.0]])
    xlsx(os.path.join(raw, "2026-09_cpo_orders (1).xlsx"), "01.09.2026 - 30.09.2026",
         [["03.09.2026", "1", "A-1", 111, "GGM-01", 100.0], ["12.09.2026", "3", "C-1", 333, "GGM-03", 70.0]])
    rows, used, _ = read_raw(raw)
    res["F1"] = {"order_of_files": [u[0] for u in used], "rows_taken": [(u[0], u[2], u[3]) for u in used],
                 "orders": sorted({r["order"] for r in rows}), "total": sum(r["sp"] for r in rows)}
    # F2
    raw = os.path.join(root, "f2raw"); os.makedirs(raw)
    data = os.path.join(root, "f2data"); os.makedirs(data)
    nd(os.path.join(data, "cpo_orders.ndjson"), [{"order": "A-1", "sp": 100.0}, {"order": "B-1", "sp": 50.0}])
    nd(os.path.join(data, "cpo_sku_daily.ndjson"), [{"d": "2026-09-03", "sku": "111", "offer": "GGM-01", "sp": 100.0, "n": 1},
                                                    {"d": "2026-09-10", "sku": "222", "offer": "GGM-02", "sp": 50.0, "n": 1}])
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [["03.09.2026", "1", "A-1", 111, "GGM-01", 100.0]])
    co, sd = run(raw, data)
    res["F2"] = {"cpo_orders": co, "cpo_orders_total": sum(co.values()), "sku_daily_total": sum(r["sp"] for r in sd)}
    # F3
    raw = os.path.join(root, "f3raw"); os.makedirs(raw)
    data = os.path.join(root, "f3data"); os.makedirs(data)
    nd(os.path.join(data, "cpo_orders.ndjson"), [{"order": "X-1", "sp": 80.0}])
    nd(os.path.join(data, "cpo_sku_daily.ndjson"), [{"d": "2026-08-31", "sku": "111", "offer": "GGM-01", "sp": 80.0, "n": 1}])
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [["01.09.2026", "1", "X-1", 222, "GGM-02", 20.0]])
    co, sd = run(raw, data)
    res["F3"] = {"cpo_orders": co, "cpo_orders_total": sum(co.values()), "sku_daily_total": sum(r["sp"] for r in sd)}
finally:
    shutil.rmtree(root, ignore_errors=True)
print("=== RESULTS ===")
for k, v in res.items():
    print(k, json.dumps(v, ensure_ascii=False))
