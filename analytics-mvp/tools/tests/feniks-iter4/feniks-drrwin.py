#!/usr/bin/env python3
"""ДРР of CPO campaign 28753239: as shown (spend over the whole period / xlsx revenue inside it) vs window-matched."""
import json, sys
root = sys.argv[1]
api = {}
for l in open(root + "/data/ads_daily.ndjson", encoding="utf-8"):
    r = json.loads(l)
    if str(r.get("id")) == "28753239":
        api[r["d"]] = api.get(r["d"], 0) + (r.get("sp", 0) or 0)
nd = [json.loads(l) for l in open(root + "/data/cpo_card_orders.ndjson", encoding="utf-8") if l.strip()]
for f, t in (("2026-09-20", "2026-10-10"), ("2026-08-15", "2026-09-15"), ("2026-07-01", "2026-09-30"), ("2026-09-28", "2026-10-03"), ("2026-09-01", "2026-09-30"), ("2026-09-04", "2026-09-04")):
    sp_all = sum(v for d, v in api.items() if f <= d <= t)
    rows = [x for x in nd if f <= x["d"] <= t]
    if not rows:
        continue
    d0, d1 = min(x["d"] for x in rows), max(x["d"] for x in rows)
    sp_win = sum(v for d, v in api.items() if d0 <= d <= d1)
    rev_asis = sum(x["rev"] for x in rows); rev_line = sum(x["rev"] * x["n"] for x in rows)
    print(f"{f}..{t}: shown ДРР {sp_all / rev_asis * 100:.1f}% (spend {sp_all:.0f} / rev {rev_asis:.0f}); "
          f"window {d0}..{d1}: spend {sp_win:.0f}, line-total rev {rev_line:.0f}, ДРР {sp_win / rev_line * 100:.1f}%")
