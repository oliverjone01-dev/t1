"""Extra data variants for iter2 of the audit of PR #489 (code e1c3a62), same conventions as mkvar_gm.py:
absolute symlinks to every repo data file + own gap_daily.ndjson + own gap_manual.ndjson. Writes only argv[2]/<v>/data.
Usage: python3 -I mkvar_gm_iter2.py <repo analytics-mvp/data> <scratch pb dir>

  vM13   GGK-02-3-3-80 zero on 13.10 (last day - 7) + manual record 13.10: «снято вручную» line inside the window
  vM12   the same on 12.10 (last day - 8): removal still applied, line outside the window (not shown)
  vM5    GGK-02-3-3-80 = 5.0 on 20.10 (test-4 stop line is gap < 10) + manual record 20.10: record on a non-zero row
  vSnap  GGK-02-3-3-80 20.10 twice: «утро» zero row first, then the real «вечер» row 49.57; manual record 20.10
  vSnapR the same, order reversed: real «утро» row first, zero «вечер» row second; manual record 20.10
"""
import json
import os
import sys

SRC, OUT = os.path.abspath(sys.argv[1]), sys.argv[2]
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
K, L = "GGK-02-3-3-80", "2026-10-20"
ZERO = {"site_to_seller": 1.0, "gap_pct": 0.0}
day = lambda r: str(r.get("date", ""))[:10]


def rec(d, a, reason="сбой витрины", by="ФЕНИКС проба iter2"):
    return {"date": d, "art": a, "reason": reason, "by": by, "ts": "2026-10-20T12:00:00+03:00"}


def write(v, out_rows, manual, note):
    d = os.path.join(OUT, v, "data")
    os.makedirs(d, exist_ok=True)
    for name in os.listdir(SRC):
        if name in ("gap_daily.ndjson", "gap_manual.ndjson"):
            continue
        dst = os.path.join(d, name)
        if not os.path.lexists(dst):
            os.symlink(os.path.join(SRC, name), dst)
    with open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(d, "gap_manual.ndjson"), "w", encoding="utf-8") as f:
        for m in manual:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    print(f"{v:7} rows {len(out_rows):6}  {note}; manual {len(manual)} lines")


def at(d, val=None):
    z = ZERO if val is None else {"gap_pct": val, "site_to_seller": round(1 - val / 100, 4)}
    return [{**r, **z} if (day(r), r["art"]) == (d, K) else r for r in rows]


write("vM13", at("2026-10-13"), [rec("2026-10-13", K)], "zero 13.10 at GGK-02-3-3-80")
write("vM12", at("2026-10-12"), [rec("2026-10-12", K)], "zero 12.10 at GGK-02-3-3-80")
write("vM5", at(L, 5.0), [rec(L, K)], "GGK-02-3-3-80 = 5.0 on 20.10")
i = next(n for n, r in enumerate(rows) if (day(r), r["art"]) == (L, K))
real = rows[i]
zero_m = {**real, **ZERO, "snap": "утро"}
write("vSnap", rows[:i] + [zero_m, {**real, "snap": "вечер"}] + rows[i + 1:], [rec(L, K)],
      f"GGK-02-3-3-80 20.10: утро 0 then вечер {real.get('gap_pct')}")
write("vSnapR", rows[:i] + [{**real, "snap": "утро"}, {**real, **ZERO, "snap": "вечер"}] + rows[i + 1:], [rec(L, K)],
      f"GGK-02-3-3-80 20.10: утро {real.get('gap_pct')} then вечер 0")
