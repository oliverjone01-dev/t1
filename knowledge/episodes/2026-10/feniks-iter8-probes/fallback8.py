#!/usr/bin/env python3
"""Independent recomputation of co.day (earliest posting date, rev without cancelled) and the fallback path:
days with export revenue where campaign 28753239 has no API spend row / zero spend, and who else (isCPO by camp_meta) spends that day."""
import json, collections, sys

D = sys.argv[1]
CID = "28753239"
post = collections.defaultdict(list)
for l in open(D + "/orders_daily.ndjson"):
    if l.strip():
        r = json.loads(l)
        o = str(r.get("order") or "")
        post[o[: o.rfind("-")]].append(r)
day = collections.defaultdict(lambda: [0.0, 0.0, 0])
miss = 0
first_vs_min = 0
multi = 0
for l in open(D + "/cpo_orders.ndjson"):
    if not l.strip():
        continue
    r = json.loads(l)
    ps = post.get(str(r["order"]))
    if not ps:
        miss += 1
        continue
    d0 = min(str(p["d"]) for p in ps)
    if len(ps) > 1:
        multi += 1
        if len({str(p["d"]) for p in ps}) > 1:
            first_vs_min += 1 if str(ps[0]["d"]) != d0 else 0
    a = day[d0]
    a[0] += float(r.get("sp") or 0)
    for p in ps:
        if p.get("status") != "cancelled":
            a[1] += float(p.get("revenue") or 0)
            a[2] += int(p.get("units") or 0)
print("cpo orders miss", miss, "orders with >1 posting", multi, "first-in-file != earliest", first_vs_min)
mon = collections.defaultdict(lambda: [0.0, 0.0])
for d, v in day.items():
    mon[d[:7]][0] += v[0]
    mon[d[:7]][1] += v[1]
print("by month (sp by order date, rev):", {k: (round(v[0]), round(v[1])) for k, v in sorted(mon.items())})
print("co.day min/max:", min(day), max(day), "days", len(day))
instr = {}
for f in ("ads_30d.json",):
    for i, v in (json.load(open(D + "/" + f)).get("camp_meta") or {}).items():
        instr[i] = v.get("instr", "")
ap = json.load(open(D + "/ads_periods.json"))
for k in ap:
    for i, v in ((ap[k] or {}).get("camp_meta") or {}).items():
        instr.setdefault(i, v.get("instr", ""))
ads = collections.defaultdict(dict)
for l in open(D + "/ads_daily.ndjson"):
    if l.strip():
        r = json.loads(l)
        ads[str(r["d"])][str(r["id"])] = ads[str(r["d"])].get(str(r["id"]), 0) + float(r.get("sp") or 0)
bad = []
for d in sorted(day):
    if day[d][1] <= 0:
        continue
    row = ads.get(d, {})
    if CID not in row or round(row.get(CID, 0)) == 0:
        others = {i: round(s) for i, s in row.items() if "за заказ" in instr.get(i, "").lower() and i != CID}
        bad.append((d, CID in row, round(row.get(CID, 0)), round(day[d][1]), others))
print("days with export revenue and 28753239 absent/zero:", len(bad))
for b in bad[:20]:
    print("  ", b)
# windowed API spend of CID vs export charges
tot = sum(v[0] for v in day.values())
lo, hi = "2026-06-05", "2026-09-30"
api = sum(row.get(CID, 0) for d, row in ads.items() if lo <= d <= hi)
print("export charges (matched orders)", round(tot, 2), "API", CID, lo, hi, round(api, 2), "diff", round(api - tot, 2))
pre = sum(row.get(CID, 0) for d, row in ads.items() if "2026-06-01" <= d < lo)
print("pre-window spend 01-04.06 of", CID, round(pre, 2))
