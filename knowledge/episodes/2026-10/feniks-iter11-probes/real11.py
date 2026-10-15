#!/usr/bin/env python3
"""FENIKS iter11 on real data (sandbox p11 = 978821206, temp copies; no writes to the repo).
R1 collector rerun (p11 code) over p11 data/cpo_orders.ndjson + data/raw/ozon-cpo == committed file? any nosku field?
R2 real export: rows without SKU / SKU 0, rows with a date but WITHOUT order number (kept by cpo_raw, dropped by
   build_order_joins, counted by build_cpo_sku_daily).
R3 invariant on committed files: sum(cpo_orders.sp) - sum(nosku) vs sum(cpo_sku_daily.sp)."""
import filecmp, importlib.util, json, os, shutil, sys, tempfile

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
P11 = S + "p11/analytics-mvp"
sys.path.insert(0, P11 + "/tools/cpo")
from cpo_raw import read_raw  # noqa: E402


def load(p, n):
    s = importlib.util.spec_from_file_location(n, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


tmp = tempfile.mkdtemp(prefix="real11_", dir=S)
shutil.copy(P11 + "/data/cpo_orders.ndjson", tmp + "/cpo_orders.ndjson")
jo = load(P11 + "/tools/orders/build_order_joins.py", "jo")
jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = P11 + "/data/raw/ozon-cpo", tmp + "/cpo_orders.ndjson", True
so = sys.stdout
sys.stdout = open(os.devnull, "w")
jo.main()
sys.stdout = so
same = filecmp.cmp(tmp + "/cpo_orders.ndjson", P11 + "/data/cpo_orders.ndjson", shallow=False)
rows_c = [json.loads(l) for l in open(P11 + "/data/cpo_orders.ndjson", encoding="utf-8") if l.strip()]
print("R1 collector rerun (p11 code, committed file + data/raw/ozon-cpo) == committed file:", same,
      "| rows", len(rows_c), "| rows with nosku field", sum(1 for r in rows_c if "nosku" in r))
for raw in (P11 + "/data/raw/ozon-cpo", "/home/user/t1/analytics-mvp/tools/cpo/raw"):
    if not os.path.isdir(raw):
        print("R2", raw, "absent")
        continue
    rows, used, skipped = read_raw(raw)
    nosku = [r for r in rows if not r["sku"] or r["sku"] == "0"]
    noorder = [r for r in rows if not r["order"]]
    print(f"R2 {raw.split('analytics-mvp/')[-1]}: files {[u[0] for u in used]} rows {len(rows)} | without SKU {len(nosku)} "
          f"({round(sum(r['sp'] for r in nosku), 2)} ₽) | with date but without order {len(noorder)} ({round(sum(r['sp'] for r in noorder), 2)} ₽)")
sku = [json.loads(l) for l in open(P11 + "/data/cpo_sku_daily.ndjson", encoding="utf-8") if l.strip()]
a, n, b = sum(float(r["sp"]) for r in rows_c), sum(float(r.get("nosku", 0)) for r in rows_c), sum(float(r["sp"]) for r in sku)
print(f"R3 committed: cpo_orders {round(a, 2)} - nosku {round(n, 2)} = {round(a - n, 2)} vs cpo_sku_daily {round(b, 2)} | |diff| {round(abs(a - n - b), 2)}")
