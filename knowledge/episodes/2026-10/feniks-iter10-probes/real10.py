#!/usr/bin/env python3
"""FENIKS iter10: real data checks in sandboxes (nothing in the repo).
R1 migration: p10 data/cpo_orders.ndjson vs main (p9m): rows with d, total, per-order sums; collector rerun from data/raw/ozon-cpo
   in a temp copy (build_order_joins --cpo-only on the MAIN file) must give the committed p10 file byte-for-byte.
R2 SKU-less rows in the real export (build_cpo_sku_daily.py:47 skips them, cpo_orders keeps them -> invariant would fire).
R3 charge month (cpo_orders d) vs order month (earliest posting in orders_daily) for rows with d: cross-month orders.
R4 orders_daily span (legacy rows without d hide ALL months if their order goes missing)."""
import collections, importlib.util, json, os, shutil, subprocess, sys, tempfile

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10"
P10, P9 = S + "/p10/analytics-mvp", S + "/p9m/analytics-mvp"


def nd(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


new, old = nd(P10 + "/data/cpo_orders.ndjson"), nd(P9 + "/data/cpo_orders.ndjson")
agg = lambda rows: {k: round(v, 2) for k, v in collections.Counter({}).items()} or _agg(rows)


def _agg(rows):
    a = collections.defaultdict(float)
    for r in rows:
        a[str(r["order"])] += float(r["sp"])
    return {k: round(v, 2) for k, v in a.items()}


an, ao = _agg(new), _agg(old)
print("R1 rows new", len(new), "with d", sum(1 for r in new if r.get("d")), "| old", len(old), "with d", sum(1 for r in old if r.get("d")))
print("R1 total new", round(sum(float(r["sp"]) for r in new), 2), "old", round(sum(float(r["sp"]) for r in old), 2),
      "| orders new", len(an), "old", len(ao), "| per-order sums differ:", sum(1 for k in set(an) | set(ao) if abs(an.get(k, 0) - ao.get(k, 0)) > 0.005))
sku = nd(P10 + "/data/cpo_sku_daily.ndjson")
print("R1 cpo_sku_daily p10 == main:", open(P10 + "/data/cpo_sku_daily.ndjson", "rb").read() == open(P9 + "/data/cpo_sku_daily.ndjson", "rb").read(),
      "| sum", round(sum(float(r["sp"]) for r in sku), 2))
# collector rerun on a temp copy of main's data
tmp = tempfile.mkdtemp(prefix="real10_", dir=S)
shutil.copytree(P9 + "/data", tmp + "/data", symlinks=True, ignore=shutil.ignore_patterns("raw"))
T = P10 + "/tools"
sys.path.insert(0, T + "/cpo")
spec = importlib.util.spec_from_file_location("jo", T + "/orders/build_order_joins.py")
jo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jo)
jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = P10 + "/data/raw/ozon-cpo", tmp + "/data/cpo_orders.ndjson", True
try:
    jo.main()
except SystemExit as e:
    print("collector exit", e.code)
same = open(tmp + "/data/cpo_orders.ndjson", "rb").read() == open(P10 + "/data/cpo_orders.ndjson", "rb").read()
print("R1 collector rerun (p10 code, main file + data/raw/ozon-cpo) == committed p10 file:", same)
from cpo_raw import read_raw  # noqa: E402

rows, used, skipped = read_raw(P10 + "/data/raw/ozon-cpo")
print("R2 raw files used", [u[0] for u in used], "skipped", skipped, "| rows", len(rows))
nos = [r for r in rows if not r["sku"] or str(r["sku"]) == "0"]
print("R2 rows without SKU or SKU 0:", len(nos), "sp", round(sum(r["sp"] for r in nos), 2))
# R3 charge month vs order month
first = {}
for r in nd(P10 + "/data/orders_daily.ndjson"):
    o = str(r.get("order") or "")
    k = o[: o.rfind("-")]
    first[k] = min(first.get(k, "9999"), str(r["d"]))
lag = collections.Counter()
cross = []
for r in new:
    if not r.get("d"):
        continue
    f = first.get(str(r["order"]))
    if not f:
        continue
    from datetime import date
    dd = (date.fromisoformat(r["d"]) - date.fromisoformat(f)).days
    lag[dd] += 1
    if r["d"][:7] != f[:7]:
        cross.append((r["order"], f, r["d"], r["sp"]))
print("R3 rows with d:", sum(lag.values()), "lag charge-minus-order days:", sorted(lag.items())[:12])
print("R3 cross-month (charge month != order month):", len(cross), "sp", round(sum(c[3] for c in cross), 2), cross[:5])
ods = sorted(first.values())
print("R4 orders_daily earliest posting", ods[0], "latest", ods[-1], "| legacy rows without d:", sum(1 for r in new if not r.get("d")),
      "orders", len({str(r['order']) for r in new if not r.get('d')}))
