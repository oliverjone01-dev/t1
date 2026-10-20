"""K2 second order: a REAL catalog-wide stop of OZON co-investment lasts several days (not a one-day slice glitch).
vReal2: every row of 18.10 and 19.10 -> 1.0 / 0.0 (two consecutive «system days»).
Self-check point 21 claims: «если системный день настоящий (OZON перестал доплачивать всем) - потеря одного дня ряда,
следующий день покажет нули с историей». What does the page show on day 2?
Usage: python3 -I mkvariant_real.py <repo analytics-mvp/data> <scratch pb dir>  (writes only <scratch pb dir>/vReal2)
"""
import json
import os
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
DAYS = {"2026-10-18", "2026-10-19"}
d = os.path.join(OUT, "vReal2", "data")
os.makedirs(d, exist_ok=True)
for name in os.listdir(SRC):
    if name != "gap_daily.ndjson" and not os.path.lexists(os.path.join(d, name)):
        os.symlink(os.path.join(SRC, name), os.path.join(d, name))
out, hit = [], 0
for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    if r["date"][:10] in DAYS:
        r = {**r, "site_to_seller": 1.0, "gap_pct": 0.0}
        hit += 1
    out.append(json.dumps(r, ensure_ascii=False))
open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("vReal2 rows of 18.10 and 19.10 set to price == ours:", hit)
