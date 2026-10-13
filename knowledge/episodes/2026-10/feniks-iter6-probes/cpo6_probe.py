#!/usr/bin/env python3
"""FENIKS iter6: independent recomputation of CPO «по заказам» (rule of «Отчет», written from spec v2.3 / decisions 13.10,
not from cpo-orders-rev.ts) + data-quality probes + periods table for comparison with Chromium.
usage: cpo6_probe.py <sandbox> [out.json]"""
import collections, datetime as dt, json, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
SB = sys.argv[1]
D = f"{S}/{SB}/analytics-mvp/data/"
OUT = sys.argv[2] if len(sys.argv) > 2 else f"{S}/cpo6_{SB}.json"
CPO_ID = "28753239"


def nd(f):
    out = []
    for ln in open(D + f, encoding="utf-8"):
        if ln.strip():
            out.append(json.loads(ln))
    return out


cpo = nd("cpo_orders.ndjson")
od = nd("orders_daily.ndjson")
skud = nd("cpo_sku_daily.ndjson")
ads = nd("ads_daily.ndjson")

rep = {}
# --- data quality: cpo_orders
keys = [str(r["order"]) for r in cpo]
dup = [k for k, n in collections.Counter(keys).items() if n > 1]
rep["cpo_rows"], rep["cpo_unique"], rep["cpo_dup_keys"] = len(keys), len(set(keys)), dup[:5]
rep["cpo_sp_total"] = round(sum(float(r["sp"]) for r in cpo), 2)

# --- postings by order prefix (text before the last "-"), file order kept
post = collections.defaultdict(list)
for i, r in enumerate(od):
    o = str(r.get("order") or "")
    post[o[: o.rfind("-")]].append((i, r))
dates_sorted = all(od[i]["d"] <= od[i + 1]["d"] for i in range(len(od) - 1))
rep["orders_daily_rows"], rep["orders_daily_sorted_by_d"] = len(od), dates_sorted
st = collections.Counter()
miss, multi_date, first_ne_min, units_bad = [], [], [], 0
for k in keys:
    ps = post.get(k, [])
    if not ps:
        miss.append(k)
        continue
    ds = [p["d"] for _, p in ps]
    if len(set(ds)) > 1:
        multi_date.append(k)
    if ds[0] != min(ds):
        first_ne_min.append((k, ds))
    for _, p in ps:
        st[p.get("status")] += 1
        if not isinstance(p.get("units"), (int, float)):
            units_bad += 1
rep["miss"] = len(miss)
rep["miss_sp"] = round(sum(float(r["sp"]) for r in cpo if str(r["order"]) in set(miss)), 2)
rep["multi_date_orders"] = len(multi_date)
rep["first_ne_min"] = first_ne_min[:10]
rep["first_ne_min_n"] = len(first_ne_min)
rep["posting_status"] = dict(st)
rep["postings_units_not_numeric"] = units_bad
rep["postings_per_order"] = dict(collections.Counter(len(post.get(k, [])) for k in keys))


def rule(first="file"):
    day = collections.defaultdict(lambda: [0.0, 0.0, 0])  # sp, rev, units
    for r in cpo:
        ps = [p for _, p in post.get(str(r["order"]), [])]
        if not ps:
            continue
        d = ps[0]["d"] if first == "file" else min(p["d"] for p in ps)
        a = day[d]
        a[0] += float(r["sp"] or 0)
        for p in ps:
            if p.get("status") != "cancelled":
                a[1] += float(p.get("revenue") or 0)
                a[2] += int(p.get("units") or 0)
    return day


day = rule("file")
day_min = rule("min")
rows = sorted((d, round(v[0]), round(v[1]), v[2]) for d, v in day.items())
rep["days"] = len(rows)
rep["day_first", "day_last"] = None
rep.pop(("day_first", "day_last"))
rep["rev_days_range"] = [rows[0][0], rows[-1][0]]
# coverage = min..max d of cpo_sku_daily
cd = sorted({str(r["d"]) for r in skud})
cfrom, cto = cd[0], cd[-1]
rep["coverage"] = [cfrom, cto]
alld = []
x = dt.date.fromisoformat(cfrom)
while x <= dt.date.fromisoformat(cto):
    alld.append(x.isoformat())
    x += dt.timedelta(days=1)
rep["coverage_days_without_sku_rows"] = [d for d in alld if d not in set(cd)]
rep["rev_days_outside_coverage"] = [(d, rv, u) for d, sp, rv, u in rows if d < cfrom or d > cto]
# per month: export sp (cpo_sku_daily, by its date), export units, API spend, rule rev/units, rule sp (by order date)
mon = collections.defaultdict(lambda: collections.Counter())
for r in skud:
    m = str(r["d"])[:7]
    mon[m]["export_sp"] += float(r["sp"])
    mon[m]["export_n"] += int(r.get("n") or 0)
for r in ads:
    if str(r["id"]) == CPO_ID:
        mon[str(r["d"])[:7]]["api_sp"] += float(r["sp"])
for d, sp, rv, u in rows:
    mon[d[:7]]["rule_sp_by_orderdate"] += sp
    mon[d[:7]]["rule_rev"] += rv
    mon[d[:7]]["rule_units"] += u
# units incl. cancelled (to compare with export units)
for r in cpo:
    ps = [p for _, p in post.get(str(r["order"]), [])]
    if ps:
        mon[ps[0]["d"][:7]]["units_incl_cancelled"] += sum(int(p.get("units") or 0) for p in ps)
        mon[ps[0]["d"][:7]]["orders"] += 1
        if all(p.get("status") == "cancelled" for p in ps):
            mon[ps[0]["d"][:7]]["orders_all_cancelled"] += 1
rep["months"] = {m: {k: round(v, 2) for k, v in c.items()} for m, c in sorted(mon.items())}
# api spend on days before coverage start / after end (CPO campaign)
rep["api_sp_before_coverage"] = round(sum(float(r["sp"]) for r in ads if str(r["id"]) == CPO_ID and r["d"] < cfrom), 2)
rep["api_sp_after_coverage"] = round(sum(float(r["sp"]) for r in ads if str(r["id"]) == CPO_ID and r["d"] > cto), 2)
rep["api_first_day_cpo"] = min((r["d"] for r in ads if str(r["id"]) == CPO_ID and float(r["sp"]) > 0), default=None)
# sensitivity: file-first vs min date by month
sens = collections.Counter()
for d, v in day_min.items():
    sens[d[:7]] += v[1]
rep["rev_by_month_min_date"] = {m: round(v) for m, v in sorted(sens.items())}

# --- periods
api = collections.defaultdict(float)
for r in ads:
    if str(r["id"]) == CPO_ID:
        api[r["d"]] += float(r["sp"])
P = [("2026-06-01", "2026-06-30"), ("2026-07-01", "2026-07-31"), ("2026-08-01", "2026-08-31"), ("2026-09-01", "2026-09-30"), ("2026-10-01", "2026-10-12"),
     ("2026-06-05", "2026-06-30"), ("2026-06-01", "2026-06-04"), ("2026-05-25", "2026-06-10"), ("2026-06-15", "2026-07-15"), ("2026-07-01", "2026-07-15"),
     ("2026-07-16", "2026-07-31"), ("2026-08-01", "2026-08-15"), ("2026-08-16", "2026-08-31"), ("2026-09-01", "2026-09-15"), ("2026-09-16", "2026-09-30"),
     ("2026-08-15", "2026-09-15"), ("2026-07-01", "2026-09-30"), ("2026-09-20", "2026-10-10"), ("2026-09-25", "2026-10-05"), ("2026-06-01", "2026-10-12"),
     ("2026-09-04", "2026-09-04"), ("2026-06-05", "2026-06-05"), ("2026-06-30", "2026-07-01"), ("2026-07-31", "2026-08-01"), ("2026-08-31", "2026-09-01"),
     ("2026-07-20", "2026-07-26"), ("2026-08-03", "2026-08-09"), ("2026-06-08", "2026-06-14"), ("2026-07-10", "2026-07-10"), ("2026-08-20", "2026-08-20"),
     ("2026-09-30", "2026-09-30"), ("2026-10-01", "2026-10-01"), ("2026-06-20", "2026-08-20"), ("2026-06-01", "2026-09-30")]
per = []
for f, t in P:
    rv = sum(r[2] for r in rows if f <= r[0] <= t)
    u = sum(r[3] for r in rows if f <= r[0] <= t)
    cf, ct = max(f, cfrom), min(t, cto)
    ncov = (dt.date.fromisoformat(ct) - dt.date.fromisoformat(cf)).days + 1 if cf <= ct else 0
    nall = (dt.date.fromisoformat(t) - dt.date.fromisoformat(f)).days + 1
    sc = sum(v for d, v in api.items() if f <= d <= t and cf <= d <= ct)
    sp_all = sum(v for d, v in api.items() if f <= d <= t)
    drr = round(sc / rv * 1000) / 10 if rv else None
    per.append({"f": f, "t": t, "rev": round(rv), "units": u, "ncov": ncov, "nall": nall, "sc": round(sc), "sp_period": round(sp_all), "drr": drr})
rep["periods"] = per
json.dump(rep, open(OUT, "w"), ensure_ascii=False, indent=0)
for k, v in rep.items():
    if k != "periods":
        print(k, ":", json.dumps(v, ensure_ascii=False)[:600])
for p in per:
    print(p)
