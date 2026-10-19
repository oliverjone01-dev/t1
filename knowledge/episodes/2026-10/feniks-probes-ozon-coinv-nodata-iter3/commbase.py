"""Reproduce decisions.md 2026-10-19 (4): accrued per unit / our price (prices_daily.price) by orders_daily."""
import json, sys, statistics as st, collections
D = sys.argv[1]
rd = lambda f: [json.loads(l) for l in open(D + "/" + f, encoding="utf-8") if l.strip()]
orders = rd("orders_daily.ndjson")
price = {(r["d"], r["offer"]): r.get("price") for r in rd("prices_daily.ndjson")}
pdays = sorted({d for d, _ in price})
def our(d, off):
    if (d, off) in price: return price[(d, off)], d
    prev = [x for x in pdays if x <= d and (x, off) in price]
    return (price[(prev[-1], off)], prev[-1]) if prev else (None, None)
print("statuses:", collections.Counter(o["status"] for o in orders if o["d"] >= "2026-10-01"))
defs = {
    "all non-cancelled": lambda o: o["status"] != "cancelled",
    "commission != 0": lambda o: (o.get("commission") or 0) != 0,
    "delivered": lambda o: o["status"] == "delivered",
    "all": lambda o: True,
}
for name, f in defs.items():
    for lo, hi in (("2026-10-01", "2026-10-14"), ("2026-10-15", "2026-10-19")):
        rs = []
        for o in orders:
            if not (lo <= o["d"] <= hi) or not f(o) or not o.get("units"): continue
            p, pd = our(o["d"], o["offer"])
            if not p: continue
            rs.append((o["revenue"] / o["units"]) / p)
        if not rs:
            print(f"{name:20} {lo}..{hi}: n=0"); continue
        within = sum(1 for x in rs if abs(x - 1) <= 0.02)
        print(f"{name:20} {lo}..{hi}: n={len(rs)} median={st.median(rs):.3f} within2%={within} min={min(rs):.3f} max={max(rs):.3f}")
