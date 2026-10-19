"""V1/V3/R1/X1: independent check of the iter4 «history» rule on the data files (read-only).
Usage: python3 -I datacheck.py <data_dir> <tests.json> <plan.json>
Independent of the TS code: the rule is re-derived from decisions.md 19.10 p.(5) text, not imported.
"""
import json
import sys
from collections import defaultdict

D, TESTS, PLAN = sys.argv[1], sys.argv[2], sys.argv[3]


def nd(p):
    out = []
    for l in open(p, encoding="utf-8"):
        l = l.strip()
        if l:
            out.append(json.loads(l))
    return out


def num(v):
    try:
        x = float(v)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


gap = nd(f"{D}/gap_daily.ndjson")
coinv = nd(f"{D}/coinv_daily.ndjson")
print(f"gap_daily rows {len(gap)}, coinv_daily rows {len(coinv)}")

# ---------- gap_daily
dup = defaultdict(int)
for r in gap:
    dup[(r["date"][:10], r["art"].strip())] += 1
print(f"gap: (date, art) with >1 row: {sum(1 for v in dup.values() if v > 1)}")

first_nz = {}
for r in gap:
    g = num(r.get("gap_pct"))
    if r.get("no_site") is True or g is None or g <= 0:
        continue
    a, d = r["art"].strip(), r["date"][:10]
    if a not in first_nz or d < first_nz[a]:
        first_nz[a] = d


def eq_ours(r):
    g, s = num(r.get("gap_pct")), num(r.get("site_to_seller"))
    return (g is not None and g == 0) or (s is not None and s >= 0.9999)


lab = [r for r in gap if r.get("no_site") is True]
lab_hist = [(r["date"], r["art"]) for r in lab if first_nz.get(r["art"].strip(), "9999") < r["date"][:10]]
print(f"gap: no_site labeled {len(lab)}; with history {len(lab_hist)} {lab_hist}")
for r in sorted(lab, key=lambda x: (x["date"], x["art"])):
    a = r["art"].strip()
    print(f"   {r['date']} {a:24} sku={r.get('sku')!s:12} first_nonzero={first_nz.get(a)}")
unl = [r for r in gap if r.get("no_site") is not True and eq_ours(r)]
unl_hist = [r for r in unl if first_nz.get(r["art"].strip(), "9999") < r["date"][:10]]
print(f"gap: price==ours WITHOUT label {len(unl)}; of them with history (= honest zero in series) {len(unl_hist)}")
tiny = [r for r in gap if (num(r.get("gap_pct")) or -1) > 0 and (num(r.get("gap_pct")) <= 0.01 or (num(r.get("site_to_seller")) or 0) >= 0.9999)]
neg = [r for r in gap if (num(r.get("gap_pct")) is not None and num(r.get("gap_pct")) < 0)]
low = [r for r in gap if (num(r.get("gap_pct")) is not None and 0 < num(r.get("gap_pct")) < 10)]
print(f"gap: 0<gap<=0.01 or sts>=0.9999 with gap>0: {len(tiny)}; negative gap: {len(neg)}; 0<gap<10: {len(low)}")

# ---------- coinv_daily
first_paid = {}
for r in coinv:
    v = r.get("coinv_paid_pct")
    if not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0:
        continue
    a, d = r["art"], r["date"]
    if a not in first_paid or d < first_paid[a]:
        first_paid[a] = d
clab = [r for r in coinv if r.get("no_site") is True]
clab_hist = [(r["date"], r["art"]) for r in clab if first_paid.get(r["art"], "9999") < r["date"]]
print(f"coinv: no_site labeled {len(clab)}; with history {len(clab_hist)} {clab_hist}")
for r in sorted(clab, key=lambda x: (x["date"], x["art"])):
    print(f"   {r['date']} {r['art']:24} sku={r.get('sku')!s:12} snap={r.get('snap')} first_paid={first_paid.get(r['art'])}")
czero = [r for r in coinv if isinstance(r.get("coinv_paid_pct"), (int, float)) and r.get("coinv_paid_pct") == 0]
print(f"coinv: coinv_paid_pct == 0 rows {len(czero)}")
both_lab = [(r["date"], r["art"]) for r in clab if r["date"] >= "2026-09-09"]

# ---------- cross-file: same (date, art) labeled in one file and valued in the other
gidx = {(r["date"][:10], r["art"].strip()): r for r in gap}
cidx = {(r["date"], r["art"]): r for r in coinv}
mism = []
for k, r in cidx.items():
    if r.get("no_site") is True and k in gidx and gidx[k].get("no_site") is not True:
        mism.append((k, "coinv no_site", "gap", gidx[k].get("gap_pct")))
for k, r in gidx.items():
    if r.get("no_site") is True and k in cidx and cidx[k].get("no_site") is not True:
        mism.append((k, "gap no_site", "coinv", cidx[k].get("coinv_paid_pct")))
print(f"X1 cross-file: same (date, art) 'нет данных' in one file, value in the other: {len(mism)}")
for m in sorted(mism):
    print("   ", m)

# ---------- test 4 and plan arts: history in both files (first nonzero date)
t = json.load(open(TESTS, encoding="utf-8"))
t4 = [x for x in t["тесты_цены"] if x["id"] == "price_cut_hold"][0]
p = json.load(open(PLAN, encoding="utf-8"))
plan_arts = sorted({(x.get("art") or x.get("артикул") or "") for x in p.get("price", [])} - {""})
print(f"test4 start {t4['старт']}: {len(t4['тест'])} arts; plan price arts: {len(plan_arts)}")
for a in t4["тест"] + plan_arts:
    print(f"   {a:24} gap_first_nonzero={first_nz.get(a)} coinv_first_paid={first_paid.get(a)}")

# ---------- R1: art with more than one non-empty SKU in gap_daily (re-publication under same art)
skus = defaultdict(list)
for r in sorted(gap, key=lambda x: x["date"]):
    s = str(r.get("sku") or "").strip()
    if s and (not skus[r["art"].strip()] or skus[r["art"].strip()][-1][1] != s):
        skus[r["art"].strip()].append((r["date"][:10], s, r.get("gap_pct"), r.get("no_site")))
multi = {a: v for a, v in skus.items() if len({s for _, s, _, _ in v}) > 1}
print(f"R1: arts with >1 distinct SKU in gap_daily: {len(multi)}")
for a, v in sorted(multi.items())[:15]:
    print("   ", a, v)
