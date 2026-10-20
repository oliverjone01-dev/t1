"""Data variants for the audit of PR #489 (gap_manual.ndjson) on CURRENT data (last day 20.10).
Every variant = absolute symlinks to all repo data files + its own gap_daily.ndjson and (optionally) its own
gap_manual.ndjson. Writes only under argv[2]/<variant>/data.
Usage: python3 -I mkvar_gm.py <repo analytics-mvp/data> <scratch pb dir> <tests.json> <plan json>

  v0        as is, gap_manual = repo file (empty)
  v0x       as is, gap_manual absent
  vZ20      honest zero 20.10 at GGK-02-3-3-80 (test 4) and GGT-48-2-2-100-180 (plan)
  vZ20m     vZ20 + manual records for both (20.10)
  vZ20m1    vZ20 + manual record only for GGK-02-3-3-80 20.10 (chip of GGT-48 must stay)
  vZ19      honest zero 19.10 at both, 20.10 untouched; vZ19m: + manual records 19.10
  vMiss     vZ20 + records on keys absent from gap_daily (21.10 GGK-02-3-3-80; 20.10 GGK-02-3-3-8O - letter O)
  vBad      vZ20 + manual file: broken line, null, valid GGK-02-3-3-80 20.10, date 20.10.2026 for GGT-48
  vNZ       as is + manual record on a NON-ZERO row: GGK-02-3-3-80 18.10 (48.55) - real value silently removed?
  vDup      vZ20 + the same record twice (+ CRLF line) - counter of manual removals
  vSys13    every 13.10 row -> price == ours (system day at last-7); vSys12: 12.10 (last-8); vSysOld: 20.09
  vAll3     every 18.10, 19.10, 20.10 row -> price == ours (all last days system: GAP.days ends 17.10)
  vAll3old  vAll3 + every 11.10 row -> price == ours (old system day next to a run of recent ones)
  vFut      vMass-like system day 20.10 + one stray non-zero row dated 28.10 (window anchored on the max date)
  vKeep5    20.10: ceil(0.9 n) rows -> price == ours, GGK-02-3-3-80 kept at 5.0 (non-zero below the stop line)
  vZsib     honest zero 20.10 at GGM-02-2-1 (placebo, card shared with GGM-02-3-1 and GGM-17-1-1)
  vZsib19   honest zero 19.10 only at GGM-02-2-1
  vZsibL    honest zero 20.10 at GGL-01-M-2 (placebo without pair partners)
  vZsib5    GGM-02-2-1 at 5.0 on 20.10 (collapse below the stop line, not exactly zero)
  vZsibm    vZsib + manual record GGM-02-2-1 20.10 (procedure of the PR)
  vW15      20.10: ceil(0.15 n) rows -> price == ours, test-4 and plan first (warn zone)
  vMass     every 20.10 row -> price == ours (system day on the last day)
"""
import json
import math
import os
import sys

SRC, OUT, TESTS, PLAN = sys.argv[1:5]
SRC = os.path.abspath(SRC)
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]
t4 = json.load(open(TESTS, encoding="utf-8"))["тесты_цены"][0]
T4 = list(t4["тест"])
plan = json.load(open(PLAN, encoding="utf-8"))
PLAN_ARTS = sorted({p["art"] for p in plan.get("price", [])})
PRIO = set(T4) | set(PLAN_ARTS)
L, Y = "2026-10-20", "2026-10-19"
ZERO = {"site_to_seller": 1.0, "gap_pct": 0.0}
K, P = "GGK-02-3-3-80", "GGT-48-2-2-100-180"


def day(r):
    return str(r.get("date", ""))[:10]


def write(v, out_rows, note, manual=None, manual_raw=None, link_manual=True):
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
    mp = os.path.join(d, "gap_manual.ndjson")
    if manual is not None or manual_raw is not None:
        with open(mp, "w", encoding="utf-8", newline="") as f:
            if manual_raw is not None:
                f.write(manual_raw)
            else:
                for m in manual:
                    f.write(json.dumps(m, ensure_ascii=False) + "\n")
        mnote = f"manual {sum(1 for l in open(mp, encoding='utf-8') if l.strip())} lines"
    elif link_manual:
        os.symlink(os.path.join(SRC, "gap_manual.ndjson"), mp)
        mnote = "manual = repo file"
    else:
        mnote = "manual absent"
    print(f"{v:9} rows {len(out_rows):6}  {note}; {mnote}")


def inplace(keys, base=None, val=None):
    base = rows if base is None else base
    z = ZERO if val is None else {"gap_pct": val, "site_to_seller": round(1 - val / 100, 4)}
    return [{**r, **z} if (day(r), r["art"]) in keys else r for r in base]


def rec(d, a, reason="сбой витрины", by="ФЕНИКС проба"):
    return {"date": d, "art": a, "reason": reason, "by": by, "ts": "2026-10-20T12:00:00+03:00"}


def zero_days(ds, base=None):
    base = rows if base is None else base
    return [{**r, **ZERO} if day(r) in ds else r for r in base]


def zero_first(d, k, keep=None):
    idx = [i for i, r in enumerate(rows) if day(r) == d and r["art"] != keep]
    idx = sorted(idx, key=lambda i: (rows[i]["art"] not in PRIO, rows[i]["art"]))[:k]
    zs = set(idx)
    out = [{**r, **ZERO} if i in zs else r for i, r in enumerate(rows)]
    n = sum(day(r) == d for r in rows)
    return out, f"{d} zero {k} of {n} = {k / n * 100:.2f}%"


nL = sum(day(r) == L for r in rows)
write("v0", rows, "as is")
write("v0x", rows, "as is", link_manual=False)
vz20 = inplace({(L, K), (L, P)})
write("vZ20", vz20, "zero 20.10 at GGK-02-3-3-80 and GGT-48-2-2-100-180")
write("vZ20m", vz20, "vZ20", manual=[rec(L, K), rec(L, P)])
write("vZ20m1", vz20, "vZ20", manual=[rec(L, K)])
vz19 = inplace({(Y, K), (Y, P)})
write("vZ19", vz19, "zero 19.10 at both, 20.10 recovered")
write("vZ19m", vz19, "vZ19", manual=[rec(Y, K), rec(Y, P)])
write("vMiss", vz20, "vZ20", manual=[rec("2026-10-21", K), rec(L, "GGK-02-3-3-8O")])
bad = "{не json\nnull\n" + json.dumps(rec(L, K), ensure_ascii=False) + "\n" + json.dumps({"date": "20.10.2026", "art": P}, ensure_ascii=False) + "\n"
write("vBad", vz20, "vZ20", manual_raw=bad)
write("vNZ", rows, "as is (GGK-02-3-3-80 18.10 = 48.55)", manual=[rec("2026-10-18", K, reason="ошибочная запись")])
dup = json.dumps(rec(L, K), ensure_ascii=False)
write("vDup", vz20, "vZ20", manual_raw=dup + "\n" + dup + "\r\n")
write("vSys13", zero_days({"2026-10-13"}), "13.10 all price == ours")
write("vSys12", zero_days({"2026-10-12"}), "12.10 all price == ours")
write("vSysOld", zero_days({"2026-09-20"}), "20.09 all price == ours")
write("vAll3", zero_days({"2026-10-18", Y, L}), "18-20.10 all price == ours")
write("vAll3old", zero_days({"2026-10-11", "2026-10-18", Y, L}), "11.10 and 18-20.10 all price == ours")
stray = {**[r for r in rows if day(r) == L][0], "date": "2026-10-28", "snap": "утро"}
write("vFut", zero_days({L}) + [stray], f"20.10 all price == ours + stray row 28.10 ({stray['art']} {stray.get('gap_pct')})")
out, note = zero_first(L, math.ceil(0.9 * nL), keep=K)
out = inplace({(L, K)}, out, val=5.0)
write("vKeep5", out, note + ", GGK-02-3-3-80 = 5.0 on 20.10")
write("vZsib", inplace({(L, "GGM-02-2-1")}), "zero 20.10 at GGM-02-2-1")
write("vZsib19", inplace({(Y, "GGM-02-2-1")}), "zero 19.10 only at GGM-02-2-1")
write("vZsibL", inplace({(L, "GGL-01-M-2")}), "zero 20.10 at GGL-01-M-2")
write("vZsib5", inplace({(L, "GGM-02-2-1")}, val=5.0), "GGM-02-2-1 = 5.0 on 20.10")
write("vZsibm", inplace({(L, "GGM-02-2-1")}), "zero 20.10 at GGM-02-2-1", manual=[rec(L, "GGM-02-2-1")])
out, note = zero_first(L, math.ceil(0.15 * nL))
write("vW15", out, note)
write("vMass", zero_days({L}), f"20.10 all price == ours ({nL})")
