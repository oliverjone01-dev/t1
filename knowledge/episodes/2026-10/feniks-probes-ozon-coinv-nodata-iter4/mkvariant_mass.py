"""K2: systemic day (the 15.10 prices_daily case, but in the cabinet slice): every row of 2026-10-19 has the site price equal
to ours (1.0 / 0.0), as one bad slice of the mac would give. prices_daily has a mass rule for exactly this (NO_BEFORE_SHARE,
>= 90% of items -> the whole day «нет данных»); gap_daily has none. What does the page show?
Usage: python3 -I mkvariant_mass.py <repo analytics-mvp/data> <scratch pb dir>  (writes only <scratch pb dir>/vMass)
"""
import json
import os
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
d = os.path.join(OUT, "vMass", "data")
os.makedirs(d, exist_ok=True)
for rev in ("0bb36b5", "b0096cf"):
    os.makedirs(os.path.join(OUT, "vMass", f"out_{rev}"), exist_ok=True)
for name in os.listdir(SRC):
    if name != "gap_daily.ndjson" and not os.path.lexists(os.path.join(d, name)):
        os.symlink(os.path.join(SRC, name), os.path.join(d, name))
out, hit = [], 0
for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    if r["date"][:10] == "2026-10-19" and r.get("no_site") is not True:
        r = {**r, "site_to_seller": 1.0, "gap_pct": 0.0}
        hit += 1
    out.append(json.dumps(r, ensure_ascii=False))
open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("vMass rows of 19.10 set to price == ours:", hit)
