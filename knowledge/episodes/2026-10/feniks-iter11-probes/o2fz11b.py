#!/usr/bin/env python3
"""FENIKS iter11: acceptance of N3 (Ivan 15.10 invariant) and N4 on the AUDITED collectors and module (sandbox p10, temp dirs).
N3a my iter8/iter9 fixtures F2L, F3L verbatim (prior cpo_orders rows WITHOUT d) -> collectors -> cpoExportCampaign: expect err.
N3b same with prior rows WITH d (F2N, F3N) -> expect no invariant error (other errors allowed: no ads files in the fixture).
N3c legit export with one SKU-less row (SKU 0): collectors -> invariant fires? (build_cpo_sku_daily.py:47 skips SKU 0).
N4a names: ' (1)', '(1)', '-1', ' 2', ' copy', ' - копия', ' - Copy' (Windows EN), ' copy 2' after ' copy', ' (10)' after ' (2)'.
N4b same period, same content, different non-copy names -> no doubling (total once).
N4c same period, different content, non-copy names -> refusal."""
import importlib.util, json, os, subprocess, sys, tempfile
import openpyxl

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11"
T = S + "/p11/analytics-mvp/tools"
TSX = S + "/p11/analytics-mvp/node_modules/tsx/dist/cli.mjs"
CHK = "/home/user/t1/knowledge/episodes/2026-10/feniks-iter11-probes/chk11.mts"
sys.path.insert(0, T + "/cpo")
from cpo_raw import read_raw, CpoRawError  # noqa: E402

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


def nd(path, rows):
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def collect(raw, data):
    jo = load(T + "/orders/build_order_joins.py", "jo")
    jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = raw, os.path.join(data, "cpo_orders.ndjson"), True
    jo.main()
    sk = load(T + "/cpo/build_cpo_sku_daily.py", "sk")
    sk.RAW, sk.OUT = raw, os.path.join(data, "cpo_sku_daily.ndjson")
    sk.main()


root = tempfile.mkdtemp(prefix="fz11b_", dir=S)
A1 = ["03.09.2026", "1", "A-1", 111, "GGM-01", 100.0]
B1 = ["10.09.2026", "2", "B-1", 222, "GGM-02", 50.0]
C1 = ["12.09.2026", "3", "C-1", 333, "GGM-03", 70.0]
POST = [{"order": o + "-1", "d": d, "revenue": 1000, "units": 1, "status": "delivered"} for o, d in
        (("A-1", "2026-09-03"), ("B-1", "2026-09-10"), ("C-1", "2026-09-12"), ("X-1", "2026-08-31"))]
cases = {
    "N3a F2L legacy prior": ([{"order": "A-1", "sp": 100.0}, {"order": "B-1", "sp": 50.0}],
                             [{"d": "2026-09-03", "sku": "111", "offer": "GGM-01", "sp": 100.0, "n": 1}, {"d": "2026-09-10", "sku": "222", "offer": "GGM-02", "sp": 50.0, "n": 1}], [A1]),
    "N3a F3L legacy prior": ([{"order": "X-1", "sp": 80.0}], [{"d": "2026-08-31", "sku": "111", "offer": "GGM-01", "sp": 80.0, "n": 1}],
                             [["01.09.2026", "1", "X-1", 222, "GGM-02", 20.0]]),
    "N3b F2N new prior": ([{"order": "A-1", "d": "2026-09-03", "sp": 100.0}, {"order": "B-1", "d": "2026-09-10", "sp": 50.0}],
                          [{"d": "2026-09-03", "sku": "111", "offer": "GGM-01", "sp": 100.0, "n": 1}, {"d": "2026-09-10", "sku": "222", "offer": "GGM-02", "sp": 50.0, "n": 1}], [A1]),
    "N3b F3N new prior": ([{"order": "X-1", "d": "2026-08-31", "sp": 80.0}], [{"d": "2026-08-31", "sku": "111", "offer": "GGM-01", "sp": 80.0, "n": 1}],
                          [["01.09.2026", "1", "X-1", 222, "GGM-02", 20.0]]),
    "N3c SKU 0 row in a legit export": ([], [], [A1, ["11.09.2026", "2", "B-1", 0, "", 50.0]]),
    "N3e SKU empty row in a legit export": ([], [], [A1, ["11.09.2026", "2", "B-1", None, None, 50.0]]),
    "N3f SKU 0 row of an order that also has a SKU row (same day)": ([], [], [A1, ["03.09.2026", "1", "A-1", 0, "", 40.0]]),
    "N3g SKU 0 row plus a stale legacy row": ([{"order": "Z-1", "sp": 30.0}], [], [A1, ["11.09.2026", "2", "B-1", 0, "", 50.0]]),
    "N3d row with SKU but without order number": ([], [], [A1, ["11.09.2026", "", "", 222, "GGM-02", 50.0]]),
}
dirs = []
for tag, (prev_o, prev_s, rows_x) in cases.items():
    raw, data = tempfile.mkdtemp(dir=root), tempfile.mkdtemp(dir=root, prefix=tag.split()[0] + "_" + tag.split()[1] + "_")
    nd(os.path.join(data, "cpo_orders.ndjson"), prev_o)
    nd(os.path.join(data, "cpo_sku_daily.ndjson"), prev_s)
    nd(os.path.join(data, "orders_daily.ndjson"), POST)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", rows_x)
    collect(raw, data)
    dirs.append((tag, data))
out = subprocess.run(["node", TSX, CHK, *[d for _, d in dirs]], capture_output=True, text=True)
print("=== N3 (cpoExportCampaign on collector output) ===")
for (tag, _), line in zip(dirs, out.stdout.strip().splitlines()):
    j = json.loads(line)
    print(tag, "| cpo_orders", j["spAll"], "sku", j["skuSp"], "nosku", j.get("noSkuSp"), "| err:", (j["err"] or "-")[:170])
if out.returncode:
    print("chk11 rc", out.returncode, out.stderr[-500:])
print("=== N4 names ===")
for second in ["2026-09_cpo_orders (1).xlsx", "2026-09_cpo_orders(1).xlsx", "2026-09_cpo_orders-1.xlsx", "2026-09_cpo_orders 2.xlsx",
               "2026-09_cpo_orders copy.xlsx", "2026-09_cpo_orders - копия.xlsx", "2026-09_cpo_orders - Copy.xlsx"]:
    raw = tempfile.mkdtemp(dir=root)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [A1, B1])
    xlsx(os.path.join(raw, second), "01.09.2026 - 30.09.2026", [A1, C1])
    try:
        rows, used, _ = read_raw(raw)
        print(f"N4a {second!r}: total", sum(r["sp"] for r in rows), "order", [u[0] for u in used])
    except CpoRawError as e:
        print(f"N4a {second!r}: REFUSED", str(e)[:140])
for first, second in (("2026-09_cpo_orders copy.xlsx", "2026-09_cpo_orders copy 2.xlsx"), ("2026-09_cpo_orders (2).xlsx", "2026-09_cpo_orders (10).xlsx")):
    raw = tempfile.mkdtemp(dir=root)
    xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [A1])
    xlsx(os.path.join(raw, first), "01.09.2026 - 30.09.2026", [A1, B1])
    xlsx(os.path.join(raw, second), "01.09.2026 - 30.09.2026", [A1, C1])
    rows, used, _ = read_raw(raw)
    print(f"N4a {first!r} then {second!r}: total", sum(r["sp"] for r in rows), "(expect 170: the later copy wins)", [u[0] for u in used])
raw = tempfile.mkdtemp(dir=root)
xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [A1, B1])
xlsx(os.path.join(raw, "sentyabr.xlsx"), "01.09.2026 - 30.09.2026", [A1, B1])
rows, used, _ = read_raw(raw)
print("N4b same content, other name: total", sum(r["sp"] for r in rows), "(expect 150)", [u[0] for u in used])
raw = tempfile.mkdtemp(dir=root)
xlsx(os.path.join(raw, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [A1, B1])
xlsx(os.path.join(raw, "sentyabr.xlsx"), "01.09.2026 - 30.09.2026", [A1, C1])
try:
    read_raw(raw)
    print("N4c different content: NOT refused")
except CpoRawError as e:
    print("N4c different content: REFUSED", str(e)[:160])
