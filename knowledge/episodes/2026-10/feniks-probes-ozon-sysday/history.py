"""K2 history probe, independent of the TS code: per-day share of rows where the site price equals ours.
gap_daily: one row per (day, art), last row wins except «missing over captured» (M1); missing = no_site or gap_pct == 0
           or site_to_seller >= 0.9999 (same predicate as gap-daily.ts siteMissing, re-implemented here).
coinv_daily: stored file, one row per (day, art); missing = no_site or coinv_paid_pct == 0
           or round(site_paid) == round(cap) (the slice predicate of coinv-merge.ts mapped onto stored fields).
Prints min/max rows per day, max share, the 5 highest days, and how many days would pass
the rule at 0.9 / 50 and at looser thresholds (sensitivity).
Usage: python3 -I history.py <repo analytics-mvp/data>
"""
import json
import os
import sys
from collections import defaultdict

D = sys.argv[1]


def load(name):
    return [json.loads(l) for l in open(os.path.join(D, name), encoding="utf-8") if l.strip()]


def num(x):
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def gap_missing(r):
    g, s = num(r.get("gap_pct")), num(r.get("site_to_seller"))
    return r.get("no_site") is True or (g is not None and g == 0) or (s is not None and s >= 0.9999)


def coinv_missing(r):
    c, sp, cap = num(r.get("coinv_paid_pct")), num(r.get("site_paid")), num(r.get("cap"))
    return r.get("no_site") is True or (c is not None and c == 0) or (sp is not None and cap is not None and round(sp) == round(cap))


def dedupe_gap(rows):
    last = {}
    for r in rows:
        k = (str(r.get("date", ""))[:10], str(r.get("art", "")).strip())
        cur = last.get(k)
        if cur is not None and gap_missing(r) and not gap_missing(cur) and num(cur.get("gap_pct")) is not None:
            continue
        last.pop(k, None)
        last[k] = r
    return list(last.values())


def per_day(rows, pred, keyf):
    tot, mis = defaultdict(int), defaultdict(int)
    seen = set()
    dup = 0
    for r in rows:
        k = keyf(r)
        if k in seen:
            dup += 1
        seen.add(k)
        d = k[0]
        tot[d] += 1
        mis[d] += pred(r)
    return tot, mis, dup


def report(name, tot, mis, dup):
    days = sorted(tot)
    shares = {d: mis[d] / tot[d] for d in days}
    top = sorted(days, key=lambda d: -shares[d])[:5]
    print(f"{name}: days {len(days)} ({days[0]}..{days[-1]}), rows/day min {min(tot.values())} max {max(tot.values())}, dup keys {dup}")
    print(f"  top share: " + ", ".join(f"{d} {mis[d]}/{tot[d]}={shares[d]*100:.1f}%" for d in top))
    small = [d for d in days if tot[d] < 50]
    print(f"  days with < 50 rows: {len(small)} {small[:10]}")
    for thr, mn in ((0.9, 50), (0.5, 50), (0.1, 50), (0.05, 50), (0.9, 1)):
        hit = [d for d in days if tot[d] >= mn and shares[d] >= thr]
        print(f"  rule share>={thr} n>={mn}: {len(hit)} days {hit[:8]}")
    return shares


g = load("gap_daily.ndjson")
gd = dedupe_gap(g)
print(f"gap_daily raw rows {len(g)}, after (day, art) dedupe {len(gd)}")
report("gap_daily", *per_day(gd, gap_missing, lambda r: (str(r.get("date", ""))[:10], str(r.get("art", "")).strip())))
c = load("coinv_daily.ndjson")
print(f"coinv_daily rows {len(c)}")
report("coinv_daily", *per_day(c, coinv_missing, lambda r: (str(r.get("date", ""))[:10], str(r.get("art", "")).strip())))
