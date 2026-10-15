#!/usr/bin/env python3
"""Independent: report rule (isCpoCampaign by name /за заказ/) -> CPC spend/om per month from raw ads_daily (d <= maxD),
plus export charges by order date per month from cpo_orders + orders_daily (earliest posting), and total ROAS = (cpcOm+cpoRev)/(cpcSp+cpoSp)."""
import json, re, collections, sys

D = sys.argv[1]
MAXD = "2026-10-13"
m = collections.defaultdict(lambda: [0.0, 0.0, 0.0])  # cpcSp, cpcOm, cpoApiSp
for l in open(D + "/ads_daily.ndjson"):
    if not l.strip():
        continue
    r = json.loads(l)
    d = str(r["d"])
    if d > MAXD:
        continue
    a = m[d[:7]]
    if re.search("за заказ", str(r.get("off") or ""), re.I):
        a[2] += float(r.get("sp") or 0)
    else:
        a[0] += float(r.get("sp") or 0)
        a[1] += float(r.get("om") or 0)
post = collections.defaultdict(list)
for l in open(D + "/orders_daily.ndjson"):
    if l.strip():
        r = json.loads(l)
        o = str(r["order"])
        post[o[: o.rfind("-")]].append(r)
cpo = collections.defaultdict(lambda: [0.0, 0.0])
for l in open(D + "/cpo_orders.ndjson"):
    if not l.strip():
        continue
    r = json.loads(l)
    ps = post.get(str(r["order"]))
    if not ps:
        continue
    d0 = min(str(p["d"]) for p in ps)
    cpo[d0[:7]][0] += float(r["sp"])
    cpo[d0[:7]][1] += sum(float(p.get("revenue") or 0) for p in ps if p.get("status") != "cancelled")
for k in sorted(m):
    cs, co_, ca = m[k]
    s, rv = cpo.get(k, [0.0, 0.0])
    tot = (co_ + rv) / (cs + s) if (cs + s) else None
    old = (co_ + rv) / (cs + ca) if (cs + ca) else None
    print(f"{k}: cpcSp {cs:,.0f} cpcOm {co_:,.0f} cpoApiSp {ca:,.0f} | export sp {s:,.2f} rev {rv:,.0f} | total new {tot and round(tot, 2)} old {old and round(old, 2)}")
