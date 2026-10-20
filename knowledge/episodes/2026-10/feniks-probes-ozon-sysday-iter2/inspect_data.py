"""Data facts for the iter2 probes of PR #488 (head 10049c0): last days of gap_daily and coinv_daily, test-4 and plan
articles per day, the two cards used in vZ, prices_daily on 19-20.10 (self-check claim «459 из 459 нет данных»).
Read-only. Usage: python3 -I inspect_data.py <repo analytics-mvp/data> <tests.json> <plan json>
"""
import collections
import json
import os
import sys

DATA, TESTS, PLAN = sys.argv[1:4]


def nd(name):
    p = os.path.join(DATA, name)
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()] if os.path.exists(p) else []


def day(r, k="date"):
    return str(r.get(k, ""))[:10]


rows = nd("gap_daily.ndjson")
t = json.load(open(TESTS, encoding="utf-8"))["тесты_цены"]
T4 = list(t[0]["тест"])
print("price tests:", [(x.get("старт"), len(x["тест"])) for x in t])
plan = json.load(open(PLAN, encoding="utf-8"))
PA = sorted({p["art"] for p in plan.get("price", [])})
print("test-4:", len(T4), "plan price arts:", len(PA))
by = collections.Counter(day(r) for r in rows)
ds = sorted(by)
print("gap_daily rows", len(rows), "days", len(ds), ds[0], "..", ds[-1])
for d in ds[-4:]:
    sub = [r for r in rows if day(r) == d]
    arts = {r["art"] for r in sub}
    eq = sum(1 for r in sub if r.get("gap_pct") == 0 or r.get("site_to_seller") == 1)
    print(f"  {d} rows {len(sub)} uniq {len(arts)} price==ours {eq} no_site {sum(r.get('no_site') is True for r in sub)}"
          f" test-4 {sum(a in arts for a in T4)} plan {sum(a in arts for a in PA)}")
for a in ("GGK-02-3-3-80", "GGT-48-2-2-100-180", "GGK-05-2-3-7040"):
    print(" ", a, [(day(r)[5:], r.get("gap_pct")) for r in rows if r["art"] == a and day(r) >= "2026-10-13"])

co = nd("coinv_daily.ndjson")
cby = collections.Counter(day(r) for r in co)
cds = sorted(cby)
print("coinv_daily rows", len(co), "last days", [(d, cby[d]) for d in cds[-4:]])
for d in cds[-2:]:
    sub = [r for r in co if day(r) == d]
    z = sum(1 for r in sub if r.get("coinv_paid_pct") == 0 or r.get("coinv_pct") == 0)
    print(f"  coinv {d}: rows {len(sub)} zero {z} keys {sorted(set().union(*[set(r) for r in sub]))[:14]}")

pr = nd("prices_daily.ndjson")
pby = collections.defaultdict(list)
for r in pr:
    pby[day(r)].append(r)
for d in sorted(pby)[-3:]:
    sub = pby[d]
    empty = sum(1 for r in sub if r.get("before") in (None, "") and r.get("coinv") in (None, ""))
    print(f"  prices_daily {d}: rows {len(sub)} before/coinv empty {empty}")
