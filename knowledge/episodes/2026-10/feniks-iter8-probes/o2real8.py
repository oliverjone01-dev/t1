#!/usr/bin/env python3
"""Real September export once and twice through both branch collectors, starting from committed outputs; compare bytes.
Also: the same with the main collectors (old code) twice -> doubling expected."""
import filecmp, importlib.util, json, os, shutil, sys, tempfile

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8"
X = S + "/p8/analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx"


def load(p, n):
    s = importlib.util.spec_from_file_location(n, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


def case(sb, copies, tag):
    T = f"{S}/{sb}/analytics-mvp/tools"
    if T + "/cpo" not in sys.path:
        sys.path.insert(0, T + "/cpo")
    root = tempfile.mkdtemp(prefix=f"o2r_{tag}_", dir=S)
    raw, data = os.path.join(root, "raw"), os.path.join(root, "data")
    os.makedirs(raw); os.makedirs(data)
    for i in range(copies):
        shutil.copy(X, os.path.join(raw, "2026-09_cpo_orders.xlsx" if i == 0 else f"2026-09_cpo_orders_re{i}.xlsx"))
    for f in ("cpo_orders.ndjson", "cpo_sku_daily.ndjson"):
        shutil.copy(f"{S}/{sb}/analytics-mvp/data/{f}", os.path.join(data, f))
    jo = load(T + "/orders/build_order_joins.py", f"jo_{tag}")
    jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = raw, os.path.join(data, "cpo_orders.ndjson"), True
    jo.main()
    sk = load(T + "/cpo/build_cpo_sku_daily.py", f"sk_{tag}")
    sk.RAW, sk.OUT = raw, os.path.join(data, "cpo_sku_daily.ndjson")
    sk.main()
    out = {}
    for f in ("cpo_orders.ndjson", "cpo_sku_daily.ndjson"):
        same = filecmp.cmp(os.path.join(data, f), f"{S}/{sb}/analytics-mvp/data/{f}", shallow=False)
        rows = [json.loads(l) for l in open(os.path.join(data, f)) if l.strip()]
        sep = sum(r["sp"] for r in rows if (f == "cpo_sku_daily.ndjson" and str(r["d"]).startswith("2026-09")))
        out[f] = {"bytes_equal_committed": same, "total_sp": round(sum(r["sp"] for r in rows), 2), "sep_sp_sku_daily": round(sep, 2) if sep else None}
    shutil.rmtree(root, ignore_errors=True)
    return out


res = {}
res["p8 once"] = case("p8", 1, "p8x1")
res["p8 twice"] = case("p8", 2, "p8x2")
res["main twice"] = case("mn", 2, "mnx2")
print("=== RESULTS ===")
for k, v in res.items():
    print(k, json.dumps(v, ensure_ascii=False))
