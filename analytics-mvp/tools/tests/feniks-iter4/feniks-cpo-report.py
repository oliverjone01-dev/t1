#!/usr/bin/env python3
"""Which definition gives «Отчет» 14 073 867 for September CPO revenue? Try: orders_daily revenue of CPO postings by status."""
import json, sys, collections
root = sys.argv[1]
nd = [json.loads(l) for l in open(root + "/data/cpo_card_orders.ndjson", encoding="utf-8") if l.strip()]
od = [json.loads(l) for l in open(root + "/data/orders_daily.ndjson", encoding="utf-8") if l.strip()]
cpo_orders = {r["order"] for r in nd}
by = collections.defaultdict(float); byu = collections.defaultdict(int)
for r in od:
    o = r["order"].rsplit("-", 1)[0]
    if o in cpo_orders:
        by[r["status"]] += r["revenue"]; byu[r["status"]] += r["units"]
tot = sum(by.values())
print("orders_daily revenue of CPO orders by status:", {k: round(v) for k, v in by.items()}, "total", round(tot))
print("non-cancelled", round(tot - by.get("cancelled", 0)), "units non-cancelled", sum(byu.values()) - byu.get("cancelled", 0))
# xlsx line totals (rev*n) excluding orders cancelled in orders_daily
canc = {r["order"].rsplit("-", 1)[0] for r in od if r["status"] == "cancelled"}
lt = sum(x["rev"] * x["n"] for x in nd); lt_nc = sum(x["rev"] * x["n"] for x in nd if x["order"] not in canc)
asis_nc = sum(x["rev"] for x in nd if x["order"] not in canc)
print("xlsx line total", round(lt), "line total excl. cancelled", round(lt_nc), "as-is excl. cancelled", round(asis_nc))
# main's report source: look for cpo files
import os
for f in sorted(os.listdir(root + "/data")):
    if "cpo" in f:
        print("data file", f, os.path.getsize(root + "/data/" + f))
