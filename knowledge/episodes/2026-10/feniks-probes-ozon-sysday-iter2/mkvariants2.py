"""Data variants for the iter2 probes of PR #488 (head 10049c0) on CURRENT data (main 12808f9, last day 20.10).
Every variant = symlinks to all repo data files + a modified copy of gap_daily.ndjson. Writes only under argv[2].
Usage: python3 -I mkvariants2.py <repo analytics-mvp/data> <scratch pb dir> <tests.json> <plan json>

  v0       as is
  vZ19     honest zero IN PLACE at mature cards on 19.10 (GGK-02-3-3-80, GGT-48-2-2-100-180) and GGM-20-2 02.10;
           20.10 untouched (stop already «played back»: R8 must show the current gap)
  vZ20     honest zero at GGK-02-3-3-80 and GGT-48-2-2-100-180 on 20.10 (last day)
  vU       the 14 no_site rows unlabeled and restored to 1.0 / 0.0 (new cards as the mac writes them)
  vW       + one unlabeled zero row of a new article on 20.10; vW21: the same row on 21.10 (a new day of one row)
  vMass    every 20.10 row -> 1.0 / 0.0 (system day on the last day)
  vS90     20.10: ceil(0.9 n) rows -> 1.0 / 0.0, test-4 and plan articles first; vS89: one row fewer (warn zone)
  vW15     20.10: ceil(0.15 n) rows -> 1.0 / 0.0, test-4 and plan first (warn zone); vW14: one row fewer (no warning)
  vN50     20.10 cut to 50 rows, all 1.0 / 0.0; vN49: 49 rows
  vKeep    vS90, GGK-05-2-3-7040 kept non-zero (non-zero rows of a system day stay data)
  vP       one-day glitch GGK-02-3-3-80 15.10 -> 1.0 / 0.0; vPfix: + no_site: true on that row (procedure P1)
  vZfix    vZ19 + no_site: true on GGK-02-3-3-80 19.10; vZ20fix: vZ20 + no_site: true on GGK-02-3-3-80 20.10
  vReal2   every row of 19.10 and 20.10 -> 1.0 / 0.0 (real catalog-wide stop, two days)
  vMass19  every 19.10 row -> 1.0 / 0.0 (iter1 vMass on current data: system day inside the frozen history)
  vS90_19, vN50_19   iter1 vS90 / vN50 on 19.10 (current data)
  vOld     every 20.09 row -> 1.0 / 0.0 (old system day: is the page notice windowed?)
  vWarnOld 01.10: 20% of rows -> 1.0 / 0.0, none of test-4 / plan (old warn day: is the notice windowed?)
"""
import json
import math
import os
import sys

SRC, OUT, TESTS, PLAN = sys.argv[1:5]
SRC = os.path.abspath(SRC)  # symlink targets must be absolute
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
t4 = json.load(open(TESTS, encoding="utf-8"))["тесты_цены"][0]
T4 = list(t4["тест"])
plan = json.load(open(PLAN, encoding="utf-8"))
PLAN_ARTS = sorted({p["art"] for p in plan.get("price", [])})
L, Y = "2026-10-20", "2026-10-19"
ZERO = {"site_to_seller": 1.0, "gap_pct": 0.0}
PRIO = set(T4) | set(PLAN_ARTS)


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
    print(f"{v:8} rows {len(out_rows):6}  {note}")


def inplace(keys, base=None):
    base = rows if base is None else base
    return [{**r, **ZERO} if (day(r), r["art"]) in keys else r for r in base]


def label(keys, base):
    return [{**r, "no_site": True} if (day(r), r["art"]) in keys else r for r in base]


def ordered_idx(d, exclude_prio=False, keep_art=None):
    idx = [i for i, r in enumerate(rows) if day(r) == d and r["art"] != keep_art]
    if exclude_prio:
        return sorted((i for i in idx if rows[i]["art"] not in PRIO), key=lambda i: rows[i]["art"])
    return sorted(idx, key=lambda i: (rows[i]["art"] not in PRIO, rows[i]["art"]))


def zero_first(d, k, **kw):
    zs = set(ordered_idx(d, **kw)[:k])
    out = [{**r, **ZERO} if i in zs else r for i, r in enumerate(rows)]
    n = sum(day(r) == d for r in rows)
    return out, f"{d} zero {k} of {n} = {k / n * 100:.2f}%, test-4 zero {sum(rows[i]['art'] in T4 for i in zs)}, plan zero {sum(rows[i]['art'] in PLAN_ARTS for i in zs)}"


def cut(d, k):
    keepi = set(ordered_idx(d)[:k])
    out = [({**r, **ZERO} if i in keepi else None) if day(r) == d else r for i, r in enumerate(rows)]
    out = [r for r in out if r is not None]
    return out, f"{d} cut to {k} rows all zero, test-4 {sum(rows[i]['art'] in T4 for i in keepi)}, plan {sum(rows[i]['art'] in PLAN_ARTS for i in keepi)}"


nL = sum(day(r) == L for r in rows)
print(f"{L}: n {nL}, ceil(0.9 n) {math.ceil(0.9 * nL)}, ceil(0.15 n) {math.ceil(0.15 * nL)}")

write("v0", rows, "as is")
vz19 = inplace({(Y, "GGK-02-3-3-80"), (Y, "GGT-48-2-2-100-180"), ("2026-10-02", "GGM-20-2")})
write("vZ19", vz19, "honest zero 19.10 at GGK-02-3-3-80, GGT-48-2-2-100-180; GGM-20-2 02.10")
vz20 = inplace({(L, "GGK-02-3-3-80"), (L, "GGT-48-2-2-100-180")})
write("vZ20", vz20, "honest zero 20.10 at GGK-02-3-3-80, GGT-48-2-2-100-180")

vu, hit = [], 0
for r in rows:
    if r.get("no_site") is True:
        r = {k: v for k, v in r.items() if k != "no_site"}
        r.update(ZERO)
        hit += 1
    vu.append(r)
write("vU", vu, f"unlabeled {hit}")

new = {"date": L, "art": "GGT-03-5-1-L-130", "sku": "6045999999", "site_to_seller": 1.0, "gap_pct": 0.0,
       "src": "prices_raw", "oa_used": False, "snap": "утро"}
write("vW", rows + [new], "new card 20.10 unlabeled zero")
write("vW21", rows + [{**new, "date": "2026-10-21"}], "new card 21.10 unlabeled zero (one-row day)")

write("vMass", [{**r, **ZERO} if day(r) == L else r for r in rows], f"20.10 rows -> zero: {nL}")
for v, k in (("vS90", math.ceil(0.9 * nL)), ("vS89", math.ceil(0.9 * nL) - 1), ("vW15", math.ceil(0.15 * nL)), ("vW14", math.ceil(0.15 * nL) - 1)):
    out, note = zero_first(L, k)
    write(v, out, note)
for v, k in (("vN50", 50), ("vN49", 49)):
    out, note = cut(L, k)
    write(v, out, note)
out, note = zero_first(L, math.ceil(0.9 * nL), keep_art="GGK-05-2-3-7040")
write("vKeep", out, note + ", kept non-zero GGK-05-2-3-7040")

G = ("2026-10-15", "GGK-02-3-3-80")
vp = inplace({G})
write("vP", vp, f"glitch {G}")
write("vPfix", label({G}, vp), "vP + no_site: true on the glitch row (procedure P1)")
write("vZfix", label({(Y, "GGK-02-3-3-80")}, vz19), "vZ19 + no_site: true on GGK-02-3-3-80 19.10")
write("vZ20fix", label({(L, "GGK-02-3-3-80")}, vz20), "vZ20 + no_site: true on GGK-02-3-3-80 20.10")

write("vReal2", [{**r, **ZERO} if day(r) in (Y, L) else r for r in rows], "19.10 and 20.10 rows -> zero")
write("vMass19", [{**r, **ZERO} if day(r) == Y else r for r in rows], "19.10 rows -> zero")
nY = sum(day(r) == Y for r in rows)
out, note = zero_first(Y, math.ceil(0.9 * nY))
write("vS90_19", out, note)
out, note = cut(Y, 50)
write("vN50_19", out, note)
write("vOld", [{**r, **ZERO} if day(r) == "2026-09-20" else r for r in rows], f"20.09 rows -> zero: {sum(day(r) == '2026-09-20' for r in rows)}")
nO = sum(day(r) == "2026-10-01" for r in rows)
out, note = zero_first("2026-10-01", math.ceil(0.2 * nO), exclude_prio=True)
write("vWarnOld", out, note)
