"""Data variants for the K2 / P1 / L3 page and live-test probes of PR #488 (code 30abf83).
Every variant = symlinks to all repo data files + a modified copy of gap_daily.ndjson. Writes only under argv[2].
Usage: python3 -I mkvariants_sd.py <repo analytics-mvp/data> <scratch pb dir> <tests.json> <plan json>

  v0      as is
  vZ      honest zero IN PLACE at mature cards: GGK-02-3-3-80 19.10, GGT-48-2-2-100-180 19.10, GGM-20-2 02.10 (iter4 vZ)
  vU      the 14 no_site rows unlabeled and restored to 1.0 / 0.0 (new cards as the mac writes them, iter4 vU)
  vW      v0 + one unlabeled zero row of a new article on 2026-10-20 (the next new card from the mac, iter4 vW)
  vMass   every 19.10 row -> 1.0 / 0.0 (whole slice broken, iter4 K2)
  vS90    19.10: exactly ceil(0.9 n) rows -> 1.0 / 0.0, all 10 test-4 and all plan articles among them
  vS89    same, one non-test row fewer (share just under 0.9)
  vN50    19.10 cut to 50 rows (10 test-4 + plan articles + filler), all 1.0 / 0.0
  vN49    19.10 cut to 49 rows, all 1.0 / 0.0
  vKeep   vS90, and the remaining (non-zero) 19.10 rows must stay data: one test-4 article kept non-zero on purpose
  vP      one-day glitch: GGK-02-3-3-80 15.10 -> 1.0 / 0.0, 16-19.10 untouched (iter4 P1)
  vPfix   vP + the documented procedure: no_site: true on that 15.10 row
  vZfix   vZ + no_site: true on GGK-02-3-3-80 19.10 (procedure applied to the author's scenario)
"""
import json
import math
import os
import sys

SRC, OUT, TESTS, PLAN = sys.argv[1:5]
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
t4 = json.load(open(TESTS, encoding="utf-8"))["тесты_цены"][0]
T4 = list(t4["тест"])
plan = json.load(open(PLAN, encoding="utf-8"))
PLAN_ARTS = sorted({p["art"] for p in plan.get("price", [])})
D19 = "2026-10-19"
ZERO = {"site_to_seller": 1.0, "gap_pct": 0.0}


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
    print(f"{v:6} rows {len(out_rows):6}  {note}")


def day(r):
    return str(r.get("date", ""))[:10]


write("v0", rows, "as is")

INPLACE = {(D19, "GGK-02-3-3-80"), (D19, "GGT-48-2-2-100-180"), ("2026-10-02", "GGM-20-2")}
vz = [{**r, **ZERO} if (day(r), r["art"]) in INPLACE else r for r in rows]
write("vZ", vz, f"in place {sum((day(r), r['art']) in INPLACE for r in rows)}")

vu, hit = [], 0
for r in rows:
    if r.get("no_site") is True:
        r = {k: v for k, v in r.items() if k != "no_site"}
        r.update(ZERO)
        hit += 1
    vu.append(r)
write("vU", vu, f"unlabeled {hit}")

new = {"date": "2026-10-20", "art": "GGT-03-5-1-L-130", "sku": "6045999999", "site_to_seller": 1.0, "gap_pct": 0.0,
       "src": "prices_raw", "oa_used": False, "snap": "утро"}
write("vW", rows + [new], "new card 20.10 unlabeled zero")

vm = [{**r, **ZERO} if day(r) == D19 else r for r in rows]
write("vMass", vm, f"19.10 rows -> zero: {sum(day(r) == D19 for r in rows)}")

idx19 = [i for i, r in enumerate(rows) if day(r) == D19]
n19 = len(idx19)
need = math.ceil(0.9 * n19)
prio = set(T4) | set(PLAN_ARTS)
ordered = sorted(idx19, key=lambda i: (rows[i]["art"] not in prio, rows[i]["art"]))
print(f"19.10: n {n19}, ceil(0.9 n) {need}, test-4 present {sum(rows[i]['art'] in T4 for i in idx19)}, plan present {sum(rows[i]['art'] in PLAN_ARTS for i in idx19)}")


def zero_set(k, keep_art=None):
    zs = [i for i in ordered if rows[i]["art"] != keep_art][:k]
    return set(zs)


for v, k in (("vS90", need), ("vS89", need - 1)):
    zs = zero_set(k)
    out = [{**r, **ZERO} if i in zs else r for i, r in enumerate(rows)]
    write(v, out, f"19.10 zero {k} of {n19} = {k / n19 * 100:.2f}%, test-4 zero {sum(rows[i]['art'] in T4 for i in zs)}, plan zero {sum(rows[i]['art'] in PLAN_ARTS for i in zs)}")

keep = "GGK-05-2-3-7040"
zs = zero_set(need, keep_art=keep)
out = [{**r, **ZERO} if i in zs else r for i, r in enumerate(rows)]
kept = [r for r in rows if day(r) == D19 and r["art"] == keep]
write("vKeep", out, f"19.10 zero {len(zs)} of {n19} = {len(zs) / n19 * 100:.2f}%, kept non-zero {keep} = {kept[0]['gap_pct'] if kept else None}")

for v, k in (("vN50", 50), ("vN49", 49)):
    keepi = set(ordered[:k])
    out = []
    for i, r in enumerate(rows):
        if day(r) == D19:
            if i in keepi:
                out.append({**r, **ZERO})
        else:
            out.append(r)
    write(v, out, f"19.10 cut to {k} rows all zero, test-4 {sum(rows[i]['art'] in T4 for i in keepi)}, plan {sum(rows[i]['art'] in PLAN_ARTS for i in keepi)}")

G = ("2026-10-15", "GGK-02-3-3-80")
vp = [{**r, **ZERO} if (day(r), r["art"]) == G else r for r in rows]
after = [(day(r)[5:], r["gap_pct"]) for r in rows if r["art"] == G[1] and day(r) > G[0]]
write("vP", vp, f"glitch {G}, later days {after}")
vpf = [{**r, "no_site": True} if (day(r), r["art"]) == G else r for r in vp]
write("vPfix", vpf, "vP + no_site: true on the glitch row (documented procedure)")
Z = (D19, "GGK-02-3-3-80")
vzf = [{**r, "no_site": True} if (day(r), r["art"]) == Z else r for r in vz]
write("vZfix", vzf, "vZ + no_site: true on GGK-02-3-3-80 19.10")
