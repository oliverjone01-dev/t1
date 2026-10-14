#!/usr/bin/env python3
"""API CPO spend per month by campaign (isCpoCampaign: /за заказ/i on off), from a sandbox's data/ads_daily.ndjson.
usage: cpoapi9.py <sandbox>"""
import collections, json, re, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9/"
D = S + sys.argv[1] + "/analytics-mvp/data/"
m = collections.defaultdict(lambda: collections.defaultdict(float))
offs = {}
for l in open(D + "ads_daily.ndjson", encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    if re.search("за заказ", str(r.get("off") or ""), re.I):
        m[str(r["d"])[:7]][str(r["id"])] += float(r.get("sp") or 0)
        offs[str(r["id"])] = r.get("off")
for ym in sorted(m):
    print(ym, {k: round(v) for k, v in sorted(m[ym].items())}, "total", round(sum(m[ym].values())))
print("offs:", offs)
