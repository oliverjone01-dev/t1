"""P1: one-day glitch at a mature test-4 card. v0 + GGK-02-3-3-80 2026-10-15 set to 1.0 / 0.0 IN PLACE, 16-19.10 untouched
(the card «recovered» the next day). Question: does the stop of test 4 stay on the page after recovery?
Usage: python3 -I mkvariant_p.py <repo analytics-mvp/data> <scratch pb dir>  (writes only <scratch pb dir>/vP)
"""
import json
import os
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
d = os.path.join(OUT, "vP", "data")
os.makedirs(d, exist_ok=True)
os.makedirs(os.path.join(OUT, "vP", "out_0bb36b5"), exist_ok=True)
for name in os.listdir(SRC):
    if name != "gap_daily.ndjson" and not os.path.lexists(os.path.join(d, name)):
        os.symlink(os.path.join(SRC, name), os.path.join(d, name))
out, hit, after = [], 0, []
for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    if r["art"] == "GGK-02-3-3-80" and r["date"][:10] == "2026-10-15":
        r = {**r, "site_to_seller": 1.0, "gap_pct": 0.0}
        hit += 1
    elif r["art"] == "GGK-02-3-3-80" and r["date"][:10] > "2026-10-15":
        after.append((r["date"][5:10], r["gap_pct"]))
    out.append(json.dumps(r, ensure_ascii=False))
open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("vP glitch rows", hit, "later days of the card", after)
