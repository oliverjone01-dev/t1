#!/usr/bin/env python3
"""Where camp_meta for the export campaign comes from; windows of orders_daily and ads_daily."""
import json, sys

D = sys.argv[1]
ap = json.load(open(D + "/ads_periods.json"))
print("ads_periods keys:", list(ap.keys())[:30])
for k in list(ap.keys())[:30]:
    v = ap[k] or {}
    cm = v.get("camp_meta") or {}
    print(" ", k, "from/to:", v.get("dateFrom"), v.get("dateTo"), "| camp_meta n:", len(cm), "| 28753239:", "28753239" in cm, "| 22421802:", "22421802" in cm)
a30 = json.load(open(D + "/ads_30d.json"))
cm = a30.get("camp_meta") or {}
print("ads_30d from/to:", a30.get("dateFrom"), a30.get("dateTo"), "| camp_meta n:", len(cm), "| 28753239:", "28753239" in cm)
print("ads_30d keys:", list(a30.keys())[:20])
ds = [json.loads(l)["d"] for l in open(D + "/orders_daily.ndjson") if l.strip()]
print("orders_daily rows", len(ds), "min", min(ds), "max", max(ds))
ad = [json.loads(l)["d"] for l in open(D + "/ads_daily.ndjson") if l.strip()]
print("ads_daily rows", len(ad), "min", min(ad), "max", max(ad))
