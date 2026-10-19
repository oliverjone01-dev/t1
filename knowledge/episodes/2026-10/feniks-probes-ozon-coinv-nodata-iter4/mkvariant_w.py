"""L3 realistic case: the next new card from the mac after the merge. v0 (14 labels kept) + one unlabeled zero row of a
new article on 2026-10-20, exactly as the mac writes it (site_to_seller 1.0, gap_pct 0.0, SKU present, no no_site).
Usage: python3 -I mkvariant_w.py <repo analytics-mvp/data> <scratch pb dir>  (writes only <scratch pb dir>/vW)
"""
import json
import os
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
d = os.path.join(OUT, "vW", "data")
os.makedirs(d, exist_ok=True)
for name in os.listdir(SRC):
    if name != "gap_daily.ndjson" and not os.path.lexists(os.path.join(d, name)):
        os.symlink(os.path.join(SRC, name), os.path.join(d, name))
lines = [l for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8").read().split("\n") if l.strip()]
new = {"date": "2026-10-20", "art": "GGT-03-5-1-L-130", "sku": "6045999999", "site_to_seller": 1.0, "gap_pct": 0.0,
       "src": "prices_raw", "oa_used": False, "snap": "утро"}
lines.append(json.dumps(new, ensure_ascii=False))
open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("vW rows", len(lines), "new art first day zero, unlabeled:", new["art"], new["date"])
