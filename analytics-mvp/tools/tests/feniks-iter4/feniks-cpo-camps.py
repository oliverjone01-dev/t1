#!/usr/bin/env python3
"""How many CPO ('за заказ') campaigns have spend per month in ads_daily; what API gives for o/om on them."""
import json, re, sys, collections
root = sys.argv[1]
# CAMP_META lives in the built page; extract from the tab
s = open(root + "/public/katya-reklama-kartochki.html", encoding="utf-8").read()
m = re.search(r"CAMP_META=(\{.*?\});", s)
meta = json.loads(m.group(1)) if m else {}
cpo_ids = {k for k, v in meta.items() if re.search("за заказ", str(v.get("instr", "")), re.I)}
print("CAMP_META campaigns", len(meta), "CPO by instr:", sorted(cpo_ids))
agg = collections.defaultdict(lambda: [0.0, 0, 0.0, 0])
for line in open(root + "/data/ads_daily.ndjson", encoding="utf-8"):
    r = json.loads(line)
    cid = str(r.get("id"))
    if cid in cpo_ids:
        k = (r["d"][:7], cid)
        a = agg[k]
        a[0] += r.get("sp", 0) or 0
        a[1] += r.get("o", 0) or 0
        a[2] += r.get("om", 0) or 0
        a[3] += 1
for k in sorted(agg):
    a = agg[k]
    print(k, "spend %.2f orders %d om %.2f days %d" % tuple(a))
