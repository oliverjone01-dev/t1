#!/usr/bin/env python3
"""FENIKS iter6: periods where the second «за заказ»-labelled campaign 22421802 outspends 28753239 while CPO revenue > 0
(cpoRevFix gives revenue to the first CPO-labelled campaign in a.all sorted by spend desc)."""
import collections, json, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
D = f"{S}/{sys.argv[1]}/analytics-mvp/data/"
rows = [json.loads(l) for l in open(D + "ads_daily.ndjson") if l.strip()]
sp = collections.defaultdict(lambda: collections.Counter())
for r in rows:
    if r["id"] in ("22421802", "28753239"):
        sp[r["d"]][r["id"]] += r["sp"]
probe = json.load(open(f"{S}/cpo6_{sys.argv[1]}.json"))
# daily revenue from rule via periods is not stored per day; recompute quickly
cpo = [json.loads(l) for l in open(D + "cpo_orders.ndjson") if l.strip()]
post = collections.defaultdict(list)
for r in (json.loads(l) for l in open(D + "orders_daily.ndjson") if l.strip()):
    o = str(r.get("order") or "")
    post[o[: o.rfind("-")]].append(r)
rev = collections.Counter()
for r in cpo:
    ps = post.get(str(r["order"]), [])
    if ps:
        rev[ps[0]["d"]] += sum(float(p.get("revenue") or 0) for p in ps if p.get("status") != "cancelled")
days = sorted(sp)
cands = []
for i, d0 in enumerate(days):
    for d1 in days[i:i + 10]:
        a = sum(sp[d][ "22421802"] for d in days if d0 <= d <= d1)
        b = sum(sp[d]["28753239"] for d in days if d0 <= d <= d1)
        r = sum(v for d, v in rev.items() if d0 <= d <= d1)
        if a > b and r > 0:
            cands.append((d0, d1, round(a), round(b), round(r)))
print("periods (<=10 days) where 22421802 spend > 28753239 spend and CPO revenue > 0:", len(cands))
for c in cands[:20]:
    print("  ", c)
print("22421802 daily spend June-July:", [(d, round(sp[d]["22421802"]), round(sp[d]["28753239"])) for d in days if "2026-06-01" <= d <= "2026-07-15" and sp[d]["22421802"] > 0])
