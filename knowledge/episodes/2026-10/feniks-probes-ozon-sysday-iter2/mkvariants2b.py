"""Extra variants for iter2 (second-order probes). Same layout as mkvariants2.py. Writes only under argv[2].
Usage: python3 -I mkvariants2b.py <repo analytics-mvp/data> <scratch pb dir>

  vZsib     honest zero at GGM-02-2-1 on 20.10 (mature card of the placebo group of wave boost_plus_exit)
  vZsib19   honest zero at GGM-02-2-1 on 19.10 only, 20.10 recovered
  vZsibfix  vZsib19 + no_site: true on that row (procedure P1)
  vZad      honest zero at GGM-02-1-1 on 20.10 (test_ad of boost_plus_exit)
  vReal2b   20.10 and a new day 21.10 (same articles) entirely price == ours: a real catalog-wide stop, two future days
  vReal3    20.10, 21.10, 22.10 entirely price == ours
  vSysWarn  20.10 system day + 21.10 warn day (20% of rows, none of test-4 / plan)
"""
import json
import math
import os
import sys

SRC, OUT = sys.argv[1:3]
SRC = os.path.abspath(SRC)  # symlink targets must be absolute
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
L, Y = "2026-10-20", "2026-10-19"
ZERO = {"site_to_seller": 1.0, "gap_pct": 0.0}


def day(r):
    return str(r.get("date", ""))[:10]


def write(v, out_rows, note):
    d = os.path.join(OUT, v, "data")
    os.makedirs(d, exist_ok=True)
    for name in os.listdir(SRC):
        if name == "gap_daily.ndjson":
            continue
        dst = os.path.join(d, name)
        if not os.path.lexists(dst):
            os.symlink(os.path.join(SRC, name), dst)
    with open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{v:9} rows {len(out_rows):6}  {note}")


def inplace(keys, base=None):
    base = rows if base is None else base
    return [{**r, **ZERO} if (day(r), r["art"]) in keys else r for r in base]


Ld = [r for r in rows if day(r) == L]
write("vZsib", inplace({(L, "GGM-02-2-1")}), "honest zero GGM-02-2-1 20.10")
z19 = inplace({(Y, "GGM-02-2-1")})
write("vZsib19", z19, "honest zero GGM-02-2-1 19.10 only")
write("vZsibfix", [{**r, "no_site": True} if (day(r), r["art"]) == (Y, "GGM-02-2-1") else r for r in z19], "vZsib19 + no_site label")
write("vZad", inplace({(L, "GGM-02-1-1")}), "honest zero GGM-02-1-1 20.10")


def future(d):
    return [{**r, **ZERO, "date": d, "snap": "утро"} for r in Ld]


base2 = [{**r, **ZERO} if day(r) == L else r for r in rows]
write("vReal2b", base2 + future("2026-10-21"), "20.10 and 21.10 all price == ours")
write("vReal3", base2 + future("2026-10-21") + future("2026-10-22"), "20.10, 21.10, 22.10 all price == ours")
k = math.ceil(0.2 * len(Ld))
d21 = [{**r, "date": "2026-10-21", "snap": "утро"} for r in Ld]
idx = sorted(range(len(d21)), key=lambda i: d21[i]["art"])[-k:]
d21 = [{**r, **ZERO} if i in set(idx) else r for i, r in enumerate(d21)]
write("vSysWarn", base2 + d21, f"20.10 system + 21.10 warn ({k} of {len(d21)} zero)")
