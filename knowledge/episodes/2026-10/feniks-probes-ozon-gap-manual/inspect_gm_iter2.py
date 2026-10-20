"""Data facts for iter2 of the audit of PR #489 (gap_manual.ndjson). Read-only.
Usage: python3 -I inspect_gm_iter2.py <analytics-mvp/data dir>
Prints: GGK-02-3-3-80 rows around 12-13.10 (window probe vM13/vM12), how often a mature card falls to a NON-zero
value below 10 (stop line of test 4, placebo residual vZsib5) versus exactly zero, and per placebo card values below 10.
"""
import collections
import json
import os
import sys

D = sys.argv[1]
rows = [json.loads(l) for l in open(os.path.join(D, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
day = lambda r: str(r.get("date", ""))[:10]
num = lambda r: None if r.get("gap_pct") in (None, "") else float(r["gap_pct"])
K = "GGK-02-3-3-80"
print("gap_daily rows", len(rows), "last day", max(day(r) for r in rows))
print("GGK-02-3-3-80 rows 11-14.10:", [(day(r), r.get("gap_pct"), r.get("site_to_seller")) for r in rows
                                        if r["art"] == K and "2026-10-11" <= day(r) <= "2026-10-14"])
keys = collections.Counter((day(r), r["art"]) for r in rows)
print("duplicate (day, art) keys:", sum(1 for v in keys.values() if v > 1), "| snap values:",
      dict(collections.Counter(r.get("snap") for r in rows)))
byart = collections.defaultdict(list)
for r in rows:
    v = num(r)
    if v is not None:
        byart[r["art"]].append((day(r), v))
low_rows = zero_rows = 0
low_arts, zero_arts = set(), set()
examples = []
for a, s in byart.items():
    s.sort()
    mature = False
    for d, v in s:
        if v >= 10:
            mature = True
            continue
        if not mature:
            continue
        if v == 0:
            zero_rows += 1
            zero_arts.add(a)
        else:
            low_rows += 1
            low_arts.add(a)
            if len(examples) < 8:
                examples.append((a, d, v))
print(f"after a day with gap 10+ (mature card): rows with 0 < gap < 10: {low_rows} ({len(low_arts)} arts); rows with gap == 0: {zero_rows} ({len(zero_arts)} arts)")
print("examples of non-zero values below 10 at mature cards:", examples)
for a in ["GGM-02-2-1", "GGM-02-3-1", "GGM-17-1-1", "GGL-01-M-2", "GGT-03-3-1-L-80"]:
    s = sorted(byart.get(a, []))
    print(f"  placebo {a:16} days {len(s):3} values below 10: {[(d, v) for d, v in s if v < 10]}")
