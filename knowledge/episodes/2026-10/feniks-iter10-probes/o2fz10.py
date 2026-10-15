#!/usr/bin/env python3
"""FENIKS iter10 collector probes against the branch collectors (sandbox p9, temp dirs only; nothing in the repo).
F1  iter8 fixture verbatim: '2026-09_cpo_orders.xlsx' (A=100, B=50) + '2026-09_cpo_orders (1).xlsx' (A=100, C=70) -> expect 170.
F1x same class, other browsers / OS copy names: Firefox 'x(1).xlsx', Safari 'x-1.xlsx', Finder 'x 2.xlsx', 'x copy.xlsx'.
F2L iter8 fixture verbatim (LEGACY prior cpo_orders without d): prior A=100, B=50; Sep re-export holds A only.
F3L iter8 fixture verbatim (LEGACY prior): prior X=80 (31.08 in sku_daily); Sep export X=20 on 01.09.
F2N/F3N same with prior rows in the NEW format (with d), as in the author's test.
"""
import importlib.util, json, os, shutil, sys, tempfile
import openpyxl

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10"
T = S + "/p10/analytics-mvp/tools"
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
    co = {}
    for r in map(json.loads, open(jo.OUT_CPO)):
        co[r["order"]] = round(co.get(r["order"], 0) + r["sp"], 2)
    sd = [json.loads(l) for l in open(sk.OUT)]
    return co, sd


def nd(path, rows):
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


root = tempfile.mkdtemp(prefix="fz10o2_", dir=S)
res = {}
A1 = ["03.09.2026", "1", "A-1", 111, "GGM-01", 100.0]
B1 = ["10.09.2026", "2", "B-1", 222, "GGM-02", 50.0]
C1 = ["12.09.2026", "3", "C-1", 333, "GGM-03", 70.0]
# F1 and F1x
for tag, second in (("F1 chrome ' (1)'", "2026-09_cpo_orders (1).xlsx"), ("F1x firefox '(1)'", "2026-09_cpo_orders(1).xlsx"),
                    ("F1x safari '-1'", "2026-09_cpo_orders-1.xlsx"), ("F1x finder ' 2'", "2026-09_cpo_orders 2.xlsx"),
                    ("F1x finder ' copy'", "2026-09_cpo_orders copy.xlsx")):
    raw = tempfile.mkdtemp(dir=root)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [A1, B1])
    xlsx(os.path.join(raw, second), "01.09.2026 - 30.09.2026", [A1, C1])
    rows, used, _ = read_raw(raw)
    res[tag] = {"order_of_files": [u[0] for u in used], "orders": sorted({r["order"] for r in rows}),
                "total": sum(r["sp"] for r in rows), "verdict": "PASS (corrected wins)" if sum(r["sp"] for r in rows) == 170 else "FAIL (first download wins)"}
# F2 / F3 legacy and new
cases = {
    "F2L legacy prior": ([{"order": "A-1", "sp": 100.0}, {"order": "B-1", "sp": 50.0}],
                         [{"d": "2026-09-03", "sku": "111", "offer": "GGM-01", "sp": 100.0, "n": 1}, {"d": "2026-09-10", "sku": "222", "offer": "GGM-02", "sp": 50.0, "n": 1}],
                         [A1]),
    "F2N new prior": ([{"order": "A-1", "d": "2026-09-03", "sp": 100.0}, {"order": "B-1", "d": "2026-09-10", "sp": 50.0}],
                      [{"d": "2026-09-03", "sku": "111", "offer": "GGM-01", "sp": 100.0, "n": 1}, {"d": "2026-09-10", "sku": "222", "offer": "GGM-02", "sp": 50.0, "n": 1}],
                      [A1]),
    "F3L legacy prior": ([{"order": "X-1", "sp": 80.0}], [{"d": "2026-08-31", "sku": "111", "offer": "GGM-01", "sp": 80.0, "n": 1}],
                         [["01.09.2026", "1", "X-1", 222, "GGM-02", 20.0]]),
    "F3N new prior": ([{"order": "X-1", "d": "2026-08-31", "sp": 80.0}], [{"d": "2026-08-31", "sku": "111", "offer": "GGM-01", "sp": 80.0, "n": 1}],
                      [["01.09.2026", "1", "X-1", 222, "GGM-02", 20.0]]),
}
for tag, (prev_o, prev_s, rows_x) in cases.items():
    raw = tempfile.mkdtemp(dir=root)
    data = tempfile.mkdtemp(dir=root)
    nd(os.path.join(data, "cpo_orders.ndjson"), prev_o)
    nd(os.path.join(data, "cpo_sku_daily.ndjson"), prev_s)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", rows_x)
    co, sd = run(raw, data)
    res[tag] = {"cpo_orders": co, "cpo_orders_total": round(sum(co.values()), 2), "sku_daily_total": round(sum(r["sp"] for r in sd), 2),
                "agree": round(sum(co.values()), 2) == round(sum(r["sp"] for r in sd), 2)}
print("=== RESULTS ===")
for k, v in res.items():
    print(k, json.dumps(v, ensure_ascii=False))
