#!/usr/bin/env python3
"""xlsx 'Дата' vs Seller API order date for the same posting; and xlsx daily spend vs API daily spend of CPO campaign."""
import json, sys, collections, datetime
root = sys.argv[1]
nd = [json.loads(l) for l in open(root + "/data/cpo_card_orders.ndjson", encoding="utf-8") if l.strip()]
od = [json.loads(l) for l in open(root + "/data/orders_daily.ndjson", encoding="utf-8") if l.strip()]
first = {}
for r in od:
    o = r["order"].rsplit("-", 1)[0]
    first.setdefault(o, set()).add(r["d"])
dd = collections.Counter()
ex = []
for r in nd:
    ds = first.get(r["order"])
    if not ds:
        continue
    d0 = min(ds)
    delta = (datetime.date.fromisoformat(r["d"]) - datetime.date.fromisoformat(d0)).days
    dd[delta] += 1
    if delta != 0 and len(ex) < 6:
        ex.append((r["order"], "xlsx", r["d"], "order date", sorted(ds)))
print("xlsx date minus order date (days):", sorted(dd.items()))
for e in ex:
    print("  ", e)
# daily spend xlsx vs API ads_daily for 28753239
api = collections.defaultdict(float)
for l in open(root + "/data/ads_daily.ndjson", encoding="utf-8"):
    r = json.loads(l)
    if str(r.get("id")) == "28753239" and r["d"].startswith("2026-09"):
        api[r["d"]] += r.get("sp", 0) or 0
xs = collections.defaultdict(float)
for r in nd:
    xs[r["d"]] += r["sp"]
bad = [(d, round(xs.get(d, 0), 2), round(api.get(d, 0), 2)) for d in sorted(set(api) | set(xs)) if abs(xs.get(d, 0) - api.get(d, 0)) > 1.5]
print("days where xlsx spend != API spend (>1.5 rub):", len(bad), bad[:10])
print("sum xlsx %.2f api %.2f" % (sum(xs.values()), sum(api.values())))
