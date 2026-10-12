"""FENIKS probe fixture: closed-window verdict stability (writes only inside the given /tmp tree).
argv: <tree analytics-mvp root> <mode: s0|s1>
s0: no manual exclusions; prices of 4 "not reduced" products forced to base*0.9 for 10-08..10-11 so the
    rule has enough clean products; gap rows of 10-11 copied to 10-25 (data after window end);
    TODAY patched to 2026-10-27 (window 10-07..10-21 closed).
s1: s0 + CPC spend on 10-24 (after the window) for 4 clean test products.
"""
import json, sys, statistics
root, mode = sys.argv[1], sys.argv[2]
assert root.startswith("/tmp/"), root
tp = root + "/tools/tests/tests.json"
T = json.load(open(tp, encoding="utf-8"))
t4 = T["тесты_цены"][0]
t4["исключены"] = {}
with open(tp, "w", encoding="utf-8") as f:
    json.dump(T, f, ensure_ascii=False, indent=2)
start = t4["старт"]
# prices: force reduced price for products whose price was not reduced
fix = ["GGT-03-1-3-E-12080", "GGT-20-2-3-16080", "GGK-05-2-3-7040", "GGM-18-1-1-LED"]
pp = root + "/data/prices_daily.ndjson"
rows = [json.loads(l) for l in open(pp, encoding="utf-8") if l.strip()]
base = {}
for a in fix:
    xs = [float(r["price"]) for r in rows if r.get("offer") == a and "2026-09-23" <= r["d"] < start and float(r.get("price") or 0) > 0]
    base[a] = statistics.median(xs)
n = 0
for r in rows:
    if r.get("offer") in base and "2026-10-08" <= r["d"] <= "2026-10-11":
        r["price"] = round(base[r["offer"]] * 0.9)
        n += 1
with open(pp, "w", encoding="utf-8") as f:
    f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
print("prices forced:", n, {a: round(b) for a, b in base.items()})
# gap: copy 10-11 rows to 10-25
gp = root + "/data/gap_daily.ndjson"
g = [json.loads(l) for l in open(gp, encoding="utf-8") if l.strip()]
extra = [dict(r, date="2026-10-25") for r in g if str(r.get("date", ""))[:10] == "2026-10-11"]
with open(gp, "a", encoding="utf-8") as f:
    f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in extra)
print("gap rows added for 10-25:", len(extra))
# TODAY patch
bp = root + "/src/scripts/build-tests.ts"
src = open(bp, encoding="utf-8").read()
old = 'const TODAY = new Date().toISOString().slice(0, 10);'
assert old in src
src = src.replace(old, 'const TODAY = "2026-10-27";')
with open(bp, "w", encoding="utf-8") as f:
    f.write(src)
print("TODAY patched")
if mode == "s1":
    sku2art = json.load(open(root + "/data/sku_offer.json"))
    art2sku = {}
    for s, a in sku2art.items():
        art2sku.setdefault(a, s)
    post = ["GGM-16-2-3-LED", "GGL-05-XL-slim-2", "GGK-02-3-3-80", "GGK-05-2-3-7040"]
    ap = root + "/data/ads_sku_daily.ndjson"
    with open(ap, "a", encoding="utf-8") as f:
        for a in post:
            f.write(json.dumps({"d": "2026-10-24", "cid": "99999999", "sku": int(art2sku[a]), "sp": 50, "om": 0, "ca": 0}) + "\n")
    print("post-window CPC added for:", post)
