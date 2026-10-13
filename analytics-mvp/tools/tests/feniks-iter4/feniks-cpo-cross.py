#!/usr/bin/env python3
"""Cross-family check: CPO xlsx (Performance cabinet) vs orders_daily (Seller API postings) per order and SKU.
Also: xlsx orders vs main's cpo_orders.ndjson (same-family, just for consistency)."""
import json, sys, collections
root = sys.argv[1]
nd = [json.loads(l) for l in open(root + "/data/cpo_card_orders.ndjson", encoding="utf-8") if l.strip()]
od = [json.loads(l) for l in open(root + "/data/orders_daily.ndjson", encoding="utf-8") if l.strip()]
co = {}
for l in open(root + "/data/cpo_orders.ndjson", encoding="utf-8"):
    if l.strip():
        r = json.loads(l); co[r["order"]] = co.get(r["order"], 0) + float(r["sp"])
# orders_daily: posting "ORDER-N" -> order "ORDER"
by_ord = collections.defaultdict(list)
for r in od:
    o = r["order"].rsplit("-", 1)[0]
    by_ord[o].append(r)
x_ord = collections.defaultdict(list)
for r in nd:
    x_ord[r["order"]].append(r)
miss = [o for o in x_ord if o not in by_ord]
print("xlsx orders", len(x_ord), "found in orders_daily", len(x_ord) - len(miss), "missing", len(miss), miss[:5])
# compare revenue by (order, sku): xlsx rev vs orders_daily revenue for postings of that order with same sku
match = mism = 0
diffs = []
rev_x = rev_o = 0.0
units_x = units_o = 0
status_ct = collections.Counter()
date_diff = collections.Counter()
for o, rows in x_ord.items():
    if o not in by_ord:
        continue
    for x in rows:
        ps = [p for p in by_ord[o] if str(p["sku"]) == str(x["sku"])]
        if not ps:
            mism += 1; diffs.append((o, x["sku"], "no posting with sku", x["rev"]));
            continue
        rv = sum(p["revenue"] for p in ps); un = sum(p["units"] for p in ps)
        for p in ps:
            status_ct[p["status"]] += 1
            date_diff[(x["d"] == p["d"])] += 1
        rev_x += x["rev"]; rev_o += rv; units_x += x["n"]; units_o += un
        if abs(rv - x["rev"]) <= 1 and un == x["n"]:
            match += 1
        else:
            mism += 1; diffs.append((o, x["sku"], x["d"], "xlsx rev", x["rev"], "n", x["n"], "orders_daily rev", rv, "units", un, [p["status"] for p in ps], [p["d"] for p in ps]))
print("rows matched (rev within 1 rub and units equal):", match, "mismatched:", mism)
print("sum xlsx rev %.0f vs orders_daily rev %.0f (diff %.0f); units %d vs %d" % (rev_x, rev_o, rev_x - rev_o, units_x, units_o))
print("posting statuses of matched rows", dict(status_ct))
print("same date xlsx vs order date:", dict(date_diff))
for d in diffs[:15]:
    print("  ", d)
# same family: xlsx sp per order vs main cpo_orders
sp_x = collections.defaultdict(float)
for r in nd:
    sp_x[r["order"]] += r["sp"]
common = [o for o in sp_x if o in co]
bad = [(o, round(sp_x[o], 2), round(co[o], 2)) for o in common if abs(sp_x[o] - co[o]) > 0.01]
print("cpo_orders.ndjson (main) has", len(common), "of", len(sp_x), "xlsx orders; sp mismatches", len(bad), bad[:5])
print("sum sp xlsx %.2f, main cpo_orders on those orders %.2f" % (sum(sp_x.values()), sum(co[o] for o in common)))
