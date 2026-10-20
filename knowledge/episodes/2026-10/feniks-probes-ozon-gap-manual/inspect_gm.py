"""Data facts for the audit of PR #489 (gap_manual.ndjson). Read-only.
Usage: python3 -I inspect_gm.py <analytics-mvp dir>
Prints: last days of gap_daily (rows, zeros, no_site), duplicate (day, art) keys, test-4 roster, placebo roster of
wave boost_plus_exit with card groups and SIB-mates (pair partners in the placebo test), plan articles.
"""
import collections
import json
import os
import sys

A = sys.argv[1]
D = os.path.join(A, "data")


def nd(name):
    return [json.loads(l) for l in open(os.path.join(D, name), encoding="utf-8") if l.strip()]


rows = nd("gap_daily.ndjson")
day = lambda r: str(r.get("date", ""))[:10]
eq = lambda r: r.get("gap_pct") == 0 or float(r.get("site_to_seller") or 0) >= 0.9999
days = collections.Counter(day(r) for r in rows)
print("gap_daily rows", len(rows), "days", len(days), "first", min(days), "last", max(days))
for d in sorted(days)[-6:]:
    dr = [r for r in rows if day(r) == d]
    print(" ", d, "rows", len(dr), "price==ours", sum(eq(r) for r in dr), "no_site", sum(r.get("no_site") is True for r in dr))
dup = collections.Counter((day(r), r["art"]) for r in rows)
print("duplicate (day, art) keys:", sum(1 for v in dup.values() if v > 1))
print("rows with no_site in file:", sum(r.get("no_site") is True for r in rows))
mf = os.path.join(D, "gap_manual.ndjson")
print("gap_manual.ndjson:", "exists" if os.path.exists(mf) else "absent", os.path.getsize(mf) if os.path.exists(mf) else "-", "bytes")

T = json.load(open(os.path.join(A, "tools/tests/tests.json"), encoding="utf-8"))
t4 = T["тесты_цены"][0]
print("test-4:", t4.get("id"), "start", t4.get("старт"), "test arts", len(t4["тест"]), "control", len(t4.get("контроль", [])))
w = [t for t in T["тесты"] if t["id"] == "boost_plus_exit"][0]
SIB, AD = w["роли"]["test_sibling"], w["роли"]["test_ad"]
cg = json.load(open(os.path.join(D, "card_groups.json"), encoding="utf-8"))
card = {s["offer"]: g["main"] for g in cg["groups"] for s in g["skus"]}
print("placebo (test_sibling):")
for a in SIB:
    mates = [x for x in SIB if card.get(x) and card.get(x) == card.get(a) and x != a]
    last = [r.get("gap_pct") for r in rows if r["art"] == a and day(r) == max(days)]
    print(f"  {a:18} card {card.get(a)!s:18} pair partners {mates} last-day gap {last}")
print("test_ad:", AD)
plan = json.load(open(os.path.join(D, "plan_2026-10-15_v4.json"), encoding="utf-8"))
print("plan price arts:", len({p["art"] for p in plan.get("price", [])}))
for a in ("GGK-02-3-3-80", "GGT-48-2-2-100-180"):
    ser = sorted((day(r), r.get("gap_pct")) for r in rows if r["art"] == a)
    print(f"  {a}: in test-4 {a in t4['тест']}, days {len(ser)}, last 3 {ser[-3:]}")
